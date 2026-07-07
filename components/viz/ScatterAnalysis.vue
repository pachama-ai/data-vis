<script setup lang="ts">
/**
 * components/viz/ScatterAnalysis.vue
 * ===================================
 * Scatterplot: Zusammenhang zwischen X und CO₂-Intensität.
 * Mit Play/Pause-Zeitsteuerung ueber 3-Monats-Phasen (2015-2024).
 */

import { ref, computed, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{ data: HourlyRow[] }>()

// ----------------------------------------------------------------
// Achsen
// ----------------------------------------------------------------
interface AxisOption {
  key: string; label: string; unit: string
  value: (row: HourlyRow) => number
}

const X_OPTIONS: AxisOption[] = [
  { key: 'ee_share',     label: 'Anteil erneuerbarer Energien', unit: '%',      value: (r) => r.ee_share },
  { key: 'fossil_share', label: 'Anteil fossiler Energien',     unit: '%',      value: (r) => r.fossil_share },
  { key: 'load',         label: 'Stromnachfrage',               unit: 'GW',     value: (r) => r.load_mwh / 1000 },
  { key: 'price',        label: 'Strompreis',                   unit: '€/MWh',  value: (r) => r.price_eur_mwh },
]

const xAxis = ref<AxisOption>(X_OPTIONS[0])

// ----------------------------------------------------------------
// 3-Monats-Phasen (2015-2024, 40 Phasen)
// ----------------------------------------------------------------
const QUARTERS = [
  { label: 'Jan–Mrz', mStart: 0, mEnd: 2 },
  { label: 'Apr–Jun', mStart: 3, mEnd: 5 },
  { label: 'Jul–Sep', mStart: 6, mEnd: 8 },
  { label: 'Okt–Dez', mStart: 9, mEnd: 11 },
]

interface Phase {
  year: number
  quarterIdx: number
  label: string
  startDate: Date
  endDate: Date
}

const PHASES: Phase[] = []
for (let y = 2015; y <= 2024; y++) {
  for (let q = 0; q < 4; q++) {
    const qq = QUARTERS[q]
    PHASES.push({
      year: y,
      quarterIdx: q,
      label: `${qq.label} ${y}`,
      startDate: new Date(Date.UTC(y, qq.mStart, 1)),
      endDate: new Date(Date.UTC(y, qq.mEnd + 1, 0, 23, 59, 59)),
    })
  }
}

const totalPhases = PHASES.length // 40

// ----------------------------------------------------------------
// Play/Pause State
// ----------------------------------------------------------------
type PlayState = 'idle' | 'playing' | 'paused'
const playState = ref<PlayState>('idle')
const currentPhase = ref(0)
let animTimer: ReturnType<typeof setInterval> | null = null

function togglePlay() {
  if (playState.value === 'playing') {
    // Pause
    playState.value = 'paused'
    if (animTimer) { clearInterval(animTimer); animTimer = null }
  } else {
    // Play or resume
    if (playState.value === 'idle') {
      currentPhase.value = 0
    }
    playState.value = 'playing'
    animTimer = setInterval(() => {
      if (currentPhase.value < totalPhases - 1) {
        currentPhase.value++
      } else {
        // Stop am Ende
        playState.value = 'paused'
        if (animTimer) { clearInterval(animTimer); animTimer = null }
      }
    }, 1500)
  }
}

function resetPlay() {
  if (animTimer) { clearInterval(animTimer); animTimer = null }
  playState.value = 'idle'
  currentPhase.value = 0
}

function goToPhase(idx: number) {
  if (idx < 0) idx = 0
  if (idx >= totalPhases) idx = totalPhases - 1
  currentPhase.value = idx
}

onUnmounted(() => {
  if (animTimer) clearInterval(animTimer)
})

// ----------------------------------------------------------------
// Aktuelle Phase
// ----------------------------------------------------------------
const phaseInfo = computed(() => PHASES[currentPhase.value])

// ----------------------------------------------------------------
// Datenpunkte fuer aktuelle Phase
// ----------------------------------------------------------------
interface Point { x: number; y: number; isOutlier: boolean }

const phasePoints = computed<Point[]>(() => {
  const xFn = xAxis.value.value
  const p = phaseInfo.value
  const start = p.startDate.getTime()
  const end = p.endDate.getTime()

  const rows = props.data.filter((r) => {
    const t = new Date(r.timestamp).getTime()
    return t >= start && t <= end
  })

  const all = rows.map((r) => ({ x: xFn(r), y: r.co2_g_per_kwh }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))

  const n = all.length; if (n === 0) return []
  const mX = all.reduce((s, p) => s + p.x, 0) / n
  const mY = all.reduce((s, p) => s + p.y, 0) / n
  const sX = Math.sqrt(all.reduce((s, p) => s + (p.x - mX) ** 2, 0) / n)
  const sY = Math.sqrt(all.reduce((s, p) => s + (p.y - mY) ** 2, 0) / n)
  const t = 2
  return all.map((p) => ({ x: p.x, y: p.y, isOutlier: Math.abs(p.x - mX) > t * sX || Math.abs(p.y - mY) > t * sY }))
})

// ----------------------------------------------------------------
// Regression + Korrelation (pro Phase)
// ----------------------------------------------------------------
const phaseStats = computed(() => {
  const pts = phasePoints.value; const n = pts.length
  if (n < 3) return { r: 0, r2: 0, a: 0, b: 0, count: n, direction: '—', strength: '—' }
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0
  for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; sy2 += p.y * p.y }
  const rNum = n * sxy - sx * sy
  const rDen = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  const r = rDen === 0 ? 0 : rNum / rDen
  const aD = n * sx2 - sx * sx
  const a = aD === 0 ? 0 : rNum / aD
  const b = (sy - a * sx) / n

  const direction = r > 0.05 ? 'positiv' : r < -0.05 ? 'negativ' : 'keine'
  const absR = Math.abs(r)
  const strength = absR > 0.7 ? 'stark' : absR > 0.4 ? 'moderat' : absR > 0.1 ? 'schwach' : 'keine'

  return {
    r: Math.round(r * 100) / 100,
    r2: Math.round(r * r * 100) / 100,
    a: Math.round(a * 1000) / 1000,
    b: Math.round(b * 100) / 100,
    count: n,
    direction,
    strength,
  }
})

// Auswertungstext
const auswertungText = computed(() => {
  const s = phaseStats.value
  const xLabel = xAxis.value.label.toLowerCase()
  if (s.count < 3) return `In dieser Phase (${phaseInfo.value.label}) liegen zu wenige Datenpunkte für eine aussagekräftige Analyse vor.`
  let text = `In der Phase ${phaseInfo.value.label} zeigt sich ein ${s.direction === 'keine' ? '' : s.direction + 'er '}Zusammenhang zwischen ${xLabel} und der CO₂-Intensität (r = ${s.r}). `
  if (s.strength !== 'keine') {
    text += `Der Zusammenhang ist ${s.strength} ausgeprägt. `
    if (s.direction === 'negativ') {
      text += `Das bedeutet: Ein höherer ${xLabel} geht tendenziell mit einer niedrigeren CO₂-Intensität einher.`
    } else {
      text += `Das bedeutet: Ein höherer ${xLabel} geht tendenziell mit einer höheren CO₂-Intensität einher.`
    }
  } else {
    text += `Es ist kein klarer linearer Zusammenhang erkennbar.`
  }
  return text
})

// ----------------------------------------------------------------
// HighlightOutliers
// ----------------------------------------------------------------
const highlightOutliers = ref(false)

// ----------------------------------------------------------------
// D3 + Canvas Refs
// ----------------------------------------------------------------
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<SVGSVGElement | null>(null)

// ----------------------------------------------------------------
// Chart-Masse
// ----------------------------------------------------------------
const MARGIN = { top: 20, right: 90, bottom: 40, left: 65 }
const WIDTH = 700
const HEIGHT = 430
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------
watchEffect(() => {
  const pts = phasePoints.value
  if (!pts.length || !canvasRef.value || !overlayRef.value) return

  const xExtent = d3.extent(pts, (p) => p.x) as [number, number]
  const yExtent = d3.extent(pts, (p) => p.y) as [number, number]
  const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 1
  const yPad = (yExtent[1] - yExtent[0]) * 0.05 || 1

  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([0, INNER_W])

  const yScale = d3.scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .range([INNER_H, 0])

  // Canvas: Punkte
  const canvas = canvasRef.value
  canvas.width = INNER_W
  canvas.height = INNER_H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, INNER_W, INNER_H)

  const pointColor = '#2563eb'
  const alpha = pts.length > 5000 ? 0.15 : pts.length > 1000 ? 0.25 : 0.4
  const radius = highlightOutliers.value ? 2.5 : 2

  for (const p of pts) {
    const cx = xScale(p.x); const cy = yScale(p.y)
    if (cx < -5 || cx > INNER_W + 5 || cy < -5 || cy > INNER_H + 5) continue
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    if (highlightOutliers.value && p.isOutlier) {
      ctx.fillStyle = '#3b82f6'; ctx.globalAlpha = 0.6; ctx.fill()
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.8; ctx.stroke()
    } else if (highlightOutliers.value) {
      ctx.fillStyle = pointColor; ctx.globalAlpha = alpha * 0.3; ctx.fill()
    } else {
      ctx.fillStyle = pointColor; ctx.globalAlpha = alpha; ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // SVG-Overlay: Achsen, Regression
  const svg = d3.select(overlayRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', WIDTH).attr('height', HEIGHT)
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  const chart = svg.append('g')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  // X-Achse
  const xAxisGen = d3.axisBottom(xScale).ticks(8)
  chart.append('g')
    .attr('transform', `translate(0, ${INNER_H})`)
    .call(xAxisGen)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // Y-Achse
  const yAxisGen = d3.axisLeft(yScale).ticks(6)
  chart.append('g')
    .call(yAxisGen)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // Achsenbeschriftungen
  chart.append('text')
    .attr('x', INNER_W / 2).attr('y', INNER_H + 32)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px').attr('fill', '#6b7280')
    .text(`${xAxis.value.label} (${xAxis.value.unit})`)

  chart.append('text')
    .attr('x', -35).attr('y', 12)
    .attr('font-size', '11px').attr('fill', '#6b7280')
    .text('CO₂-Intensität (g/kWh)')

  // Regressionslinie
  const { a, b } = phaseStats.value
  if (Number.isFinite(a) && Number.isFinite(b)) {
    const xMin = xScale.domain()[0]; const xMax = xScale.domain()[1]
    const regPoints: [number, number][] = [[xScale(xMin), yScale(a * xMin + b)], [xScale(xMax), yScale(a * xMax + b)]]
    const regLine = d3.line()
    chart.append('path').datum(regPoints).attr('d', regLine).attr('fill', 'none')
      .attr('stroke', '#1a1a1a').attr('stroke-width', 1.5).attr('opacity', 0.6).attr('stroke-dasharray', '4,3')
  }
})
</script>

<template>
  <div class="scatter-card">
    <div class="scatter-header">
      <div class="scatter-title">
        <span class="scatter-number">2</span>
        <span class="scatter-heading">Einflussfaktoren der CO₂-Intensität</span>
      </div>
    </div>
    <p class="scatter-subtitle">Wie verändern Strommix, Nachfrage, Preis und Tageszeit die Klimabilanz des Stroms?</p>

    <!-- Dropdowns -->
    <div class="axis-controls">
      <div class="axis-picker">
        <span class="axis-label">X = möglicher Einfluss:</span>
        <select v-model="xAxis" class="axis-select">
          <option v-for="opt in X_OPTIONS" :key="opt.key" :value="opt">{{ opt.label }} ({{ opt.unit }})</option>
        </select>
      </div>
      <div class="axis-picker y-fixed">
        <span class="axis-label">Y = CO₂-Intensität:</span>
        <span class="y-fixed-label">g CO₂ pro kWh Strom</span>
      </div>
    </div>

    <!-- Zeitsteuerung: Play/Pause + Phasen -->
    <div class="timeline-section">
      <div class="timeline-controls">
        <button class="play-btn" @click="togglePlay" :title="playState === 'playing' ? 'Pause' : 'Abspielen'">
          {{ playState === 'playing' ? '⏸' : '▶' }}
        </button>
        <button class="reset-btn" @click="resetPlay" title="Zurücksetzen">⏹</button>
        <span class="phase-label">{{ phaseInfo.label }}</span>
        <span class="phase-count">{{ currentPhase + 1 }} / {{ totalPhases }}</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-filled" :style="{ width: `${((currentPhase + 1) / totalPhases) * 100}%` }"></div>
        <input type="range" class="timeline-range" :min="0" :max="totalPhases - 1" :value="currentPhase"
          @input="goToPhase(Number(($event.target as HTMLInputElement).value))" />
      </div>
    </div>

    <!-- Chart: Canvas + SVG-Overlay -->
    <div ref="containerRef" class="scatter-chart-wrap">
      <svg ref="overlayRef" class="scatter-overlay"></svg>
      <canvas ref="canvasRef" class="scatter-canvas"></canvas>
    </div>

    <!-- Auswertungsbox -->
    <div class="auswertung-box">
      <div class="auswertung-header">Auswertung für {{ phaseInfo.label }}</div>
      <p class="auswertung-text">{{ auswertungText }}</p>
      <div class="auswertung-stats">
        <span>n = {{ phaseStats.count.toLocaleString('de-DE') }} Std.</span>
        <span>r = {{ phaseStats.r }}</span>
        <span>r² = {{ phaseStats.r2 }}</span>
        <span>Richtung: {{ phaseStats.direction }}</span>
        <span>Stärke: {{ phaseStats.strength }}</span>
      </div>
    </div>

    <!-- Besondere Stunden -->
    <div class="outlier-toggle">
      <label class="toggle-label">
        <input type="checkbox" v-model="highlightOutliers" />
        <span>Besondere Stunden hervorheben</span>
        <span class="info-tip" title="Besondere Stunden sind Werte, die statistisch deutlich vom Durchschnitt abweichen. Technisch: mehr als 2 Standardabweichungen.">ⓘ</span>
      </label>
    </div>

  </div>
</template>

<style scoped>
.scatter-card {
  width: 100%;
}

.scatter-header {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.scatter-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scatter-number {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-muted);
  opacity: 0.5;
  margin-right: 6px;
}

.scatter-heading {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg);
}

.scatter-subtitle {
  font-size: 0.8rem;
  color: var(--fg-muted);
  margin: 4px 0 14px;
  line-height: 1.4;
}

.axis-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.axis-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.axis-label {
  font-family: var(--font-sans);
  font-size: 0.65rem;
  color: var(--fg-muted);
  white-space: nowrap;
}

.axis-select {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  padding: 3px 6px;
  border: none;
  border-bottom: 1px solid var(--hairline);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  max-width: 220px;
}

.y-fixed {
  display: flex;
  align-items: center;
  gap: 6px;
}

.y-fixed-label {
  font-size: 0.78rem;
  color: var(--fg);
  display: flex;
  align-items: center;
  gap: 6px;
}



/* Timeline / Play-Steuerung */
.timeline-section {
  margin-bottom: 12px;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.play-btn, .reset-btn {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  width: 28px;
  height: 28px;
  border: 1px solid var(--hairline);
  border-radius: 0;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
  line-height: 1;
}

.play-btn:hover, .reset-btn:hover {
  color: var(--accent);
  border-color: var(--fg-muted);
}

.phase-label {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg);
  margin-left: 6px;
}

.phase-count {
  font-family: var(--font-sans);
  font-size: 0.65rem;
  color: var(--fg-muted);
  margin-left: auto;
  opacity: 0.6;
}

.timeline-track {
  position: relative;
  height: 4px;
  background: var(--hairline);
}

.timeline-filled {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--accent);
  pointer-events: none;
  z-index: 1;
}

.timeline-range {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  margin: 0;
  z-index: 2;
}

.timeline-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: pointer;
}

.timeline-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: pointer;
}

/* Ansichts-Auswahl */
.view-selector {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.view-label {
  font-size: 0.72rem;
  color: var(--fg-muted);
  margin-right: 6px;
  white-space: nowrap;
}

.view-btn {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.view-btn:hover { border-color: var(--accent); color: var(--fg); }
.view-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 500; }

/* Filter-Chips */
.filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.chip {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 3px 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.chip:hover { border-color: var(--accent); color: var(--fg); }
.chip.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 500; }

/* Lesebeispiel */
.lesebeispiel {
  font-size: 0.8rem;
  color: var(--fg);
  margin: 10px 0 12px;
  line-height: 1.5;
  font-style: italic;
}

/* Auswertungsbox */
.auswertung-box {
  background: transparent;
  border: none;
  border-top: 1px solid var(--hairline);
  padding: 10px 0;
  margin-bottom: 10px;
  font-size: 0.82rem;
  line-height: 1.5;
}

.auswertung-header {
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 6px;
}

.auswertung-text {
  margin: 4px 0 8px;
  color: var(--fg);
}

.auswertung-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.72rem;
  color: var(--fg-muted);
}

.correlation-help {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--fg-muted);
  line-height: 1.6;
}

.correlation-help summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--fg);
}

.correlation-help p {
  margin: 3px 0;
}

.corr-note {
  font-style: italic;
  color: #94a3b8;
}

.regression-detail {
  margin-top: 6px;
  font-size: 0.72rem;
  color: #94a3b8;
}

.regression-detail summary {
  cursor: pointer;
  color: #94a3b8;
}

/* Chart */
.scatter-chart-wrap {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 440px;
}

@media (max-width: 900px) {
  .scatter-chart-wrap { overflow-x: auto; }
}

.scatter-overlay {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 1;
  width: 100%;
  height: auto;
}

.scatter-canvas {
  position: absolute;
  top: 20px; left: 65px;
  z-index: 0;
  border-radius: 2px;
}

/* Besondere Stunden */
.outlier-toggle {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--hairline);
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: var(--fg-muted);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: var(--accent);
  width: 14px; height: 14px;
  cursor: pointer;
}

.info-tip {
  font-size: 0.8rem;
  color: var(--fg-muted);
  opacity: 0.5;
  cursor: help;
}

/* Hilfe / Hinweise */
.help-details, .science-hint {
  margin-top: 10px;
  font-size: 0.75rem;
  color: var(--fg-muted);
  line-height: 1.6;
}

.help-details summary, .science-hint summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--fg-muted);
}

.help-details p, .science-hint p {
  margin: 4px 0;
}
</style>
