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
  ee_share:     { fill: '#4A8A5F', outline: '#2D5A38', trend: '#1E3D26', label: '#4A8A5F', btnBg: '#2D6A4F', opacity: 0.40 },
  fossil_share: { fill: '#4A4A4A', outline: '#2A2A2A', trend: '#1A1A1A', label: '#4A4A4A', btnBg: '#3A3A3A', opacity: 0.40 },
  load:         { fill: '#3E7A9E', outline: '#2A5870', trend: '#1E4058', label: '#3E7A9E', btnBg: '#4A90A4', opacity: 0.30 },
  price:        { fill: '#B8935A', outline: '#8A6A35', trend: '#6A5030', label: '#B8935A', btnBg: '#D97742', opacity: 0.35 },
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
// Tageszeit-Farben (aus Träger-Palette abgeleitet)
// ----------------------------------------------------------------
const HOUR_COLORS: [number, number, string][] = [
  [0,  5,  '#2C3E50'], // Nacht
  [6,  9,  '#D97742'], // Morgen (Erdgas-Orange)
  [10, 17, '#E8B547'], // Tag (PV-Gelb)
  [18, 23, '#B85C8E'], // Abend (Kernenergie-Magenta)
]
const HOUR_LABELS = [
  { key: 'nacht',  label: 'Nacht',   color: '#2C3E50' },
  { key: 'morgen', label: 'Morgen',  color: '#D97742' },
  { key: 'tag',    label: 'Tag',     color: '#E8B547' },
  { key: 'abend',  label: 'Abend',   color: '#B85C8E' },
]

function getHourColor(h: number): string {
  for (const [lo, hi, c] of HOUR_COLORS) { if (h >= lo && h <= hi) return c }
  return '#2C3E50'
}
function getHourKey(h: number): string {
  if (h >= 0 && h <= 5) return 'nacht'
  if (h >= 6 && h <= 9) return 'morgen'
  if (h >= 10 && h <= 17) return 'tag'
  return 'abend'
}

// ----------------------------------------------------------------
// Chart-Masse (an Strommix angeglichen)
// ----------------------------------------------------------------
const MARGIN = { top: 12, right: 16, bottom: 60, left: 60 }
const WIDTH = 900
const HEIGHT = 412
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// Toggle für sichtbare Tageszeiten
// ----------------------------------------------------------------
const visibleTimes = ref<Set<string>>(new Set(HOUR_LABELS.map(h => h.key)))
const hoveredTime = ref<string | null>(null)

function toggleTime(key: string) {
  if (visibleTimes.value.has(key)) {
    visibleTimes.value.delete(key)
    if (visibleTimes.value.size === 0) visibleTimes.value.add(key)
  } else {
    visibleTimes.value.add(key)
  }
  visibleTimes.value = new Set(visibleTimes.value)
  scheduleRender('metricChanged')
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

// Nach Zeitraum gefilterte Punkte — einzige Datenbasis für DOM-Join + Regression
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
// Sidebar-Metriken
// ----------------------------------------------------------------
const sidebarMetrics = computed(() => {
  const stats = rangeStats.value
  const pts = rangePoints.value
  const n = stats.count

  // Korrelationsstärke
  const absR = Math.abs(stats.r)
  let strength = 'keine'
  if (absR >= 0.7) strength = 'starke'
  else if (absR >= 0.5) strength = 'mittlere'
  else if (absR >= 0.3) strength = 'schwache'
  const direction = stats.r < 0 ? 'negative' : 'positive'
  const correlationLabel = stats.r < 0
    ? (absR >= 0.7 ? 'starke negative Korrelation' : absR >= 0.5 ? 'mittlere negative Korrelation' : 'schwache negative Korrelation')
    : (absR >= 0.7 ? 'starke positive Korrelation' : absR >= 0.5 ? 'mittlere positive Korrelation' : 'schwache positive Korrelation')

  // Steigung
  const slopeLabel = Number.isFinite(stats.a)
    ? (stats.a < 0 ? '' : '+') + stats.a.toFixed(1) + ' g/kWh pro %-Punkt'
    : '—'

  // Datumsbereich – Ende: letzter Tag des Monats, nicht erster Tag des Folgemonats
  const startLabel = selectedStartDate.value.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const endMonthEnd = new Date(selectedEndDate.value)
  endMonthEnd.setDate(0) // letzter Tag des Vormonats = letzter Tag des gewählten Monats
  const endLabel = endMonthEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return {
    correlation: { value: stats.r.toFixed(2).replace('.', ','), context: correlationLabel },
    slope: { value: slopeLabel, context: 'je zusätzlichem Prozentpunkt EE-Anteil' },
    count: { value: n.toLocaleString('de-DE') + ' Stunden', context: startLabel + ' bis ' + endLabel },
  }
})

// ----------------------------------------------------------------
// Toggle States
// ----------------------------------------------------------------
const showTrendline = ref(false)
const explainMode = ref(false)
const highlightOutliers = ref(false)

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
// Zoom State + Selection
// ----------------------------------------------------------------
let xScale: d3.ScaleLinear<number, number> | null = null
let yScale: d3.ScaleLinear<number, number> | null = null
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
const currentZoom = ref<d3.ZoomTransform | null>(null)
let zoomInitialized = false
const baseXScale = ref<d3.ScaleLinear<number, number> | null>(null)
const baseYScale = ref<d3.ScaleLinear<number, number> | null>(null)

const zoomEnabled = true
const selectedHour = ref<{ point: Point; row: HourlyRow } | null>(null)

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
let hoverRaf: number | null = null
let lastHoverId: number | null = null
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
const TRANS_DURATION = 0

function updateChart(reason: RenderReason) {
  console.time(`⏱ updateChart [${reason}]`)
  const svgEl = svgRef.value
  if (!svgEl) { console.timeEnd(`⏱ updateChart [${reason}]`); return }

  const pts = rangePoints.value
  const { xDomain, yDomain } = fixedDomains.value

  console.time(`  scales`)
  xScale = d3.scaleLinear().domain(xDomain).range([0, INNER_W])
  yScale = d3.scaleLinear().domain(yDomain).range([INNER_H, 0])
  baseXScale.value = xScale
  baseYScale.value = yScale
  const ux = currentZoom.value ? currentZoom.value.rescaleX(xScale) : xScale
  const uy = currentZoom.value ? currentZoom.value.rescaleY(yScale) : yScale
  console.timeEnd(`  scales`)

  const svg = d3.select(svgEl)
  const ac = axisColor.value

  // --- INIT: Einmalige SVG-Struktur ---
  if (reason === 'init' || !chart?.node()) {
    console.time(`  init-structure`)
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
        .attr('x', INNER_W / 2).attr('y', INNER_H + 45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
        .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    }

    // Y-Label
    if (svg.selectChild<SVGTextElement>('text.y-label').empty())
      svg.append('text').attr('class', 'y-label')
        .attr('x', 12).attr('y', MARGIN.top + INNER_H / 2)
        .attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, 12, ${MARGIN.top + INNER_H / 2})`)
        .attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
        .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
        .text('CO₂-Intensität (g CO₂/kWh)')

    // Point-Gruppe
    pg = chart.selectChild<SVGGElement>('g.point-group')
    if (pg.empty()) pg = chart.append('g').attr('class', 'point-group')
      .attr('clip-path', 'url(#chart-clip)')

    // Zoom einmalig (nur Mausrad, kein Klick)
    if (!zoomInitialized) {
      zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 20])
        .translateExtent([[0, 0], [WIDTH, HEIGHT]])
        .extent([[0, 0], [WIDTH, HEIGHT]])
        .filter((event) => event.type === 'wheel')
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
    console.timeEnd(`  init-structure`)
  }

  // --- RENDER nach Grund ---

  // 1. Grids + Baseline (immer, schnell)
  console.time(`  grids+axes`)
  const yAxisGen = d3.axisLeft(uy).ticks(5).tickSize(-INNER_W).tickFormat(() => '')
  gridGroup.selectAll('g.y-grid').remove()
  gridGroup.append('g').attr('class', 'y-grid').call(yAxisGen)
    .selectAll('.tick line').attr('stroke', '#DCDCDC').attr('stroke-width', 1)
  gridGroup.selectAll('.tick text').remove()
  baselineGroup.selectAll('line').remove()
  baselineGroup.append('line')
    .attr('x1', 0).attr('x2', INNER_W).attr('y1', INNER_H).attr('y2', INNER_H)
    .attr('stroke', '#AAAAAA').attr('stroke-width', 1.5)

  // 2. Achsen (immer) — Strommix-Stil: Inter 11px uppercase
  axisGroup.select('.x-axis')
    .call(d3.axisBottom(ux).ticks(6).tickSize(0).tickFormat((d: any) => String(d)) as any)
    .call(g => g.select('.domain').remove())
  axisGroup.select('.x-axis .tick text')
    .attr('fill', 'var(--fg-muted)').attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
  axisGroup.select('.y-axis')
    .call(d3.axisLeft(uy).ticks(5).tickSize(0) as any)
    .call(g => g.select('.domain').remove())
  axisGroup.select('.y-axis .tick text')
    .attr('fill', 'var(--fg-muted)').attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')

  // X-Label
  svg.select<SVGTextElement>('.x-label').text(`${xAxis.value.label} (${xAxis.value.unit})`)
  svg.select<SVGTextElement>('.x-label').attr('fill', 'var(--fg-muted)')
  console.timeEnd(`  grids+axes`)

  // 3. Punkte — Data-Join NUR bei init, metricChanged oder timeRangeChanged
  if (reason === 'init' || reason === 'metricChanged' || reason === 'timeRangeChanged') {
    const markId = `${reason}_${Date.now()}`
    performance.mark(`${markId}-start`)

    console.time(`  data-join (${pts.length} pts)`)
    const POINT_R = 2.5
    const filteredPts = pts.filter((p) => visibleTimes.value.has(getHourKey(p.hour)))

    const circles = pg.selectAll<SVGCircleElement, Point>('circle.point')
      .data(filteredPts, (d) => String(d.id))

    circles.exit().remove()

    const enter = circles.enter().append('circle')
      .attr('class', 'point').attr('cursor', 'crosshair')

    const merged = enter.merge(circles)
      .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y))
      .attr('fill', (d) => getHourColor(d.hour))
      .attr('stroke', 'none')
      .attr('r', POINT_R)
      .attr('opacity', (d) => {
        const hk = getHourKey(d.hour)
        if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
        if (selectedHour.value && selectedHour.value.point.id !== d.id) return ac.opacity * 0.5
        return ac.opacity
      })

    // Unsichtbare Treffer-Kreise für Klick (r=8, transparent)
    const hitCircles = pg.selectAll<SVGCircleElement, Point>('circle.point-hit')
      .data(filteredPts, (d) => String(d.id))

    hitCircles.exit().remove()

    hitCircles.enter().append('circle')
      .attr('class', 'point-hit')
      .attr('fill', 'transparent').attr('stroke', 'none')
      .attr('cursor', 'pointer').attr('pointer-events', 'all')
      .merge(hitCircles)
      .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y))
      .attr('r', 8)
      .on('click', function (event: MouseEvent, d: Point) {
        event.stopPropagation()
        const row = rowLookup.value.get(d.id)
        if (!row) return
        if (selectedHour.value?.point.id === d.id) {
          selectedHour.value = null
          pg.selectAll('circle.point').attr('opacity', (p: any) => {
            const hk = getHourKey(p.hour)
            if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
            return ac.opacity
          }).attr('r', POINT_R).attr('stroke', 'none')
          return
        }
        selectedHour.value = { point: d, row }
        // Hervorhebung
        pg.selectAll('circle.point')
          .attr('opacity', (p: any) => p.id === d.id ? 1 : ac.opacity * 0.5)
          .attr('r', (p: any) => p.id === d.id ? 5 : POINT_R)
          .attr('stroke', (p: any) => p.id === d.id ? '#333' : 'none')
          .attr('stroke-width', (p: any) => p.id === d.id ? 1.5 : 0)
      })

    console.timeEnd(`  data-join (${pts.length} pts)`)

    const circlesInDom = pg.selectAll('circle.point').size()
    console.table({ selectedPeriod: `${selectedStartIdx.value * 2 + 2015}-${selectedEndIdx.value * 2 + 2015}`, filteredPoints: pts.length, circlesInDom })

    performance.mark(`${markId}-end`)
    performance.measure(`data-join [${markId}]`, `${markId}-start`, `${markId}-end`)

    // Trendlinie (komplett)
    console.time(`  trendline`)
    updateTrendline(ux, uy, ac)
    console.timeEnd(`  trendline`)

    // Erklärmodus (komplett)
    console.time(`  explain`)
    updateExplainMode(ux, uy)
    console.timeEnd(`  explain`)

    // Hover-Overlay (brute-force nearest point, kein Delaunay/Voronoi)
    console.time(`  hover-overlay`)
    updateHoverOverlay(ux, uy, pts, ac)
    console.timeEnd(`  hover-overlay`)

  } else if (reason === 'timeRangeChanged') {
    // Data-Join passiert bereits im ersten if-Zweig (init | metricChanged | timeRangeChanged)

    // Trendline debounced
    scheduleTrendline(ux, uy)

    // Hover-Overlay aktualisieren
    updateHoverOverlay(ux, uy, pts, ac)

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
  console.timeEnd(`⏱ updateChart [${reason}]`)
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
    .attr('stroke', ac.trend).attr('stroke-width', 1).attr('opacity', 0.6).attr('stroke-dasharray', '4,4')
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
  const key = xAxis.value.key
  const zg = chart.append('g').attr('class', 'explain-zone').attr('pointer-events', 'none')

  // Helper: Eck-Label mit zwei Zeilen (16px Abstand zur Kante, in Pixel-Koordinaten)
  function cornerLabel(side: 'topleft' | 'topright' | 'bottomleft' | 'bottomright', line1: string, line2: string) {
    const pad = 16
    let x: number, y: number, anchor: string
    if (side === 'topleft') {
      x = pad; y = pad
      anchor = 'start'
    } else if (side === 'topright') {
      x = INNER_W - pad; y = pad
      anchor = 'end'
    } else if (side === 'bottomleft') {
      x = pad; y = INNER_H - pad
      anchor = 'start'
    } else {
      x = INNER_W - pad; y = INNER_H - pad
      anchor = 'end'
    }
    zg.append('text')
      .attr('x', x).attr('y', y)
      .attr('text-anchor', anchor)
      .attr('font-size', '12px').attr('font-weight', '500').attr('fill', 'var(--fg-muted)').attr('opacity', 0.8)
      .attr('font-family', 'var(--font-sans)')
      .each(function () {
        const el = d3.select(this)
        el.append('tspan').attr('x', x).attr('dy', '0em')
          .text(line1)
        el.append('tspan').attr('x', x).attr('dy', '1.4em')
          .attr('font-size', '11px').attr('font-weight', '400')
          .text(line2)
      })
  }

  if (key === 'ee_share') {
    cornerLabel('topleft', 'Wenig EE', 'hohe CO₂-Intensität')
    cornerLabel('bottomright', 'Viel EE', 'niedrige CO₂-Intensität')
  } else if (key === 'fossil_share') {
    cornerLabel('topright', 'Viel Fossil', 'hohe CO₂-Intensität')
    cornerLabel('bottomleft', 'Wenig Fossil', 'niedrige CO₂-Intensität')
  } else if (key === 'load') {
    cornerLabel('topleft', 'Niedrige Last', 'meist EE-dominiert')
    cornerLabel('topright', 'Hohe Last', 'oft fossil-dominiert')
  } else if (key === 'price') {
    cornerLabel('topleft', 'Negativpreise', 'EE-Überschuss')
    cornerLabel('topright', 'Spitzenlast', 'oft Gas als Puffer')
  }
}

function updateHoverOverlay(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>,
                             pts: Point[], ac: any) {
  chart.selectAll('rect.hover-hit').remove()
  if (pts.length <= 1) return

  // Brute-force nearest point: für ~4k Punkte schnell genug (< 1ms).
  // Kein Delaunay/Voronoi — spart den O(n log n) Rebuild.
  function findNearest(mx: number, my: number): Point | null {
    let best: Point | null = null
    let bestDist = Infinity
    for (let i = 0; i < pts.length; i++) {
      const dx = ux(pts[i].x) - mx, dy = uy(pts[i].y) - my
      const dist = dx * dx + dy * dy
      if (dist < bestDist) { bestDist = dist; best = pts[i] }
    }
    return best
  }

  // rAF-gebündelter Hover: maximal eine Berechnung pro Frame
  let latestHoverEvent: MouseEvent | null = null

  chart.append('rect').attr('class', 'hover-hit')
    .attr('width', INNER_W).attr('height', INNER_H)
    .attr('fill', 'transparent').attr('cursor', 'crosshair')
    .on('click', function () {
      // Klick auf leeren Bereich → Auswahl aufheben
      if (selectedHour.value) {
        selectedHour.value = null
        pg.selectAll('circle.point')
          .attr('opacity', (d: any) => {
            const hk = getHourKey(d.hour)
            if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
            return ac.opacity
          }).attr('r', POINT_R).attr('stroke', 'none')
        tooltip.value = null
      }
    })
    .on('pointermove', (event: PointerEvent) => {
      latestHoverEvent = event
      if (hoverRaf !== null) return
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = null
        const ev = latestHoverEvent
        latestHoverEvent = null
        if (!ev) return
        const [mx, my] = d3.pointer(ev, chart.node()!)
        const p = findNearest(mx, my)
        if (!p) return
        // Tooltip + Highlight nur aktualisieren, wenn sich der Punkt ändert
        if (p.id === lastHoverId) return
        lastHoverId = p.id
        const row = rowLookup.value.get(p.id)
        if (!row) return
        // Cache die circle-Selection (wiederholte selectAll sind teuer)
        if (selectedHour.value) return // kein Hover-Highlight bei aktiver Auswahl
        const circles = pg.selectChild<SVGGElement>('circle.point')
          ? pg.selectAll<SVGCircleElement, Point>('circle.point')
          : null
        if (circles) {
          circles.attr('opacity', (d: any) => {
            const hk = getHourKey(d.hour)
            if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
            return ac.opacity
          }).attr('r', 3)
          circles.filter((d: any) => d.id === p.id)
            .attr('opacity', 1).attr('r', 6)
            .each(function () { (this.parentNode as SVGGElement).appendChild(this) })
        }
        tooltip.value = { x: ux(p.x) + MARGIN.left, y: uy(p.y) + MARGIN.top, d: row }
      })
    })
    .on('pointerleave', () => {
      latestHoverEvent = null
      lastHoverId = null
      if (hoverRaf !== null) {
        cancelAnimationFrame(hoverRaf)
        hoverRaf = null
      }
      if (!selectedHour.value) {
        pg.selectAll<SVGCircleElement, Point>('circle.point')
          .attr('opacity', (d: any) => {
            const hk = getHourKey(d.hour)
            if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
            return ac.opacity
          }).attr('r', 3)
        tooltip.value = null
      }
    })
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
  // Ausstehende rAFs und Timeouts aufräumen
  if (renderRaf !== null) { cancelAnimationFrame(renderRaf); renderRaf = null }
  if (trendlineTimer !== null) { clearTimeout(trendlineTimer); trendlineTimer = null }
  if (hoverRaf !== null) { cancelAnimationFrame(hoverRaf); hoverRaf = null }

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
    <!-- Header mit Kicker + Titel + Untertitel (wie Strommix) -->
    <div class="scatter-header">
      <span class="scatter-kicker">KAPITEL 2</span>
      <h3 class="scatter-heading">Einflussfaktoren der CO₂-Intensität</h3>
    </div>
    <p class="scatter-subtitle">Wie verändern Strommix, Nachfrage, Preis und Tageszeit die Klimabilanz des Stroms?</p>

    <!-- Kontrollleiste: zwei Reihen rechtsbündig (wie Strommix) -->
    <div class="scatter-controls">
      <div class="control-row">
        <span class="control-label">X:</span>
        <div class="segment-group">
          <button v-for="opt in X_OPTIONS" :key="opt.key"
            class="segment-btn" :class="{ active: xAxis.key === opt.key }"
            @click="xAxis = opt">{{ opt.label }}</button>
        </div>
        <span class="control-label" style="margin-left:12px">Y:</span>
        <span class="segment-static" :style="{ color: axisColor.label }">CO₂ g/kWh</span>
      </div>
      <div class="control-row control-row-secondary">
        <div class="segment-group">
          <button class="segment-btn-sm" :class="{ active: showTrendline }" @click="showTrendline = true; explainMode = false; highlightOutliers = false">Trendlinie</button>
          <button class="segment-btn-sm" :class="{ active: explainMode }" @click="explainMode = true; showTrendline = false; highlightOutliers = false">Einordnung</button>
          <button class="segment-btn-sm" :class="{ active: highlightOutliers }" @click="highlightOutliers = true; showTrendline = false; explainMode = false">Besondere Stunden</button>
        </div>
        <button v-if="currentZoom && currentZoom.k !== 1" class="reset-chip-inline" @click="resetZoom">× Zoom</button>
      </div>
    </div>

    <!-- Tageszeit-Legende (wie Strommix-Legende) -->
    <div class="tod-legend-bar">
      <button v-for="hl in HOUR_LABELS" :key="hl.key"
        class="tod-item" :class="{ dimmed: !visibleTimes.has(hl.key) }"
        @mouseenter="hoveredTime = hl.key" @mouseleave="hoveredTime = null"
        @click="toggleTime(hl.key)">
        <span class="tod-dot" :style="{ background: hl.color }"></span>
        <span class="tod-label" :class="{ struck: !visibleTimes.has(hl.key) }">{{ hl.label }}</span>
      </button>
    </div>
    <div class="tod-hint">Klicken zum Ausblenden · Hovern zum Hervorheben</div>
    <span class="zoom-hint">Mausrad zum Zoomen · Ziehen zum Verschieben</span>

    <!-- Erklärung: Besondere Stunden -->
    <div v-if="highlightOutliers" class="outlier-hint">
      <span class="oh-icon">ⓘ</span>
      <span class="oh-text"><strong>Besondere Stunden</strong> sind Stunden, in denen EE-Anteil oder CO₂-Intensität mehr als <strong>2 Standardabweichungen</strong> vom Mittelwert des gewählten Zeitraums entfernt liegen – z.&thinsp;B. extrem windreiche oder windarme Stunden, Stromimporte oder Netzengpässe.</span>
    </div>

    <!-- Zeitraum-Chips (wie Strommix-Segment-Toggle) -->
    <div class="range-section">
      <div class="range-presets">
        <button v-for="pr in RANGE_PRESETS" :key="pr.label"
          class="segment-btn range-btn"
          :class="{ active: selectedStartIdx === pr.start && selectedEndIdx === pr.end }"
          @click="applyPreset(pr.start, pr.end)">
          {{ pr.label }}
        </button>
        <span class="range-label">{{ dateLabel }}</span>
      </div>
    </div>

    <!-- Chart + Sidebar (Grid wie Strommix) -->
    <div class="scatter-layout">
      <div class="scatter-chart">
        <div ref="containerRef" class="chart-wrap">
          <svg ref="svgRef" class="scatter-svg"></svg>
          <!-- Tooltip (Hover) -->
          <div v-if="tooltip?.d && !selectedHour" class="scatter-tooltip"
            :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
            <div class="tt-row"><span class="tt-label">Stunde</span><span class="tt-val">{{ formatTimestamp(tooltip.d.timestamp) }}</span></div>
            <div class="tt-row"><span class="tt-label">EE-Anteil</span><span class="tt-val">{{ tooltip.d.ee_share.toFixed(1) }} %</span></div>
            <div class="tt-row"><span class="tt-label">CO₂</span><span class="tt-val">{{ tooltip.d.co2_g_per_kwh.toFixed(0) }} g/kWh</span></div>
            <div class="tt-row"><span class="tt-label">Nachfrage</span><span class="tt-val">{{ (tooltip.d.load_mwh / 1000).toFixed(1) }} GW</span></div>
            <div class="tt-row"><span class="tt-label">Preis</span><span class="tt-val">{{ tooltip.d.price_eur_mwh.toFixed(1) }} €/MWh</span></div>
          </div>
          <!-- Tooltip (Selektion – permanent) -->
          <div v-if="selectedHour" class="scatter-tooltip scatter-tooltip-selected"
            :style="{ left: (xScale ? xScale(selectedHour.point.x) + MARGIN.left : 0) + 'px', top: (yScale ? yScale(selectedHour.point.y) + MARGIN.top : 0) + 'px' }">
            <div class="tt-row"><span class="tt-label">Stunde</span><span class="tt-val">{{ formatTimestamp(selectedHour.row.timestamp) }}</span></div>
            <div class="tt-row"><span class="tt-label">EE-Anteil</span><span class="tt-val">{{ selectedHour.row.ee_share.toFixed(1) }} %</span></div>
            <div class="tt-row"><span class="tt-label">CO₂</span><span class="tt-val">{{ selectedHour.row.co2_g_per_kwh.toFixed(0) }} g/kWh</span></div>
            <div class="tt-row"><span class="tt-label">Nachfrage</span><span class="tt-val">{{ (selectedHour.row.load_mwh / 1000).toFixed(1) }} GW</span></div>
            <div class="tt-row"><span class="tt-label">Preis</span><span class="tt-val">{{ selectedHour.row.price_eur_mwh.toFixed(1) }} €/MWh</span></div>
          </div>
        </div>
      </div>
      <aside class="scatter-sidebar">
        <div class="metric-tile">
          <div class="tile-eyebrow">Korrelation</div>
          <div class="tile-value">{{ sidebarMetrics.correlation.value }}</div>
          <div class="tile-context">{{ sidebarMetrics.correlation.context }}</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile">
          <div class="tile-eyebrow">Steigung Trendlinie</div>
          <div class="tile-value">{{ sidebarMetrics.slope.value }}</div>
          <div class="tile-context">{{ sidebarMetrics.slope.context }}</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile">
          <div class="tile-eyebrow">Datenpunkte</div>
          <div class="tile-value">{{ sidebarMetrics.count.value }}</div>
          <div class="tile-context">{{ sidebarMetrics.count.context }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.scatter-card { width:100%; }

/* ---- Header (wie Strommix) ---- */
.scatter-header { margin-bottom:2px; }
.scatter-kicker {
  display:block;
  font-family:var(--font-sans); font-size:11px; font-weight:600;
  letter-spacing:0.06em; text-transform:uppercase;
  color:var(--fg-muted); margin-bottom:8px;
}
.scatter-heading {
  font-family:var(--font-serif); font-size:22px; font-weight:500;
  color:var(--fg); margin:0;
}
.scatter-subtitle {
  font-family:var(--font-sans); font-size:15px; color:var(--fg-muted);
  max-width:640px; line-height:1.5; margin:8px 0 32px;
}

/* ---- Kontrollleiste (wie Strommix-Toggles) ---- */
.scatter-controls {
  display:flex; flex-direction:column; align-items:flex-end; gap:8px;
  margin-bottom:12px;
}
.control-row {
  display:flex; align-items:center; gap:6px;
}
.control-label {
  font-family:var(--font-sans); font-size:11px; font-weight:600;
  text-transform:uppercase; letter-spacing:0.04em; color:var(--fg-muted);
}
.segment-group {
  display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden;
}
.segment-btn {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  padding:4px 10px; border:none; background:transparent; color:var(--fg-muted);
  cursor:pointer; transition:all .15s;
  border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em;
}
.segment-btn:last-child { border-right:none; }
.segment-btn:hover { color:var(--fg); }
.segment-btn.active { background:var(--accent); color:#fff; }

.segment-btn-sm {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  padding:3px 8px; border:none; background:transparent; color:var(--fg-muted);
  cursor:pointer; transition:all .15s;
  border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em;
}
.segment-btn-sm:last-child { border-right:none; }
.segment-btn-sm:hover { color:var(--fg); }
.segment-btn-sm.active { background:var(--accent); color:#fff; }

.control-row-secondary { gap:4px; }

.reset-chip-inline {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  color:var(--fg); padding:3px 8px;
  border:1px solid var(--hairline); border-radius:4px;
  background:var(--bg); cursor:pointer; white-space:nowrap;
}
.reset-chip-inline:hover { border-color:var(--accent); color:var(--accent); }
.segment-static {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  padding:4px 10px; border:1px solid var(--hairline); border-radius:6px;
  text-transform:uppercase; letter-spacing:.04em;
}
.zoom-hint {
  font-family:var(--font-sans); font-size:11px; color:var(--fg-muted);
  opacity:0.5;
}

/* ---- Tageszeit-Legende (wie Strommix-Legenden-Bar) ---- */
.tod-legend-bar {
  display:flex; flex-wrap:wrap; gap:4px 16px; margin-bottom:4px; align-items:center;
}
.tod-item {
  display:inline-flex; align-items:center; gap:4px;
  border:none; background:transparent; cursor:pointer;
  padding:2px 4px; border-radius:4px; transition:opacity .2s; font-family:var(--font-sans);
}
.tod-item:hover { background:#f0f0f0; }
.tod-item.dimmed { opacity:.5; }
.tod-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.tod-label { font-size:13px; color:var(--fg); transition:all .2s; }
.tod-label.struck { text-decoration:line-through; color:var(--fg-muted); }
.tod-hint {
  font-family:var(--font-sans); font-size:10px; color:var(--fg-muted);
  opacity:0.6; margin-bottom:12px;
}

/* ---- Bereich Ausreißer-Hinweis ---- */
.outlier-hint {
  display:flex; align-items:flex-start; gap:6px;
  margin:0 0 10px; padding:6px 10px;
  background:#F8F8F8; border-radius:4px;
  font-family:var(--font-sans); font-size:0.7rem;
  color:var(--fg-muted); line-height:1.5;
}
.oh-icon { font-size:0.75rem; flex-shrink:0; margin-top:1px; }
.oh-text { flex:1; }

/* ---- Zeitraum-Chips (Segment-Toggle-Stil) ---- */
.range-section { margin-bottom:16px; }
.range-presets {
  display:flex; gap:4px; align-items:center; flex-wrap:wrap;
}
.range-btn { font-size:11px !important; }
.range-label {
  font-family:var(--font-sans); font-size:12px; font-weight:500;
  color:var(--fg); margin-left:12px;
}

/* ---- Chart + Sidebar (Grid wie Strommix) ---- */
.scatter-layout {
  display:grid;
  grid-template-columns:1fr 260px;
  gap:32px;
  align-items:start;
}
.scatter-chart {
  min-width:0;
}
.chart-wrap {
  width:100%; max-width:100%; overflow:hidden; position:relative;
}
.scatter-svg {
  display:block; width:100%; height:auto;
  cursor:crosshair;
}
.reset-chip {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  color:var(--fg); padding:4px 10px;
  border:1px solid var(--hairline); border-radius:4px;
  background:var(--bg); cursor:pointer; white-space:nowrap;
  margin-top:8px;
}
.reset-chip:hover { border-color:var(--accent); color:var(--accent); }

/* ---- Sidebar (wie ExtremeValuesPanel) ---- */
.scatter-sidebar {
  border-left:1px solid var(--hairline);
  padding:4px 0 4px 20px;
  position:sticky; top:20px;
}
.metric-tile { padding:20px 0; position:relative; }
.metric-divider {
  height:1px; background:var(--hairline); margin:0;
}
.tile-eyebrow {
  font-family:var(--font-sans); font-size:10px; font-weight:600;
  letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted);
  margin-bottom:6px;
}
.tile-value {
  font-family:var(--font-serif); font-size:32px; font-weight:500;
  color:var(--fg); line-height:1.1; margin-bottom:4px;
}
.tile-context {
  font-family:var(--font-sans); font-size:12px; color:var(--fg-muted);
}

/* ---- Tooltip ---- */
.scatter-tooltip {
  position:absolute;
  transform:translate(-50%,calc(-100% - 8px));
  background:var(--fg); color:var(--bg);
  font-family:var(--font-sans); font-size:0.7rem;
  padding:8px 10px; line-height:1.5;
  pointer-events:none; z-index:20; white-space:nowrap;
}
.tt-row { display:flex; justify-content:space-between; gap:12px; }
.tt-label { opacity:0.6; }
.tt-val { font-weight:600; text-align:right; }

/* ---- Responsive ---- */
@media (max-width:1200px) {
  .scatter-layout { grid-template-columns:1fr; }
  .scatter-sidebar { position:static; border-left:none; border-top:1px solid var(--hairline); padding:16px 0 0; }
}
</style>