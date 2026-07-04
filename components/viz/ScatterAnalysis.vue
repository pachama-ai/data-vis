<script setup lang="ts">
/**
 * components/viz/ScatterAnalysis.vue
 * ===================================
 * Scatterplot fuer Zusammenhaenge zwischen verschiedenen Metriken.
 *
 * Der Nutzer kann X-Achse, Y-Achse und Farbkodierung frei waehlen.
 * Bis zu 84.987 Datenpunkte -> Performance-kritisch, daher Canvas.
 *
 * Features:
 *   - Drei Dropdowns fuer X, Y und Farbe
 *   - Canvas-Rendering fuer die Punkte (SVG nur fuer Achsen + Linie)
 *   - Regressionslinie (OLS) mit Korrelations-Statistiken
 *   - Ausreisser-Hervorhebung (Punkte > 2 Sigma)
 *   - Farb-Legende vertikal rechts
 */

import { ref, computed, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
const props = defineProps<{
  data: HourlyRow[]
}>()

// ----------------------------------------------------------------
// Achsen-Definitionen
// ----------------------------------------------------------------
interface AxisOption {
  key: string
  label: string
  unit: string
  /** Wert aus HourlyRow extrahieren */
  value: (row: HourlyRow) => number
}

const AXIS_OPTIONS: AxisOption[] = [
  { key: 'ee_share',       label: 'EE-Anteil',       unit: '%',         value: (r) => r.ee_share },
  { key: 'co2',            label: 'CO2-Intensitaet',  unit: 'g/kWh',    value: (r) => r.co2_g_per_kwh },
  { key: 'price',          label: 'Day-Ahead-Preis',  unit: 'EUR/MWh',  value: (r) => r.price_eur_mwh },
  { key: 'fossil_share',   label: 'Fossiler Anteil',  unit: '%',         value: (r) => r.fossil_share },
  { key: 'load',           label: 'Last',             unit: 'GW',        value: (r) => r.load_mwh / 1000 },
  { key: 'hour',           label: 'Stunde des Tages', unit: '',           value: (r) => new Date(r.timestamp).getUTCHours() },
]

const xAxis = ref<AxisOption>(AXIS_OPTIONS[0])  // EE-Anteil
const yAxis = ref<AxisOption>(AXIS_OPTIONS[1])  // CO2
const colorAxis = ref<AxisOption>(AXIS_OPTIONS[2])  // Preis

// ----------------------------------------------------------------
// Ausreisser-Modus
// ----------------------------------------------------------------
const highlightOutliers = ref(false)

// ----------------------------------------------------------------
// Datenpunkte berechnen
// ----------------------------------------------------------------
interface Point {
  x: number
  y: number
  colorVal: number
  isOutlier: boolean
}

const points = computed<Point[]>(() => {
  const rows = props.data
  const xFn = xAxis.value.value
  const yFn = yAxis.value.value
  const cFn = colorAxis.value.value

  // Mittelwert und StdAbw fuer Ausreisser
  const vals = rows.map((r) => ({ x: xFn(r), y: yFn(r) })).filter((v) => !isNaN(v.x) && !isNaN(v.y))
  const n = vals.length
  if (n === 0) return []

  const meanX = vals.reduce((s, v) => s + v.x, 0) / n
  const meanY = vals.reduce((s, v) => s + v.y, 0) / n
  const stdX = Math.sqrt(vals.reduce((s, v) => s + (v.x - meanX) ** 2, 0) / n)
  const stdY = Math.sqrt(vals.reduce((s, v) => s + (v.y - meanY) ** 2, 0) / n)
  const threshold = 2 // Sigma

  return vals.map((v, i) => ({
    x: v.x,
    y: v.y,
    colorVal: cFn(rows[i]),
    isOutlier: Math.abs(v.x - meanX) > threshold * stdX || Math.abs(v.y - meanY) > threshold * stdY,
  }))
})

// ----------------------------------------------------------------
// Regression und Korrelation
// ----------------------------------------------------------------
const stats = computed(() => {
  const pts = points.value
  const n = pts.length
  if (n < 3) return { r: 0, r2: 0, a: 0, b: 0, count: n }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (const p of pts) {
    sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x; sumY2 += p.y * p.y
  }

  // Pearson
  const rNum = n * sumXY - sumX * sumY
  const rDen = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  const r = rDen === 0 ? 0 : rNum / rDen

  // OLS Regression: y = a*x + b
  const aDen = n * sumX2 - sumX * sumX
  const a = aDen === 0 ? 0 : rNum / aDen
  const meanX = sumX / n
  const meanY = sumY / n
  const b = meanY - a * meanX

  return { r: Math.round(r * 100) / 100, r2: Math.round(r * r * 100) / 100, a: Math.round(a * 1000) / 1000, b: Math.round(b * 100) / 100, count: n }
})

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
  const pts = points.value
  if (!pts.length || !canvasRef.value || !overlayRef.value) return

  // Skalen
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

  // Farbskala
  const colorVals = pts.map((p) => p.colorVal).filter((v) => !isNaN(v))
  const cMin = d3.min(colorVals) ?? 0
  const cMax = d3.max(colorVals) ?? 1
  const colorScale = d3.scaleSequential(d3.interpolatePlasma)
    .domain([cMin, cMax])

  // --- Canvas: Punkte zeichnen ---
  const canvas = canvasRef.value
  canvas.width = INNER_W
  canvas.height = INNER_H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, INNER_W, INNER_H)

  // Performance: bei vielen Points mit kleinerem Alpha zeichnen
  const alpha = pts.length > 20000 ? 0.15 : pts.length > 5000 ? 0.25 : 0.35
  const radius = highlightOutliers.value ? 2.5 : 2

  for (const p of pts) {
    const cx = xScale(p.x)
    const cy = yScale(p.y)
    if (cx < -5 || cx > INNER_W + 5 || cy < -5 || cy > INNER_H + 5) continue

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)

    if (highlightOutliers.value && p.isOutlier) {
      // Ausreisser: schwarzer Rand + hellere Fuellung
      ctx.fillStyle = colorScale(p.colorVal)
      ctx.globalAlpha = 0.6
      ctx.fill()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.8
      ctx.stroke()
    } else if (highlightOutliers.value) {
      // Nicht-Ausreisser blasser
      ctx.fillStyle = colorScale(p.colorVal)
      ctx.globalAlpha = alpha * 0.3
      ctx.fill()
    } else {
      ctx.fillStyle = colorScale(p.colorVal)
      ctx.globalAlpha = alpha
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // --- SVG-Overlay: Achsen, Regression, Labels ---
  const svg = d3.select(overlayRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', WIDTH).attr('height', HEIGHT)

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
    .text(`${yAxis.value.label} (${yAxis.value.unit})`)

  // Regressionslinie
  const { a, b } = stats.value
  const xMin = xScale.domain()[0]
  const xMax = xScale.domain()[1]
  const regPoints: [number, number][] = [
    [xScale(xMin), yScale(a * xMin + b)],
    [xScale(xMax), yScale(a * xMax + b)],
  ]

  const regLine = d3.line()
  chart.append('path')
    .datum(regPoints)
    .attr('d', regLine)
    .attr('fill', 'none')
    .attr('stroke', '#1a1a1a')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.6)
    .attr('stroke-dasharray', '4,3')

  // Stats-Box rechts oben
  const statsBox = chart.append('g')
    .attr('transform', `translate(${INNER_W - 170}, 8)`)

  statsBox.append('rect')
    .attr('width', 165).attr('height', 72)
    .attr('fill', 'rgba(255,255,255,0.9)')
    .attr('rx', 4)
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 1)

  const statLines = [
    `Korrelation r: ${stats.value.r}`,
    `R²: ${stats.value.r2}`,
    `Datenpunkte: ${stats.value.count.toLocaleString('de-DE')}`,
    `Regression: y = ${a}x + ${b}`,
  ]

  for (let i = 0; i < statLines.length; i++) {
    statsBox.append('text')
      .attr('x', 8).attr('y', 16 + i * 15)
      .attr('font-size', '10px')
      .attr('fill', '#1a1a1a')
      .text(statLines[i])
  }

  // Farb-Legende vertikal rechts
  const legX = MARGIN.left + INNER_W + 50
  const legY = MARGIN.top + 200
  const legH = 140
  const legW = 12

  // Gradient fuer Farb-Legende
  const gradId = 'scatter-color-grad'
  const defs = svg.append('defs')
  const grad = defs.append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')

  const gradSteps = 10
  for (let i = 0; i <= gradSteps; i++) {
    const t = i / gradSteps
    grad.append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', colorScale(cMin + t * (cMax - cMin)))
  }

  svg.append('rect')
    .attr('x', legX).attr('y', legY)
    .attr('width', legW).attr('height', legH)
    .attr('rx', 2)
    .style('fill', `url(#${gradId})`)

  // Legenden-Beschriftung
  svg.append('text')
    .attr('x', legX + legW + 6).attr('y', legY)
    .attr('dominant-baseline', 'hanging')
    .attr('font-size', '9px').attr('fill', '#6b7280')
    .text(cMax.toFixed(1))

  svg.append('text')
    .attr('x', legX + legW + 6).attr('y', legY + legH)
    .attr('dominant-baseline', 'auto')
    .attr('font-size', '9px').attr('fill', '#6b7280')
    .text(cMin.toFixed(1))

  svg.append('text')
    .attr('x', legX).attr('y', legY - 6)
    .attr('font-size', '9px').attr('fill', '#6b7280')
    .text(colorAxis.value.label)
})
</script>

<template>
  <div class="scatter-card">
    <!-- Kopfzeile -->
    <div class="scatter-header">
      <div class="scatter-title">
        <span class="scatter-number">3</span>
        <span class="scatter-heading">Zusammenhaenge</span>
      </div>
    </div>

    <!-- Drei Dropdowns -->
    <div class="axis-controls">
      <div class="axis-picker">
        <span class="axis-label">X-Achse:</span>
        <select v-model="xAxis" class="axis-select">
          <option v-for="opt in AXIS_OPTIONS" :key="opt.key" :value="opt">
            {{ opt.label }} ({{ opt.unit }})
          </option>
        </select>
      </div>
      <div class="axis-picker">
        <span class="axis-label">Y-Achse:</span>
        <select v-model="yAxis" class="axis-select">
          <option v-for="opt in AXIS_OPTIONS" :key="opt.key" :value="opt">
            {{ opt.label }} ({{ opt.unit }})
          </option>
        </select>
      </div>
      <div class="axis-picker">
        <span class="axis-label">Farbe:</span>
        <select v-model="colorAxis" class="axis-select">
          <option v-for="opt in AXIS_OPTIONS" :key="opt.key" :value="opt">
            {{ opt.label }} ({{ opt.unit }})
          </option>
        </select>
      </div>
    </div>

    <!-- Chart: Canvas + SVG-Overlay -->
    <div ref="containerRef" class="scatter-chart-wrap">
      <svg ref="overlayRef" class="scatter-overlay"></svg>
      <canvas ref="canvasRef" class="scatter-canvas"></canvas>
    </div>

    <!-- Ausreisser-Toggle -->
    <div class="outlier-toggle">
      <label class="toggle-label">
        <input type="checkbox" v-model="highlightOutliers" />
        <span>Ausreisser hervorheben (&gt; 2 Sigma)</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Card
   ---------------------------------------------------------------- */
.scatter-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ----------------------------------------------------------------
   Kopfzeile
   ---------------------------------------------------------------- */
.scatter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.scatter-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scatter-number {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-muted);
  background: #f3f4f6;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.scatter-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg);
}

/* ----------------------------------------------------------------
   Axis-Controls (drei Dropdowns)
   ---------------------------------------------------------------- */
.axis-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.axis-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.axis-label {
  font-size: 0.75rem;
  color: var(--fg-muted);
  white-space: nowrap;
}

.axis-select {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  max-width: 200px;
}

/* ----------------------------------------------------------------
   Chart: Canvas + SVG uebereinander
   ---------------------------------------------------------------- */
.scatter-chart-wrap {
  position: relative;
  overflow-x: auto;
  min-height: 440px;
}

.scatter-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.scatter-canvas {
  position: absolute;
  top: 70px;    /* margin.top Versatz */
  left: 50px;   /* margin.left Versatz */
  z-index: 0;
  border-radius: 2px;
}

/* ----------------------------------------------------------------
   Ausreisser-Toggle
   ---------------------------------------------------------------- */
.outlier-toggle {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--fg-muted);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
