<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import {
  formatDelta,
  formatPercent,
  getBarOpacity,
  getLabelData,
  toggleCategoryFilter as toggleCategoryFilterPure,
} from '~/components/home/groupedBarUtils'
import type { EnergyDataPoint, FlatBarItem, EnergyCategory } from '~/components/home/groupedBarUtils'

export type { EnergyDataPoint } from '~/components/home/groupedBarUtils'

interface TooltipState {
  visible: boolean
  label: string
  category: string
  year: '2015' | '2024'
  value: string
  delta: string
  clientX: number
  clientY: number
}

const props = defineProps<{
  data: EnergyDataPoint[]
}>()

const activeCategory = ref<EnergyCategory | null>(null)

const filteredData = computed<EnergyDataPoint[]>(function () {
  if (activeCategory.value === null) {
    return props.data
  }
  return props.data.filter(function (dataPoint) {
    return dataPoint.category === activeCategory.value
  })
})

const tooltip = ref<TooltipState | null>(null)

const chartHintText = computed<string>(function () {
  if (activeCategory.value === null) {
    return 'Energieträger anklicken, um die zugehörige Kategorie hervorzuheben.'
  }
  return 'Erneut klicken, um den Filter zurückzusetzen.'
})

const tooltipComparisonYear = computed<number>(function () {
  if (tooltip.value === null) {
    return 2015
  }
  if (tooltip.value.year === '2024') {
    return 2015
  }
  return 2024
})

const germanNumberFormat = d3.formatLocale({
  decimal: ',',
  thousands: '.',
  grouping: [3],
  currency: ['', ' €'],
})

const svgRef = ref<SVGSVGElement | null>(null)

const CHART_WIDTH = 900
const CHART_MARGIN = { top: 40, right: 80, bottom: 86, left: 200 }
const ROW_HEIGHT = 64
const OUTER_BAND_PADDING = 0.45
const INNER_BAND_PADDING = 0.08
const X_AXIS_TICK_VALUES = [0, 5, 10, 15, 20, 25, 30]

const CATEGORY_COLORS: Record<EnergyCategory, string> = {
  erneuerbar: '#7a9e6e',
  fossil: '#a67c52',
  kernkraft: '#b56b8a',
}

const CATEGORY_COLORS_CONTRAST: Record<EnergyCategory, { year2015: string; year2024: string }> = {
  erneuerbar: { year2015: '#9CBE7E', year2024: '#33612A' },
  fossil:      { year2015: '#D2A25C', year2024: '#6F3F12' },
  kernkraft:   { year2015: '#D18BAF', year2024: '#84265A' },
}

function getCategoryColor(category: EnergyCategory, year: '2015' | '2024'): string {
  const isContrast = document.documentElement.dataset.contrast === 'on'
  if (isContrast) {
    return CATEGORY_COLORS_CONTRAST[category][year === '2015' ? 'year2015' : 'year2024']
  }
  return CATEGORY_COLORS[category]
}

const CATEGORY_LABELS: Record<EnergyCategory, string> = {
  erneuerbar: 'Erneuerbare Energien',
  fossil: 'Fossile Energieträger',
  kernkraft: 'Kernenergie',
}

function toggleCategoryFilter(clickedCategory: EnergyCategory): void {
  activeCategory.value = toggleCategoryFilterPure(activeCategory.value, clickedCategory)
}

function getBarLabelColor(year: '2015' | '2024'): string {
  if (year === '2015') {
    return '#8a8a85'
  }
  return 'var(--text-color)'
}

const DELTA_LABEL_COLOR = '#4a4a45'

// Haupt-Zeichenfunktion
function renderChart(): void {
  const currentData = filteredData.value
  if (currentData.length === 0 || svgRef.value === null) {
    return
  }

  const svg = d3.select(svgRef.value)
  const currentInnerHeight = currentData.length * ROW_HEIGHT
  const currentChartHeight = currentInnerHeight + CHART_MARGIN.top + CHART_MARGIN.bottom
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right

  // SVG einmalig einrichten
  const isFirstRender = svg.select('.chart-content').empty()
  if (isFirstRender) {
    svg
      .attr('width', CHART_WIDTH)
      .attr('height', currentChartHeight)
      .attr('role', 'img')
      .attr('aria-label', 'Gruppiertes Balkendiagramm: Stromerzeugungsanteile 2015 und 2024')

    svg.append('g').attr('class', 'grid')
    svg.append('g').attr('class', 'chart-content')
    svg.append('g').attr('class', 'x-axis')
    svg.append('g').attr('class', 'axis-label')
  } else {
    svg.attr('height', currentChartHeight)
  }

  // Zwei Skalen: eine für die Zeile pro Energieträger, eine für die beiden Jahre
  const outerScale = d3.scaleBand<string>()
    .domain(currentData.map(function (d) { return d.id }))
    .range([0, currentInnerHeight])
    .padding(OUTER_BAND_PADDING)

  const innerScale = d3.scaleBand<string>()
    .domain(['2015', '2024'])
    .range([0, outerScale.bandwidth()])
    .padding(INNER_BAND_PADDING)

  function getBarTopY(bar: FlatBarItem): number {
    const rowTop = outerScale(bar.parent.id) ?? 0
    const withinRow = innerScale(bar.year) ?? 0
    return CHART_MARGIN.top + rowTop + withinRow
  }

  // x-Skala
  let maxFound = 0
  for (const dataPoint of currentData) {
    const m = Math.max(dataPoint.value2015, dataPoint.value2024)
    if (m > maxFound) {
      maxFound = m
    }
  }
  const xScale = d3.scaleLinear()
    .domain([0, Math.max(maxFound * 1.1, 30)])
    .nice()
    .range([0, innerWidth])

  // Aus jedem Energieträger zwei Balken machen (2015 und 2024)
  const flatBars: FlatBarItem[] = []
  for (const dataPoint of currentData) {
    flatBars.push(
      { id: dataPoint.id + '-2015', parent: dataPoint, year: '2015', value: dataPoint.value2015 },
    )
    flatBars.push(
      { id: dataPoint.id + '-2024', parent: dataPoint, year: '2024', value: dataPoint.value2024 },
    )
  }

  const labelBars = getLabelData(flatBars)

  // Rasterlinien
  const gridGroup = svg.select<SVGGElement>('.grid')
  gridGroup.selectAll<SVGLineElement, number>('.grid-line')
    .data(X_AXIS_TICK_VALUES)
    .join('line')
    .attr('class', 'grid-line')
    .attr('y1', CHART_MARGIN.top)
    .attr('y2', CHART_MARGIN.top + currentInnerHeight)
    .attr('x1', function (tickValue) { return CHART_MARGIN.left + xScale(tickValue) })
    .attr('x2', function (tickValue) { return CHART_MARGIN.left + xScale(tickValue) })
    .attr('stroke', '#f0ede8')
    .attr('stroke-width', 1)

  // x-Achse
  const xAxis = d3.axisBottom(xScale)
    .tickValues(X_AXIS_TICK_VALUES)
    .tickFormat(function (tickValue) {
      return germanNumberFormat.format('.0f')(Number(tickValue)) + ' %'
    })
    .tickSize(4)
  const xAxisGroup = svg.select<SVGGElement>('.x-axis')
    .attr('transform', 'translate(' + CHART_MARGIN.left + ', ' + (CHART_MARGIN.top + currentInnerHeight) + ')')
  xAxisGroup.call(xAxis)
  xAxisGroup.select('.domain').remove()
  xAxisGroup.selectAll('.tick text')
    .attr('font-size', '11px')
    .attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')

  // Achsentitel
  const axisLabelGroup = svg.select<SVGGElement>('.axis-label')
  axisLabelGroup.html('')
  axisLabelGroup.append('text')
    .attr('x', CHART_MARGIN.left + innerWidth / 2)
    .attr('y', CHART_MARGIN.top + currentInnerHeight + 52)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em')
    .style('text-transform', 'uppercase')
    .text('Anteil an der öffentlichen Nettostromerzeugung')

  // Balken zeichnen
  const chartContent = svg.select<SVGGElement>('.chart-content')
  chartContent.selectAll<SVGRectElement, FlatBarItem>('.bar')
    .data(flatBars, function (flatBar: FlatBarItem) { return flatBar.id })
    .join('rect')
    .attr('class', 'bar')
    .attr('x', CHART_MARGIN.left)
    .attr('y', getBarTopY)
    .attr('height', innerScale.bandwidth())
    .attr('fill', function (bar) { return getCategoryColor(bar.parent.category, bar.year) })
    .attr('opacity', getBarOpacity)
    .attr('rx', 2)
    .attr('ry', 2)
    .on('mouseenter', function (event: MouseEvent, flatBar: FlatBarItem) {
      tooltip.value = {
        visible: true,
        label: flatBar.parent.label,
        category: CATEGORY_LABELS[flatBar.parent.category],
        year: flatBar.year,
        value: formatPercent(flatBar.value),
        delta: formatDelta(flatBar.parent.displayedDelta),
        clientX: event.clientX,
        clientY: event.clientY,
      }
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltip.value !== null) {
        tooltip.value.clientX = event.clientX
        tooltip.value.clientY = event.clientY
      }
    })
    .on('mouseleave', function () {
      tooltip.value = null
    })
    .transition()
    .duration(400)
    .attr('width', function (bar) { return xScale(bar.value) })

  // Prozent-Label am Ende jedes Balkens
  chartContent.selectAll<SVGTextElement, FlatBarItem>('.bar-label')
    .data(labelBars, function (flatBar: FlatBarItem) { return flatBar.id })
    .join('text')
    .attr('class', 'bar-label')
    .attr('x', function (bar) { return CHART_MARGIN.left + xScale(bar.value) + 4 })
    .attr('y', function (bar) { return getBarTopY(bar) + innerScale.bandwidth() / 2 })
    .attr('opacity', 1)
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('fill', function (bar) { return getBarLabelColor(bar.year) })
    .attr('font-family', 'var(--sans-font)')
    .style('font-variant-numeric', 'tabular-nums')
    .text(function (bar) { return formatPercent(bar.value) })

  // Zeilenbeschriftung links: pro Energieträger Name und Kategorie
  const rowLabelGroups = chartContent
    .selectAll<SVGGElement, EnergyDataPoint>('.row-label-group')
    .data(currentData, function (dataPoint) { return dataPoint.id })
    .join('g')
    .attr('class', 'row-label-group')
    .attr('transform', function (dataPoint) {
      const yTop = CHART_MARGIN.top + (outerScale(dataPoint.id) ?? 0)
      return 'translate(0, ' + yTop + ')'
    })

  rowLabelGroups.each(function renderOneRowLabel(this: SVGGElement, dataPoint: EnergyDataPoint) {
    const groupElement = d3.select(this)
    const bandCenter = outerScale.bandwidth() / 2

    groupElement.selectAll('text').remove()

    groupElement.append('text')
      .attr('class', 'row-label-name')
      .attr('x', CHART_MARGIN.left - 12)
      .attr('y', bandCenter - 3)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'alphabetic')
      .attr('font-size', '14px')
      .attr('fill', 'var(--text-color)')
      .attr('font-family', 'var(--sans-font)')
      .style('cursor', 'pointer')
      .text(dataPoint.label)
      .on('click', function () { toggleCategoryFilter(dataPoint.category) })

    groupElement.append('text')
      .attr('class', 'row-label-cat')
      .attr('x', CHART_MARGIN.left - 12)
      .attr('y', bandCenter + 4)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'hanging')
      .attr('font-size', '11px')
      .attr('fill', '#8a8a85')
      .attr('font-family', 'var(--sans-font)')
      .style('cursor', 'pointer')
      .text(CATEGORY_LABELS[dataPoint.category])
      .on('click', function () { toggleCategoryFilter(dataPoint.category) })
  })

  // Delta-Label rechts (Veränderung in Prozentpunkten)
  chartContent.selectAll<SVGTextElement, EnergyDataPoint>('.delta-label')
    .data(currentData, function (dataPoint: EnergyDataPoint) { return dataPoint.id })
    .join('text')
    .attr('class', 'delta-label')
    .attr('x', CHART_MARGIN.left + innerWidth + 8)
    .attr('y', function (dataPoint) {
      const bandTop = outerScale(dataPoint.id) ?? 0
      return CHART_MARGIN.top + bandTop + outerScale.bandwidth() / 2
    })
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('font-family', "'SFMono-Regular', Consolas, monospace")
    .style('font-variant-numeric', 'tabular-nums')
    .text(function (dataPoint) { return formatDelta(dataPoint.displayedDelta) })
    .attr('fill', DELTA_LABEL_COLOR)

  // Legende oberhalb des Charts
  const legendSvg = svg.selectAll<SVGGElement, unknown>('.chart-legend').data([null])
  const legendGroup = legendSvg.join('g').attr('class', 'chart-legend')
  legendGroup.html('')
  const legendX = CHART_MARGIN.left + innerWidth / 2 - 60
  const isContrast = document.documentElement.dataset.contrast === 'on'

  legendGroup.append('rect')
    .attr('x', legendX).attr('y', 14)
    .attr('width', 12).attr('height', 12).attr('rx', 2).attr('ry', 2)
    .attr('fill', isContrast ? '#6F3F12' : '#8a8a85')
    .attr('opacity', isContrast ? 1 : 0.45)
  legendGroup.append('text')
    .attr('x', legendX + 18).attr('y', 24)
    .attr('font-size', '11px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em').style('text-transform', 'uppercase')
    .text('2015')
  legendGroup.append('rect')
    .attr('x', legendX + 66).attr('y', 14)
    .attr('width', 12).attr('height', 12).attr('rx', 2).attr('ry', 2)
    .attr('fill', isContrast ? '#33612A' : '#8a8a85')
    .attr('opacity', isContrast ? 1 : 1.0)
  legendGroup.append('text')
    .attr('x', legendX + 84).attr('y', 24)
    .attr('font-size', '11px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em').style('text-transform', 'uppercase')
    .text('2024')
}

let contrastObserver: MutationObserver | null = null

onMounted(function () {
  renderChart()

  contrastObserver = new MutationObserver(function () {
    renderChart()
  })
  contrastObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-contrast'],
  })
})

onBeforeUnmount(function () {
  contrastObserver?.disconnect()
  contrastObserver = null

  if (svgRef.value !== null) {
    const svg = d3.select(svgRef.value)
    svg.selectAll('*').remove()
    svg.attr('width', null).attr('height', null)
  }
})

watch(filteredData, function () { renderChart() }, { flush: 'post', deep: true })
</script>

<template>
  <div class="grouped-bar-wrapper">
    <div class="chart-hint">
      <span class="chart-hint-icon" aria-hidden="true">↳</span>
      {{ chartHintText }}
    </div>
    <svg ref="svgRef" class="grouped-bar-svg"></svg>

    <div
      v-if="tooltip?.visible"
      class="bar-tooltip"
      :style="{
        left: (tooltip.clientX + 14) + 'px',
        top: Math.max(8, tooltip.clientY - 72) + 'px',
      }"
    >
      <div class="bar-tt-label">{{ tooltip.label }}</div>
      <div class="bar-tt-row">
        <span class="bar-tt-year">{{ tooltip.year }}:</span>
        <span class="bar-tt-val">{{ tooltip.value }}</span>
      </div>
      <div class="bar-tt-cat">{{ tooltip.category }}</div>
      <div class="bar-tt-delta">Veränderung zu {{ tooltipComparisonYear }}: {{ tooltip.delta }}</div>
    </div>
  </div>
</template>

<style scoped>
.grouped-bar-wrapper {
  position: relative;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.chart-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans-font);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--muted-text-color);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  margin-bottom: 24px;
  font-style: normal;
}

.chart-hint-icon {
  font-size: 11px;
  opacity: 0.6;
}

.grouped-bar-svg {
  width: 100%;
  height: auto;
  display: block;
}

.bar-tooltip {
  position: fixed;
  pointer-events: none;
  background: rgba(42, 42, 38, 0.92);
  color: #f0f0ea;
  font-family: var(--sans-font);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  line-height: 1.5;
  z-index: 1000;
  white-space: nowrap;
}

.bar-tt-label {
  font-weight: 600;
  margin-bottom: 2px;
}

.bar-tt-row {
  display: flex;
  gap: 6px;
}

.bar-tt-year {
  opacity: 0.7;
}

.bar-tt-val {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bar-tt-cat {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 1px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bar-tt-delta {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

:deep(.x-axis .tick text) {
  font-family: var(--sans-font);
  font-size: 11px;
  fill: #8a8a85;
}

:deep(.x-axis .tick line) {
  stroke: #d0cec8;
}

/* SVG-Text-Elemente */
:deep(.bar-label),
:deep(.delta-label) {
  font-size: 12px;
}

:deep(.row-label-name) {
  font-size: 14px;
}

:deep(.row-label-cat),
:deep(.groupled-bar-legend text) {
  font-size: 11px;
}
</style>
