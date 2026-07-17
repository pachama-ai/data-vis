<script setup lang="ts">
/**
 * IntroBarbellChart.vue – D3-Barbell-Chart: Strommix 2015 vs 2024.
 *
 * Zeigt sechs ausgewählte Energieträger als Punktepaare mit
 * Verbindungslinie. Die Anteile werden aus den absoluten MWh-
 * Summen berechnet, weil nur so die erzeugungsgewichtete
 * Zusammensetzung korrekt abgebildet wird.
 *
 * Vue/D3-Trennung nach Vorlesungsmuster (Kapitel 8.5):
 * - Vue stellt Container-Ref, Props und Tooltip-Zustand.
 * - D3 erzeugt/verwaltet das SVG in initializeChart/updateChart.
 *
 * Datenbasis: yearlyMix aus visualization-data.json.
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import type { YearlyMixPoint, EnergySourceValues } from '~/types/visualization-data'

const props = defineProps<{
  yearlyData: { year2015: YearlyMixPoint; year2024: YearlyMixPoint }
}>()

// ── Container für D3 – Vue stellt das Element ──
const chartContainer = ref<HTMLDivElement | null>(null)
let svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

// ── Tooltip-Zustand (Vue, nicht D3) ──
const tooltip = ref<{
  visible: boolean; label: string; color: string
  share2015: string; share2024: string; delta: string
  clientX: number; clientY: number
} | null>(null)

// ── prefers-reduced-motion ──
// Wird beim Laden der Komponente ausgelesen und bleibt konstant,
// damit die Entscheidung nicht während der Lebensdauer wechselt.
const prefersReduced =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

// ── Sechs fachlich relevante Energieträger ──
// Wind (onshore/offshore) und PV als wachsende Erneuerbare;
// Braun-/Steinkohle und Kernenergie als schrumpfende Konventionelle.
const ITEMS: { key: keyof EnergySourceValues; label: string; color: string }[] = [
  { key: 'wind_onshore',  label: 'Wind an Land',      color: '#4A90A4' },
  { key: 'wind_offshore', label: 'Wind auf See',       color: '#1A4A5A' },
  { key: 'pv',            label: 'Photovoltaik',       color: '#E8B547' },
  { key: 'lignite',       label: 'Braunkohle',         color: '#6B4423' },
  { key: 'hardcoal',      label: 'Steinkohle',         color: '#3A3A3A' },
  { key: 'nuclear',       label: 'Kernenergie',        color: '#B85C8E' },
]

interface BarbellRow {
  key: keyof EnergySourceValues
  label: string
  color: string
  share2015: number
  share2024: number
}

// Anteile aus MWh-Summen berechnen, gegen Division durch null sichern.
const computedRows = computed<BarbellRow[]>(() => {
  const { year2015, year2024 } = props.yearlyData
  const t15 = year2015.totalGenerationMwh
  const t24 = year2024.totalGenerationMwh

  const rows = ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    share2015: t15 > 0 ? (year2015.sources[item.key] / t15) * 100 : 0,
    share2024: t24 > 0 ? (year2024.sources[item.key] / t24) * 100 : 0,
  }))
  // Nach absoluter Veränderung sortieren (größter Wandel zuerst)
  rows.sort((a, b) => Math.abs(b.share2024 - b.share2015) - Math.abs(a.share2024 - a.share2015))
  return rows
})

// ── Layout-Konstanten ──
const MARGIN = { top: 40, right: 100, bottom: 40, left: 130 }
const ROW_H = 56
const ROW_GAP = 8
const CAPSULE_H = 20
const DOT_R = 7
const VIEW_W = 800

// ── Lifecycle ──
let hasAnimated = false

onMounted(() => { updateChart() })

onBeforeUnmount(() => {
  svg?.remove()
  svg = null
})

watch(computedRows, () => { updateChart() }, { flush: 'post' })

// ── D3-Initialisierung (höchstens einmal) ──
function initializeChart(): void {
  if (!chartContainer.value || svg) return

  const created = d3.create('svg')
    .attr('viewBox', `0 0 ${VIEW_W} 400`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', 'Vergleich der Stromerzeugungsanteile 2015 und 2024')

  // Feste Gruppen für Legende, Zeilen und Achse (einmalig)
  created.append('g').attr('class', 'legend-g')
  created.append('g').attr('class', 'rows-g')
  created.append('g').attr('class', 'axis-g')

  chartContainer.value.appendChild(created.node()!)
  svg = created
}

// ── Diagramm aktualisieren ──
function updateChart(): void {
  initializeChart()
  if (!svg) return

  const rows = computedRows.value
  if (!rows.length) return

  const totalH = rows.length * (ROW_H + ROW_GAP) - ROW_GAP + MARGIN.top + MARGIN.bottom
  svg.attr('viewBox', `0 0 ${VIEW_W} ${totalH}`)

  // Scale
  const plotW = VIEW_W - MARGIN.left - MARGIN.right
  const xScale = d3.scaleLinear().domain([0, 30]).range([0, plotW])

  // ── Legende (oben rechts) ──
  updateLegend(xScale)

  // ── X-Achse ──
  updateAxis(xScale, rows.length)

  // ── Datenzeilen ──
  updateRows(rows, xScale)
}

function updateLegend(xScale: d3.ScaleLinear<number, number>): void {
  if (!svg) return
  const plotW = VIEW_W - MARGIN.left - MARGIN.right
  const legG = svg.select<SVGGElement>('.legend-g')
  legG.html('')
  legG.attr('transform', `translate(${MARGIN.left + plotW}, ${MARGIN.top - 24})`)

  legG.append('circle').attr('cx', -90).attr('cy', 0).attr('r', 5)
    .attr('fill', 'none').attr('stroke', '#6B7280').attr('stroke-width', 1.5)
  legG.append('text').attr('x', -78).attr('y', 4)
    .attr('font-size', '11px').attr('fill', 'var(--fg-muted)')
    .attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase')
    .text('2015')
  legG.append('circle').attr('cx', -35).attr('cy', 0).attr('r', 5).attr('fill', '#6B7280')
  legG.append('text').attr('x', -23).attr('y', 4)
    .attr('font-size', '11px').attr('fill', 'var(--fg-muted)')
    .attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase')
    .text('2024')
}

function updateAxis(xScale: d3.ScaleLinear<number, number>, rowCount: number): void {
  if (!svg) return
  const axisY = rowCount * (ROW_H + ROW_GAP) - ROW_GAP + 8
  const axisG = svg.select<SVGGElement>('.axis-g')
  axisG.html('')
  axisG.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top + axisY})`)

  axisG.call(d3.axisBottom(xScale).tickValues([0, 10, 20, 30]).tickSize(0)
    .tickFormat((d) => `${d}%`))
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
  axisG.select('.domain').attr('stroke', 'var(--hairline)')
}

function updateRows(rows: BarbellRow[], xScale: d3.ScaleLinear<number, number>): void {
  if (!svg) return
  const rowsG = svg.select<SVGGElement>('.rows-g')
  const plotW = VIEW_W - MARGIN.left - MARGIN.right

  const fmt = (v: number) => v.toFixed(1).replace('.', ',') + ' %'

  const rowSel = rowsG.selectAll<SVGGElement, BarbellRow>('.barbell-row')
    .data(rows, (r: BarbellRow) => r.key)
    .join(
      (enter) => enter.append('g').attr('class', 'barbell-row').attr('opacity', 0),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('transform', (d, i) => `translate(${MARGIN.left}, ${MARGIN.top + i * (ROW_H + ROW_GAP)})`)

  // Einmalige Transition oder sofort sichtbar
  const doAnim = !prefersReduced && !hasAnimated
  if (doAnim) {
    rowSel.transition()
      .delay((d, i) => i * 80)
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('opacity', 1)
    hasAnimated = true
  } else {
    rowSel.attr('opacity', 1)
  }

  // Zeileninhalt zeichnen
  rowSel.each(function (d, _i) {
    const g = d3.select(this)
    const x15 = xScale(d.share2015)
    const x24 = xScale(d.share2024)
    const xMin = Math.min(x15, x24)
    const capsuleW = Math.max(2, Math.abs(x24 - x15))
    const cy = ROW_H / 2
    const delta = d.share2024 - d.share2015
    const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1).replace('.', ',') + ' pp'

    // Label
    let label = g.select<SVGTextElement>('.row-label')
    if (label.empty()) label = g.append('text').attr('class', 'row-label')
    label.attr('x', -MARGIN.left + 12).attr('y', cy + 4)
      .attr('font-size', '13px').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(d.label)

    // Verbindungslinie
    let line = g.select<SVGLineElement>('.conn-line')
    if (line.empty()) line = g.append('line').attr('class', 'conn-line')
    line.attr('x1', x15).attr('y1', cy).attr('x2', x24).attr('y2', cy)
      .attr('stroke', d.color).attr('stroke-width', 2).attr('opacity', 0.3)

    // Kapsel
    let capsule = g.select<SVGRectElement>('.barbell-capsule')
    if (capsule.empty()) capsule = g.append('rect').attr('class', 'barbell-capsule')
    capsule.attr('y', (ROW_H - CAPSULE_H) / 2).attr('height', CAPSULE_H)
      .attr('rx', 10).attr('ry', 10).attr('fill', d.color).attr('opacity', 0.85)

    if (doAnim) {
      capsule.attr('x', x15).attr('width', 0)
        .transition().delay(0).duration(600).ease(d3.easeCubicOut)
        .attr('x', xMin).attr('width', capsuleW)
    } else {
      capsule.attr('x', xMin).attr('width', capsuleW)
    }

    // 2015 Kreis (offen)
    let dot15 = g.select<SVGCircleElement>('.dot-2015')
    if (dot15.empty()) dot15 = g.append('circle').attr('class', 'dot-2015')
    dot15.attr('cx', x15).attr('cy', cy).attr('r', DOT_R)
      .attr('fill', 'none').attr('stroke', d.color).attr('stroke-width', 2)

    let dot15inner = g.select<SVGCircleElement>('.dot-2015-inner')
    if (dot15inner.empty()) dot15inner = g.append('circle').attr('class', 'dot-2015-inner')
    dot15inner.attr('cx', x15).attr('cy', cy).attr('r', 3).attr('fill', '#fff')

    // 2024 Kreis (gefüllt)
    let dot24 = g.select<SVGCircleElement>('.dot-2024')
    if (dot24.empty()) dot24 = g.append('circle').attr('class', 'dot-2024')
    dot24.attr('cx', x24).attr('cy', cy).attr('r', DOT_R).attr('fill', d.color)

    // Prozent-Label 2015
    let label15 = g.select<SVGTextElement>('.pct-2015')
    if (label15.empty()) label15 = g.append('text').attr('class', 'pct-2015')
    label15.attr('x', x15).attr('y', cy - DOT_R - 5)
      .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '500')
      .attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(fmt(d.share2015))

    // Prozent-Label 2024
    let label24 = g.select<SVGTextElement>('.pct-2024')
    if (label24.empty()) label24 = g.append('text').attr('class', 'pct-2024')
    label24.attr('x', x24).attr('y', cy - DOT_R - 5)
      .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '500')
      .attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(fmt(d.share2024))

    // Delta rechts (nur wenn Platz)
    let deltaLabel = g.select<SVGTextElement>('.delta-label')
    if (deltaLabel.empty()) deltaLabel = g.append('text').attr('class', 'delta-label')
    deltaLabel.attr('x', plotW + 8).attr('y', cy + 4)
      .attr('font-size', '12px').attr('font-weight', '500')
      .attr('fill', delta >= 0 ? d.color : 'var(--fg-muted)')
      .attr('font-family', 'var(--font-sans)').text(deltaStr)

    // Tooltip-Events auf der ganzen Zeile
    const bg = g.select<SVGRectElement>('.row-bg')
    if (bg.empty()) {
      g.insert('rect', ':first-child').attr('class', 'row-bg')
        .attr('width', VIEW_W - MARGIN.left).attr('height', ROW_H)
        .attr('fill', 'transparent').attr('cursor', 'default')
        .on('mouseenter', (event: MouseEvent) => {
          tooltip.value = {
            visible: true,
            label: d.label,
            color: d.color,
            share2015: d.share2015.toFixed(1).replace('.', ',') + ' %',
            share2024: d.share2024.toFixed(1).replace('.', ',') + ' %',
            delta: deltaStr,
            clientX: event.clientX,
            clientY: event.clientY,
          }
        })
        .on('mousemove', (event: MouseEvent) => {
          if (tooltip.value) {
            tooltip.value.clientX = event.clientX
            tooltip.value.clientY = event.clientY
          }
        })
        .on('mouseleave', () => { tooltip.value = null })
    }
  })
}
</script>

<template>
  <div class="barbell-card">
    <div ref="chartContainer" class="barbell-chart"></div>

    <!-- Tooltip (Vue, nicht D3) -->
    <div
      v-if="tooltip?.visible"
      class="barbell-tooltip"
      :style="{
        left: (tooltip.clientX + 14) + 'px',
        top: Math.max(8, tooltip.clientY - 80) + 'px',
      }"
    >
      <div class="tt-label" :style="{ color: tooltip.color }">{{ tooltip.label }}</div>
      <div class="tt-row">
        <span class="tt-year">2015:</span>
        <span class="tt-val">{{ tooltip.share2015 }}</span>
      </div>
      <div class="tt-row">
        <span class="tt-year">2024:</span>
        <span class="tt-val">{{ tooltip.share2024 }}</span>
      </div>
      <div class="tt-row tt-delta">
        <span>Veränderung:</span>
        <span>{{ tooltip.delta }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.barbell-card {
  position: relative;
  width: 100%;
  margin-bottom: 96px;
}
.barbell-chart {
  width: 100%;
}
.barbell-chart svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Tooltip */
.barbell-tooltip {
  position: fixed;
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.6;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
}
.tt-label {
  font-weight: 600;
  margin-bottom: 4px;
}
.tt-row {
  display: flex;
  gap: 6px;
}
.tt-year {
  color: var(--fg-muted);
}
.tt-val {
  color: var(--fg);
  font-weight: 500;
}
.tt-delta {
  margin-top: 2px;
  padding-top: 2px;
  border-top: 1px solid var(--hairline);
  color: var(--fg-muted);
}
</style>
