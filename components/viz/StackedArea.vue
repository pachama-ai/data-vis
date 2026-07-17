<script setup lang="ts">
/**
 * StackedArea.vue – Gestapelte Flächendarstellung des deutschen Stromerzeugungsmix.
 *
 * Zeigt die monatliche Entwicklung der Stromerzeugung nach Energieträgern
 * als gestapelte Fläche. Unterstützt absolute (TWh) und prozentuale Darstellung,
 * interaktive Legende und lokalen Scroll-Zoom.
 *
 * Datenbasis: monthlyMix aus visualization-data.json (build-time aggregiert).
 *
 * @example
 * <StackedArea :data="monthlyMix" />
 */

import { ref, watch, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { MonthlyMixPoint, EnergySourceValues } from '~/types/visualization-data'

type EnergySourceKeys = keyof EnergySourceValues

const props = defineProps<{ data: MonthlyMixPoint[] }>()

// TODO: irgendwann in shared file, kommt in 3 dateien vor
const COLORS: Record<EnergySourceKeys, string> = {
  biomass: '#7A9B4E', hydro: '#C4B8A0', wind_onshore: '#4A90A4',
  wind_offshore: '#1A4A5A', pv: '#E8B547', nuclear: '#B85C8E',
  gas: '#D97742', hardcoal: '#3A3A3A', lignite: '#6B4423',
  other_renewables: '#A8D35C', other_fossil: '#8B7355', pumped_storage: '#5B9BD5',
}
const LABELS: Record<EnergySourceKeys, string> = {
  biomass: 'Biomasse', hydro: 'Wasserkraft', wind_onshore: 'Wind Onshore',
  wind_offshore: 'Wind Offshore', pv: 'Photovoltaik', nuclear: 'Kernenergie',
  gas: 'Erdgas', hardcoal: 'Steinkohle', lignite: 'Braunkohle',
  other_renewables: 'Sonstige Erneuerbare', other_fossil: 'Sonstige Konventionelle',
  pumped_storage: 'Pumpspeicher',
}
const ALL_KEYS: EnergySourceKeys[] = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite',
  'other_renewables', 'other_fossil', 'pumped_storage']

const visibleKeys = ref<Set<EnergySourceKeys>>(new Set(ALL_KEYS))
const mode = ref<'absolute' | 'percent'>('percent')
const zoomDomain = ref<[Date, Date] | null>(null)

function toggleKey(key: EnergySourceKeys) {
  if (visibleKeys.value.has(key)) { visibleKeys.value.delete(key); if (visibleKeys.value.size === 0) visibleKeys.value.add(key) }
  else { visibleKeys.value.add(key) }
  visibleKeys.value = new Set(visibleKeys.value)
}
function resetZoom() { zoomDomain.value = null }

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipDiv: d3.Selection<HTMLDivElement, unknown, HTMLElement, undefined> | null = null
onUnmounted(() => { tooltipDiv?.remove() })

const MARGIN = { top: 20, right: 16, bottom: 40, left: 80 }
const WIDTH = 900, MAIN_H = 400
const MAIN_H_ACT = MAIN_H - MARGIN.top - MARGIN.bottom

function fmtMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
}

watch([() => props.data, visibleKeys, mode, zoomDomain], () => { render() }, { deep: false })
watch(svgRef, (el) => { if (el) render() })

function render() {
  const svgEl = svgRef.value
  if (!svgEl || !props.data.length) return
  const svg = d3.select(svgEl)

  // monthlyMix ist bereits chronologisch sortiert. Datum aus month-String.
  type AggregatedPoint = { date: Date; total: number; _month: string } & EnergySourceValues
  const aggregated: AggregatedPoint[] = props.data.map((d) => ({
    date: new Date(d.month + '-01T00:00:00+01:00'),
    total: d.totalGenerationMwh,
    _month: d.month,
    ...d.sources,
  }))

  const activeKeys: EnergySourceKeys[] = ALL_KEYS.filter((k) => visibleKeys.value.has(k))
  const minDate = d3.min(aggregated, (d: AggregatedPoint) => d.date)
  const maxDate = d3.max(aggregated, (d: AggregatedPoint) => d.date)
  if (minDate === undefined || maxDate === undefined) return
  const fullDomain = [minDate, maxDate] as [Date, Date]
  const xDomain = zoomDomain.value ?? fullDomain

  const stack = d3.stack<AggregatedPoint>().keys(activeKeys)
    .value((d, key) => d[key as keyof EnergySourceValues] / (mode.value === 'absolute' ? 1000000 : 1000))
  if (mode.value === 'percent') stack.offset(d3.stackOffsetExpand)
  const stacked = stack(aggregated)

  const innerW = WIDTH - MARGIN.left - MARGIN.right
  const xScale = d3.scaleTime().domain(xDomain).range([0, innerW])

  let yMax: number
  if (mode.value === 'percent') { yMax = 1 }
  else {
    yMax = d3.max(stacked, (s: d3.Series<AggregatedPoint, string>) => d3.max(s, (d: d3.SeriesPoint<AggregatedPoint>) => d[1])) ?? 1
  }
  const yScale = d3.scaleLinear().domain([0, yMax]).range([MAIN_H_ACT, 0])

  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${WIDTH} ${MAIN_H + MARGIN.bottom}`)

  const defs = svg.append('defs')
  defs.append('clipPath').attr('id', 'chart-clip').append('rect').attr('width', innerW).attr('height', MAIN_H_ACT)

  const chart = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  const clipped = chart.append('g').attr('clip-path', 'url(#chart-clip)')

  const dates = aggregated.map((d) => d.date)
  const area = d3.area<d3.SeriesPoint<AggregatedPoint>>()
    .defined((d) => !isNaN(d[0]) && !isNaN(d[1]))
    .x((_d, i) => {
      const date = dates[i]
      return date ? xScale(date) : 0
    })
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  for (let i = activeKeys.length - 1; i >= 0; i--) {
    const key = activeKeys[i]
    const series = stacked[i]
    if (!key || !series) continue
    clipped.append('g').append('path').datum(series)
      .attr('d', area).attr('fill', COLORS[key]).attr('opacity', 0.85)
      .attr('stroke', COLORS[key]).attr('stroke-width', 0.5).attr('stroke-opacity', 1)
  }

  // X-Achse
  chart.append('g').attr('transform', `translate(0,${MAIN_H_ACT})`)
    .call((s) => d3.axisBottom(xScale).tickArguments([6, '%Y'])(s))
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .call((g) => g.select('.domain').attr('stroke', 'var(--hairline)'))
    .call((g) => g.selectAll('.tick text').attr('fill', 'var(--fg-muted)'))

  // Y-Achse
  const yFormat = (d: number) => mode.value === 'percent'
    ? Math.round(d * 100) + '%'
    : d3.format('.1f')(d) + ' TWh'
  const yAxisGen = mode.value === 'percent'
    ? d3.axisLeft<number>(yScale).tickValues([0, 0.25, 0.5, 0.75, 1]).tickFormat(yFormat)
    : d3.axisLeft<number>(yScale).tickFormat(yFormat)
  chart.append('g').call((s) => yAxisGen(s))
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .call((g) => g.select('.domain').attr('stroke', 'var(--hairline)'))
    .call((g) => g.selectAll('.tick text').attr('fill', 'var(--fg-muted)'))

  // Lokaler Zoom (nur visuell, keine Cross-Chart-Kopplung)
  const zoom = d3.zoom<SVGRectElement, unknown>()
    .scaleExtent([0.3, 30])
    .translateExtent([[0, 0], [innerW, MAIN_H_ACT]])
    .extent([[0, 0], [innerW, MAIN_H_ACT]])
    .on('zoom', (event: d3.D3ZoomEvent<SVGRectElement, unknown>) => {
      if (event.transform.k <= 1.02) { zoomDomain.value = null; return }
      const d = event.transform.rescaleX(xScale).domain()
      if (d.length >= 2 && d[0] && d[1]) { zoomDomain.value = [d[0], d[1]] }
    })
    .filter((event: Event) => event.type === 'wheel' || event.type === 'mousedown')

  // Tooltip
  if (!tooltipDiv) {
    tooltipDiv = d3.select('body').append('div')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#fff').style('border', '1px solid var(--hairline)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('font-size', '12px').style('pointer-events', 'none')
      .style('z-index', '1000').style('line-height', '1.5')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)').style('font-family', 'var(--font-sans)')
  }
  const tt = tooltipDiv

  const tooltipLine = chart.append('line').attr('y1', 0).attr('y2', MAIN_H_ACT).attr('stroke', '#333').attr('stroke-width', 1).attr('opacity', 0)
  const bisect = d3.bisector<AggregatedPoint, Date>((d: AggregatedPoint) => d.date).left

  const rect = chart.append('rect').attr('width', innerW).attr('height', MAIN_H_ACT)
    .attr('fill', 'none').attr('pointer-events', 'all').style('cursor', 'grab')
  zoom(rect)
  rect.on('mousemove', function (this: SVGRectElement, event: MouseEvent) {
      const [mx] = d3.pointer(event), x0 = xScale.invert(mx), i = bisect(aggregated, x0, 1)
      const left = aggregated[i - 1], right = aggregated[i]
      if (!left || !right) return
      const entry = x0.getTime() - left.date.getTime() < right.date.getTime() - x0.getTime() ? left : right
      const xPos = xScale(entry.date)
      tooltipLine.attr('x1', xPos).attr('x2', xPos).attr('opacity', 0.4)
      const isPct = mode.value === 'percent'
      const divisor = isPct ? 1 : 1000000
      const sorted = ALL_KEYS.map((k) => ({ key: k, val: entry[k] }))
        .filter((s) => s.val > 0).sort((a, b) => b.val - a.val)
      let html = '<div style="font-weight:600;margin-bottom:4px;white-space:nowrap">' + fmtMonth(entry._month) + '</div>'
      if (isPct) {
        html += '<div style="color:var(--fg-muted);margin-bottom:6px">100 %</div>'
      } else {
        html += '<div style="color:var(--fg-muted);margin-bottom:6px">Gesamt: ' + (entry.total / divisor).toFixed(1) + ' TWh</div>'
      }
      for (const t of sorted) {
        const pct = entry.total > 0 ? (t.val / entry.total * 100).toFixed(1) : '0.0'
        const displayVal = isPct ? pct : (t.val / divisor).toFixed(1)
        const unit = isPct ? '%' : ' TWh'
        html += `<div style="font-size:12px;white-space:nowrap"><span style="color:${COLORS[t.key]}">●</span> ${LABELS[t.key]}: ${displayVal}${unit}</div>`
      }
      tt.style('display', 'block').html(html)
        .style('left', (event.clientX > window.innerWidth - 260 ? event.clientX - 240 : event.clientX + 14) + 'px')
        .style('top', Math.max(10, event.clientY - 120) + 'px')
    })
    .on('mouseleave', function () { tooltipLine.attr('opacity', 0); tt.style('display', 'none') })
}
</script>

<template>
  <div v-if="!data.length" class="stacked-empty">
    Keine monatlichen Daten verfügbar.
  </div>
  <div v-else class="stacked-card">
    <div class="stacked-header">
      <h3 class="stacked-heading">Erzeugungsmix über die Zeit</h3>
      <div class="stacked-controls">
        <div class="mode-toggle">
          <button class="mode-btn" :class="{active:mode==='absolute'}" @click="mode='absolute'">Absolut</button>
          <button class="mode-btn" :class="{active:mode==='percent'}" @click="mode='percent'">% Anteil</button>
        </div>
        <button v-if="zoomDomain" class="reset-chip" @click="resetZoom">× Zoom aufheben</button>
      </div>
    </div>
    <div class="legend-bar">
      <button v-for="key in ALL_KEYS" :key="key"
        class="legend-item" :class="{dimmed:!visibleKeys.has(key)}"
        @click="toggleKey(key)">
        <span class="legend-dot" :style="{background:COLORS[key]}"></span>
        <span class="legend-label" :class="{struck:!visibleKeys.has(key)}">{{ LABELS[key] }}</span>
      </button>
    </div>
    <div class="legend-hint">Klicken zum Ausblenden · Scrollen zum Zoomen</div>
    <div class="chart-wrap"><svg ref="svgRef"></svg></div>
  </div>
</template>

<style scoped>
.stacked-card { width:100%; }
.stacked-empty { padding:40px 16px; text-align:center; color:var(--fg-muted); font-family:var(--font-sans); font-size:14px; }
.stacked-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
.stacked-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.stacked-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.mode-toggle { display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden; }
.mode-btn { font-family:var(--font-sans); font-size:11px; font-weight:500; padding:4px 10px; border:none; background:transparent; color:var(--fg-muted); cursor:pointer; transition:all .15s; border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em; }
.mode-btn:last-child { border-right:none; }
.mode-btn:hover { color:var(--fg); }
.mode-btn.active { background:var(--accent); color:#fff; }
.reset-chip { font-family:var(--font-sans); font-size:11px; font-weight:500; color:var(--fg); padding:4px 10px; border:1px solid var(--hairline); border-radius:4px; background:var(--bg); cursor:pointer; white-space:nowrap; }
.reset-chip:hover { border-color:var(--accent); color:var(--accent); }
.legend-bar { display:flex; flex-wrap:wrap; gap:4px 12px; margin-bottom:4px; align-items:center; }
.legend-item { display:inline-flex; align-items:center; gap:4px; border:none; background:transparent; cursor:pointer; padding:2px 4px; border-radius:4px; transition:opacity .2s; font-family:var(--font-sans); }
.legend-item:hover { background:#f0f0f0; }
.legend-item.dimmed { opacity:.5; }
.legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.legend-label { font-size:12px; color:var(--fg); transition:all .2s; }
.legend-label.struck { text-decoration:line-through; color:var(--fg-muted); }
.legend-hint { font-family:var(--font-sans); font-size:10px; color:var(--fg-muted); opacity:0.6; margin-bottom:8px; }
.chart-wrap { width:100%; }
.chart-wrap svg { width:100%; height:auto; display:block; }
</style>

