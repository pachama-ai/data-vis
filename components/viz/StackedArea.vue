<script setup lang="ts">
/**
 * StackedArea.vue – Gestapelte Flächendarstellung des deutschen Stromerzeugungsmix.
 *
 * Zeigt die Entwicklung der Stromerzeugung nach Energieträgern über die Zeit.
 * Unterstützt absolute und prozentuale Darstellung, verschiedene Aggregations-Level
 * (Tag, Woche, Monat, Quartal) sowie interaktiven Zoom und Zeitmarker.
 *
 * @example
 * <StackedArea :data="hourlyData" @visible-range-change="onRangeChange" />
 */

import { ref, watch, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'
import { aggregate } from '~/utils/aggregate'

const props = defineProps<{ data: HourlyRow[] }>()
const emit = defineEmits<{
  visibleRangeChange: [range: { start: Date; end: Date } | null]
  aggLevelChange: [level: 'tag' | 'woche' | 'monat' | 'quartal']
  modeChange: [mode: 'absolute' | 'percent']
}>()

// TODO: irgendwann in shared file, kommt in 3 dateien vor
const COLORS: Record<string, string> = {
  biomass: '#7A9B4E', hydro: '#C4B8A0', wind_onshore: '#4A90A4',
  wind_offshore: '#1A4A5A', pv: '#E8B547', nuclear: '#B85C8E',
  gas: '#D97742', hardcoal: '#3A3A3A', lignite: '#6B4423', other: '#A8A29E',
}
const LABELS: Record<string, string> = {
  biomass: 'Biomasse', hydro: 'Wasserkraft', wind_onshore: 'Wind Onshore',
  wind_offshore: 'Wind Offshore', pv: 'Photovoltaik', nuclear: 'Kernenergie',
  gas: 'Erdgas', hardcoal: 'Steinkohle', lignite: 'Braunkohle', other: 'Sonstige',
}
const STACK_ORDER = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite', 'other']
const ALL_KEYS = STACK_ORDER

const visibleKeys = ref<Set<string>>(new Set(ALL_KEYS))
const mode = ref<'absolute' | 'percent'>('percent')
const aggLevel = ref<'tag' | 'woche' | 'monat' | 'quartal'>('monat')
const zoomDomain = ref<[Date, Date] | null>(null)
const hasZoomed = ref(false)

watch(aggLevel, (v) => emit('aggLevelChange', v))
watch(mode, (v) => emit('modeChange', v))

/**
 * Schaltet einen Energieträger in der Legende ein oder aus.
 * Es bleibt immer mindestens einer aktiv.
 * @param key Der Energieträger-Schlüssel.
 */
function toggleKey(key: string) {
  if (visibleKeys.value.has(key)) { visibleKeys.value.delete(key); if (visibleKeys.value.size === 0) visibleKeys.value.add(key) }
  else { visibleKeys.value.add(key) }
  visibleKeys.value = new Set(visibleKeys.value)
}
/**
 * Setzt den Zoom auf den vollen Zeitraum zurück und benachrichtigt die Parent-Komponente.
 */
function resetZoom() { zoomDomain.value = null; hasZoomed.value = true; emit('visibleRangeChange', null) }

/**
 * Kurzform zum Aggregieren von Stunden-Daten.
 * Leitet an die zentrale aggregate()-Funktion aus utils/ weiter.
 *
 * @param rows Stunden-Daten.
 * @param level Aggregations-Level (tag, woche, monat, quartal).
 * @returns Aggregierte Daten mit CO₂-Tracking.
 */
function aggregateHours(rows: HourlyRow[], level: string) {
  return aggregate(rows, { level: level as any, trackCo2: true })
}

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null
let eventTooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null
onUnmounted(() => { tooltipDiv?.remove(); eventTooltipDiv?.remove() })

const MARGIN = { top: 20, right: 16, bottom: 80, left: 80 }
const WIDTH = 900, MAIN_H = 400
const MAIN_H_ACT = MAIN_H - MARGIN.top - MARGIN.bottom

// Marker-Spur unter der X-Achse
const GAP_AFTER_CHART = 8
const AXIS_H = 22
const GAP_AFTER_AXIS = 12
const MARKER_TRACK_H = 20
const MARKER_R = 9

const X_AXIS_Y = MAIN_H_ACT + GAP_AFTER_CHART
const MARKER_CY = X_AXIS_Y + AXIS_H + GAP_AFTER_AXIS + MARKER_TRACK_H / 2

const EVENTS = [
  { date: new Date('2015-12-12'), label: 'Pariser Klimaabkommen unterzeichnet' },
  { date: new Date('2016-07-08'), label: 'EEG-Reform 2017 beschlossen' },
  { date: new Date('2020-03-11'), label: 'WHO ruft Corona-Pandemie aus' },
  { date: new Date('2020-07-03'), label: 'Kohleausstiegsgesetz beschlossen' },
  { date: new Date('2022-02-24'), label: 'Beginn Ukraine-Krieg' },
  { date: new Date('2022-08-26'), label: 'Höchststand Day-Ahead-Preis (700 EUR/MWh)' },
  { date: new Date('2023-04-15'), label: 'Abschaltung der letzten drei Kernkraftwerke' },
  { date: new Date('2023-11-17'), label: 'BVerfG-Urteil zum Klimafonds' },
]

/**
 * Formatiert ein Datum abhängig vom Aggregations-Level.
 * @param d Das Datum.
 * @param level 'monat', 'woche' oder 'quartal'.
 * @returns Formatierter String, z. B. "Januar 2020", "KW 23/2020" oder "Q3 2021".
 */
function fmtDate(d: Date, level: string): string {
  if (level === 'monat') return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
  if (level === 'woche') return 'KW ' + Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7) + '/' + d.getUTCFullYear()
  if (level === 'quartal') return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + ' ' + d.getUTCFullYear()
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Gibt die aktuell aggregierten Daten zurück (abhängig vom aggLevel-Ref) */
function getAggregated() { return aggregateHours(props.data, aggLevel.value) }

// Haupt-Rendering
watchEffect(() => {
  const rows = props.data
  if (!rows.length || !svgRef.value) return

  const aggregated = aggregateHours(rows, aggLevel.value)
  const activeKeys = ALL_KEYS.filter((k) => visibleKeys.value.has(k))
  const fullDomain = d3.extent(aggregated, (d) => d.date) as [Date, Date]
  const xDomain = zoomDomain.value ?? fullDomain

  const stack = d3.stack<any>().keys(activeKeys)
    .value((d, key) => d._gap ? NaN : d[key] / (mode.value === 'absolute' ? 1000000 : 1000))
  if (mode.value === 'percent') stack.offset(d3.stackOffsetExpand)
  const stacked = stack(aggregated)

  const innerW = WIDTH - MARGIN.left - MARGIN.right
  const xScale = d3.scaleTime().domain(xDomain).range([0, innerW])

  let yMax: number
  if (mode.value === 'percent') { yMax = 1 }
  else { yMax = d3.max(stacked, (s) => d3.max(s, (d: any) => d[1])) ?? 1 }
  const yScale = d3.scaleLinear().domain([0, yMax]).range([MAIN_H_ACT, 0])

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', WIDTH).attr('height', MAIN_H + MARGIN.bottom)
    .attr('viewBox', '0 0 ' + WIDTH + ' ' + (MAIN_H + MARGIN.bottom))

  // Clip-Path
  const defs = svg.append('defs')
  defs.append('clipPath').attr('id', 'chart-clip').append('rect').attr('width', innerW).attr('height', MAIN_H_ACT)

  const chart = svg.append('g').attr('transform', 'translate(' + MARGIN.left + ',' + MARGIN.top + ')')
  const clipped = chart.append('g').attr('clip-path', 'url(#chart-clip)')

  // Areas
  const area = d3.area<any>().defined((d: any) => !isNaN(d[0]) && !isNaN(d[1]))
    .x((d, i) => xScale(aggregated[i].date)).y0((d) => yScale(d[0])).y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  for (let i = activeKeys.length - 1; i >= 0; i--) {
    const key = activeKeys[i], g = clipped.append('g')
    g.append('path').datum(stacked[i]).attr('d', area as any)
      .attr('fill', COLORS[key]).attr('opacity', 0.85)
      .attr('stroke', COLORS[key]).attr('stroke-width', 0.5).attr('stroke-opacity', 1)
  }

  // Gap-Overlay entfernt – keine Markierung fehlender Daten

  // Event-Marker: nummerierte Kreise in eigener Spur unter der X-Achse
  EVENTS.forEach((ev, i) => {
    const x = xScale(ev.date)
    if (x < -10 || x > innerW + 10) return
    const num = i + 1

    // Führungslinie vom Marker nach oben durch die X-Achse bis in den Chart
    const guideLine = chart.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', MARKER_CY)
      .attr('stroke', 'var(--fg-muted)').attr('opacity', 0.15)
      .attr('stroke-dasharray', '2,3').attr('stroke-width', 1)
      .attr('pointer-events', 'none')

    // Nummerierter Kreis in der Marker-Spur
    chart.append('circle').attr('cx', x).attr('cy', MARKER_CY).attr('r', MARKER_R)
      .attr('fill', 'var(--bg)').attr('stroke', 'var(--fg)').attr('stroke-width', 1)
      .style('cursor', 'pointer')

    const numText = chart.append('text').attr('x', x).attr('y', MARKER_CY + 4)
      .attr('text-anchor', 'middle').attr('font-size', '10px').attr('font-weight', '500')
      .attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .style('cursor', 'pointer').style('pointer-events', 'none').text(num)

    // Hover: Kreis füllt sich, Nummer wird weiß, Führungslinie verstärkt
    const hitArea = chart.append('circle').attr('cx', x).attr('cy', MARKER_CY).attr('r', MARKER_R + 4)
      .attr('fill', 'transparent').attr('stroke', 'none').style('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent) {
        guideLine.attr('opacity', 0.5).attr('stroke', 'var(--fg)')
        chart.selectAll('circle').filter(function () {
          return d3.select(this).attr('r') === String(MARKER_R) && d3.select(this).attr('cx') === String(x)
        }).attr('fill', 'var(--fg)')
        numText.attr('fill', '#fff')

        if (!eventTooltipDiv) {
          eventTooltipDiv = d3.select('body').append('div')
            .style('position', 'fixed').style('display', 'none')
            .style('background', '#fff').style('border', '1px solid var(--hairline)')
            .style('border-radius', '6px').style('padding', '8px 12px')
            .style('font-size', '12px').style('pointer-events', 'none')
            .style('z-index', '1000').style('line-height', '1.5')
            .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)').style('font-family', 'var(--font-sans)')
        }
        eventTooltipDiv.style('display', 'block')
          .html('<div style="font-weight:600">' + ev.date.toLocaleDateString('de-DE') + '</div><div style="color:var(--fg-muted)">' + ev.label + '</div>')
          .style('left', Math.min(event.clientX + 14, window.innerWidth - 300) + 'px')
          .style('top', Math.max(10, event.clientY - 20) + 'px')
      })
      .on('mouseleave', function () {
        guideLine.attr('opacity', 0.15).attr('stroke', 'var(--fg-muted)')
        chart.selectAll('circle').filter(function () {
          return d3.select(this).attr('r') === String(MARKER_R) && d3.select(this).attr('cx') === String(x)
        }).attr('fill', 'var(--bg)')
        numText.attr('fill', 'var(--fg)')
        eventTooltipDiv?.style('display', 'none')
      })
  })

  // X-Achse
  chart.append('g').attr('transform', 'translate(0,' + X_AXIS_Y + ')')
    .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y') as any))
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .style('letter-spacing', '0.04em')
    .call((g: any) => g.select('.domain').attr('stroke', 'var(--hairline)'))
    .call((g: any) => g.selectAll('.tick text').attr('fill', 'var(--fg-muted)'))

  // Y-Achse
  const yTicks = mode.value === 'percent' ? [0, 0.25, 0.5, 0.75, 1] : undefined
  const yFormat: any = mode.value === 'percent' ? (d: number) => Math.round(d * 100) + '%' : (d: number) => d3.format('.1f')(d) + ' TWh'
  chart.append('g').call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat(yFormat) as any)
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .style('letter-spacing', '0.04em')
    .call((g: any) => g.select('.domain').attr('stroke', 'var(--hairline)'))
    .call((g: any) => g.selectAll('.tick text').attr('fill', 'var(--fg-muted)'))
    .call((g: any) => g.selectAll('.tick text').attr('x', -4))

  // Zoom-Reset als Chip (in der Steuerungszeile, nicht im SVG)
  // → Im Template als Button

  // Scroll-Zoom mit Out-Unterstützung
  const zoom = d3.zoom<SVGRectElement, unknown>()
    .scaleExtent([0.3, 30])
    .translateExtent([[0, 0], [innerW, MAIN_H_ACT]])
    .extent([[0, 0], [innerW, MAIN_H_ACT]])
    .on('zoom', (event: any) => {
      hasZoomed.value = true
      const s = event.transform.k
      if (s <= 1.02) { zoomDomain.value = null; emit('visibleRangeChange', null); return }
      zoomDomain.value = event.transform.rescaleX(xScale).domain()
      emit('visibleRangeChange', { start: zoomDomain.value![0], end: zoomDomain.value![1] })
    })
    .filter((event) => event.type === 'wheel' || event.type === 'mousedown')

  // Tooltip
  if (!tooltipDiv) {
    tooltipDiv = d3.select('body').append('div').attr('class', 'stacked-tooltip')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#fff').style('border', '1px solid var(--hairline)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('font-size', '12px').style('pointer-events', 'none')
      .style('z-index', '1000').style('line-height', '1.5')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)').style('font-family', 'var(--font-sans)')
  }

  const tooltipLine = chart.append('line').attr('y1', 0).attr('y2', MAIN_H_ACT).attr('stroke', '#333').attr('stroke-width', 1).attr('opacity', 0)
  const bisect = d3.bisector<any, Date>((d) => d.date).left

  chart.append('rect').attr('width', innerW).attr('height', MAIN_H_ACT)
    .attr('fill', 'none').attr('pointer-events', 'all').style('cursor', 'grab')
    .call(zoom)
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event), x0 = xScale.invert(mx), i = bisect(aggregated, x0, 1)
      const left = aggregated[i - 1], right = aggregated[i]
      if (!left || !right) return
      const entry = (x0.getTime() - left.date.getTime()) < (right.date.getTime() - x0.getTime()) ? left : right
      if (entry._gap) { tooltipDiv!.style('display', 'none'); return }
      const xPos = xScale(entry.date)
      tooltipLine.attr('x1', xPos).attr('x2', xPos).attr('opacity', 0.4)
      const isPct = mode.value === 'percent'
      const divisor = isPct ? 1 : 1000000
      const sorted = ALL_KEYS.map((k) => ({ key: k, val: entry[k] })).filter((s) => s.val > 0).sort((a, b) => b.val - a.val)
      let html = '<div style="font-weight:600;margin-bottom:4px;white-space:nowrap">' + fmtDate(entry.date, aggLevel.value) + '</div>'
      if (isPct) {
        html += '<div style="color:var(--fg-muted);margin-bottom:6px;white-space:nowrap">100 %</div>'
      } else {
        const totalVal = (entry.total / divisor).toFixed(1)
        html += '<div style="color:var(--fg-muted);margin-bottom:6px;white-space:nowrap">Gesamt: ' + totalVal + ' TWh</div>'
      }
      for (const t of sorted) {
        const pct = entry.total > 0 ? (t.val / entry.total * 100).toFixed(1) : '0.0'
        const isTop3 = sorted.indexOf(t) < 3
        const displayVal = isPct ? pct : (t.val / divisor).toFixed(1)
        const displayUnit = isPct ? '%' : ' TWh'
        html += '<div style="font-weight:500;font-size:' + (isTop3 ? '12px' : '11px') + ';color:' + (isTop3 ? 'var(--fg)' : 'var(--fg-muted)') + ';white-space:nowrap"><span style="color:' + COLORS[t.key] + '">●</span> ' + LABELS[t.key] + ': ' + displayVal + displayUnit + (isPct ? '' : ' (' + pct + '%)') + '</div>'
      }
      tooltipDiv!.style('display', 'block').html(html)
        .style('left', (event.clientX > window.innerWidth - 260 ? event.clientX - 240 : event.clientX + 14) + 'px')
        .style('top', Math.max(10, event.clientY - 120) + 'px')
    })
    .on('mouseleave', function () { tooltipLine.attr('opacity', 0); tooltipDiv!.style('display', 'none') })
})
</script>

<template>
  <div class="stacked-card">
    <div class="stacked-header">
      <h3 class="stacked-heading">Erzeugungsmix über die Zeit</h3>
      <div class="stacked-controls">
        <div class="agg-toggle">
          <button v-for="lvl in [{k:'tag',l:'Tag'},{k:'woche',l:'Woche'},{k:'monat',l:'Monat'},{k:'quartal',l:'Quartal'}]" :key="lvl.k"
            class="agg-btn" :class="{active:aggLevel===lvl.k}" @click="aggLevel=lvl.k">{{ lvl.l }}</button>
        </div>
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
    <div class="event-legend">1 Paris · 2 EEG-Reform · 3 Corona · 4 Kohleausstieg · 5 Ukraine-Krieg · 6 Gaspreis · 7 Atomausstieg · 8 BVerfG-Urteil</div>
    <div v-if="!zoomDomain||(zoomDomain[0]<=new Date('2018-12-31')&&zoomDomain[1]>=new Date('2018-01-01'))" class="data-warning">
      <strong>2018:</strong> Ab Oktober Datenlücken durch ENTSO-E-Marktgebietswechsel. Ca. 25 % der Stunden fehlen.
    </div>
  </div>
</template>

<style scoped>
.stacked-card { width:100%; }
.stacked-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
.stacked-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.stacked-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.agg-toggle, .mode-toggle { display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden; }
.agg-btn, .mode-btn { font-family:var(--font-sans); font-size:11px; font-weight:500; padding:4px 10px; border:none; background:transparent; color:var(--fg-muted); cursor:pointer; transition:all .15s; border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em; }
.agg-btn:last-child, .mode-btn:last-child { border-right:none; }
.agg-btn:hover, .mode-btn:hover { color:var(--fg); }
.agg-btn.active, .mode-btn.active { background:var(--accent); color:#fff; }
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
.event-legend { font-family:var(--font-sans); font-size:10px; color:var(--fg-muted); line-height:1.6; margin-top:4px; opacity:0.7; }
.data-warning { background:#EDF3EB; border-left:3px solid var(--accent); padding:12px; font-family:var(--font-sans); font-size:13px; color:var(--fg); line-height:1.5; margin-top:12px; border-radius:0 4px 4px 0; }
</style>

