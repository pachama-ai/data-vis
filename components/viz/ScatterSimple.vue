<script setup lang="ts">
/**
 * ScatterSimple.vue – Streudiagramm EE-Anteil vs. CO₂-Intensität.
 *
 * Zeigt tägliche Datenpunkte (EE-Anteil % vs. CO₂ g/kWh) als
 * Scatter-Plot über alle Jahre oder ein einzelnes Jahr.
 * Datenbasis: scatterDaily aus visualization-data.json.
 *
 * @example
 * <ScatterSimple :data="scatterDaily" />
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { ScatterDailyPoint } from '~/types/visualization-data'

const props = defineProps<{ data: ScatterDailyPoint[] }>()

// Jahre aus den Daten ableiten
const availableYears = computed(() => {
  const set = new Set<number>()
  for (const d of props.data) {
    const y = Number(d.date.slice(0, 4))
    if (!isNaN(y)) set.add(y)
  }
  return [...set].sort((a, b) => a - b)
})

type YearSelection = 'all' | number
const selectedYear = ref<YearSelection>('all')

// Select-Change-Handler: native <select> liefert Strings
function onYearChange(event: Event) {
  const el = event.target
  if (!(el instanceof HTMLSelectElement)) return
  selectedYear.value = el.value === 'all' ? 'all' : Number(el.value)
}

// Gefilterte Daten zentral ableiten (für Template + drawChart)
const filteredData = computed(() => {
  if (selectedYear.value === 'all') return props.data
  return props.data.filter((d) => Number(d.date.slice(0, 4)) === selectedYear.value)
})

// Feste Domains für Jahresvergleichbarkeit
// EE-Anteil ~13–84 %, CO₂ ~131–636 g/kWh → [0, 100] × [100, 650] mit kleinem Puffer
const X_DOMAIN: [number, number] = [0, 100]
const Y_DOMAIN: [number, number] = [100, 650]

const MARGIN = { top: 24, right: 24, bottom: 44, left: 56 }
const VIEW_W = 700
const VIEW_H = 480
const INNER_W = VIEW_W - MARGIN.left - MARGIN.right
const INNER_H = VIEW_H - MARGIN.top - MARGIN.bottom

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipEl: d3.Selection<HTMLDivElement, unknown, HTMLElement, undefined> | null = null
onUnmounted(() => { tooltipEl?.remove() })

function drawChart() {
  const svgEl = svgRef.value
  if (!svgEl) return
  const points = filteredData.value
  if (!points.length) return

  const xScale = d3.scaleLinear().domain(X_DOMAIN).range([0, INNER_W])
  const yScale = d3.scaleLinear().domain(Y_DOMAIN).range([INNER_H, 0])

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`)

  if (!tooltipEl) {
    tooltipEl = d3.select('body').append('div')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#fff').style('border', '1px solid var(--hairline)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('font-size', '12px').style('pointer-events', 'none')
      .style('z-index', '1000').style('line-height', '1.5')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)').style('font-family', 'var(--font-sans)')
  }

  const chart = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  // Gitterlinien
  const xGrid = d3.axisBottom(xScale).tickSize(INNER_H).tickFormat(null)
  const yGrid = d3.axisLeft(yScale).tickSize(-INNER_W).tickFormat(null)
  chart.append('g').attr('class', 'grid').call(xGrid)
    .attr('color', '#E5E5E5').attr('stroke-dasharray', '3,3')
  chart.append('g').attr('class', 'grid').call(yGrid)
    .attr('color', '#E5E5E5').attr('stroke-dasharray', '3,3')

  // Achsen
  chart.append('g').attr('transform', `translate(0,${INNER_H})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('color', 'var(--fg-muted)')
  chart.append('g')
    .call(d3.axisLeft(yScale).ticks(6))
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)').attr('color', 'var(--fg-muted)')

  // Achsentitel
  chart.append('text')
    .attr('x', INNER_W / 2).attr('y', INNER_H + 34)
    .attr('text-anchor', 'middle').attr('font-family', 'var(--font-sans)')
    .attr('font-size', '12px').attr('fill', 'var(--fg-muted)')
    .text('EE-Anteil (%) →')
  chart.append('text')
    .attr('x', -INNER_H / 2).attr('y', -40)
    .attr('text-anchor', 'middle').attr('font-family', 'var(--font-sans)')
    .attr('font-size', '12px').attr('fill', 'var(--fg-muted)')
    .attr('transform', 'rotate(-90)')
    .text('CO₂-Intensität (g/kWh) →')

  // Punkte
  const circles = chart.selectAll('circle')
    .data(points)
    .join('circle')
    .attr('cx', (d) => xScale(d.renewableSharePercent))
    .attr('cy', (d) => yScale(d.co2GramsPerKwh))
    .attr('r', 3)
    .attr('fill', '#4A90A4')
    .attr('opacity', 0.3)
    .attr('stroke', 'none')

  // Trendlinie (lineare Regression)
  if (points.length >= 2) {
    const n = points.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (const d of points) {
      const x = d.renewableSharePercent
      const y = d.co2GramsPerKwh
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    if (Number.isFinite(slope) && Number.isFinite(intercept)) {
      const x0 = X_DOMAIN[0], x1 = X_DOMAIN[1]
      const y0 = slope * x0 + intercept, y1 = slope * x1 + intercept
      const clampY = (y: number) => Math.max(Y_DOMAIN[0], Math.min(Y_DOMAIN[1], y))
      chart.append('line')
        .attr('x1', xScale(x0)).attr('y1', yScale(clampY(y0)))
        .attr('x2', xScale(x1)).attr('y2', yScale(clampY(y1)))
        .attr('stroke', '#B85C8E').attr('stroke-width', 2).attr('stroke-dasharray', '4,3')
    }
  }

  // Tooltip – Suche über nach EE-Anteil sortierte Kopie
  const sortedByX = [...points].sort((a, b) => a.renewableSharePercent - b.renewableSharePercent)
  const bisectX = d3.bisector<ScatterDailyPoint, number>((d) => d.renewableSharePercent).center

  chart.append('rect')
    .attr('width', INNER_W).attr('height', INNER_H)
    .attr('fill', 'none').attr('pointer-events', 'all')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const xVal = xScale.invert(mx)
      const i = bisectX(sortedByX, xVal)
      const d = sortedByX[i]
      if (!d) return

      // Punkt hervorheben
      circles.attr('stroke', null).attr('stroke-width', null)
      circles.filter((p) => p.date === d.date)
        .attr('stroke', '#333').attr('stroke-width', 1.5)

      if (tooltipEl) {
        tooltipEl.style('display', 'block')
          .html(`<div style="font-weight:600;margin-bottom:4px">${d.date}</div>`
            + `EE-Anteil: ${d.renewableSharePercent.toFixed(1)} %<br>`
            + `CO₂: ${Math.round(d.co2GramsPerKwh)} g/kWh<br>`
            + `<span style="color:var(--fg-muted)">${d.availableHourCount} verfügbare Stunden</span>`)
          .style('left', `${event.clientX + 14}px`)
          .style('top', `${Math.max(8, event.clientY - 80)}px`)
      }
    })
    .on('mouseleave', function () {
      circles.attr('stroke', null).attr('stroke-width', null)
      if (tooltipEl) tooltipEl.style('display', 'none')
    })
}

watch([() => props.data, selectedYear], () => { drawChart() }, { deep: false })
onMounted(() => { drawChart() })
</script>

<template>
  <div v-if="!data.length" class="scatter-empty">
    Keine Tagesdaten für das Streudiagramm verfügbar.
  </div>
  <div v-else class="scatter-card">
    <div class="scatter-header">
      <h3 class="scatter-heading">EE-Anteil vs. CO₂-Intensität</h3>
      <div class="scatter-controls">
        <span class="control-label">Jahr:</span>
        <select :value="selectedYear" class="scatter-select" @change="onYearChange">
          <option value="all">Alle Jahre</option>
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>
    <p class="scatter-subtitle">Tägliche Messwerte | Feste Achsenspannen für alle Jahre</p>

    <div v-if="filteredData.length === 0" class="scatter-empty">
      Für das ausgewählte Jahr sind keine Tagesdaten verfügbar.
    </div>
    <div v-else class="scatter-chart-wrap">
      <svg ref="svgRef"></svg>
    </div>
  </div>
</template>

<style scoped>
.scatter-card { width:100%; }
.scatter-empty { padding:40px 16px; text-align:center; color:var(--fg-muted); font-family:var(--font-sans); font-size:14px; }
.scatter-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:4px; }
.scatter-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.scatter-subtitle { font-family:var(--font-sans); font-size:13px; color:var(--fg-muted); margin:4px 0 16px; }
.scatter-controls { display:flex; align-items:center; gap:8px; }
.control-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); }
.scatter-select { font-family:var(--font-sans); font-size:13px; padding:4px 8px; border:1px solid var(--hairline); border-radius:6px; background:var(--bg); color:var(--fg); cursor:pointer; }
.scatter-chart-wrap { width:100%; }
.scatter-chart-wrap svg { width:100%; height:auto; display:block; }
</style>
