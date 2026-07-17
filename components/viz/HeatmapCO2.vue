<script setup lang="ts">
/**
 * HeatmapCO2.vue – CO₂-Heatmap (24h × 12 Monate).
 *
 * Zeigt die erzeugungsgewichtete CO₂-Intensität als 24×12-Raster.
 * Eine feste Farbskala garantiert Jahresvergleichbarkeit.
 * Datenbasis: heatmapCo2 aus visualization-data.json (build-time aggregiert).
 *
 * @example
 * <HeatmapCO2 :data="heatmapCo2" />
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HeatmapCo2Cell } from '~/types/visualization-data'

const props = defineProps<{ data: HeatmapCo2Cell[] }>()

// Jahre aus den Daten ableiten, sortiert aufsteigend
const availableYears = computed(() => {
  const set = new Set(props.data.map((d) => d.year))
  return [...set].sort((a, b) => a - b)
})
const selectedYear = ref(2024)
// Standard auf 2024 setzen (falls vorhanden), sonst letztes Jahr
watch(availableYears, (years) => {
  if (years.includes(2024)) selectedYear.value = 2024
  else if (years.length) {
    const last = years[years.length - 1]
    if (last !== undefined) selectedYear.value = last
  }
}, { immediate: true })

// Feste Farbskala: [100, 650] g CO₂/kWh.
// Begründung: Der deutsche Strommix liegt typischerweise zwischen ~200 (hoher EE-Anteil)
// und ~600 (viel Kohle) g/kWh. Eine feste Domain stellt sicher, dass Jahresvergleiche
// nicht durch wechselnde Skalen verfälscht werden.
const COLOR_DOMAIN: [number, number] = [100, 650]
const colorScale = d3.scaleSequential(d3.interpolateRgb('#F5F5F0', '#6B4423'))
  .domain(COLOR_DOMAIN)

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i)

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipEl: d3.Selection<HTMLDivElement, unknown, HTMLElement, undefined> | null = null
onUnmounted(() => { tooltipEl?.remove() })

const MARGIN = { top: 28, right: 70, bottom: 36, left: 48 }
const CHART_H = 300
const VIEW_W = 700

function drawChart() {
  const svgEl = svgRef.value
  if (!svgEl) return

  const year = selectedYear.value
  const cells = props.data.filter((d) => d.year === year)

  if (!cells.length) return

  // Lookup: month×hour → HeatmapCo2Cell
  const lookup = new Map<string, HeatmapCo2Cell>()
  for (const c of cells) { lookup.set(`${c.month}-${c.hour}`, c) }

  // 12×24-Raster aufbauen, fehlende Zellen = null
  const grid: (HeatmapCo2Cell | null)[][] = ALL_MONTHS.map((m) =>
    ALL_HOURS.map((h) => lookup.get(`${m + 1}-${h}`) ?? null)
  )
  // Flaches Array für Data-Join
  const flat: (HeatmapCo2Cell & { row: number; col: number } | null)[] = []
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const cell = grid[m]![h]
      flat.push(cell ? { ...cell, row: h, col: m } : null)
    }
  }

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const cellW = (VIEW_W - MARGIN.left - MARGIN.right) / 12
  const cellH = CHART_H / 24
  const svgH = MARGIN.top + CHART_H + MARGIN.bottom

  svg.attr('viewBox', `0 0 ${VIEW_W} ${svgH}`)

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
      .attr('x1', MARGIN.left).attr('x2', MARGIN.left + VIEW_W - MARGIN.left - MARGIN.right)
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
      .text(MONTH_LABELS[m]!)
  }

  // Heatmap-Zellen
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
  const cellsG = g.selectAll('rect').data(flat).join('rect')
    .attr('x', (_d, i) => (i % 12) * cellW)
    .attr('y', (_d, i) => Math.floor(i / 12) * cellH)
    .attr('width', Math.max(1, cellW - 1))
    .attr('height', Math.max(1, cellH - 1))
    .attr('rx', 1)
    .attr('fill', (d) => d ? colorScale(d.co2GramsPerKwh) : '#F0F0F0')
    .attr('stroke', 'none')

  // Monats-Trennlinien
  for (let m = 1; m < 12; m++) {
    g.append('line')
      .attr('x1', m * cellW).attr('y1', 0).attr('x2', m * cellW).attr('y2', CHART_H)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }

  // Tooltip
  cellsG
    .on('mouseenter', function (event: MouseEvent, d) {
      if (!tooltipEl || !d) return
      tooltipEl.style('display', 'block')
        .html(`${MONTH_LABELS[d.month - 1]}, ${String(d.hour).padStart(2, '0')}:00`
          + `<br><span style="color:var(--fg-muted)">Ø ${Math.round(d.co2GramsPerKwh)} g CO₂/kWh`
          + ` · ${d.observationCount} Tage</span>`)
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
  const legG = svg.append('g').attr('transform', `translate(${MARGIN.left + VIEW_W - MARGIN.left - MARGIN.right + 12}, ${MARGIN.top})`)
  const gradId = `heatmap-grad-co2-${year}`
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
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(String(Math.round(COLOR_DOMAIN[1])))
  legG.append('text').attr('x', 16).attr('y', 142).attr('dominant-baseline', 'auto')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(String(Math.round(COLOR_DOMAIN[0])))
  legG.append('text').attr('x', 0).attr('y', 152)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)').text('g CO₂/kWh')

  svg.append('text')
    .attr('x', MARGIN.left).attr('y', svgH - 6)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .text(`${year} · ${cells.length} Zellen`)
}

watch([() => props.data, selectedYear], () => { drawChart() }, { deep: false })
onMounted(() => { drawChart() })
</script>

<template>
  <div v-if="!data.length" class="heatmap-card">
    <div class="heatmap-empty">Keine CO₂-Heatmap-Daten verfügbar.</div>
  </div>
  <div v-else class="heatmap-card">
    <div class="heatmap-header">
      <h3 class="heatmap-heading">CO₂-Intensität im Tagesverlauf</h3>
    </div>
    <p class="heatmap-subtitle">Jede Zelle zeigt den erzeugungsgewichteten Durchschnitt eines Monats zu einer bestimmten Uhrzeit.</p>

    <div class="heatmap-controls">
      <div class="control-group">
        <span class="control-label">Jahr:</span>
        <select v-model="selectedYear" class="heatmap-select">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div v-if="!props.data.filter((d) => d.year === selectedYear).length" class="heatmap-empty">
      Für das ausgewählte Jahr sind keine Daten verfügbar.
    </div>
    <template v-else>
      <div class="heatmap-layout">
        <div class="heatmap-main">
          <div class="heatmap-scroll">
            <svg ref="svgRef"></svg>
          </div>
          <p class="heatmap-legend-text">
            Je dunkler das Feld, desto höher die CO₂-Intensität. Die Farbskala ist für alle Jahre identisch (<code>{{ COLOR_DOMAIN[0] }} – {{ COLOR_DOMAIN[1] }} g CO₂/kWh</code>).
          </p>
        </div>
      </div>
    </template>
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
</style>
