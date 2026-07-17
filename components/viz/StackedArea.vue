<script setup lang="ts">
/**
 * StackedArea.vue – Gestapelte Flächendarstellung des monatlichen Strommix.
 *
 * Zeigt die Entwicklung der Stromerzeugung nach Energieträgern als
 * gestapelte Fläche. Unterstützt absolute (TWh) und prozentuale Darstellung,
 * interaktive Legende und lokalen Scroll-Zoom.
 *
 * Vue/D3-Trennung nach Vorlesungsmuster (Kapitel 8.5):
 * - Vue: Container-Ref, Props, Modus/Legenden-Zustand, Tooltip, Leerzustand
 * - D3: SVG, Skalen, Achsen, Flächen, Zoom
 *
 * Datenbasis: monthlyMix aus visualization-data.json.
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import type { MonthlyMixPoint, EnergySourceValues } from '~/types/visualization-data'

type EnergySourceKey = keyof EnergySourceValues

const props = defineProps<{ data: MonthlyMixPoint[] }>()

// ── Von Vue verwaltete Zustände ──
// ── Farben und Labels ──
const COLORS: Record<EnergySourceKey, string> = {
  biomass: '#7A9B4E', hydro: '#C4B8A0', wind_onshore: '#4A90A4',
  wind_offshore: '#1A4A5A', pv: '#E8B547', nuclear: '#B85C8E',
  gas: '#D97742', hardcoal: '#3A3A3A', lignite: '#6B4423',
  other_renewables: '#A8D35C', other_fossil: '#8B7355', pumped_storage: '#5B9BD5',
}
const LABELS: Record<EnergySourceKey, string> = {
  biomass: 'Biomasse', hydro: 'Wasserkraft', wind_onshore: 'Wind Onshore',
  wind_offshore: 'Wind Offshore', pv: 'Photovoltaik', nuclear: 'Kernenergie',
  gas: 'Erdgas', hardcoal: 'Steinkohle', lignite: 'Braunkohle',
  other_renewables: 'Sonstige Erneuerbare', other_fossil: 'Sonstige Konventionelle',
  pumped_storage: 'Pumpspeicher',
}
const ALL_KEYS: EnergySourceKey[] = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite',
  'other_renewables', 'other_fossil', 'pumped_storage']

const mode = ref<'absolute' | 'percent'>('percent')
const visibleSources = ref<EnergySourceKey[]>([...ALL_KEYS])
const zoomDomain = ref<[Date, Date] | null>(null)
const tooltip = ref<TooltipState | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)

interface TooltipState {
  month: string
  entries: { key: EnergySourceKey; label: string; color: string; val: number }[]
  totalLabel: string
  clientX: number
  clientY: number
}

function toggleKey(key: EnergySourceKey) {
  const set = new Set(visibleSources.value)
  if (set.has(key)) {
    set.delete(key)
    if (set.size === 0) set.add(key)
  } else {
    set.add(key)
  }
  visibleSources.value = [...set]
}
function resetZoom() { zoomDomain.value = null }

// ── Aufbereitete Monatsdaten ──
// Aus monthlyMix werden Datum und Sources in ein flaches Objekt überführt.
type AggregatedPoint = { date: Date; total: number; _month: string } & EnergySourceValues

const aggregatedData = computed<AggregatedPoint[]>(() => {
  return props.data.map((d) => ({
    date: new Date(d.month + '-01T00:00:00+01:00'),
    total: d.totalGenerationMwh,
    _month: d.month,
    ...d.sources,
  }))
})

// ── Layout ──
const MARGIN = { top: 20, right: 16, bottom: 40, left: 80 }
const WIDTH = 900
const MAIN_H = 400
const MAIN_H_ACT = MAIN_H - MARGIN.top - MARGIN.bottom

function fmtMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
}

// ── D3-Interna (kein Vue-Zustand) ──
let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null
let zoomBehavior: d3.ZoomBehavior<SVGRectElement, undefined> | null = null
let currentAggregated: AggregatedPoint[] = []
let currentXScale: d3.ScaleTime<number, number> | null = null

// ── Lifecycle ──
onMounted(() => { updateChart() })
onBeforeUnmount(() => {
  svg?.remove()
  svg = null
  zoomBehavior = null
})

watch([() => props.data, mode, visibleSources, zoomDomain], () => { updateChart() }, { flush: 'post' })

// ── Initialisierung (höchstens einmal) ──
function initializeChart(): void {
  if (!chartContainer.value || svg) return

  const created = d3.create('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${MAIN_H + MARGIN.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'Gestapelte Fläche des monatlichen Stromerzeugungsmix')

  // Clip-Pfad + feste Gruppen
  created.append('defs').append('clipPath').attr('id', 'stacked-clip')
    .append('rect').attr('class', 'clip-rect')

  created.append('g').attr('class', 'areas-g')
  created.append('g').attr('class', 'x-axis-g')
  created.append('g').attr('class', 'y-axis-g')
  created.append('g').attr('class', 'tooltip-line-g')

  // Zoom-Verhalten einmalig anlegen
  zoomBehavior = d3.zoom<SVGRectElement, undefined>()
    .on('zoom', (event: d3.D3ZoomEvent<SVGRectElement, undefined>) => {
      if (!currentXScale) return
      if (event.transform.k <= 1.02) { zoomDomain.value = null; return }
      const d = event.transform.rescaleX(currentXScale).domain()
      if (d.length >= 2 && d[0] && d[1]) { zoomDomain.value = [d[0], d[1]] }
    })
    .filter((event: Event) => event.type === 'wheel' || event.type === 'mousedown')

  const zoomG = created.append('g').attr('class', 'zoom-g')
  const zoomRect = zoomG.append('rect')
    .attr('fill', 'none').attr('pointer-events', 'all').style('cursor', 'grab')

  zoomRect.call(zoomBehavior)

  // Tooltip-Ereignisse auf dem Zoom-Rect
  zoomRect
    .on('mousemove', (event: MouseEvent) => {
      if (!currentXScale || !currentAggregated.length) return
      const chartG = created.select('.areas-g')
      const [mx] = d3.pointer(event)
      const x0 = currentXScale.invert(mx)
      const bisect = d3.bisector<AggregatedPoint, Date>((d) => d.date).left
      const i = bisect(currentAggregated, x0, 1)
      const left = currentAggregated[i - 1], right = currentAggregated[i]
      if (!left || !right) return
      const entry = x0.getTime() - left.date.getTime() < right.date.getTime() - x0.getTime() ? left : right

      // Tooltip-Linie
      const xPos = currentXScale(entry.date)
      const tooltipG = created.select<SVGGElement>('.tooltip-line-g')
      tooltipG.selectAll('line').remove()
      tooltipG.append('line')
        .attr('x1', xPos + MARGIN.left).attr('x2', xPos + MARGIN.left)
        .attr('y1', MARGIN.top).attr('y2', MARGIN.top + MAIN_H_ACT)
        .attr('stroke', '#333').attr('stroke-width', 1).attr('opacity', 0.4)

      // Tooltip-Inhalt (Vue-Zustand)
      const isPct = mode.value === 'percent'
      const divisor = isPct ? 1 : 1000000
      const sorted = ALL_KEYS.map((k) => ({ key: k, val: entry[k] as number }))
        .filter((s) => s.val > 0).sort((a, b) => b.val - a.val)
      const cx = event.clientX > window.innerWidth - 260 ? event.clientX - 240 : event.clientX + 14

      tooltip.value = {
        month: fmtMonth(entry._month),
        entries: sorted.map((s) => ({
          key: s.key,
          label: LABELS[s.key],
          color: COLORS[s.key],
          val: isPct ? (entry.total > 0 ? (s.val / entry.total * 100) : 0) : (s.val / divisor),
        })),
        totalLabel: isPct ? '100 %' : 'Gesamt: ' + (entry.total / divisor).toFixed(1) + ' TWh',
        clientX: cx,
        clientY: Math.max(10, event.clientY - 120),
      }
    })
    .on('mouseleave', () => {
      const created = svg
      if (created) {
        created.select('.tooltip-line-g').selectAll('line').remove()
      }
      tooltip.value = null
    })

  chartContainer.value.appendChild(created.node()!)
  svg = created
}

// ── Diagramm aktualisieren ──
function updateChart(): void {
  initializeChart()
  if (!svg) return

  const points = aggregatedData.value
  if (!points.length) {
    svg.select('.areas-g').html('')
    svg.select('.x-axis-g').html('')
    svg.select('.y-axis-g').html('')
    return
  }

  const activeKeys = ALL_KEYS.filter((k) => visibleSources.value.includes(k))

  // Zeit-Domain
  const minDate = d3.min(points, (d) => d.date)
  const maxDate = d3.max(points, (d) => d.date)
  if (minDate === undefined || maxDate === undefined) return
  const fullDomain: [Date, Date] = [minDate, maxDate]
  const xDomain = zoomDomain.value ?? fullDomain

  // Stack
  const stack = d3.stack<AggregatedPoint>().keys(activeKeys)
    .value((d, key) => d[key as EnergySourceKey] / (mode.value === 'absolute' ? 1000000 : 1000))
  if (mode.value === 'percent') stack.offset(d3.stackOffsetExpand)
  const stacked = stack(points)

  // Skalen
  const innerW = WIDTH - MARGIN.left - MARGIN.right
  const xScale = d3.scaleTime().domain(xDomain).range([0, innerW])
  let yMax: number
  if (mode.value === 'percent') { yMax = 1 }
  else {
    yMax = d3.max(stacked, (s) => d3.max(s, (d) => d[1])) ?? 1
  }
  const yScale = d3.scaleLinear().domain([0, yMax]).range([MAIN_H_ACT, 0])

  // Aktuelle Referenzen für Zoom/Tooltip-Handler
  currentAggregated = points
  currentXScale = xScale

  // Clip-Rect aktualisieren
  svg.select('.clip-rect')
    .attr('width', innerW).attr('height', MAIN_H_ACT)

  // Zoom-Rect + Verhalten aktualisieren
  svg.select('.zoom-g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  svg.select('.zoom-g rect')
    .attr('width', innerW).attr('height', MAIN_H_ACT)
  zoomBehavior
    ?.scaleExtent([0.3, 30])
    .translateExtent([[0, 0], [innerW, MAIN_H_ACT]])
    .extent([[0, 0], [innerW, MAIN_H_ACT]])

  // Achsen aktualisieren
  updateAxes(xScale, yScale, activeKeys)

  // Flächen aktualisieren (Data-Join)
  updateAreas(stacked, xScale, yScale, points)
}

function updateAxes(
  xScale: d3.ScaleTime<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  activeKeys: EnergySourceKey[],
): void {
  if (!svg) return

  // X-Achse
  const xAxisG = svg.select<SVGGElement>('.x-axis-g')
  xAxisG.html('')
  xAxisG.attr('transform', `translate(${MARGIN.left},${MARGIN.top + MAIN_H_ACT})`)
  xAxisG.call(d3.axisBottom(xScale).tickArguments([6, '%Y']))
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
  xAxisG.select('.domain').attr('stroke', 'var(--hairline)')
  xAxisG.selectAll('.tick text').attr('fill', 'var(--fg-muted)')

  // Y-Achse
  const yFormat = (d: number | d3.NumberValue) => mode.value === 'percent'
    ? Math.round(+d * 100) + '%'
    : d3.format('.1f')(+d) + ' TWh'
  const yAxisG = svg.select<SVGGElement>('.y-axis-g')
  yAxisG.html('')
  yAxisG.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  if (mode.value === 'percent') {
    yAxisG.call(d3.axisLeft(yScale).tickValues([0, 0.25, 0.5, 0.75, 1]).tickFormat(yFormat))
  } else {
    yAxisG.call(d3.axisLeft(yScale).tickFormat(yFormat))
  }
  yAxisG.attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
  yAxisG.select('.domain').attr('stroke', 'var(--hairline)')
  yAxisG.selectAll('.tick text').attr('fill', 'var(--fg-muted)')
}

function updateAreas(
  stacked: d3.Series<AggregatedPoint, string>[],
  xScale: d3.ScaleTime<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  points: AggregatedPoint[],
): void {
  if (!svg) return
  const areasG = svg.select<SVGGElement>('.areas-g')

  // Area-Generator (einmalig pro updateChart, da Skalen sich ändern)
  const area = d3.area<d3.SeriesPoint<AggregatedPoint>>()
    .defined((d) => !isNaN(d[0]) && !isNaN(d[1]))
    .x((_d, i) => {
      const date = points[i]?.date
      return date ? xScale(date) : 0
    })
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  // Data-Join: Energieträger als stabiler Schlüssel
  areasG.selectAll<SVGGElement, d3.Series<AggregatedPoint, string>>('.area-layer')
    .data(stacked, (s: d3.Series<AggregatedPoint, string>) => s.key)
    .join(
      (enter) => enter.append('g').attr('class', 'area-layer')
        .append('path').attr('class', 'area-path'),
      (update) => update,
      (exit) => exit.remove(),
    )
    .select('path')
    .attr('d', area)
    .attr('fill', (d) => COLORS[d.key as EnergySourceKey] ?? '#999')
    .attr('opacity', 0.85)
    .attr('stroke', (d) => COLORS[d.key as EnergySourceKey] ?? '#999')
    .attr('stroke-width', 0.5)
    .attr('stroke-opacity', 1)
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
        class="legend-item" :class="{dimmed:!visibleSources.includes(key)}"
        @click="toggleKey(key)">
        <span class="legend-dot" :style="{background:COLORS[key]}"></span>
        <span class="legend-label" :class="{struck:!visibleSources.includes(key)}">{{ LABELS[key] }}</span>
      </button>
    </div>
    <div class="legend-hint">Klicken zum Ausblenden · Scrollen zum Zoomen</div>
    <div class="chart-wrap">
      <div ref="chartContainer"></div>
    </div>

    <!-- Tooltip (Vue, nicht D3) -->
    <div
      v-if="tooltip"
      class="stacked-tooltip"
      :style="{
        left: tooltip.clientX + 'px',
        top: tooltip.clientY + 'px',
      }"
    >
      <div class="st-tt-month">{{ tooltip.month }}</div>
      <div class="st-tt-total">{{ tooltip.totalLabel }}</div>
      <div v-for="e in tooltip.entries" :key="e.key" class="st-tt-row">
        <span class="st-tt-dot" :style="{ color: e.color }">●</span>
        <span>{{ e.label }}:</span>
        <span class="st-tt-val">{{ e.val.toFixed(1) }}{{ mode === 'percent' ? '%' : ' TWh' }}</span>
      </div>
    </div>
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

/* Tooltip */
.stacked-tooltip {
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
.st-tt-month { font-weight: 600; margin-bottom: 4px; white-space: nowrap; }
.st-tt-total { color: var(--fg-muted); margin-bottom: 6px; }
.st-tt-row { font-size: 12px; white-space: nowrap; }
.st-tt-dot { margin-right: 2px; }
.st-tt-val { font-weight: 500; }
</style>

