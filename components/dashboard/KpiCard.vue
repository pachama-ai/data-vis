<script setup lang="ts">
/**
 * components/dashboard/KpiCard.vue
 * =================================
 * KPI-Karte mit Sparkline, Hover-Sync,
 * Aggregations-Label, Min/Max-Hinweis und ausblendbarem Delta.
 */

import { ref, computed, watchEffect } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  title: string
  value: string
  unit: string
  aggLabel?: string
  sparklineData: number[]
  sparkLabels?: string[]
  deltaLabel?: string | null
  deltaPositive?: boolean
  deltaTooltip?: string
  hoveredIndex?: number | null
  selectedIndex?: number | null
  minLabel?: string
  maxLabel?: string
  sparkColor?: string
}>()

const emit = defineEmits<{
  hover: [index: number | null]
  leave: []
}>()

// ----------------------------------------------------------------
// Sparkline (D3-SVG, 200x60)
// ----------------------------------------------------------------
const sparkRef = ref<SVGSVGElement | null>(null)

watchEffect(() => {
  const data = props.sparklineData
  if (!data.length || !sparkRef.value) return

  const svg = d3.select(sparkRef.value)
  svg.selectAll('*').remove()

  const width = 200
  const height = 60
  const pad = { top: 4, bottom: 4, left: 2, right: 2 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

  const xScale = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([pad.left, pad.left + innerW])

  const yMin = d3.min(data) ?? 0
  const yMax = d3.max(data) ?? 1
  const yPad = (yMax - yMin) * 0.1 || 1
  const yScale = d3.scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .range([pad.top + innerH, pad.top])

  const line = d3.line<number>()
    .x((_d, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveMonotoneX)

  const area = d3.area<number>()
    .x((_d, i) => xScale(i))
    .y0(yScale(yMin - yPad))
    .y1((d) => yScale(d))
    .curve(d3.curveMonotoneX)

  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`
  const defs = svg.append('defs')
  const sc = props.sparkColor || 'var(--accent)'
  defs.append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
    .append('stop').attr('offset', '0%').attr('stop-color', sc).attr('stop-opacity', 0.15)
  defs.select('linearGradient')
    .append('stop').attr('offset', '100%').attr('stop-color', sc).attr('stop-opacity', 0.02)

  svg.append('path')
    .datum(data)
    .attr('d', area)
    .attr('fill', `url(#${gradId})`)

  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', sc)
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.8)

  // Ausgewählten Punkt dauerhaft markieren (bei Einzeljahr)
  if (props.selectedIndex !== null && props.selectedIndex !== undefined) {
    const si = Math.min(props.selectedIndex, data.length - 1)
    svg.append('circle')
      .attr('cx', xScale(si))
      .attr('cy', yScale(data[si]))
      .attr('r', 4)
      .attr('fill', sc)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 1)
  } else {
    // Nur letzten Punkt leicht andeuten
    svg.append('circle')
      .attr('cx', xScale(data.length - 1))
      .attr('cy', yScale(data[data.length - 1]))
      .attr('r', 2.5)
      .attr('fill', sc)
      .attr('opacity', 0.6)
  }

  // Hover-Fadenkreuz
  if (props.hoveredIndex !== null && props.hoveredIndex !== undefined) {
    const hi = Math.min(props.hoveredIndex, data.length - 1)
    svg.append('line')
      .attr('x1', xScale(hi)).attr('y1', pad.top)
      .attr('x2', xScale(hi)).attr('y2', pad.top + innerH)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.7)

    svg.append('circle')
      .attr('cx', xScale(hi))
      .attr('cy', yScale(data[hi]))
      .attr('r', 4)
      .attr('fill', sc)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 1)
  }

  // Unsichtbare Hover-Flaeche
  svg.append('rect')
    .attr('x', pad.left).attr('y', pad.top)
    .attr('width', innerW).attr('height', innerH)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const idx = Math.round(xScale.invert(mx))
      const clamped = Math.max(0, Math.min(data.length - 1, idx))
      emit('hover', clamped)
    })
    .on('mouseleave', () => { emit('leave') })
})

// Tooltip
const tooltipInfo = computed(() => {
  if (props.hoveredIndex === null || props.hoveredIndex === undefined) return null
  const i = Math.min(props.hoveredIndex, props.sparklineData.length - 1)
  return {
    label: props.sparkLabels?.[i] ?? String(i),
    value: props.sparklineData[i],
  }
})
</script>

<template>
  <div class="kpi-card">
    <div class="kpi-header">
      <span class="kpi-title">{{ title }}</span>
      <span v-if="aggLabel" class="kpi-agg-label">{{ aggLabel }}</span>
    </div>
    <div class="kpi-value-row">
      <span class="kpi-value">{{ value }}</span>
      <span class="kpi-unit">{{ unit }}</span>
    </div>
    <div class="kpi-spark-wrap">
      <svg ref="sparkRef" class="kpi-spark"></svg>
      <div v-if="tooltipInfo" class="kpi-tooltip"
        :style="{ left: `${(hoveredIndex ?? 0) / (sparklineData.length - 1) * 100}%` }">
        <span class="kpi-tooltip-label">{{ tooltipInfo.label }}</span>
        <span class="kpi-tooltip-val">{{ tooltipInfo.value.toFixed(1) }}</span>
      </div>
    </div>
    <div v-if="minLabel !== undefined && maxLabel !== undefined" class="kpi-minmax">
      <span>min {{ minLabel }}</span>
      <span>max {{ maxLabel }}</span>
    </div>
    <span v-if="deltaLabel" class="kpi-delta"
      :class="{ good: deltaPositive, bad: !deltaPositive }"
      :title="deltaTooltip || ''">
      {{ deltaLabel }}<span v-if="deltaLabel?.includes('PP')" class="pp-help" title="PP = Prozentpunkte – damit ist nicht der relative Anstieg in Prozent gemeint, sondern die absolute Differenz in Prozentpunkten."> ⓘ</span>
    </span>
  </div>
</template>

<style scoped>
.kpi-card {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  position: relative;
  border-right: 1px solid var(--hairline);
  height: 100%;
}

.kpi-card:last-child {
  border-right: none;
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.kpi-title {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-agg-label {
  font-family: var(--font-sans);
  font-size: 0.55rem;
  color: var(--fg-muted);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-value {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.1;
}

.kpi-unit {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--fg-muted);
}

.kpi-spark-wrap {
  position: relative;
  margin-top: 2px;
}

.kpi-spark {
  width: 100%;
  height: 52px;
  display: block;
}

.kpi-tooltip {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  background: var(--fg);
  color: var(--bg);
  font-family: var(--font-sans);
  font-size: 0.6rem;
  padding: 2px 6px;
  white-space: nowrap;
  display: flex;
  gap: 4px;
  pointer-events: none;
  margin-bottom: 4px;
  z-index: 10;
}

.kpi-tooltip-label { opacity: 0.7; }
.kpi-tooltip-val { font-weight: 600; }

.kpi-minmax {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-sans);
  font-size: 0.55rem;
  color: var(--fg-muted);
  opacity: 0.4;
  line-height: 1.2;
  margin-top: 0;
}

.kpi-delta {
  font-family: var(--font-sans);
  font-size: 0.65rem;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 2px;
}

.kpi-delta.good { color: var(--accent); }
.kpi-delta.bad { color: var(--fg-muted); }

.pp-help {
  cursor: help;
  font-size: 0.6rem;
  color: var(--fg-muted);
  opacity: 0.5;
}
.pp-help:hover { opacity: 1; }
</style>
