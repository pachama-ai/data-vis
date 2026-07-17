<script setup lang="ts">
/**
 * HeatmapCO2.vue – CO₂-Heatmap (24h × 12 Monate).
 *
 * Zeigt die erzeugungsgewichtete CO₂-Intensität als 24×12-Raster.
 * Eine feste Farbskala garantiert Jahresvergleichbarkeit.
 * Datenbasis: heatmapCo2 aus visualization-data.json (build-time aggregiert).
 *
 * Vue/D3-Trennung nach Vorlesungsmuster (Kapitel 8.5):
 * - Vue: Container-Ref, Jahresauswahl, Tooltip, Leerzustände
 * - D3: SVG, Skalen, Achsen, Zellen, Legende
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import type { HeatmapCo2Cell } from '~/types/visualization-data'

const props = defineProps<{ data: HeatmapCo2Cell[] }>()

// ── Von Vue verwaltete Zustände ──
const availableYears = computed(() => {
  const set = new Set(props.data.map((d) => d.year))
  return [...set].sort((a, b) => a - b)
})
const selectedYear = ref(2024)
const tooltip = ref<TooltipState | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)

interface TooltipState {
  label: string
  co2: string
  count: number
  clientX: number
  clientY: number
}

// Standardjahr: 2024, sonst letztes verfügbares
watch(availableYears, (years) => {
  if (years.includes(2024)) selectedYear.value = 2024
  else if (years.length) {
    const last = years[years.length - 1]
    if (last !== undefined) selectedYear.value = last
  }
}, { immediate: true })

function onYearChange(event: Event) {
  const el = event.target
  if (!(el instanceof HTMLSelectElement)) return
  selectedYear.value = Number(el.value)
}

// ── Filter für ausgewähltes Jahr ──
const yearData = computed(() =>
  props.data.filter((d) => d.year === selectedYear.value),
)

// ── Vollständiges 12×24-Raster ──
// Fehlende Zellen bleiben null (nicht 0), um sie von gültigen Messwerten zu unterscheiden.
interface GridCell {
  month: number
  hour: number
  co2: number | null
  count: number
  key: string
}

const gridData = computed<GridCell[]>(() => {
  const lookup = new Map<string, HeatmapCo2Cell>()
  for (const c of yearData.value) {
    lookup.set(`${c.month}-${c.hour}`, c)
  }
  const result: GridCell[] = []
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const key = `${m + 1}-${h}`
      const cell = lookup.get(key)
      result.push(cell
        ? { month: m, hour: h, co2: cell.co2GramsPerKwh, count: cell.observationCount, key }
        : { month: m, hour: h, co2: null, count: 0, key },
      )
    }
  }
  return result
})

// ── Feste Farbskala ──
// Der deutsche Strommix liegt typischerweise zwischen ~200 (hoher EE-Anteil)
// und ~600 (viel Kohle) g/kWh. Eine feste Domain [100, 650] stellt sicher,
// dass Jahresvergleiche nicht durch wechselnde Skalen verfälscht werden.
const COLOR_DOMAIN: [number, number] = [100, 650]
const colorScale = d3.scaleSequential(d3.interpolateRgb('#F5F5F0', '#6B4423'))
  .domain(COLOR_DOMAIN)

const MONTH_LABELS = ['Jan', 'Feb', 'M\u00e4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// ── Layout ──
const MARGIN = { top: 28, right: 70, bottom: 36, left: 48 }
const CHART_H = 300
const VIEW_W = 700
const CELL_W = (VIEW_W - MARGIN.left - MARGIN.right) / 12
const CELL_H = CHART_H / 24

// ── D3-Interna ──
let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

// ── Lifecycle ──
onMounted(() => { updateChart() })
onBeforeUnmount(() => {
  svg?.remove()
  svg = null
})

watch([() => props.data, selectedYear], () => { updateChart() }, { flush: 'post' })

// ── Initialisierung (h├╢chstens einmal) ──
function initializeChart(): void {
  if (!chartContainer.value || svg) return

  const created = d3.create('svg')
    .attr('viewBox', `0 0 ${VIEW_W} ${MARGIN.top + CHART_H + MARGIN.bottom}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'CO\u00b2-Intensit\u00e4t nach Monat und Stunde')

  created.append('g').attr('class', 'y-labels-g')
  created.append('g').attr('class', 'grid-lines-g')
  created.append('g').attr('class', 'x-labels-g')
  created.append('g').attr('class', 'cells-g')
  created.append('g').attr('class', 'month-lines-g')
  created.append('g').attr('class', 'legend-g')
  created.append('text').attr('class', 'footer-text')

  chartContainer.value.appendChild(created.node()!)
  svg = created
}

// ── Diagramm aktualisieren ──
function updateChart(): void {
  initializeChart()
  if (!svg) return

  const cells = gridData.value
  if (!cells.length) { svg.select('.cells-g').html(''); svg.select('.legend-g').html(''); return }

  const svgH = MARGIN.top + CHART_H + MARGIN.bottom

  updateYLabels()
  updateGridLines()
  updateXLabels()
  updateCells(cells)
  updateMonthLines()
  updateLegend()

  svg.select('.footer-text')
    .attr('x', MARGIN.left).attr('y', svgH - 6)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .text(`${selectedYear.value} \u00b7 ${yearData.value.length} Zellen`)
}

function updateYLabels(): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.y-labels-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left - 8}, ${MARGIN.top})`)
  for (let h = 0; h < 24; h += 4) {
    g.append('text').attr('x', 0).attr('y', h * CELL_H + CELL_H / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(String(h).padStart(2, '0'))
  }
}

function updateGridLines(): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.grid-lines-g'); g.html('')
  const plotW = VIEW_W - MARGIN.left - MARGIN.right
  for (let h = 0; h < 24; h++) {
    g.append('line').attr('x1', MARGIN.left).attr('x2', MARGIN.left + plotW)
      .attr('y1', MARGIN.top + h * CELL_H).attr('y2', MARGIN.top + h * CELL_H)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }
}

function updateXLabels(): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.x-labels-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top - 6})`)
  for (let m = 0; m < 12; m++) {
    g.append('text').attr('x', m * CELL_W + CELL_W / 2).attr('y', 0)
      .attr('text-anchor', 'middle').attr('font-size', '11px')
      .attr('font-family', 'var(--font-sans)').attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(MONTH_LABELS[m]!)
  }
}

function updateCells(cells: GridCell[]): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.cells-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  const joined = g.selectAll<SVGRectElement, GridCell>('rect')
    .data(cells, (d: GridCell) => d.key)
    .join('rect')
    .attr('x', (d) => d.month * CELL_W).attr('y', (d) => d.hour * CELL_H)
    .attr('width', Math.max(1, CELL_W - 1)).attr('height', Math.max(1, CELL_H - 1))
    .attr('rx', 1)
    .attr('fill', (d) => d.co2 !== null ? colorScale(d.co2) : '#F0F0F0')
    .attr('stroke', 'none')

  joined
    .on('mouseenter', (event: MouseEvent, d: GridCell) => {
      if (d.co2 === null) return
      tooltip.value = {
        label: `${MONTH_LABELS[d.month]}, ${String(d.hour).padStart(2, '0')}:00`,
        co2: `\u00d8 ${Math.round(d.co2)} g CO\u2082/kWh`,
        count: d.count,
        clientX: event.clientX + 12,
        clientY: event.clientY - 10,
      }
      d3.select(event.currentTarget as SVGRectElement).attr('stroke', 'var(--fg)').attr('stroke-width', 1)
    })
    .on('mousemove', (event: MouseEvent) => {
      if (tooltip.value) { tooltip.value.clientX = event.clientX + 12; tooltip.value.clientY = event.clientY - 10 }
    })
    .on('mouseleave', (event: MouseEvent) => {
      tooltip.value = null
      d3.select(event.currentTarget as SVGRectElement).attr('stroke', 'none')
    })
}

function updateMonthLines(): void {
  if (!svg) return
  const g = svg.select<SVGGElement>('.month-lines-g'); g.html('')
  g.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
  for (let m = 1; m < 12; m++) {
    g.append('line').attr('x1', m * CELL_W).attr('y1', 0)
      .attr('x2', m * CELL_W).attr('y2', CHART_H)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }
}

function updateLegend(): void {
  if (!svg) return
  const legG = svg.select<SVGGElement>('.legend-g'); legG.html('')
  const plotW = VIEW_W - MARGIN.left - MARGIN.right
  legG.attr('transform', `translate(${MARGIN.left + plotW + 12}, ${MARGIN.top})`)

  const gradId = 'heatmap-grad-co2'
  const gradDefs = legG.append('defs').append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const val = COLOR_DOMAIN[0] + t * (COLOR_DOMAIN[1] - COLOR_DOMAIN[0])
    gradDefs.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorScale(val))
  }
  legG.append('rect').attr('width', 12).attr('height', 140).attr('rx', 2).style('fill', `url(#${gradId})`)
  legG.append('text').attr('x', 16).attr('y', 2).attr('dominant-baseline', 'hanging')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(String(Math.round(COLOR_DOMAIN[1])))
  legG.append('text').attr('x', 16).attr('y', 142).attr('dominant-baseline', 'auto')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(String(Math.round(COLOR_DOMAIN[0])))
  legG.append('text').attr('x', 0).attr('y', 152)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)').text('g CO\u2082/kWh')
}
</script>

<template>
  <div v-if="!data.length" class="heatmap-card">
    <div class="heatmap-empty">Keine CO\u2082-Heatmap-Daten verf\u00fcgbar.</div>
  </div>
  <div v-else class="heatmap-card">
    <div class="heatmap-header">
      <h3 class="heatmap-heading">CO\u2082-Intensit\u00e4t im Tagesverlauf</h3>
    </div>
    <p class="heatmap-subtitle">Jede Zelle zeigt den erzeugungsgewichteten Durchschnitt eines Monats zu einer bestimmten Uhrzeit.</p>

    <div class="heatmap-controls">
      <div class="control-group">
        <span class="control-label">Jahr:</span>
        <select :value="selectedYear" class="heatmap-select" @change="onYearChange">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div v-if="yearData.length === 0" class="heatmap-empty">
      F\u00fcr das ausgew\u00e4hlte Jahr sind keine Daten verf\u00fcgbar.
    </div>
    <template v-else>
      <div class="heatmap-layout">
        <div class="heatmap-main">
          <div class="heatmap-scroll">
            <div ref="chartContainer"></div>
          </div>
          <p class="heatmap-legend-text">
            Je dunkler das Feld, desto h\u00f6her die CO\u2082-Intensit\u00e4t. Die Farbskala ist f\u00fcr alle Jahre identisch (<code>{{ COLOR_DOMAIN[0] }} \u2013 {{ COLOR_DOMAIN[1] }} g CO\u2082/kWh</code>).
          </p>
        </div>
      </div>
    </template>

    <!-- Tooltip (Vue, nicht D3) -->
    <div
      v-if="tooltip"
      class="heatmap-tooltip"
      :style="{ left: tooltip.clientX + 'px', top: tooltip.clientY + 'px' }"
    >
      <div style="font-weight:600">{{ tooltip.label }}</div>
      <div style="color:var(--fg-muted)">{{ tooltip.co2 }} &middot; {{ tooltip.count }} Tage</div>
    </div>
  </div>
</template>

<style scoped>
.heatmap-card { width:100%; }
.heatmap-empty { padding:40px 16px; text-align:center; color:var(--fg-muted); font-family:var(--font-sans); font-size:14px; }
.heatmap-header { margin-bottom:2px; }
.heatmap-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.heatmap-subtitle { font-family:var(--font-sans); font-size:15px; color:var(--fg-muted); max-width:640px; line-height:1.5; margin:8px 0 24px; }
.heatmap-controls { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.control-group { display:flex; align-items:center; gap:8px; }
.control-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); flex-shrink:0; }
.heatmap-select { font-family:var(--font-sans); font-size:13px; padding:4px 8px; border:1px solid var(--hairline); border-radius:6px; background:var(--bg); color:var(--fg); cursor:pointer; }
.heatmap-layout { display:grid; grid-template-columns:1fr; gap:32px; align-items:start; }
.heatmap-main { min-width:0; }
.heatmap-scroll { width:100%; overflow-x:auto; overflow-y:hidden; }
.heatmap-scroll svg { display:block; width:100%; height:auto; }
.heatmap-legend-text { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); margin-top:10px; margin-bottom:0; line-height:1.4; }
.heatmap-tooltip {
  position: fixed;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  font-family: var(--font-sans);
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  line-height: 1.5;
}
</style>
