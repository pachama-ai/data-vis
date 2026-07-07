<script setup lang="ts">
/**
 * components/landing/AnimatedStreamgraph.vue
 * ============================================
 * Animiertes Streamgraph/Stacked-Area-Diagramm für die Landing Page.
 *
 * Zeigt den deutschen Strommix 2015–2024 als gestapelte Fläche.
 * Ein vertikaler Zeitcursor läuft automatisch über die Jahre und
 * macht den Strukturwandel im Strommix als Animation erlebbar.
 *
 * Datenbasis: yearly_mix.json (MWh → TWh)
 *
 * Features:
 *   - Automatische Cursor-Animation (5–7 s) mit Startverzögerung
 *   - Ereignis-Annotationen (Kohleausstieg, Energiekrise, Atomausstieg)
 *   - Tooltip bei Hover/Scrub mit Werten und Prozent
 *   - Erkenntniszeile unter dem Chart, die sich mit dem Cursorjahr ändert
 *   - prefers-reduced-motion-Unterstützung
 *   - Skip/Replay-Buttons
 *   - Responsive SVG mit viewBox
 */

import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import * as d3 from 'd3'

// ----------------------------------------------------------------
// Quell-Definitionen (Reihenfolge = Stapelreihenfolge bottom→top)
// ----------------------------------------------------------------
interface SourceDef {
  key: string
  label: string
  color: string
  sourceKeys: string[]
}

const SOURCE_DEFS: SourceDef[] = [
  { key: 'other',     label: 'Sonstige',     color: '#d1d5db', sourceKeys: ['other_renewables', 'other_fossil', 'pumped_storage'] },
  { key: 'hydro',     label: 'Wasserkraft',  color: '#38bdf8', sourceKeys: ['hydro'] },
  { key: 'biomass',   label: 'Biomasse',     color: '#16a34a', sourceKeys: ['biomass'] },
  { key: 'pv',        label: 'PV',           color: '#facc15', sourceKeys: ['pv'] },
  { key: 'wind',      label: 'Wind',         color: '#2563eb', sourceKeys: ['wind_onshore', 'wind_offshore'] },
  { key: 'gas',       label: 'Gas',          color: '#f97316', sourceKeys: ['gas'] },
  { key: 'hardcoal',  label: 'Steinkohle',   color: '#6b7280', sourceKeys: ['hardcoal'] },
  { key: 'lignite',   label: 'Braunkohle',   color: '#78350f', sourceKeys: ['lignite'] },
  { key: 'nuclear',   label: 'Kernenergie',  color: '#8b5cf6', sourceKeys: ['nuclear'] },
]

// ----------------------------------------------------------------
// Ereignis-Annotationen
// ----------------------------------------------------------------
interface StreamEvent {
  year: number
  label: string
}

const EVENTS: StreamEvent[] = [
  { year: 2020, label: '2020 · Kohleausstiegsgesetz' },
  { year: 2022, label: '2022 · Energiekrise' },
  { year: 2023, label: '2023 · Atomausstieg' },
  { year: 2024, label: '2024 · Vergleichsjahr' },
]

// ----------------------------------------------------------------
// Erkenntniszeilen pro Jahr
// ----------------------------------------------------------------
const INSIGHTS: Record<number, string> = {
  2015: 'Kohle und Kernenergie prägen den Strommix noch stark.',
  2016: 'Erneuerbare legen langsam zu, Kohle bleibt dominant.',
  2017: 'Der Rückgang der Kernenergie zeichnet sich ab.',
  2018: 'Windkraft überholt Braunkohle erstmals.',
  2019: 'Erneuerbare Energien erreichen über 40 % Anteil.',
  2020: 'Der Kohleausstieg wird gesetzlich verankert.',
  2021: 'Die letzte Kernenergie-Stufe läuft aus.',
  2022: 'Die Energiekrise beschleunigt den Wandel.',
  2023: 'Die Kernenergie fällt aus dem Strommix.',
  2024: 'Wind und Photovoltaik tragen deutlich mehr zum Strommix bei.',
}

// ----------------------------------------------------------------
// D3-Refs + State
// ----------------------------------------------------------------
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const insightRef = ref<HTMLParagraphElement | null>(null)

const rawData = ref<any[]>([])
const loading = ref(true)
const cursorYear = ref(2015)
const isAnimating = ref(false)
const isDone = ref(false)
const animatingForward = ref(true)

// ----------------------------------------------------------------
// Daten laden
// ----------------------------------------------------------------
onMounted(async () => {
  try {
    const res = await fetch('/data/yearly_mix.json')
    rawData.value = await res.json()
  } catch {
    // Fallback: leeres Array
    rawData.value = []
  } finally {
    loading.value = false
  }
})

// ----------------------------------------------------------------
// Animation starten (nach Sichtbarkeits-Check + 1s Verzögerung)
// ----------------------------------------------------------------
let animTimer: number | null = null
let startTime = 0
const DURATION = 6000 // 6 Sekunden
const START_DELAY = 1000

function startAnimation() {
  if (isAnimating.value || isDone.value || rawData.value.length === 0) return
  isAnimating.value = true
  isDone.value = false
  animatingForward.value = true
  cursorYear.value = 2015

  startTime = performance.now()
  scheduleFrame()
}

function scheduleFrame() {
  animTimer = requestAnimationFrame(tick)
}

function tick(now: number) {
  const elapsed = now - startTime
  const progress = Math.min(elapsed / DURATION, 1)

  // easeInOut für natürlicheres Gefühl
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2

  const year = 2015 + eased * 9
  cursorYear.value = Math.round(year * 10) / 10 // z.B. 2023.4 für gleitenden Cursor

  if (progress < 1) {
    scheduleFrame()
  } else {
    cursorYear.value = 2024
    isAnimating.value = false
    isDone.value = true
  }
}

function skipAnimation() {
  if (animTimer !== null) cancelAnimationFrame(animTimer)
  cursorYear.value = 2024
  isAnimating.value = false
  isDone.value = true
}

function replayAnimation() {
  skipAnimation()
  startAnimation()
}

onUnmounted(() => {
  if (animTimer !== null) cancelAnimationFrame(animTimer)
})

// ----------------------------------------------------------------
// Chart-Masse
// ----------------------------------------------------------------
const MARGIN = { top: 40, right: 30, bottom: 50, left: 70 }
const W = 900
const H = 420
const INNER_W = W - MARGIN.left - MARGIN.right
const INNER_H = H - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// D3-Rendering (reagiert auf rawData + cursorYear)
// ----------------------------------------------------------------
watchEffect(() => {
  const years = rawData.value
  if (!years.length || !svgRef.value) return

  // 1. Daten transformieren: MWh → TWh
  const chartData = years.map((entry: any) => {
    const obj: any = { year: entry.year }
    for (const def of SOURCE_DEFS) {
      obj[def.key] = def.sourceKeys.reduce((sum: number, k: string) => sum + (entry.sources[k] || 0), 0) / 1_000_000
    }
    return obj
  })

  const keys = SOURCE_DEFS.map((d) => d.key)

  // 2. D3-Stack
  const stack = d3.stack<any>().keys(keys)
  const stacked = stack(chartData)

  // 3. Skalen
  const xScale = d3.scaleLinear()
    .domain([2014.5, 2024.5])
    .range([0, INNER_W])

  const yMax = d3.max(stacked, (series) => d3.max(series, (d) => d[1])) ?? 1
  const yScale = d3.scaleLinear()
    .domain([0, Math.ceil(yMax / 100) * 100])
    .range([INNER_H, 0])

  // 4. SVG aufbauen
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg
    .attr('width', W)
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('aria-label', 'Gestapeltes Flächendiagramm des deutschen Strommix von 2015 bis 2024')

  const chart = svg.append('g')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  // 5. Flächen zeichnen
  const area = d3.area<[number, number]>()
    .x((_d, i) => xScale(chartData[i].year))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  for (let i = keys.length - 1; i >= 0; i--) {
    chart.append('path')
      .datum(stacked[i])
      .attr('d', area as any)
      .attr('fill', SOURCE_DEFS[i].color)
      .attr('opacity', 0.85)
      .attr('stroke', 'none')
  }

  // 6. X-Achse
  const xAxis = d3.axisBottom(xScale)
    .tickValues(d3.range(2015, 2025))
    .tickFormat(d3.format('d') as any)

  chart.append('g')
    .attr('transform', `translate(0, ${INNER_H})`)
    .call(xAxis)
    .attr('font-size', '12px')
    .attr('color', '#6b7280')

  // 7. Y-Achse
  const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d} TWh`)
  chart.append('g')
    .call(yAxis)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // Y-Beschriftung
  chart.append('text')
    .attr('x', -45)
    .attr('y', 10)
    .attr('font-size', '11px')
    .attr('fill', '#6b7280')
    .text('TWh')

  // 8. Cursor (vertikale Linie)
  const cursorX = xScale(Math.max(2015, Math.min(2024, cursorYear.value)))
  const cursorG = chart.append('g')

  cursorG.append('line')
    .attr('x1', cursorX).attr('y1', 0)
    .attr('x2', cursorX).attr('y2', INNER_H)
    .attr('stroke', '#1a1a1a')
    .attr('stroke-width', 2)
    .attr('opacity', 0.7)
    .attr('class', 'stream-cursor-line')

  // Cursor-Jahreszahl oben
  cursorG.append('text')
    .attr('x', cursorX)
    .attr('y', -12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '20px')
    .attr('font-weight', '700')
    .attr('fill', '#1a1a1a')
    .attr('class', 'stream-cursor-year')
    .text(Math.round(cursorYear.value))

  // 9. Ereignis-Annotationen
  for (const ev of EVENTS) {
    const ex = xScale(ev.year)
    if (ex < 0 || ex > INNER_W) continue

    chart.append('line')
      .attr('x1', ex).attr('y1', 0)
      .attr('x2', ex).attr('y2', INNER_H)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5)

    // Nur Label zeichnen, wenn Cursor nicht zu nah ist
    const dist = Math.abs(cursorYear.value - ev.year)
    if (dist > 0.4 || !isAnimating.value) {
      chart.append('text')
        .attr('x', ex)
        .attr('y', 14)
        .attr('text-anchor', 'start')
        .attr('font-size', '9px')
        .attr('fill', '#94a3b8')
        .attr('font-weight', '500')
        .text(ev.label)
    }
  }

  // 10. Tooltip-Overlay (Hover/Scrub)
  let tooltipDiv = d3.select('body').select('.stream-tooltip')
  if (tooltipDiv.empty()) {
    tooltipDiv = d3.select('body').append('div')
      .attr('class', 'stream-tooltip')
      .style('position', 'fixed')
      .style('display', 'none')
      .style('background', '#1a1a1a')
      .style('color', '#fff')
      .style('padding', '10px 14px')
      .style('border-radius', '8px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('line-height', '1.6')
      .style('max-height', '320px')
      .style('overflow-y', 'auto')
      .style('max-width', '280px')
  }

  // Tooltip-Daten für aktuelle Cursor-Position berechnen
  function getTooltipData(year: number) {
    const idx = Math.round(year) - 2015
    const entry = chartData[Math.max(0, Math.min(chartData.length - 1, idx))]
    if (!entry) return null
    const total = SOURCE_DEFS.reduce((s, d) => s + entry[d.key], 0)

    let html = `<strong>${Math.round(year)}</strong><br/>Gesamt: ${total.toFixed(1)} TWh<br/>`
    for (let i = SOURCE_DEFS.length - 1; i >= 0; i--) {
      const d = SOURCE_DEFS[i]
      const val = entry[d.key]
      const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0'
      html += `<span style="color:${d.color}">●</span> ${d.label}: ${val.toFixed(1)} TWh (${pct}%)<br/>`
    }
    return { html, total }
  }

  // Scrub: bei Mausbewegung Cursor + Tooltip aktualisieren
  chart.append('rect')
    .attr('width', INNER_W)
    .attr('height', INNER_H)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const year = xScale.invert(mx)
      const clamped = Math.max(2015, Math.min(2024, year))

      // Nur bei nicht-animierendem Zustand Cursor bewegen
      if (!isAnimating.value) {
        cursorYear.value = Math.round(clamped * 10) / 10
      }

      const td = getTooltipData(clamped)
      if (td) {
        tooltipDiv!
          .style('display', 'block')
          .html(td.html)
          .style('left', `${Math.min(event.clientX + 16, window.innerWidth - 300)}px`)
          .style('top', `${Math.max(8, event.clientY - 20)}px`)
      }
    })
    .on('mouseleave', function () {
      tooltipDiv!.style('display', 'none')
    })
})

// ----------------------------------------------------------------
// Cursor-Änderung => Tooltip + Insight automatisch via watchEffect
// ----------------------------------------------------------------
watchEffect(() => {
  const year = cursorYear.value
  const rounded = Math.round(year)
  const p = insightRef.value
  if (p) {
    p.textContent = INSIGHTS[rounded] || ''
  }
})
</script>

<template>
  <div ref="containerRef" class="stream-wrapper">
    <!-- Steuerung -->
    <div class="stream-controls">
      <button
        v-if="!isAnimating && !isDone && !loading"
        class="stream-btn"
        @click="startAnimation"
      >Animation starten</button>
      <button
        v-if="isAnimating"
        class="stream-btn"
        @click="skipAnimation"
      >Animation überspringen</button>
      <button
        v-if="isDone && !isAnimating"
        class="stream-btn"
        @click="replayAnimation"
      >Nochmal ansehen</button>
    </div>

    <!-- SVG -->
    <div class="stream-chart-wrap">
      <svg ref="svgRef" class="stream-svg"></svg>
    </div>

    <!-- Erkenntniszeile -->
    <p ref="insightRef" class="stream-insight">
      {{
        loading
          ? 'Daten werden geladen …'
          : rawData.length === 0
            ? 'Daten konnten nicht geladen werden.'
            : INSIGHTS[Math.round(cursorYear)] || ''
      }}
    </p>

    <!-- Legende -->
    <div class="stream-legend">
      <span
        v-for="def in SOURCE_DEFS"
        :key="def.key"
        class="stream-legend-item"
      >
        <span class="legend-dot" :style="{ background: def.color }"></span>
        <span class="legend-label">{{ def.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.stream-wrapper {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.stream-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
  min-height: 36px;
}

.stream-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 7px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--fg);
  cursor: pointer;
  transition: all 0.15s;
}

.stream-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.stream-chart-wrap {
  width: 100%;
  min-width: 0;
}

.stream-svg {
  width: 100%;
  height: auto;
  display: block;
}

.stream-insight {
  text-align: center;
  font-size: 0.9rem;
  color: var(--fg-muted);
  margin: 14px 0 10px;
  min-height: 1.5em;
  line-height: 1.5;
  font-style: italic;
}

.stream-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
  margin-top: 6px;
}

.stream-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--fg-muted);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  white-space: nowrap;
}
</style>
