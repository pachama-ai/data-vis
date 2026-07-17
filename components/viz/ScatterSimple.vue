<script setup lang="ts">
/**
 * ScatterSimple.vue – Streudiagramm EE-Anteil vs. CO₂-Intensität.
 *
 * Zeigt tägliche Datenpunkte (EE-Anteil % vs. CO₂ g/kWh) als
 * Scatter-Plot über alle Jahre oder ein einzelnes Jahr.
 * Datenbasis: scatterDaily aus visualization-data.json.
 *
 * Vue/D3-Trennung nach Vorlesungsmuster (Kapitel 8.5):
 * - Vue: Container-Ref, Jahresauswahl, Tooltip, Leerzustände
 * - D3: SVG, Skalen, Achsen, Punkte, Trendlinie
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import type { ScatterDailyPoint } from '~/types/visualization-data'

const props = defineProps<{ data: ScatterDailyPoint[] }>()

// ── Von Vue verwaltete Zustände ──
const availableYears = computed(() => {
  const set = new Set<number>()
  for (const d of props.data) {
    const y = Number(d.date.slice(0, 4))
    if (!isNaN(y)) set.add(y)
  }
  return [...set].sort((a, b) => a - b)
})

type YearSelection = 'all' | number
const selectedYear = ref<YearSelection>('all')

function onYearChange(event: Event) {
  const el = event.target
  if (!(el instanceof HTMLSelectElement)) return
  selectedYear.value = el.value === 'all' ? 'all' : Number(el.value)
}

const visibleData = computed(() => {
  if (selectedYear.value === 'all') return props.data
  return props.data.filter((d) => Number(d.date.slice(0, 4)) === selectedYear.value)
})

const tooltip = ref<TooltipState | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)

interface TooltipState {
  date: string
  eeShare: string
  co2: string
  hours: number
  clientX: number
  clientY: number
}

// ── Feste Domains ──
// EE-Anteil ~13–84 %, CO₂ ~131–636 g/kWh → [0, 100] × [100, 650] mit Puffer.
// Feste Domains ermöglichen den Vergleich zwischen Jahren und Auswahloptionen.
const X_DOMAIN: [number, number] = [0, 100]
const Y_DOMAIN: [number, number] = [100, 650]

const MARGIN = { top: 24, right: 24, bottom: 44, left: 56 }
const VIEW_W = 700
const VIEW_H = 480
const INNER_W = VIEW_W - MARGIN.left - MARGIN.right
const INNER_H = VIEW_H - MARGIN.top - MARGIN.bottom

// ── D3-Interna ──
let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

// ── Lifecycle ──
onMounted(() => { updateChart() })
onBeforeUnmount(() => {
  svg?.remove()
  svg = null
})

watch([() => props.data, selectedYear], () => { updateChart() }, { flush: 'post' })

// ── Initialisierung (höchstens einmal) ──
function initializeChart(): void {
  if (!chartContainer.value || svg) return

  const created = d3.create('svg')
    .attr('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'Streudiagramm EE-Anteil gegen CO\u2082-Intensit\u00e4t')

  created.append('g').attr('class', 'grid-g')
  created.append('g').attr('class', 'x-axis-g')
  created.append('g').attr('class', 'y-axis-g')
  created.append('g').attr('class', 'axis-titles-g')
  created.append('g').attr('class', 'points-g')
  created.append('g').attr('class', 'trend-g')
  created.append('rect').attr('class', 'tooltip-rect')

  chartContainer.value.appendChild(created.node()!)
  svg = created
}

// ── Diagramm aktualisieren ──
function updateChart(): void {
  initializeChart()
  if (!svg) return

  const points = visibleData.value
  if (!points.length) {
    svg.select('.points-g').html('')
    svg.select('.trend-g').html('')
    return
  }

  const xScale = d3.scaleLinear().domain(X_DOMAIN).range([0, INNER_W])
  const yScale = d3.scaleLinear().domain(Y_DOMAIN).range([INNER_H, 0])

  updateGrid(xScale, yScale)
  updateAxes(xScale, yScale)
  updateAxisTitles()
  updatePoints(points, xScale, yScale)
  updateTrendLine(points, xScale, yScale)
  updateTooltipRect(svg, points, xScale, yScale)
}

function updateGrid(xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.grid-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  g.append('g').call(d3.axisBottom(xScale).tickSize(INNER_H).tickFormat(null))
    .attr('color', '#E5E5E5').attr('stroke-dasharray', '3,3')
  g.append('g').call(d3.axisLeft(yScale).tickSize(-INNER_W).tickFormat(null))
    .attr('color', '#E5E5E5').attr('stroke-dasharray', '3,3')
}

function updateAxes(xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>): void {
  if (!svg) return

  const xG = svg.select<SVGGElement>('.x-axis-g'); xG.html('')
  xG.attr('transform', `translate(${MARGIN.left},${MARGIN.top + INNER_H})`)
  xG.call(d3.axisBottom(xScale).ticks(6))
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('color', 'var(--fg-muted)')

  const yG = svg.select<SVGGElement>('.y-axis-g'); yG.html('')
  yG.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  yG.call(d3.axisLeft(yScale).ticks(6))
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('color', 'var(--fg-muted)')
}

function updateAxisTitles(): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.axis-titles-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  g.append('text').attr('x', INNER_W / 2).attr('y', INNER_H + 34)
    .attr('text-anchor', 'middle').attr('font-family', 'var(--font-sans)')
    .attr('font-size', '12px').attr('fill', 'var(--fg-muted)')
    .text('EE-Anteil (%) \u2192')

  g.append('text').attr('x', -INNER_H / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('font-family', 'var(--font-sans)')
    .attr('font-size', '12px').attr('fill', 'var(--fg-muted)')
    .attr('transform', 'rotate(-90)')
    .text('CO\u2082-Intensit\u00e4t (g/kWh) \u2192')
}

function updatePoints(
  points: ScatterDailyPoint[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.points-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  g.selectAll<SVGCircleElement, ScatterDailyPoint>('circle')
    .data(points, (d: ScatterDailyPoint) => d.date)
    .join('circle')
    .attr('cx', (d) => xScale(d.renewableSharePercent))
    .attr('cy', (d) => yScale(d.co2GramsPerKwh))
    .attr('r', 3).attr('fill', '#4A90A4').attr('opacity', 0.3).attr('stroke', 'none')
}

// ── Trendlinie (lineare Regression) ──
// Zeigt den statistischen Zusammenhang, keine Kausalität.
interface TrendLine { slope: number; intercept: number }

function calculateTrendLine(points: ScatterDailyPoint[]): TrendLine | null {
  if (points.length < 2) return null
  const n = points.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (const d of points) {
    const x = d.renewableSharePercent; const y = d.co2GramsPerKwh
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null
  return { slope, intercept }
}

function updateTrendLine(
  points: ScatterDailyPoint[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.trend-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const trend = calculateTrendLine(points)
  if (!trend) return

  const x0 = X_DOMAIN[0], x1 = X_DOMAIN[1]
  const y0 = trend.slope * x0 + trend.intercept
  const y1 = trend.slope * x1 + trend.intercept
  const clampY = (y: number) => Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y))

  g.append('line')
    .attr('x1', xScale(x0)).attr('y1', yScale(clampY(y0)))
    .attr('x2', xScale(x1)).attr('y2', yScale(clampY(y1)))
    .attr('stroke', '#B85C8E').attr('stroke-width', 2).attr('stroke-dasharray', '4,3')
}

function updateTooltipRect(
  svgEl: d3.Selection<SVGSVGElement, undefined, null, undefined>,
  points: ScatterDailyPoint[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
): void {
  const sortedByX = [...points].sort((a, b) => a.renewableSharePercent - b.renewableSharePercent)
  const bisectX = d3.bisector<ScatterDailyPoint, number>((d) => d.renewableSharePercent).center

  const rect = svgEl.select<SVGRectElement>('.tooltip-rect')
  rect.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    .attr('width', INNER_W).attr('height', INNER_H)
    .attr('fill', 'none').attr('pointer-events', 'all')

  rect.on('mousemove', (event: MouseEvent) => {
    const [mx] = d3.pointer(event)
    const xVal = xScale.invert(mx)
    const i = bisectX(sortedByX, xVal)
    const d = sortedByX[i]
    if (!d) return

    // Highlight
    const circlesG = svgEl.select('.points-g')
    circlesG.selectAll('circle').attr('stroke', null).attr('stroke-width', null)
    circlesG.selectAll('circle').filter((p: unknown) => (p as ScatterDailyPoint).date === d.date)
      .attr('stroke', '#333').attr('stroke-width', 1.5)

    tooltip.value = {
      date: d.date,
      eeShare: d.renewableSharePercent.toFixed(1) + ' %',
      co2: Math.round(d.co2GramsPerKwh) + ' g/kWh',
      hours: d.availableHourCount,
      clientX: event.clientX + 14,
      clientY: Math.max(8, event.clientY - 80),
    }
  })

  rect.on('mouseleave', () => {
    svgEl.select('.points-g').selectAll('circle').attr('stroke', null).attr('stroke-width', null)
    tooltip.value = null
  })
}
</script>

<template>
  <div v-if="!data.length" class="scatter-empty">
    Keine Tagesdaten f\u00fcr das Streudiagramm verf\u00fcgbar.
  </div>
  <div v-else class="scatter-card">
    <div class="scatter-header">
      <h3 class="scatter-heading">EE-Anteil vs. CO\u2082-Intensit\u00e4t</h3>
      <div class="scatter-controls">
        <span class="control-label">Jahr:</span>
        <select :value="selectedYear" class="scatter-select" @change="onYearChange">
          <option value="all">Alle Jahre</option>
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>
    <p class="scatter-subtitle">T\u00e4gliche Messwerte | Feste Achsenspannen f\u00fcr alle Jahre</p>

    <div v-if="visibleData.length === 0" class="scatter-empty">
      F\u00fcr das ausgew\u00e4hlte Jahr sind keine Tagesdaten verf\u00fcgbar.
    </div>
    <div v-else class="scatter-chart-wrap">
      <div ref="chartContainer"></div>
    </div>

    <!-- Tooltip (Vue, nicht D3) -->
    <div
      v-if="tooltip"
      class="scatter-tooltip"
      :style="{ left: tooltip.clientX + 'px', top: tooltip.clientY + 'px' }"
    >
      <div style="font-weight:600;margin-bottom:4px">{{ tooltip.date }}</div>
      <div>EE-Anteil: {{ tooltip.eeShare }}</div>
      <div>CO\u2082: {{ tooltip.co2 }}</div>
      <div style="color:var(--fg-muted)">{{ tooltip.hours }} verf\u00fcgbare Stunden</div>
    </div>
  </div>
</template>

<style scoped>
.scatter-card { width:100%; }
.scatter-empty { padding:40px 16px; text-align:center; color:var(--fg-muted); font-family:var(--font-sans); font-size:14px; }
.scatter-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:4px; }
.scatter-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.scatter-subtitle { font-family:var(--font-sans); font-size:13px; color:var(--fg-muted); margin:4px 0 16px; }
.scatter-controls { display:flex; align-items:center; gap:8px; }
.control-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); }
.scatter-select { font-family:var(--font-sans); font-size:13px; padding:4px 8px; border:1px solid var(--hairline); border-radius:6px; background:var(--bg); color:var(--fg); cursor:pointer; }
.scatter-chart-wrap { width:100%; }
.scatter-chart-wrap svg { width:100%; height:auto; display:block; }
.scatter-tooltip {
  position: fixed;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  line-height: 1.5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  font-family: var(--font-sans);
}
</style>
