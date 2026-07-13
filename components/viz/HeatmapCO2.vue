<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{ data: HourlyRow[] }>()
const emit = defineEmits<{ 'day-selected': [isoDate: string] }>()

// ----------------------------------------------------------------
// Metriken
// ----------------------------------------------------------------
type MetricKey = 'co2' | 'ee' | 'fossil' | 'price'

interface MetricConfig {
  key: MetricKey
  label: string
  unit: string
  value: (row: HourlyRow) => number
  colorLo: string
  colorHi: string
  diverging?: boolean
  legendLo: string
  legendHi: string
}

const METRICS: MetricConfig[] = [
  { key: 'co2',    label: 'CO₂-Intensität',   unit: 'g/kWh',   value: (r) => r.co2_g_per_kwh,      colorLo: '#F5F5F0', colorHi: '#6B4423', legendLo: 'niedrige', legendHi: 'hohe CO₂-Intensität' },
  { key: 'ee',     label: 'EE-Anteil',         unit: '%',       value: (r) => r.ee_share,           colorLo: '#F5F5F0', colorHi: '#4A90A4', legendLo: 'niedriger', legendHi: 'hoher EE-Anteil' },
  { key: 'fossil', label: 'Fossiler Anteil',   unit: '%',       value: (r) => r.fossil_share,        colorLo: '#F5F5F0', colorHi: '#3A3A3A', legendLo: 'niedriger', legendHi: 'hoher fossiler Anteil' },
  { key: 'price',  label: 'Day-Ahead-Preis',   unit: 'EUR/MWh', value: (r) => r.price_eur_mwh,       colorLo: '#F5F5F0', colorHi: '#D97742', diverging: true, legendLo: 'negativ', legendHi: 'hoher Preis' },
]

const activeMetric = ref<MetricKey>('co2')
const currentMetric = computed(() => METRICS.find((m) => m.key === activeMetric.value)!)

// ----------------------------------------------------------------
// Jahr-Auswahl
// ----------------------------------------------------------------
const YEAR_OPTIONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
const selectedYear = ref(2024)

// ----------------------------------------------------------------
// Aggregierte Daten: 24×12 Matrix
const ALL_MONTHS = [0,1,2,3,4,5,6,7,8,9,10,11]
// ----------------------------------------------------------------
function computeMonthlyHeatmap(rows: HourlyRow[], year: number, metric: MetricConfig, months: number[]): number[][] {
  const result: number[][] = Array.from({ length: 12 }, () => Array(24).fill(NaN))
  const counts: number[][] = Array.from({ length: 12 }, () => Array(24).fill(0))
  for (const r of rows) {
    const d = new Date(r.timestamp)
    const y = d.getUTCFullYear()
    if (y !== year) continue
    const m = d.getUTCMonth()
    if (!months.includes(m)) continue
    const h = d.getUTCHours()
    const v = metric.value(r)
    if (!Number.isFinite(v)) continue
    if (isNaN(result[m][h])) { result[m][h] = v; counts[m][h] = 1 }
    else { result[m][h] += v; counts[m][h]++ }
  }
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      if (counts[m][h] > 0) result[m][h] /= counts[m][h]
    }
  }
  return result
}

function getFlatData(matrix: number[][]): { month: number; hour: number; value: number }[] {
  const out: { month: number; hour: number; value: number }[] = []
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const v = matrix[m][h]
      if (!isNaN(v)) out.push({ month: m, hour: h, value: v })
    }
  }
  return out
}

// ----------------------------------------------------------------
// Farb-Skala pro Metrik
// ----------------------------------------------------------------
function makeColorScale(metric: MetricConfig, dataMin: number, dataMax: number) {
  if (metric.diverging) {
    const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax), 1)
    return d3.scaleDiverging(d3.interpolateRgb('#4A90A4', '#F5F5F0', '#D97742')).domain([-absMax, 0, absMax])
  }
  return d3.scaleSequential(d3.interpolateRgb(metric.colorLo, metric.colorHi)).domain([dataMin, dataMax])
}

// ----------------------------------------------------------------
// Sidebar: Extremwerte
// ----------------------------------------------------------------
const sidebarExtremes = computed(() => {
  const matrix = computeMonthlyHeatmap(props.data, selectedYear.value, currentMetric.value, ALL_MONTHS)
  const flat = getFlatData(matrix)
  if (!flat.length) return null
  const metric = currentMetric.value
  const sorted = [...flat].sort((a, b) => a.value - b.value)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  let maxRange = 0; let maxRangeMonth = 0
  for (let m = 0; m < 12; m++) {
    const vals = matrix[m].filter(v => !isNaN(v))
    if (vals.length < 4) continue
    const mn = Math.min(...vals); const mx = Math.max(...vals)
    const r = mx - mn
    if (r > maxRange) { maxRange = r; maxRangeMonth = m }
  }

  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const fmt = (v: number) => metric.key === 'co2' ? `${Math.round(v)} g/kWh` : v.toFixed(1).replace('.', ',') + ' ' + metric.unit

  return {
    max: { label: monthNames[max.month], hour: max.hour, value: fmt(max.value) },
    min: { label: monthNames[min.month], hour: min.hour, value: fmt(min.value) },
    range: { month: monthNames[maxRangeMonth], diff: metric.key === 'co2' ? `${Math.round(maxRange)} g/kWh` : maxRange.toFixed(1).replace('.', ',') + ' ' + metric.unit },
  }
})

// ----------------------------------------------------------------
// Container + Resize
// ----------------------------------------------------------------
const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(800)
let resizeObs: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) { containerWidth.value = entry.contentRect.width }
    })
    resizeObs.observe(containerRef.value)
  }
})
onUnmounted(() => { resizeObs?.disconnect() })

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipEl: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null
onUnmounted(() => { tooltipEl?.remove() })

const MARGIN = { top: 28, right: 70, bottom: 36, left: 48 }
const CHART_H = 300
const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// ----------------------------------------------------------------
// Zeichnen
// ----------------------------------------------------------------
watch([() => activeMetric.value, () => selectedYear.value, containerWidth], () => { drawHeatmap() }, { deep: false })
onMounted(() => { drawHeatmap() })

function drawHeatmap() {
  if (!svgRef.value || containerWidth.value < 100) return
  const rows = props.data
  if (!rows.length) return

  const metric = currentMetric.value
  const matrix = computeMonthlyHeatmap(rows, selectedYear.value, metric, ALL_MONTHS)
  const flat = getFlatData(matrix)
  const allVals = flat.map(d => d.value)
  const dataMin = d3.min(allVals) ?? 0; const dataMax = d3.max(allVals) ?? 1

  drawSingle(svgRef.value, matrix, flat, metric, dataMin, dataMax, selectedYear.value, containerWidth.value)
}

function drawSingle(
  svgEl: SVGSVGElement,
  matrix: number[][],
  flat: { month: number; hour: number; value: number }[],
  metric: MetricConfig,
  dataMin: number,
  dataMax: number,
  year: number,
  width: number
) {
  const svg = d3.select(svgEl); svg.selectAll('*').remove()
  const plotWidth = width - MARGIN.left - MARGIN.right
  const cellW = plotWidth / 12
  const cellH = CHART_H / 24
  const svgH = MARGIN.top + CHART_H + MARGIN.bottom

  svg.attr('width', width).attr('height', svgH)

  const colorScale = makeColorScale(metric, dataMin, dataMax)

  if (!tooltipEl) {
    tooltipEl = d3.select('body').append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#FFFFFF').style('border', '1px solid var(--hairline)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)')
      .style('font-family', 'var(--font-sans)').style('font-size', '12px')
      .style('pointer-events', 'none').style('z-index', '1000').style('line-height', '1.5')
  }

  // Y-Achse (Stunden)
  const yLabelG = svg.append('g').attr('transform', `translate(${MARGIN.left - 8}, ${MARGIN.top})`)
  for (let h = 0; h < 24; h += 4) {
    yLabelG.append('text')
      .attr('x', 0).attr('y', h * cellH + cellH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(String(h).padStart(2, '0'))
  }
  for (let h = 0; h < 24; h++) {
    svg.append('line')
      .attr('x1', MARGIN.left).attr('x2', MARGIN.left + plotWidth)
      .attr('y1', MARGIN.top + h * cellH).attr('y2', MARGIN.top + h * cellH)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }

  // X-Achse (Monate)
  const xLabelG = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top - 6})`)
  for (let m = 0; m < 12; m++) {
    xLabelG.append('text')
      .attr('x', m * cellW + cellW / 2).attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(MONTH_LABELS[m])
  }

  // Heatmap-Zellen
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
  const cells = g.selectAll('rect').data(flat).join('rect')
    .attr('x', (d) => d.month * cellW)
    .attr('y', (d) => d.hour * cellH)
    .attr('width', Math.max(1, cellW - 1))
    .attr('height', Math.max(1, cellH - 1))
    .attr('rx', 1)
    .attr('fill', (d) => isNaN(d.value) ? '#F0F0F0' : colorScale(d.value))
    .attr('stroke', 'none')

  // Monats-Trennlinien
  for (let m = 1; m < 12; m++) {
    g.append('line')
      .attr('x1', m * cellW).attr('y1', 0).attr('x2', m * cellW).attr('y2', CHART_H)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }

  // Tooltip
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  cells
    .on('mouseenter', function (event: MouseEvent, d) {
      if (!tooltipEl) return
      const wert = isNaN(d.value) ? 'keine Daten' : `Ø ${d.value.toFixed(metric.key === 'co2' ? 0 : 1).replace('.', ',')} ${metric.unit}`
      tooltipEl.style('display', 'block')
        .html(`${MONTH_LABELS[d.month]}, ${String(d.hour).padStart(2, '0')}:00<br><span style="color:var(--fg-muted)">${wert} · über ${daysInMonth[d.month]} Tage gemittelt</span>`)
        .style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
      d3.select(this).attr('stroke', 'var(--fg)').attr('stroke-width', 1)
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltipEl) tooltipEl.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
    })
    .on('mouseleave', function () {
      if (tooltipEl) tooltipEl.style('display', 'none')
      d3.select(this).attr('stroke', 'none')
    })

  // Farblegende rechts
  const legG = svg.append('g').attr('transform', `translate(${MARGIN.left + plotWidth + 12}, ${MARGIN.top})`)
  const gradId = `heatmap-grad-${metric.key}-${year}`
  const gradDefs = legG.append('defs').append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const val = dataMin + t * (dataMax - dataMin)
    gradDefs.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorScale(val))
  }
  legG.append('rect').attr('width', 12).attr('height', 140).attr('rx', 2).style('fill', `url(#${gradId})`)
  legG.append('text').attr('x', 16).attr('y', 2).attr('dominant-baseline', 'hanging')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(metric.key === 'co2' ? Math.round(dataMax) + '' : dataMax.toFixed(1))
  legG.append('text').attr('x', 16).attr('y', 142).attr('dominant-baseline', 'auto')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(metric.key === 'co2' ? Math.round(dataMin) + '' : dataMin.toFixed(1))
  legG.append('text').attr('x', 0).attr('y', 152)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)').text(metric.unit)

  svg.append('text')
    .attr('x', MARGIN.left).attr('y', svgH - 6)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .text(`${year} · ${flat.filter(d => !isNaN(d.value)).length} Zellen`)
}
</script>

<template>
  <div class="heatmap-card">
    <div class="heatmap-header">
      <h3 class="heatmap-heading">Stündliche Muster über den Tag</h3>
    </div>
    <p class="heatmap-subtitle">Wie sich der Strommix und die CO₂-Intensität im Tagesverlauf verändern – im Durchschnitt pro Monat.</p>

    <div class="heatmap-controls">

      <div class="control-group">
        <span class="control-label">Zeige:</span>
        <div class="segment-group">
          <button v-for="m in METRICS" :key="m.key"
            class="segment-btn" :class="{ active: activeMetric === m.key }"
            @click="activeMetric = m.key">{{ m.label }}</button>
        </div>
      </div>
    </div>

    <div class="heatmap-year-row">
      <span class="control-label">Jahr:</span>
      <div class="segment-group year-chips">
        <button v-for="y in YEAR_OPTIONS" :key="y"
          class="segment-btn" :class="{ active: selectedYear === y }"
          @click="selectedYear = y">{{ y }}</button>
      </div>
    </div>

    <div class="heatmap-layout">
      <div class="heatmap-main">
        <div ref="containerRef" class="heatmap-scroll">
          <svg ref="svgRef"></svg>
        </div>
        <p class="heatmap-legend-text">
          <template v-if="currentMetric.key === 'price'">Blau = negativ / hell = 0 / orange = hoher Preis</template>
          <template v-else>Hell = {{ currentMetric.legendLo }} / dunkel = {{ currentMetric.legendHi }}</template>
        </p>
      </div>
      <aside class="heatmap-sidebar">
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Höchster Wert</div>
          <div class="tile-value">{{ sidebarExtremes.max.value }}</div>
          <div class="tile-context">Ø {{ sidebarExtremes.max.label }}, {{ String(sidebarExtremes.max.hour).padStart(2, '0') }}:00</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Niedrigster Wert</div>
          <div class="tile-value">{{ sidebarExtremes.min.value }}</div>
          <div class="tile-context">Ø {{ sidebarExtremes.min.label }}, {{ String(sidebarExtremes.min.hour).padStart(2, '0') }}:00</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Größte Tagesspanne</div>
          <div class="tile-value">{{ sidebarExtremes.range.diff }}</div>
          <div class="tile-context">Ø {{ sidebarExtremes.range.month }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.heatmap-card { width:100%; }
.heatmap-header { margin-bottom:2px; }

.heatmap-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.heatmap-subtitle { font-family:var(--font-sans); font-size:15px; color:var(--fg-muted); max-width:640px; line-height:1.5; margin:8px 0 24px; }
.heatmap-controls { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.control-group { display:flex; align-items:center; gap:8px; }
.control-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); flex-shrink:0; }
.segment-group { display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden; flex-wrap:wrap; }
.segment-btn { font-family:var(--font-sans); font-size:11px; font-weight:500; padding:4px 10px; border:none; background:transparent; color:var(--fg); cursor:pointer; transition:all .15s; border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
.segment-btn:last-child { border-right:none; }
.segment-btn:hover { background:var(--bg); }
.segment-btn.active { background:var(--accent); color:#fff; }
.heatmap-year-row { display:flex; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
.year-chips .segment-btn { font-size:11px; padding:3px 8px; }
.heatmap-layout { display:grid; grid-template-columns:1fr 260px; gap:32px; align-items:start; }
.heatmap-main { min-width:0; }
.heatmap-scroll { width:100%; overflow-x:auto; overflow-y:hidden; }
.heatmap-scroll svg { display:block; }
.heatmap-legend-text { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); margin-top:10px; margin-bottom:0; line-height:1.4; }
.heatmap-sidebar { border-left:1px solid var(--hairline); padding:4px 0 4px 20px; position:sticky; top:20px; }
.metric-tile { padding:20px 0; position:relative; }
.metric-divider { height:1px; background:var(--hairline); margin:0; }
.tile-eyebrow { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:6px; }
.tile-value { font-family:var(--font-serif); font-size:24px; font-weight:500; color:var(--fg); line-height:1.1; margin-bottom:4px; }
.tile-context { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); }
@media (max-width:1000px) { .heatmap-layout { grid-template-columns:1fr; } .heatmap-sidebar { position:static; border-left:none; border-top:1px solid var(--hairline); padding:16px 0 0; } }
@media (max-width:700px) { .heatmap-controls { flex-direction:column; align-items:flex-start; } }
</style>
