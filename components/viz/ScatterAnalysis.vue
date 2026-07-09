<script setup lang="ts">
/**
 * components/viz/ScatterAnalysis.vue
 * ===================================
 * Scatterplot: Zusammenhang zwischen X und CO₂-Intensität.
 * Mit Play/Pause-Zeitsteuerung über 6-Monats-Phasen (2015-2024, 20 Phasen).
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{ data: HourlyRow[] }>()

// ----------------------------------------------------------------
// Achsen-Optionen
// ----------------------------------------------------------------
interface AxisOption {
  key: string; label: string; unit: string
  value: (row: HourlyRow) => number
}

const X_OPTIONS: AxisOption[] = [
  { key: 'ee_share',     label: 'EE-Anteil',       unit: '%',      value: (r) => r.ee_share },
  { key: 'fossil_share', label: 'Fossil-Anteil',   unit: '%',      value: (r) => r.fossil_share },
  { key: 'load',         label: 'Stromnachfrage',   unit: 'GW',     value: (r) => r.load_mwh / 1000 },
  { key: 'price',        label: 'Strompreis',       unit: '€/MWh',  value: (r) => r.price_eur_mwh },
]

const xAxis = ref<AxisOption>(X_OPTIONS[0])

// Semantische Farben pro X-Achse
const AXIS_COLORS: Record<string, { fill: string; outline: string; trend: string; label: string; btnBg: string; opacity: number }> = {
  ee_share:     { fill: '#4A8A5F', outline: '#2D5A38', trend: '#1E3D26', label: '#4A8A5F', btnBg: '#4A8A5F', opacity: 0.40 },
  fossil_share: { fill: '#4A4A4A', outline: '#2A2A2A', trend: '#1A1A1A', label: '#4A4A4A', btnBg: '#4A4A4A', opacity: 0.40 },
  load:         { fill: '#3E7A9E', outline: '#2A5870', trend: '#1E4058', label: '#3E7A9E', btnBg: '#3E7A9E', opacity: 0.25 },
  price:        { fill: '#B8935A', outline: '#8A6A35', trend: '#6A5030', label: '#B8935A', btnBg: '#B8935A', opacity: 0.30 },
}
const axisColor = computed(() => AXIS_COLORS[xAxis.value.key] || AXIS_COLORS.ee_share)

// ----------------------------------------------------------------
// Zeitraum-Auswahl (Monats-Range-Slider)
// ----------------------------------------------------------------
const DATA_START = new Date(Date.UTC(2015, 0, 1))
const DATA_END = new Date(Date.UTC(2024, 11, 31, 23, 59, 59))
const TOTAL_MONTHS = 120 // Jan 2015 – Dez 2024

function monthToDate(m: number): Date {
  return new Date(Date.UTC(2015 + Math.floor(m / 12), m % 12, 1))
}
function dateToMonth(d: Date): number {
  return (d.getUTCFullYear() - 2015) * 12 + d.getUTCMonth()
}

const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

const selectedStartIdx = ref(0)
const selectedEndIdx = ref(23) // Default: 2015/16

const selectedStartDate = computed(() => monthToDate(selectedStartIdx.value))
const selectedEndDate = computed(() => monthToDate(selectedEndIdx.value + 1)) // exklusiv

const dateLabel = computed(() => {
  const s = selectedStartIdx.value
  const e = selectedEndIdx.value
  return `${MONTH_LABELS[s % 12]} ${2015 + Math.floor(s / 12)} – ${MONTH_LABELS[e % 12]} ${2015 + Math.floor(e / 12)}`
})

const rangeFillStyle = computed(() => {
  const total = TOTAL_MONTHS - 1
  const left = (selectedStartIdx.value / total) * 100
  const right = ((total - selectedEndIdx.value) / total) * 100
  return { left: `${left}%`, right: `${right}%` }
})

// Presets
const RANGE_PRESETS = [
  { label: 'Alles',     start: 0,  end: TOTAL_MONTHS - 1 },
  { label: '2015/16', start: 0,  end: 23 },
  { label: '2017/18', start: 24, end: 47 },
  { label: '2019/20', start: 48, end: 71 },
  { label: '2021/22', start: 72, end: 95 },
  { label: '2023/24', start: 96, end: TOTAL_MONTHS - 1 },
]

function applyPreset(start: number, end: number) {
  selectedStartIdx.value = start
  selectedEndIdx.value = end
}

function clampRange() {
  if (selectedStartIdx.value > selectedEndIdx.value) {
    selectedEndIdx.value = selectedStartIdx.value
  }
}

// ----------------------------------------------------------------
// Tageszeit-Farben
// ----------------------------------------------------------------
const HOUR_COLORS: [number, number, string][] = [
  [0,  5,  '#34495E'], // Nacht
  [6,  9,  '#E67E22'], // Morgen
  [10, 17, '#F4D03F'], // Tag
  [18, 23, '#8E44AD'], // Abend
]
const HOUR_LABELS = [
  { label: 'Nacht (0–5h)',   color: '#34495E' },
  { label: 'Morgen (6–9h)',  color: '#E67E22' },
  { label: 'Tag (10–17h)',   color: '#F4D03F' },
  { label: 'Abend (18–23h)', color: '#8E44AD' },
]
function getHourColor(h: number): string {
  for (const [lo, hi, c] of HOUR_COLORS) { if (h >= lo && h <= hi) return c }
  return '#34495E'
}

// ----------------------------------------------------------------
// Datenpunkte im gewählten Zeitraum
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Feste Domains
// ----------------------------------------------------------------
const fixedDomains = computed(() => {
  const xFn = xAxis.value.value
  const all = props.data
    .map((r) => ({ x: xFn(r), y: r.co2_g_per_kwh }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (!all.length) return { xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number] }
  const xMin = d3.min(all, (p) => p.x)!
  const xMax = d3.max(all, (p) => p.x)!
  const yMin = d3.min(all, (p) => p.y)!
  const yMax = d3.max(all, (p) => p.y)!
  const xPad = (xMax - xMin) * 0.05 || 1
  const yPad = (yMax - yMin) * 0.05 || 1
  return {
    xDomain: [xMin - xPad, xMax + xPad] as [number, number],
    yDomain: [yMin - yPad, yMax + yPad] as [number, number],
  }
})

// ----------------------------------------------------------------
// Datenpunkte pro Phase
// ----------------------------------------------------------------
interface Point { id: number; x: number; y: number; hour: number; isOutlier: boolean }

const rangePoints = computed<Point[]>(() => {
  const xFn = xAxis.value.value
  const start = selectedStartDate.value.getTime()
  const end = selectedEndDate.value.getTime()

  const rows = props.data.filter((r) => {
    const t = new Date(r.timestamp).getTime()
    return t >= start && t < end
  })

  const all = rows.map((r) => ({
    id: r.timestamp,
    x: xFn(r),
    y: r.co2_g_per_kwh,
    hour: new Date(r.timestamp).getUTCHours(),
  })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))

  const n = all.length; if (n === 0) return []
  const mX = all.reduce((s, p) => s + p.x, 0) / n
  const mY = all.reduce((s, p) => s + p.y, 0) / n
  const sX = Math.sqrt(all.reduce((s, p) => s + (p.x - mX) ** 2, 0) / n)
  const sY = Math.sqrt(all.reduce((s, p) => s + (p.y - mY) ** 2, 0) / n)
  const t = 2
  return all.map((p) => ({
    ...p,
    isOutlier: Math.abs(p.x - mX) > t * sX || Math.abs(p.y - mY) > t * sY,
  }))
})

// ----------------------------------------------------------------
// Regression
// ----------------------------------------------------------------
const rangeStats = computed(() => {
  const pts = rangePoints.value; const n = pts.length
  if (n < 3) return { r: 0, r2: 0, a: 0, b: 0, count: n, direction: '—', strength: '—' }
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0
  for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; sy2 += p.y * p.y }
  const rNum = n * sxy - sx * sy
  const rDen = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  const r = rDen === 0 ? 0 : rNum / rDen
  const aD = n * sx2 - sx * sx
  const a = aD === 0 ? 0 : rNum / aD
  const b = (sy - a * sx) / n
  return { r: Math.round(r * 100) / 100, r2: Math.round(r * r * 100) / 100, a, b, count: n }
})

// ----------------------------------------------------------------
// Toggle States
// ----------------------------------------------------------------
const showTrendline = ref(false)
const explainMode = ref(false)
const highlightOutliers = ref(false)

// ----------------------------------------------------------------
// Chart-Masse
// ----------------------------------------------------------------
const MARGIN = { top: 12, right: 12, bottom: 28, left: 52 }
const WIDTH = 960
const HEIGHT = 360
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// Refs
// ----------------------------------------------------------------
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// ----------------------------------------------------------------
// Tooltip State
// ----------------------------------------------------------------
interface TooltipState { x: number; y: number; d: HourlyRow }
const tooltip = ref<TooltipState | null>(null)

const rowLookup = computed(() => {
  const map = new Map<number, HourlyRow>()
  for (const r of props.data) map.set(r.timestamp, r)
  return map
})

// ----------------------------------------------------------------
// Zoom State (module-level, init einmal)
// ----------------------------------------------------------------
let xScale: d3.ScaleLinear<number, number> | null = null
let yScale: d3.ScaleLinear<number, number> | null = null
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
const currentZoom = ref<d3.ZoomTransform | null>(null)
let zoomInitialized = false
// Basisskalen für Zoom (stabil, werden bei Datenänderung aktualisiert)
const baseXScale = ref<d3.ScaleLinear<number, number> | null>(null)
const baseYScale = ref<d3.ScaleLinear<number, number> | null>(null)

// Zoom immer aktiv (kein Play/Pause mehr)
const zoomEnabled = true

// ----------------------------------------------------------------
// Datums-Formatierung
// ----------------------------------------------------------------
function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy}, ${hh}:00`
}

// ----------------------------------------------------------------
// Zoom zurücksetzen
// ----------------------------------------------------------------
function resetZoom() {
  const svgEl = svgRef.value
  if (!svgEl || !zoomBehavior) return
  currentZoom.value = null
  const svg = d3.select(svgEl)
  svg.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity)
}

// ----------------------------------------------------------------
// Render-Scheduler (rAF-basiert)
// ----------------------------------------------------------------
type RenderReason = 'init' | 'metricChanged' | 'timeRangeChanged' | 'trendToggleChanged' | 'explainToggleChanged' | 'zoom'
let renderRaf: number | null = null
let pendingReason: RenderReason | null = null
let trendlineTimer: ReturnType<typeof setTimeout> | null = null
let voronoiTimer: ReturnType<typeof setTimeout> | null = null
// Module-level D3-Selections (nach Init)
let chart: d3.Selection<SVGGElement, unknown, null, undefined>
let pg: d3.Selection<SVGGElement, unknown, null, undefined>
let axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>
let gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>
let baselineGroup: d3.Selection<SVGGElement, unknown, null, undefined>

function scheduleRender(reason: RenderReason) {
  pendingReason = reason
  if (renderRaf !== null) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = null
    const r = pendingReason!
    pendingReason = null
    updateChart(r)
  })
}

// ----------------------------------------------------------------
// updateChart — zentrale Render-Funktion
// ----------------------------------------------------------------
const TRANS_DURATION = 80

function updateChart(reason: RenderReason) {
  const svgEl = svgRef.value
  if (!svgEl) return

  const pts = rangePoints.value
  const { xDomain, yDomain } = fixedDomains.value

  // Scales immer aktualisieren (für updateVisuals)
  xScale = d3.scaleLinear().domain(xDomain).range([0, INNER_W])
  yScale = d3.scaleLinear().domain(yDomain).range([INNER_H, 0])
  baseXScale.value = xScale
  baseYScale.value = yScale
  const ux = currentZoom.value ? currentZoom.value.rescaleX(xScale) : xScale
  const uy = currentZoom.value ? currentZoom.value.rescaleY(yScale) : yScale

  const svg = d3.select(svgEl)
  const ac = axisColor.value

  // --- INIT: Einmalige SVG-Struktur ---
  if (reason === 'init' || !chart?.node()) {
    svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

    chart = svg.selectChild<SVGGElement>('g.chart-area')
    if (chart.empty()) chart = svg.append('g').attr('class', 'chart-area')
      .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

    // Defs + Clip-Path
    let clipDefs = svg.selectChild<SVGDefsElement>('defs')
    if (clipDefs.empty()) clipDefs = svg.insert('defs', ':first-child')
    let clipPath = clipDefs.selectChild<SVGClipPathElement>('#chart-clip')
    if (clipPath.empty()) {
      clipPath = clipDefs.append('clipPath').attr('id', 'chart-clip')
      clipPath.append('rect').attr('width', INNER_W).attr('height', INNER_H)
    }

    // Hintergrund
    if (chart.selectChild<SVGRectElement>('rect.chart-bg').empty())
      chart.insert('rect', ':first-child').attr('class', 'chart-bg')
        .attr('width', INNER_W).attr('height', INNER_H)
        .attr('fill', '#F0F0F0').attr('rx', 2)

    // Grid
    gridGroup = chart.selectChild<SVGGElement>('g.grid-group')
    if (gridGroup.empty()) gridGroup = chart.insert('g', ':first-child').attr('class', 'grid-group')

    // Baseline
    baselineGroup = chart.selectChild<SVGGElement>('g.baseline-group')
    if (baselineGroup.empty()) baselineGroup = chart.append('g').attr('class', 'baseline-group')

    // Achsen
    axisGroup = svg.selectChild<SVGGElement>('g.axis-group')
    if (axisGroup.empty()) {
      axisGroup = svg.append('g').attr('class', 'axis-group')
        .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
      axisGroup.append('g').attr('class', 'x-axis')
        .attr('transform', `translate(0, ${INNER_H})`)
        .attr('font-size', '9px').attr('color', '#6b7280')
      axisGroup.append('g').attr('class', 'y-axis')
        .attr('font-size', '9px').attr('color', '#6b7280')
    }

    // X-Label
    let labelGroup = svg.selectChild<SVGGElement>('g.label-group')
    if (labelGroup.empty()) {
      labelGroup = svg.append('g').attr('class', 'label-group')
        .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
      labelGroup.append('text').attr('class', 'x-label')
        .attr('x', INNER_W / 2).attr('y', INNER_H + 24)
        .attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#6b7280')
    }

    // Y-Label
    if (svg.selectChild<SVGTextElement>('text.y-label').empty())
      svg.append('text').attr('class', 'y-label')
        .attr('x', 12).attr('y', MARGIN.top + INNER_H / 2)
        .attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, 12, ${MARGIN.top + INNER_H / 2})`)
        .attr('font-size', '11px').attr('fill', '#6B7280')
        .text('CO₂-Intensität (g CO₂/kWh)')

    // Point-Gruppe
    pg = chart.selectChild<SVGGElement>('g.point-group')
    if (pg.empty()) pg = chart.append('g').attr('class', 'point-group')
      .attr('clip-path', 'url(#chart-clip)')

    // Zoom einmalig
    if (!zoomInitialized) {
      zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 20])
        .translateExtent([[0, 0], [WIDTH, HEIGHT]])
        .extent([[0, 0], [WIDTH, HEIGHT]])
        .on('zoom', (event) => {
          currentZoom.value = event.transform
          const bx = baseXScale.value
          const by = baseYScale.value
          if (!bx || !by) return
          const zx = event.transform.rescaleX(bx)
          const zy = event.transform.rescaleY(by)
          updateVisuals(zx, zy)
        })
      svg.call(zoomBehavior)
      zoomInitialized = true
    }
    svg.call(zoomBehavior)
    svg.style('cursor', 'crosshair')
  }

  // --- RENDER nach Grund ---

  // 1. Grids + Baseline (immer, schnell)
  const yAxisGen = d3.axisLeft(uy).ticks(5).tickSize(-INNER_W).tickFormat(() => '')
  gridGroup.selectAll('g.y-grid').remove()
  gridGroup.append('g').attr('class', 'y-grid').call(yAxisGen)
    .selectAll('.tick line').attr('stroke', '#DCDCDC').attr('stroke-width', 1)
  gridGroup.selectAll('.tick text').remove()
  baselineGroup.selectAll('line').remove()
  baselineGroup.append('line')
    .attr('x1', 0).attr('x2', INNER_W).attr('y1', INNER_H).attr('y2', INNER_H)
    .attr('stroke', '#AAAAAA').attr('stroke-width', 1.5)

  // 2. Achsen (immer)
  axisGroup.select('.x-axis')
    .call(d3.axisBottom(ux).ticks(6).tickSize(0) as any)
    .call(g => g.select('.domain').remove())
  axisGroup.select('.x-axis .tick text')
    .attr('fill', '#888888').attr('font-size', '9px').attr('font-family', 'var(--font-sans)')
  axisGroup.select('.y-axis')
    .call(d3.axisLeft(uy).ticks(5).tickSize(0) as any)
    .call(g => g.select('.domain').remove())
  axisGroup.select('.y-axis .tick text')
    .attr('fill', '#888888').attr('font-size', '9px').attr('font-family', 'var(--font-sans)')

  // X-Label
  svg.select<SVGTextElement>('.x-label').text(`${xAxis.value.label} (${xAxis.value.unit})`)
  svg.select<SVGTextElement>('.x-label').attr('fill', ac.label)

  // 3. Punkte — Data-Join NUR bei init oder metricChanged
  //    Bei timeRangeChanged: nur Sichtbarkeit via display togglen
  if (reason === 'init' || reason === 'metricChanged') {
    const POINT_R = 2.5

    const circles = pg.selectAll<SVGCircleElement, Point>('circle.point')
      .data(pts, (d) => String(d.id))

    circles.exit()
      .transition().duration(TRANS_DURATION).attr('r', 0).attr('opacity', 0).remove()

    const enter = circles.enter().append('circle')
      .attr('class', 'point').attr('r', 0).attr('opacity', 0)
      .attr('stroke', ac.outline).attr('stroke-width', 1)
      .attr('cursor', 'crosshair')

    // Bestehende: direkte attr-Updates
    circles
      .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y))
      .attr('fill', (d) => getHourColor(d.hour))
      .attr('stroke', (d) => highlightOutliers.value && d.isOutlier ? '#1a1a1a' : ac.outline)
      .attr('stroke-width', (d) => highlightOutliers.value && d.isOutlier ? 1.5 : 1)
      .attr('r', POINT_R).attr('opacity', ac.opacity)
      .style('display', null) // alle sichtbar

    // Neue mit Transition
    enter.merge(circles)
      .transition().duration(TRANS_DURATION)
      .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y))
      .attr('fill', (d) => getHourColor(d.hour))
      .attr('stroke', (d) => highlightOutliers.value && d.isOutlier ? '#1a1a1a' : ac.outline)
      .attr('stroke-width', (d) => highlightOutliers.value && d.isOutlier ? 1.5 : 1)
      .attr('r', POINT_R).attr('opacity', ac.opacity)
      .style('display', null)

    // Trendlinie (komplett)
    updateTrendline(ux, uy, ac)

    // Erklärmodus (komplett)
    updateExplainMode(ux, uy)

    // Voronoi (komplett)
    updateVoronoi(ux, uy, pts, ac)

  } else if (reason === 'timeRangeChanged') {
    // Nur Sichtbarkeit toggeln + Positionen — KEIN Data-Join
    const startT = selectedStartDate.value.getTime()
    const endT = selectedEndDate.value.getTime()

    pg.selectAll<SVGCircleElement, any>('circle.point')
      .attr('cx', (d: any) => ux(d.x))
      .attr('cy', (d: any) => uy(d.y))
      .style('display', (d: any) => {
        const t = d.id // timestamp
        return (t >= startT && t < endT) ? null : 'none'
      })

    // Trendline debounced
    scheduleTrendline(ux, uy)

    // Voronoi debounced
    scheduleVoronoi(ux, uy, ac)

    // Toggles neuzeichnen (Erklärmodus)
    chart.selectAll('g.explain-zone').remove()
    if (explainMode.value) {
      updateExplainMode(ux, uy)
    }

  } else if (reason === 'trendToggleChanged') {
    chart.selectAll('g.reg-group').remove()
    if (showTrendline.value) updateTrendline(ux, uy, ac)

  } else if (reason === 'explainToggleChanged') {
    chart.selectAll('g.explain-zone').remove()
    if (explainMode.value) updateExplainMode(ux, uy)
  }
}

// ----------------------------------------------------------------
// Sub-Funktionen
// ----------------------------------------------------------------
function updateTrendline(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>, ac: any) {
  chart.selectAll('g.reg-group').remove()
  const { a, b, r2, count } = rangeStats.value
  if (!Number.isFinite(a) || !Number.isFinite(b) || count < 3) return
  const rg = chart.append('g').attr('class', 'reg-group').attr('clip-path', 'url(#chart-clip)')
  const x0 = ux.domain()[0], x1 = ux.domain()[1]
  const ld: [number, number][] = [[ux(x0), uy(a * x0 + b)], [ux(x1), uy(a * x1 + b)]]
  rg.append('path').attr('d', d3.line()(ld)!).attr('fill', 'none')
    .attr('stroke', ac.trend).attr('stroke-width', 1).attr('opacity', 0.6).attr('stroke-dasharray', '4,3')
  rg.append('text').attr('x', ld[1][0] + 4).attr('y', ld[1][1] - 4)
    .attr('font-size', '8px').attr('fill', '#666').attr('opacity', 0.7).text(`R² = ${r2}`)
}

function scheduleTrendline(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  if (trendlineTimer !== null) clearTimeout(trendlineTimer)
  trendlineTimer = setTimeout(() => {
    trendlineTimer = null
    if (showTrendline.value) updateTrendline(ux, uy, axisColor.value)
  }, 150)
}

function updateExplainMode(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  chart.selectAll('g.explain-zone').remove()
  if (!explainMode.value) return
  const xMin = ux.domain()[0], xMax = ux.domain()[1]
  const yMin = uy.domain()[0], yMax = uy.domain()[1]
  const key = xAxis.value.key
  const zg = chart.append('g').attr('class', 'explain-zone').attr('pointer-events', 'none')

  // Helper: two-line label with <tspan>
  function addLabel(pxPct: number, pyPct: number, line1: string, line2: string, color = '#6B7280') {
    const lx = xMin + (xMax - xMin) * (pxPct / 100)
    const ly = yMin + (yMax - yMin) * (pyPct / 100)
    zg.append('text')
      .attr('x', ux(lx)).attr('y', uy(ly))
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', '10px').attr('fill', color).attr('opacity', 0.8)
      .each(function () {
        const el = d3.select(this)
        el.append('tspan').attr('x', ux(lx)).attr('dy', '-0.35em')
          .attr('font-weight', '600').text(line1)
        el.append('tspan').attr('x', ux(lx)).attr('dy', '1.3em')
          .attr('font-weight', '400').text(line2)
      })
  }

  if (key === 'ee_share') {
    const lowThresh = 30, highThresh = 55
    const xLow = ux(Math.max(lowThresh, xMin)), xHigh = ux(Math.min(highThresh, xMax))
    if (xLow > ux(xMin)) {
      zg.append('rect').attr('x', ux(xMin)).attr('y', uy(yMin))
        .attr('width', xLow - ux(xMin)).attr('height', uy(yMin) - uy(yMax))
        .attr('fill', '#E8C8C8').attr('opacity', 0.25).attr('rx', 4)
      addLabel(15, 15, 'Wenig EE', '↗ hohe CO₂-Intensität', '#8B5E5E')
    }
    if (xHigh < ux(xMax)) {
      zg.append('rect').attr('x', xHigh).attr('y', uy(yMin))
        .attr('width', ux(xMax) - xHigh).attr('height', uy(yMin) - uy(yMax))
        .attr('fill', '#A8DBA8').attr('opacity', 0.25).attr('rx', 4)
      addLabel(85, 85, 'Viel EE', '↘ niedrige CO₂-Intensität', '#2D6A4F')
    }
    if (xHigh > xLow) {
      zg.append('rect').attr('x', xLow).attr('y', uy(yMin))
        .attr('width', xHigh - xLow).attr('height', uy(yMin) - uy(yMax))
        .attr('fill', '#E8E0D0').attr('opacity', 0.15).attr('rx', 4)
      zg.append('text').attr('x', (xLow + xHigh) / 2)
        .attr('y', uy(yMin) + (uy(yMax) - uy(yMin)) * 0.06)
        .attr('text-anchor', 'middle').attr('font-size', '8px')
        .attr('fill', '#9CA3AF').attr('opacity', 0.6).text('Übergangsbereich')
    }
  } else if (key === 'fossil_share') {
    addLabel(85, 10, 'Viel Fossil', '↗ hohe CO₂-Intensität', '#4A4A4A')
    addLabel(5, 90, 'Wenig Fossil', '↘ niedrige CO₂-Intensität', '#4A4A4A')
  } else if (key === 'load') {
    addLabel(80, 10, 'Hohe Last + wenig EE', '↗ schmutzig', '#3E7A9E')
    addLabel(5, 90, 'Niedrige Last', '↘ EE-Anteil steigt', '#3E7A9E')
    addLabel(40, 15, 'Schwache Korrelation —', 'Mix entscheidet', '#9CA3AF')
  } else if (key === 'price') {
    addLabel(3, 50, 'Negativpreise', '→ EE-Überschuss', '#B8935A')
    addLabel(80, 10, 'Spitzenlast', '→ Gas als Puffer', '#B8935A')
    addLabel(5, 88, 'Günstig & sauber', '→ EE-Hochphase', '#B8935A')
    // Vertikale Linie bei 0 EUR/MWh
    const x0 = ux(0)
    if (x0 > 0 && x0 < INNER_W) {
      zg.append('line').attr('x1', x0).attr('y1', 0)
        .attr('x2', x0).attr('y2', INNER_H)
        .attr('stroke', '#B8935A').attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3').attr('opacity', 0.5)
      zg.append('text').attr('x', x0).attr('y', 10)
        .attr('text-anchor', 'middle').attr('font-size', '7px')
        .attr('fill', '#B8935A').attr('opacity', 0.6)
        .attr('transform', `rotate(-90, ${x0}, 10)`)
        .text('Negativpreisgrenze')
    }
  }
}

function updateVoronoi(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>,
                       pts: Point[], ac: any) {
  chart.selectAll('rect.voronoi-hit').remove()
  if (pts.length <= 1) return
  const delaunay = d3.Delaunay.from(pts, (d) => ux(d.x), (d) => uy(d.y))
  chart.append('rect').attr('class', 'voronoi-hit')
    .attr('width', INNER_W).attr('height', INNER_H)
    .attr('fill', 'transparent').attr('cursor', 'crosshair')
    .on('mousemove', (event: MouseEvent) => {
      if (pts.length < 2) return
      const [mx, my] = d3.pointer(event, chart.node()!)
      const idx = delaunay.find(mx, my)
      if (idx < 0 || idx >= pts.length) return
      const p = pts[idx]
      const row = rowLookup.value.get(p.id)
      if (!row) return
      pg.selectAll('circle.point').attr('opacity', ac.opacity).attr('r', 2.5)
      pg.selectAll('circle.point').filter((d: any) => d.id === p.id)
        .attr('opacity', 1).attr('r', 5)
        .each(function () { (this.parentNode as SVGGElement).appendChild(this) })
      tooltip.value = { x: ux(p.x) + MARGIN.left, y: uy(p.y) + MARGIN.top, d: row }
    })
    .on('mouseleave', () => {
      pg.selectAll('circle.point').attr('opacity', ac.opacity).attr('r', 2.5)
      tooltip.value = null
    })
}

function scheduleVoronoi(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>,
                         ac: any) {
  if (voronoiTimer !== null) clearTimeout(voronoiTimer)
  voronoiTimer = setTimeout(() => {
    voronoiTimer = null
    updateVoronoi(ux, uy, rangePoints.value, ac)
  }, 200)
}

// ----------------------------------------------------------------
// updateVisuals (für Zoom-Handler, KEIN Data-Join)
// ----------------------------------------------------------------
function updateVisuals(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  pg.selectAll('circle.point')
    .attr('cx', (d: any) => ux(d.x)).attr('cy', (d: any) => uy(d.y))

  axisGroup.select('.x-axis')
    .call(d3.axisBottom(ux).ticks(6).tickSize(0).tickFormat((d: any) => d.toFixed(d < 1 ? 1 : 0)) as any)
    .call(g => g.select('.domain').remove())
  axisGroup.select('.y-axis')
    .call(d3.axisLeft(uy).ticks(5).tickSize(0).tickFormat((d: any) => d.toFixed(0)) as any)
    .call(g => g.select('.domain').remove())

  gridGroup.selectAll('*').remove()
  const yTicks = uy.ticks(5)
  gridGroup.selectAll('line.y-grid').data(yTicks).join('line')
    .attr('x1', 0).attr('x2', INNER_W).attr('y1', d => uy(d)).attr('y2', d => uy(d))
    .attr('stroke', '#DCDCDC').attr('stroke-width', 1)
  baselineGroup.selectAll('line').remove()
  baselineGroup.append('line')
    .attr('x1', 0).attr('x2', INNER_W).attr('y1', INNER_H).attr('y2', INNER_H)
    .attr('stroke', '#AAAAAA').attr('stroke-width', 1.5)

  chart.selectAll('g.reg-group').remove()
  if (showTrendline.value) {
    const { a, b, r2 } = rangeStats.value
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const rg = chart.append('g').attr('class', 'reg-group').attr('clip-path', 'url(#chart-clip)')
      const x0 = ux.domain()[0], x1 = ux.domain()[1]
      const ld: [number, number][] = [[ux(x0), uy(a * x0 + b)], [ux(x1), uy(a * x1 + b)]]
      rg.append('path').attr('d', d3.line()(ld)!).attr('fill', 'none')
        .attr('stroke', axisColor.value.trend).attr('stroke-width', 1)
        .attr('opacity', 0.6).attr('stroke-dasharray', '4,3')
      rg.append('text').attr('x', ld[1][0] + 4).attr('y', ld[1][1] - 4)
        .attr('font-size', '8px').attr('fill', '#666').attr('opacity', 0.7).text(`R² = ${r2}`)
    }
  }

  chart.selectAll('g.explain-zone').remove()
  if (explainMode.value) {
    updateExplainMode(ux, uy)
  }
}

// ----------------------------------------------------------------
// Gezielte Watches statt watchEffect
// ----------------------------------------------------------------
watch(xAxis, () => { scheduleRender('metricChanged') })
watch([selectedStartIdx, selectedEndIdx], () => { scheduleRender('timeRangeChanged') })
watch(showTrendline, () => { scheduleRender('trendToggleChanged') })
watch(explainMode, () => { scheduleRender('explainToggleChanged') })

// Initialer Render
watch(svgRef, (el) => { if (el) scheduleRender('init') }, { once: true })

// ----------------------------------------------------------------
// Cleanup
// ----------------------------------------------------------------
onUnmounted(() => {
  const svgEl = svgRef.value
  if (svgEl) {
    const svg = d3.select(svgEl)
    svg.on('.zoom', null)
  }
  zoomInitialized = false
  zoomBehavior = null
  currentZoom.value = null
})
</script>

<template>
  <div class="scatter-card">
    <!-- Header mit "2" Badge + Titel -->
    <div class="scatter-header">
      <span class="badge">2</span>
      <h3 class="scatter-heading">Einflussfaktoren der CO₂-Intensität</h3>
    </div>
    <p class="scatter-subtitle">Wie verändern Strommix, Nachfrage, Preis und Tageszeit die Klimabilanz des Stroms?</p>

    <!-- Kompakte X/Y-Auswahl (Pill-Style) -->
    <div class="axis-selectors">
      <div class="axis-row">
        <span class="axis-char">X</span>
        <div class="pill-group">
          <button v-for="opt in X_OPTIONS" :key="opt.key"
            :class="{ active: xAxis.key === opt.key }"
            class="pill-btn"
            :style="xAxis.key === opt.key ? { '--btn-active': AXIS_COLORS[opt.key].btnBg } : {}"
            @click="xAxis = opt">
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="axis-row">
        <span class="axis-char">Y</span>
        <span class="y-pill" :style="{ color: axisColor.label }">CO₂-Intensität (g CO₂/kWh)</span>
      </div>
    </div>

    <!-- Tageszeit-Legende -->
    <div class="tod-legend">
      <span class="tod-label">Tageszeit:</span>
      <span v-for="hl in HOUR_LABELS" :key="hl.label" class="tod-item">
        <span class="tod-swatch" :style="{ background: hl.color }"></span>
        {{ hl.label }}
      </span>
    </div>

    <!-- Toggle-Chips (kompakte Toolbar) -->
    <div class="chip-toolbar">
      <button :class="{ active: showTrendline }" class="chip-btn" @click="showTrendline = !showTrendline">Trendlinie</button>
      <button :class="{ active: explainMode }" class="chip-btn" @click="explainMode = !explainMode">
        Erklärmodus
        <span class="chip-info" title="Markiert Bereiche mit wenig/viel EE und der zugehörigen CO₂-Intensität.">ⓘ</span>
      </button>
      <button :class="{ active: highlightOutliers }" class="chip-btn" @click="highlightOutliers = !highlightOutliers">
        Besondere Stunden
        <span class="chip-info" title="Besondere Stunden sind Werte, die statistisch deutlich vom Durchschnitt abweichen. Technisch: mehr als 2 Standardabweichungen.">ⓘ</span>
      </button>
    </div>

    <!-- Erklärung: Besondere Stunden -->
    <div v-if="highlightOutliers" class="outlier-hint">
      <span class="oh-icon">ⓘ</span>
      <span class="oh-text"><strong>Besondere Stunden</strong> sind Stunden, in denen EE-Anteil oder CO₂-Intensität mehr als <strong>2 Standardabweichungen</strong> vom Mittelwert des gewählten Zeitraums entfernt liegen – z.&thinsp;B. extrem windreiche oder windarme Stunden, Stromimporte oder Netzengpässe. Hervorgehoben durch stärkere Kontur.</span>
    </div>

    <!-- Zeitraum-Wahl: Dual Range Slider -->
    <div class="range-section">
      <div class="range-header">
        <span class="range-label">{{ dateLabel }}</span>
        <div class="range-presets">
          <button v-for="pr in RANGE_PRESETS" :key="pr.label"
            class="preset-btn"
            :class="{ active: selectedStartIdx === pr.start && selectedEndIdx === pr.end }"
            @click="applyPreset(pr.start, pr.end)">
            {{ pr.label }}
          </button>
        </div>
      </div>
      <div class="range-slider-wrap">
        <input type="range" class="range-input range-start"
          :min="0" :max="TOTAL_MONTHS - 1" step="1"
          v-model.number="selectedStartIdx"
          @input="clampRange" />
        <input type="range" class="range-input range-end"
          :min="0" :max="TOTAL_MONTHS - 1" step="1"
          v-model.number="selectedEndIdx"
          @input="clampRange" />
        <div class="range-track-bg"></div>
        <div class="range-fill" :style="rangeFillStyle"></div>
      </div>
      <div class="range-month-labels">
        <span v-for="y in [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]" :key="y">{{ y }}</span>
      </div>
    </div>

    <!-- Chart (mit Zoom-Hinweis) -->
    <div ref="containerRef" class="chart-wrap">
      <div class="chart-header">
        <span class="zoom-hint">Mausrad zum Zoomen · Ziehen zum Verschieben</span>
        <button v-if="currentZoom && currentZoom.k !== 1" class="reset-zoom-btn" @click="resetZoom" title="Zoom zurücksetzen">⟲ Ansicht zurücksetzen</button>
      </div>
      <svg ref="svgRef" class="scatter-svg"></svg>
      <!-- Tooltip (absolut positioniert) -->
      <div v-if="tooltip?.d" class="scatter-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <div class="tt-row"><span class="tt-label">Stunde</span><span class="tt-val">{{ formatTimestamp(tooltip.d.timestamp) }}</span></div>
        <div class="tt-row"><span class="tt-label">EE-Anteil</span><span class="tt-val">{{ tooltip.d.ee_share.toFixed(1) }} %</span></div>
        <div class="tt-row"><span class="tt-label">CO₂-Intensität</span><span class="tt-val">{{ tooltip.d.co2_g_per_kwh.toFixed(0) }} g CO₂/kWh</span></div>
        <div class="tt-row"><span class="tt-label">Stromnachfrage</span><span class="tt-val">{{ (tooltip.d.load_mwh / 1000).toFixed(1) }} GW</span></div>
        <div class="tt-row"><span class="tt-label">Day-Ahead-Preis</span><span class="tt-val">{{ tooltip.d.price_eur_mwh.toFixed(1) }} €/MWh</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scatter-card {
  width: 100%;
}

/* ---- Header ---- */
.scatter-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.badge {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-muted);
  opacity: 0.5;
}

.scatter-heading {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0;
}

.scatter-subtitle {
  font-size: 0.8rem;
  color: var(--fg-muted);
  margin: 4px 0 14px;
  line-height: 1.4;
}

/* ---- Kompakte X/Y-Auswahl (Pills) ---- */
.axis-selectors {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.axis-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.axis-char {
  font-family: var(--font-sans);
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--fg-muted);
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.pill-group {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.pill-btn {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  padding: 3px 8px;
  border: 1px solid var(--hairline);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 0;
}

.pill-btn:hover {
  border-color: var(--accent);
  color: var(--fg);
}

.pill-btn.active {
  background: var(--btn-active, var(--accent));
  border-color: var(--btn-active, var(--accent));
  color: #fff;
}

.y-pill {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  padding: 3px 8px;
  border: 1px solid var(--hairline);
  color: var(--fg-muted);
}

/* ---- Tageszeit-Legende ---- */
.tod-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 6px;
  font-family: var(--font-sans);
  font-size: 0.65rem;
  color: var(--fg-muted);
  flex-wrap: wrap;
}
.tod-label { font-weight: 600; color: var(--fg); }
.tod-item { display: inline-flex; align-items: center; gap: 3px; }
.tod-swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

/* ---- Toggle-Chips (kompakte Toolbar) ---- */
.chip-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.chip-btn {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  padding: 3px 8px;
  border: 1px solid var(--hairline);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s;
  border-radius: 0;
}

.chip-btn:hover {
  border-color: var(--accent);
  color: var(--fg);
}

.chip-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.chip-info {
  font-size: 0.75rem;
  cursor: help;
}

/* ---- Zeitraum-Wahl (Dual Range Slider) ---- */
.range-section {
  margin-bottom: 8px;
}

.range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
  flex-wrap: wrap;
}

.range-label {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
}

.range-presets {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.preset-btn {
  font-family: var(--font-sans);
  font-size: 0.6rem;
  padding: 2px 7px;
  border: 1px solid var(--hairline);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 0;
}

.preset-btn:hover {
  border-color: var(--accent);
  color: var(--fg);
}

.preset-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.range-slider-wrap {
  position: relative;
  height: 28px;
}

.range-track-bg {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--hairline);
  border-radius: 2px;
  transform: translateY(-50%);
  pointer-events: none;
}

.range-fill {
  position: absolute;
  top: 50%;
  height: 4px;
  background: var(--accent);
  border-radius: 2px;
  transform: translateY(-50%);
  pointer-events: none;
}

.range-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  z-index: 2;
  outline: none;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: box-shadow 0.15s;
}

.range-input::-webkit-slider-thumb:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

.range-input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  cursor: pointer;
  pointer-events: auto;
}

.range-month-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.55rem;
  color: var(--fg-subtle);
  margin-top: 1px;
}

.outlier-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 0 10px;
  padding: 6px 10px;
  background: #F8F8F8;
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: 0.7rem;
  color: var(--fg-muted);
  line-height: 1.5;
}
.oh-icon { font-size: 0.75rem; flex-shrink: 0; margin-top: 1px; }
.oh-text { flex: 1; }

/* ---- Chart ---- */
.chart-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  position: relative;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.zoom-hint {
  font-family: var(--font-sans);
  font-size: 0.6rem;
  color: var(--fg-subtle);
  opacity: 0.5;
}

.reset-zoom-btn {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  padding: 2px 8px;
  border: 1px solid var(--hairline);
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.reset-zoom-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.scatter-svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 380px;
  cursor: crosshair;
}

/* ---- Tooltip ---- */
.scatter-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 8px));
  background: var(--fg);
  color: var(--bg);
  font-family: var(--font-sans);
  font-size: 0.7rem;
  padding: 8px 10px;
  line-height: 1.5;
  pointer-events: none;
  z-index: 20;
  white-space: nowrap;
}

.tt-row { display: flex; justify-content: space-between; gap: 12px; }
.tt-label { opacity: 0.6; }
.tt-val { font-weight: 600; text-align: right; }
</style>