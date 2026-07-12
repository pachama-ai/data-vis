<script setup lang="ts">
/**
 * components/dashboard/KpiCard.vue
 * =================================
 * KPI-Karte mit Sparkline, Hover-Sync, angeglichen an Landingpage/Strommix.
 * Nur dünne Linie (keine Fläche), Source Serif 36px Hauptwert,
 * Hairline-Trennung, per-card Farbe für Sparkline.
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
  showDivider?: boolean
}>()

const emit = defineEmits<{
  hover: [index: number | null]
  leave: []
  click: []
}>()

// ----------------------------------------------------------------
// Sparkline (D3-SVG, nur Linie 1.5px, kein Area)
// ----------------------------------------------------------------
const sparkRef = ref<SVGSVGElement | null>(null)

watchEffect(() => {
  const data = props.sparklineData
  if (!data.length || !sparkRef.value) return

  const svg = d3.select(sparkRef.value)
  svg.selectAll('*').remove()

  const width = 200
  const height = 32
  const pad = { top: 0, bottom: 0, left: 2, right: 2 }
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

  const sc = props.sparkColor || 'var(--accent)'

  // Nur Linie – keine Fläche, keine Endpunkte
  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', sc)
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.7)

  // Hover-Fadenkreuz
  if (props.hoveredIndex !== null && props.hoveredIndex !== undefined) {
    const hi = Math.min(props.hoveredIndex, data.length - 1)
    svg.append('line')
      .attr('x1', xScale(hi)).attr('y1', pad.top)
      .attr('x2', xScale(hi)).attr('y2', pad.top + innerH)
      .attr('stroke', sc)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.5)

    svg.append('circle')
      .attr('cx', xScale(hi))
      .attr('cy', yScale(data[hi]))
      .attr('r', 3)
      .attr('fill', sc)
      .attr('stroke', 'none')
      .attr('opacity', 1)
  }

  // Unsichtbare Hover-Fläche
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
  <div class="kpi-card" :class="{ 'has-divider': showDivider }" @click="emit('click')" role="button" tabindex="0">
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
      {{ deltaLabel }}<span v-if="deltaLabel?.includes('PP')" class="pp-help" title="PP = Prozentpunkte – absolute Differenz, nicht relative Veränderung."> ⓘ</span>
    </span>
  </div>
</template>

<style scoped>
.kpi-card {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
  height: 100%;
}
.kpi-card:hover { background: rgba(0,0,0,0.02); }
.kpi-card:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.kpi-card.has-divider {
  border-right: 1px solid var(--hairline);
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.kpi-title {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-agg-label {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 20px;
}

.kpi-value {
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 500;
  color: var(--fg);
  line-height: 1.1;
}

.kpi-unit {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg-muted);
}

.kpi-spark-wrap {
  position: relative;
  margin-bottom: 12px;
}

.kpi-spark {
  width: 100%;
  height: 32px;
  display: block;
}

.kpi-tooltip {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  background: var(--fg);
  color: var(--bg);
  font-family: var(--font-sans);
  font-size: 11px;
  padding: 3px 8px;
  white-space: nowrap;
  display: flex;
  gap: 6px;
  pointer-events: none;
  margin-bottom: 4px;
  z-index: 10;
  border-radius: 3px;
}

.kpi-tooltip-label { opacity: 0.7; }
.kpi-tooltip-val { font-weight: 600; }

.kpi-minmax {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.5;
  line-height: 1.2;
  margin-bottom: 0;
}

.kpi-delta {
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.3;
  color: var(--fg-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
}

.kpi-delta.good { color: var(--accent); }
.kpi-delta.bad { color: var(--fg-muted); }

.pp-help {
  cursor: help;
  font-size: 11px;
  color: var(--fg-muted);
  opacity: 0.5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid var(--hairline);
  border-radius: 50%;
  font-style: italic;
  font-weight: 400;
}
.pp-help:hover { opacity: 1; border-color: var(--fg-muted); }
</style>

