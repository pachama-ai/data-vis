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
const xLabelKurz = computed(() => xAxis.value.label)
const viewColor = computed(() => axisColor.value.fill)

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
  if (viewMode.value === 'contour') {
    // Single-Select: Klick isoliert eine Tageszeit, zweiter Klick auf selbe setzt zurück
    const wasActive = visibleTimes.value.has(key)
    const isOnly = visibleTimes.value.size === 1 && wasActive
    if (isOnly) {
      // Zurücksetzen auf alle vier
      visibleTimes.value = new Set(HOUR_LABELS.map(h => h.key))
    } else {
      visibleTimes.value = new Set([key])
    }
  } else {
    // Punkte-Modus: Multi-Select (wie bisher)
    if (visibleTimes.value.has(key)) {
      visibleTimes.value.delete(key)
      if (visibleTimes.value.size === 0) visibleTimes.value.add(key)
    } else {
      visibleTimes.value.add(key)
    }
    visibleTimes.value = new Set(visibleTimes.value)
  }
  scheduleRender('metricChanged')
}

function resetAllTimes() {
  visibleTimes.value = new Set(HOUR_LABELS.map(h => h.key))
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
// Regression (für Trendlinie im Chart)
// ----------------------------------------------------------------
const rangeStats = computed(() => {
  const pts = rangePoints.value; const n = pts.length
  if (n < 3) return { r: 0, r2: 0, a: 0, b: 0, count: n }
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0
  for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; sy2 += p.y * p.y }
  const rNum = n * sxy - sx * sy
  const rDen = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  const r = rDen === 0 ? 0 : rNum / rDen
  const aD = n * sx2 - sx * sx
  const a = aD === 0 ? 0 : rNum / aD
  const b = (sy - a * sx) / n
  return { r, r2: r * r, a, b, count: n }
})

// ----------------------------------------------------------------
// Extreme-Werte-Berechnung (10 % niedrigste / höchste X-Werte)
// ----------------------------------------------------------------
interface ExtremeGroup {
  avgX: number
  avgY: number
  n: number
}
interface ScatterExtremes {
  lowGroup: ExtremeGroup
  highGroup: ExtremeGroup
  absDiff: number
  relDiff: number
}

function calcExtremes(pts: Point[]): ScatterExtremes | null {
  if (pts.length < 200) return null
  const sorted = [...pts].sort((a, b) => a.x - b.x)
  const cutoff = Math.floor(sorted.length * 0.1)
  const low = sorted.slice(0, cutoff)
  const high = sorted.slice(-cutoff)
  const avg = (arr: Point[], field: 'x' | 'y') => arr.reduce((s, d) => s + d[field], 0) / arr.length
  const avgXLow = avg(low, 'x'); const avgYLow = avg(low, 'y')
  const avgXHigh = avg(high, 'x'); const avgYHigh = avg(high, 'y')
  return {
    lowGroup: { avgX: avgXLow, avgY: avgYLow, n: low.length },
    highGroup: { avgX: avgXHigh, avgY: avgYHigh, n: high.length },
    absDiff: avgYHigh - avgYLow,
    relDiff: avgYLow === 0 ? 0 : ((avgYHigh - avgYLow) / avgYLow) * 100,
  }
}

// Beschriftungs-Hilfen
const xAxisMeta = computed(() => {
  const key = xAxis.value.key
  if (key === 'ee_share')     return { label: 'EE-Anteil', unit: '%', dec: 1, niedrig: 'niedrigem EE-Anteil', hoch: 'hohem EE-Anteil', niedrigUpper: 'NIEDRIGER EE-ANTEIL', hochUpper: 'HOHER EE-ANTEIL' }
  if (key === 'fossil_share') return { label: 'Fossil-Anteil', unit: '%', dec: 1, niedrig: 'niedrigem Fossil-Anteil', hoch: 'hohem Fossil-Anteil', niedrigUpper: 'NIEDRIGER FOSSIL-ANTEIL', hochUpper: 'HOHER FOSSIL-ANTEIL' }
  if (key === 'load')         return { label: 'Stromnachfrage', unit: 'GW', dec: 1, niedrig: 'niedriger Stromnachfrage', hoch: 'hoher Stromnachfrage', niedrigUpper: 'NIEDRIGE STROMNACHFRAGE', hochUpper: 'HOHE STROMNACHFRAGE' }
  if (key === 'price')        return { label: 'Strompreis', unit: 'EUR/MWh', dec: 1, niedrig: 'niedrigem Strompreis', hoch: 'hohem Strompreis', niedrigUpper: 'NIEDRIGER STROMPREIS', hochUpper: 'HOHER STROMPREIS' }
  return { label: 'X', unit: '', dec: 1, niedrig: 'niedrigem X', hoch: 'hohem X', niedrigUpper: 'NIEDRIGER X', hochUpper: 'HOHER X' }
})

function fmtVal(v: number, unit: string, dec: number): string {
  return v.toFixed(dec).replace('.', ',') + ' ' + unit
}
function fmtInt(v: number, unit: string): string {
  return Math.round(v).toLocaleString('de-DE') + ' ' + unit
}

// ----------------------------------------------------------------
// Sidebar-Metriken (Extremwert-Kacheln)
// ----------------------------------------------------------------
const sidebarMetrics = computed(() => {
  const pts = rangePoints.value

  if (compareMode.value === 'vergleich') {
    const ptsA = compareAPoints.value
    const ptsB = compareBPoints.value
    const meta = xAxisMeta.value
    const eA = calcExtremes(ptsA)
    const eB = calcExtremes(ptsB)
    const labelA = RANGE_PRESETS[compareRangeA.value]?.label || ''
    const labelB = RANGE_PRESETS[compareRangeB.value]?.label || ''
    const yUnit = 'g CO₂/kWh'

    return {
      mode: 'vergleich' as const,
      tile1: {
        eyebrow: meta.niedrigUpper,
        valueA: eA ? fmtInt(eA.lowGroup.avgY, yUnit) : '—',
        ctxA: eA ? `Ø ${meta.label}: ${eA.lowGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}` : 'zu wenig Daten (< 200 Std.)',
        valueB: eB ? fmtInt(eB.lowGroup.avgY, yUnit) : '—',
        ctxB: eB ? `Ø ${meta.label}: ${eB.lowGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}` : 'zu wenig Daten (< 200 Std.)',
        labelA, labelB,
      },
      tile2: {
        eyebrow: meta.hochUpper,
        valueA: eA ? fmtInt(eA.highGroup.avgY, yUnit) : '—',
        ctxA: eA ? `Ø ${meta.label}: ${eA.highGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}` : 'zu wenig Daten (< 200 Std.)',
        valueB: eB ? fmtInt(eB.highGroup.avgY, yUnit) : '—',
        ctxB: eB ? `Ø ${meta.label}: ${eB.highGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}` : 'zu wenig Daten (< 200 Std.)',
        labelA, labelB,
      },
      tile3: {
        eyebrow: 'CO₂-UNTERSCHIED',
        valueA: eA ? fmtInt(eA.absDiff, yUnit) : '—',
        subA: eA ? `${Math.round(eA.relDiff) >= 0 ? '+' : ''}${Math.round(eA.relDiff)} %` : '',
        valueB: eB ? fmtInt(eB.absDiff, yUnit) : '—',
        subB: eB ? `${Math.round(eB.relDiff) >= 0 ? '+' : ''}${Math.round(eB.relDiff)} %` : '',
        labelA, labelB,
      },
    }
  }

  // Einzel-Modus
  const e = calcExtremes(pts)
  const meta = xAxisMeta.value
  const yUnit = 'g CO₂/kWh'

  if (!e) {
    return {
      mode: 'einzel' as const,
      tile1: { eyebrow: meta.niedrigUpper, value: '—', context: 'zu wenig Daten (< 200 Std.)' },
      tile2: { eyebrow: meta.hochUpper, value: '—', context: 'zu wenig Daten (< 200 Std.)' },
      tile3: { eyebrow: 'CO₂-UNTERSCHIED', value: '—', context: 'zu wenig Daten (< 200 Std.)' },
    }
  }

  const diffWord = e.absDiff < 0 ? `niedrigem ${meta.label}` : `niedrigem ${meta.label}`

  return {
    mode: 'einzel' as const,
    tile1: {
      eyebrow: meta.niedrigUpper,
      value: fmtInt(e.lowGroup.avgY, yUnit),
      context: `Unterste 10 % der Stunden · Ø ${meta.label}: ${e.lowGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}`,
    },
    tile2: {
      eyebrow: meta.hochUpper,
      value: fmtInt(e.highGroup.avgY, yUnit),
      context: `Oberste 10 % der Stunden · Ø ${meta.label}: ${e.highGroup.avgX.toFixed(meta.dec).replace('.', ',')} ${meta.unit}`,
    },
    tile3: {
      eyebrow: 'CO₂-UNTERSCHIED',
      value: fmtInt(e.absDiff, yUnit),
      sub: `${Math.round(e.relDiff) >= 0 ? '+' : ''}${Math.round(e.relDiff)} %`,
      context: `gegenüber Stunden mit ${diffWord}`,
    },
  }
})

// ----------------------------------------------------------------
// Toggle States
// ----------------------------------------------------------------
const viewMode = ref<'points' | 'contour'>('points')
const compareMode = ref<'einzel' | 'vergleich'>('einzel')
const compareRangeA = ref(0) // Index in RANGE_PRESETS
const compareRangeB = ref(5) // Index in RANGE_PRESETS

const compareAPoints = computed<Point[]>(() => {
  const pr = RANGE_PRESETS[compareRangeA.value]
  if (!pr) return []
  const start = monthToDate(pr.start).getTime()
  const end = monthToDate(pr.end + 1).getTime()
  const xFn = xAxis.value.value
  return props.data.filter((r) => {
    const t = new Date(r.timestamp).getTime()
    return t >= start && t < end
  }).map((r) => ({
    id: r.timestamp,
    x: xFn(r),
    y: r.co2_g_per_kwh,
    hour: new Date(r.timestamp).getUTCHours(),
  })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
})

const compareBPoints = computed<Point[]>(() => {
  const pr = RANGE_PRESETS[compareRangeB.value]
  if (!pr) return []
  const start = monthToDate(pr.start).getTime()
  const end = monthToDate(pr.end + 1).getTime()
  const xFn = xAxis.value.value
  return props.data.filter((r) => {
    const t = new Date(r.timestamp).getTime()
    return t >= start && t < end
  }).map((r) => ({
    id: r.timestamp,
    x: xFn(r),
    y: r.co2_g_per_kwh,
    hour: new Date(r.timestamp).getUTCHours(),
  })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
})
// ----------------------------------------------------------------
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
// Selection
// ----------------------------------------------------------------
let xScale: d3.ScaleLinear<number, number> | null = null
let yScale: d3.ScaleLinear<number, number> | null = null
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
// Render-Scheduler (rAF-basiert)
// ----------------------------------------------------------------
type RenderReason = 'init' | 'metricChanged' | 'timeRangeChanged'
let renderRaf: number | null = null
let pendingReason: RenderReason | null = null
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
  const ux = xScale
  const uy = yScale
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

    // Hintergrund – entfernt, Chart schwebt auf var(--bg)

    // Chart-Rahmen (vier Hairline-Seiten)
    let frameRect = svg.selectChild<SVGRectElement>('rect.chart-frame')
    if (frameRect.empty()) {
      frameRect = svg.insert('rect', ':first-child').attr('class', 'chart-frame')
        .attr('x', MARGIN.left).attr('y', MARGIN.top)
        .attr('width', INNER_W).attr('height', INNER_H)
        .attr('fill', 'none').attr('stroke', 'var(--hairline)').attr('stroke-width', 1)
        .attr('pointer-events', 'none')
    }

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
    .attr('stroke', 'var(--hairline)').attr('stroke-width', 1)

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

  // 3. Darstellung je nach Modus
  if (reason === 'init' || reason === 'metricChanged' || reason === 'timeRangeChanged') {
    // Bestehende Gruppen leeren
    pg.selectAll('*').remove()
    chart.selectAll('g.contour-group').remove()
    chart.selectAll('g.contour-compare').remove()
    chart.selectAll('g.reg-group').remove()
    chart.selectAll('rect.hover-hit').remove()
    chart.selectAll('g.compare-legend').remove()

    if (viewMode.value === 'contour') {
      if (compareMode.value === 'vergleich') {
        renderCompareContours(ux, uy)
      } else {
        renderContours(ux, uy)
      }
    } else {
      // Punkte-Modus
      const filteredPts = pts.filter((p) => visibleTimes.value.has(getHourKey(p.hour)))

      const circles = pg.selectAll<SVGCircleElement, Point>('circle.point')
        .data(filteredPts, (d) => String(d.id))
      circles.exit().remove()
      circles.enter().append('circle')
        .attr('class', 'point').attr('cursor', 'crosshair')
        .merge(circles)
        .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y))
        .attr('fill', (d) => compareMode.value === 'vergleich' ? ( '#4A90A4') : getHourColor(d.hour))
        .attr('stroke', 'none').attr('r', POINT_R)
        .attr('opacity', (d) => {
          if (compareMode.value === 'vergleich') return 0.4
          const hk = getHourKey(d.hour)
          if (hoveredTime.value && hoveredTime.value !== hk) return 0.15
          if (selectedHour.value && selectedHour.value.point.id !== d.id) return ac.opacity * 0.5
          return ac.opacity
        })

      // Unsichtbare Treffer-Kreise für Hover (nur im Einzelmodus)
      if (compareMode.value !== 'vergleich') {
        const hitCircles = pg.selectAll<SVGCircleElement, Point>('circle.point-hit')
          .data(filteredPts, (d) => String(d.id))
        hitCircles.exit().remove()
        hitCircles.enter().append('circle')
          .attr('class', 'point-hit').attr('fill', 'transparent').attr('stroke', 'none')
          .attr('cursor', 'pointer').attr('pointer-events', 'all')
          .merge(hitCircles)
          .attr('cx', (d) => ux(d.x)).attr('cy', (d) => uy(d.y)).attr('r', 8)
      }

      // Vergleichs-Punkte (zweiter Zeitraum) im Punkte-Modus
      if (compareMode.value === 'vergleich') {
        const cmpB = compareBPoints.value.filter((p) => visibleTimes.value.has(getHourKey(p.hour)))
        pg.selectAll('circle.point-compare').remove()
        pg.selectAll('circle.point-compare')
          .data(cmpB, (d: any) => String(d.id))
          .join('circle')
          .attr('class', 'point-compare')
          .attr('cx', (d: any) => ux(d.x)).attr('cy', (d: any) => uy(d.y))
          .attr('fill', '#D97742').attr('stroke', 'none').attr('r', POINT_R)
          .attr('opacity', 0.4).attr('pointer-events', 'none')
      }
    }

    console.timeEnd(`  data-join (${pts.length} pts)`)

    const circlesInDom = pg.selectAll('circle.point').size()
    console.table({ selectedPeriod: `${selectedStartIdx.value * 2 + 2015}-${selectedEndIdx.value * 2 + 2015}`, filteredPoints: pts.length, circlesInDom })

    // Trendlinie (komplett)
    console.time(`  trendline`)
    updateTrendline(ux, uy, ac)
    console.timeEnd(`  trendline`)

    // Hover-Overlay (brute-force nearest point, kein Delaunay/Voronoi)
    console.time(`  hover-overlay`)
    updateHoverOverlay(ux, uy, pts, ac)
    console.timeEnd(`  hover-overlay`)

  } else if (reason === 'timeRangeChanged') {
    // Data-Join passiert bereits im ersten if-Zweig

    // Hover-Overlay aktualisieren
    updateHoverOverlay(ux, uy, pts, ac)

  }
  console.timeEnd(`⏱ updateChart [${reason}]`)
}

// ----------------------------------------------------------------
// Sub-Funktionen
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Kontur-Rendering (2D-Density) – 6 Level, Tageszeit-Filter aktiv
// ----------------------------------------------------------------
function renderContours(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  chart.selectAll('g.contour-group').remove()
  const pts = rangePoints.value
  if (!pts.length) return

  const activeKeys = [...visibleTimes.value]
  const isAllActive = activeKeys.length === 4
  const baseColor = viewColor.value
  const colorMap: Record<string, string> = { nacht: '#2C3E50', morgen: '#D97742', tag: '#E8B547', abend: '#B85C8E' }

  if (isAllActive) {
    // Einzige Kontur in X-Achsen-Farbe
    drawSingleContour(ux, uy, pts, baseColor, 0.08, 0.6)
  } else {
    // Mehrere Tageszeiten → je eine Kontur in eigener Farbe
    for (const key of activeKeys) {
      const filtered = pts.filter((p) => getHourKey(p.hour) === key)
      if (filtered.length < 50) continue
      drawSingleContour(ux, uy, filtered, colorMap[key] || baseColor, 0.1, 0.45)
    }
  }
}

function drawSingleContour(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>,
                           data: Point[], color: string, opacityMin: number, opacityMax: number) {
  const pixelPts = data.map((p) => [ux(p.x), uy(p.y)])
  const density = d3.contourDensity()
    .x((d) => d[0]).y((d) => d[1])
    .size([INNER_W, INNER_H]).bandwidth(20).thresholds(6)(pixelPts as any)
  const cg = chart.append('g').attr('class', 'contour-group')
  const maxV = d3.max(density, (d) => d.value) || 1
  for (const d of density) {
    const t = d.value / maxV
    const opacity = opacityMin + (opacityMax - opacityMin) * t
    cg.append('path').datum(d).attr('d', d3.geoPath() as any)
      .attr('fill', color).attr('opacity', opacity)
      .attr('stroke', color).attr('stroke-width', 0.5).attr('stroke-opacity', 0.4)
  }
}

function renderCompareContours(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  chart.selectAll('g.contour-compare').remove()
  if (compareMode.value !== 'vergleich') return
  const ptsA = compareAPoints.value; const ptsB = compareBPoints.value
  if (!ptsA.length || !ptsB.length) return
  const cg = chart.append('g').attr('class', 'contour-compare')
  for (const [pts, c] of [[ptsA, '#4A90A4'], [ptsB, '#D97742']] as const) {
    const pixelPts = pts.map((p) => [ux(p.x), uy(p.y)])
    const density = d3.contourDensity()
      .x((d) => d[0]).y((d) => d[1]).size([INNER_W, INNER_H]).bandwidth(20).thresholds(4)(pixelPts as any)
    const maxV = d3.max(density, (d) => d.value) || 1
    for (const d of density) {
      const t = d.value / maxV
      const opacity = 0.08 + (0.45 - 0.08) * t
      cg.append('path').datum(d).attr('d', d3.geoPath() as any)
        .attr('fill', c).attr('opacity', opacity)
        .attr('stroke', c).attr('stroke-width', 0.5).attr('stroke-opacity', 0.5)
    }
  }
}

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
    .attr('font-size', '8px').attr('fill', '#666').attr('opacity', 0.7).text(`R² = ${(Math.round(r2 * 100) / 100).toFixed(2)}`)
}



function updateExplainMode(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  // Entfernt – Einordnung-Modus wurde gestrichen
}

const POINT_R = 2.5

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
// Gezielte Watches statt watchEffect
// ----------------------------------------------------------------
watch(xAxis, () => { scheduleRender('metricChanged') })
watch([selectedStartIdx, selectedEndIdx], () => { scheduleRender('timeRangeChanged') })

watch(compareMode, () => {
  // Bei Wechsel zu Vergleich: Tageszeit-Filter zurücksetzen
  if (compareMode.value === 'vergleich') {
    visibleTimes.value = new Set(HOUR_LABELS.map(h => h.key))
  }
  scheduleRender('timeRangeChanged')
})
watch([compareRangeA, compareRangeB], () => { scheduleRender('timeRangeChanged') })
watch(viewMode, () => {
  if (viewMode.value === 'points' && compareMode.value === 'vergleich') {
    compareMode.value = 'einzel'
  }
  scheduleRender('metricChanged')
})

// Initialer Render
watch(svgRef, (el) => { if (el) scheduleRender('init') }, { once: true })

// ----------------------------------------------------------------
// Cleanup
// ----------------------------------------------------------------
onUnmounted(() => {
  if (renderRaf !== null) { cancelAnimationFrame(renderRaf); renderRaf = null }
  if (hoverRaf !== null) { cancelAnimationFrame(hoverRaf); hoverRaf = null }
})
</script>

<template>
  <div class="scatter-card">
    <!-- Header mit Kicker + Titel + Untertitel (wie Strommix) -->
    <div class="scatter-header">
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

      <div class="control-row control-row-tertiary">
        <span class="control-label">Darstellung:</span>
        <div class="segment-group">
          <button class="segment-btn-sm" :class="{ active: viewMode === 'points' }" @click="viewMode = 'points'">Punkte</button>
          <button class="segment-btn-sm" :class="{ active: viewMode === 'contour' }" @click="viewMode = 'contour'">Konturen</button>
        </div>
      </div>
    </div>

    <!-- Tageszeit-Legende -->
    <div class="tod-legend-bar">
      <button v-for="hl in HOUR_LABELS" :key="hl.key"
        class="tod-item" :class="{ dimmed: !visibleTimes.has(hl.key) || compareMode === 'vergleich', 'tod-disabled': compareMode === 'vergleich' }"
        :disabled="compareMode === 'vergleich'"
        @mouseenter="compareMode !== 'vergleich' && (hoveredTime = hl.key)" @mouseleave="hoveredTime = null"
        @click="compareMode !== 'vergleich' && toggleTime(hl.key)">
        <span class="tod-dot" :style="{ background: hl.color }"></span>
        <span class="tod-label" :class="{ struck: !visibleTimes.has(hl.key) }">{{ hl.label }}</span>
      </button>
      <button v-if="viewMode === 'contour' && visibleTimes.size === 1 && compareMode !== 'vergleich'" class="tod-item tod-item-all" @click="resetAllTimes">
        <span class="tod-dot" style="background:var(--fg-muted);opacity:0.5"></span>
        <span class="tod-label">Alle Tageszeiten</span>
      </button>
    </div>
    <div class="tod-hint">{{ compareMode === 'vergleich' ? 'Tageszeit-Filter nur im Einzelmodus verfügbar' : viewMode === 'points' ? 'Klicken zum Ausblenden · Hovern zum Hervorheben' : 'Klicken isoliert eine Tageszeit' }}</div>



    <!-- Zeitraum-Chips + Vergleichsmodus -->
    <div class="range-section">
      <div v-if="viewMode === 'contour'" class="compare-toggle-row">
        <div class="segment-group compare-toggle-group">
          <button class="segment-btn-sm" :class="{ active: compareMode === 'einzel' }" @click="compareMode = 'einzel'">Einzel</button>
          <button class="segment-btn-sm" :class="{ active: compareMode === 'vergleich' }" @click="compareMode = 'vergleich'">Vergleich</button>
        </div>
      </div>
      <div v-if="compareMode === 'einzel'" class="range-presets">
        <button v-for="(pr, pi) in RANGE_PRESETS" :key="pr.label"
          class="segment-btn range-btn"
          :class="{ active: selectedStartIdx === pr.start && selectedEndIdx === pr.end }"
          @click="applyPreset(pr.start, pr.end)">
          {{ pr.label }}
        </button>
        <span class="range-label">{{ dateLabel }}</span>
      </div>
      <div v-if="compareMode === 'vergleich'" class="range-presets-stacked">
        <div class="compare-row"><span class="compare-row-label">A</span>
          <button v-for="(pr, pi) in RANGE_PRESETS" :key="'a'+pi"
            class="segment-btn range-btn"
            :class="{ active: compareRangeA === pi }"
            @click="compareRangeA = pi">{{ pr.label }}</button>
        </div>
        <div class="compare-row"><span class="compare-row-label">B</span>
          <button v-for="(pr, pi) in RANGE_PRESETS" :key="'b'+pi"
            class="segment-btn range-btn"
            :class="{ active: compareRangeB === pi }"
            @click="compareRangeB = pi">{{ pr.label }}</button>
        </div>
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
        <!-- Vergleich-Legende -->
        <div v-if="compareMode === 'vergleich' && compareRangeA !== null && compareRangeB !== null" class="compare-legend">
          <span class="compare-legend-dot" style="background:#4A90A4"></span> {{ RANGE_PRESETS[compareRangeA]?.label }}
          <span class="compare-legend-dot compare-legend-dot-b" style="background:#D97742"></span> {{ RANGE_PRESETS[compareRangeB]?.label }}
        </div>
      </div>
      <aside class="scatter-sidebar">
        <!-- Einzelmodus -->
        <template v-if="sidebarMetrics.mode === 'einzel'">
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile1.eyebrow }}</div>
            <div class="tile-value">{{ sidebarMetrics.tile1.value }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile1.context }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile2.eyebrow }}</div>
            <div class="tile-value">{{ sidebarMetrics.tile2.value }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile2.context }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile3.eyebrow }}</div>
            <div class="tile-value">{{ sidebarMetrics.tile3.value }}</div>
            <div v-if="sidebarMetrics.tile3.sub" class="tile-sub-value">{{ sidebarMetrics.tile3.sub }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile3.context }}</div>
          </div>
        </template>
        <!-- Vergleichsmodus -->
        <template v-if="sidebarMetrics.mode === 'vergleich'">
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile1.eyebrow }}</div>
            <div class="tile-subhead"><span class="color-dot" style="background:#4A90A4"></span> Zeitraum A ({{ sidebarMetrics.tile1.labelA }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile1.valueA }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile1.ctxA }}</div>
            <div class="tile-comp-spacer"></div>
            <div class="tile-subhead tile-subhead-b"><span class="color-dot" style="background:#D97742"></span> Zeitraum B ({{ sidebarMetrics.tile1.labelB }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile1.valueB }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile1.ctxB }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile2.eyebrow }}</div>
            <div class="tile-subhead"><span class="color-dot" style="background:#4A90A4"></span> Zeitraum A ({{ sidebarMetrics.tile2.labelA }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile2.valueA }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile2.ctxA }}</div>
            <div class="tile-comp-spacer"></div>
            <div class="tile-subhead tile-subhead-b"><span class="color-dot" style="background:#D97742"></span> Zeitraum B ({{ sidebarMetrics.tile2.labelB }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile2.valueB }}</div>
            <div class="tile-context">{{ sidebarMetrics.tile2.ctxB }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-tile">
            <div class="tile-eyebrow">{{ sidebarMetrics.tile3.eyebrow }}</div>
            <div class="tile-subhead"><span class="color-dot" style="background:#4A90A4"></span> Zeitraum A ({{ sidebarMetrics.tile3.labelA }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile3.valueA }}</div>
            <div v-if="sidebarMetrics.tile3.subA" class="tile-context">{{ sidebarMetrics.tile3.subA }}</div>
            <div class="tile-comp-spacer"></div>
            <div class="tile-subhead tile-subhead-b"><span class="color-dot" style="background:#D97742"></span> Zeitraum B ({{ sidebarMetrics.tile3.labelB }})</div>
            <div class="tile-value tile-value-sm">{{ sidebarMetrics.tile3.valueB }}</div>
            <div v-if="sidebarMetrics.tile3.subB" class="tile-context">{{ sidebarMetrics.tile3.subB }}</div>
          </div>
        </template>
      </aside>
    </div>

    <!-- Methodik-Fußnote -->
    <details class="methodik-footnote">
      <summary class="methodik-summary">Methodik &amp; Berechnungsgrundlage</summary>
      <div class="methodik-body">
        <p><strong>Extremwert-Kacheln:</strong> Für die Kacheln in der Seitenleiste werden die Stunden im gewählten Zeitraum nach dem X-Wert sortiert. Die untersten 10 % (Stunden mit dem niedrigsten X-Wert) und die obersten 10 % (Stunden mit dem höchsten X-Wert) bilden die zwei Vergleichsgruppen. Für jede Gruppe wird der Durchschnitt des X- und Y-Wertes berechnet. Bei 17.500 Stunden im Zeitraum entspricht dies je ca. 1.750 Stunden pro Gruppe. Der CO₂-Unterschied ist die Differenz der Y-Durchschnitte, absolut und relativ zum Durchschnitt der niedrigen Gruppe.</p>
        <p><strong>Datenbasis:</strong> Anzahl der Stundenwerte im gewählten Zeitraum. Bei Datenlücken (2018) fehlen ca. 25 % der Stunden.</p>
      </div>
    </details>
  </div>
</template>

<style scoped>
.scatter-card { width:100%; }

/* ---- Header (wie Strommix) ---- */
.scatter-header { margin-bottom:2px; }
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
.control-row-tertiary { gap:4px; }

.segment-static {
  font-family:var(--font-sans); font-size:11px; font-weight:500;
  padding:4px 10px; border:1px solid var(--hairline); border-radius:6px;
  text-transform:uppercase; letter-spacing:.04em;
}

/* ---- Vergleichs-Modus ---- */
.range-btn.compare {
  background: var(--bg);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
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
.tod-item.tod-disabled { opacity:0.3; cursor:not-allowed; }
.tod-item-all { margin-left:8px; opacity:0.7; }
.tod-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.tod-label { font-size:13px; color:var(--fg); transition:all .2s; }
.tod-label.struck { text-decoration:line-through; color:var(--fg-muted); }
.tod-hint {
  font-family:var(--font-sans); font-size:10px; color:var(--fg-muted);
  opacity:0.6; margin-bottom:12px;
}
.tod-dimmed { opacity:0.4; pointer-events:none; }

/* ---- Vergleichsmodus-Toggle + gestapelte Chip-Reihen ---- */
.compare-toggle-row {
  display:flex; gap:8px; align-items:center; margin-bottom:8px;
}
.compare-toggle-group .segment-btn-sm {
  font-size:11px !important;
}
.range-presets-stacked {
  display:flex; flex-direction:column; gap:6px;
}
.compare-row {
  display:flex; gap:4px; align-items:center; flex-wrap:wrap;
}
.compare-row-label {
  font-family:var(--font-sans); font-size:10px; font-weight:600;
  color:var(--fg-muted); width:14px; text-align:center; flex-shrink:0;
}
.compare-legend {
  display:flex; align-items:center; gap:8px;
  font-family:var(--font-sans); font-size:12px; color:var(--fg);
  margin-top:10px; padding-top:10px; border-top:1px solid var(--hairline);
}
.compare-legend-dot {
  display:inline-block; width:10px; height:10px; border-radius:50%;
}
.compare-legend-dot-b { margin-left:4px; }

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
  font-family:var(--font-serif); font-size:28px; font-weight:500;
  color:var(--fg); line-height:1.1; margin-bottom:4px;
}
.tile-sub-value {
  font-family:var(--font-serif); font-size:22px; font-weight:500;
  color:var(--fg-muted); line-height:1.2; margin-bottom:4px;
}
.tile-context {
  font-family:var(--font-sans); font-size:12px; color:var(--fg-muted);
}
.tile-value-sm { font-size:22px; color:var(--fg); }
.tile-subhead { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:4px; display:flex; align-items:center; gap:4px; }
.tile-subhead-b { color:var(--fg); }
.color-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.tile-comp-spacer { height:12px; }
.tile-diff { font-weight:600; margin-top:4px; }

/* ---- Methodik-Fußnote ---- */
.methodik-footnote { margin:40px 0 0; border-top:1px solid var(--hairline); padding-top:16px; }
.methodik-summary { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); cursor:pointer; user-select:none; }
.methodik-summary:hover { color:var(--fg); }
.methodik-body { font-family:var(--font-sans); font-size:13px; color:var(--fg-muted); line-height:1.7; margin-top:12px; }
.methodik-body p { margin:0 0 8px; }
.methodik-body p:last-child { margin-bottom:0; }

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