<script setup lang="ts">
/**
 * components/dashboard/KpiCard.vue
 * =================================
 * Wiederverwendbare KPI-Karte fuer das Dashboard.
 *
 * Zeigt einen Titel, einen grossen Wert mit Einheit, einen Sparkline-
 * Chart (D3, ~60px hoch) und einen Vergleichstext.
 *
 * Props:
 *   title         - Bezeichnung der Kennzahl
 *   value         - Formatierter Wert (z.B. "53,3")
 *   unit          - Einheit (z.B. "%", "g/kWh")
 *   sparklineData - Array von Jahreswerten fuer den Mini-Chart
 *   deltaLabel    - Text unter dem Chart (z.B. "+27,8 PP vs. 2015")
 *   deltaPositive - true = Anstieg ist gut (gruen), false = Abfall ist gut (gruen)
 */

import { ref, watchEffect } from 'vue'
import * as d3 from 'd3'

const props = defineProps<{
  title: string
  value: string
  unit: string
  sparklineData: number[]
  deltaLabel: string
  deltaPositive: boolean
}>()

// ----------------------------------------------------------------
// Sparkline (D3, ~60px hoch)
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

  // Verlaufsfuellung unter der Linie
  const area = d3.area<number>()
    .x((_d, i) => xScale(i))
    .y0(yScale(yMin - yPad))
    .y1((d) => yScale(d))
    .curve(d3.curveMonotoneX)

  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`
  const defs = svg.append('defs')
  defs.append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
    .append('stop').attr('offset', '0%').attr('stop-color', 'var(--accent)').attr('stop-opacity', 0.15)
  defs.select('linearGradient')
    .append('stop').attr('offset', '100%').attr('stop-color', 'var(--accent)').attr('stop-opacity', 0.02)

  // Flaeche
  svg.append('path')
    .datum(data)
    .attr('d', area)
    .attr('fill', `url(#${gradId})`)

  // Linie
  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', 'var(--accent)')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.8)

  // Letzter Punkt hervorheben
  const last = data[data.length - 1]
  svg.append('circle')
    .attr('cx', xScale(data.length - 1))
    .attr('cy', yScale(last))
    .attr('r', 3)
    .attr('fill', 'var(--accent)')
    .attr('opacity', 0.9)
})
</script>

<template>
  <div class="kpi-card">
    <span class="kpi-title">{{ title }}</span>
    <div class="kpi-value-row">
      <span class="kpi-value">{{ value }}</span>
      <span class="kpi-unit">{{ unit }}</span>
    </div>
    <svg ref="sparkRef" class="kpi-spark"></svg>
    <span class="kpi-delta" :class="{ good: deltaPositive, bad: !deltaPositive }">
      {{ deltaLabel }}
    </span>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   KPI-Card
   ---------------------------------------------------------------- */
.kpi-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.kpi-title {
  font-size: 0.7rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--fg);
  line-height: 1.1;
}

.kpi-unit {
  font-size: 0.75rem;
  color: var(--fg-muted);
}

.kpi-spark {
  width: 100%;
  height: 60px;
  display: block;
}

.kpi-delta {
  font-size: 0.7rem;
  line-height: 1.3;
}

.kpi-delta.good {
  color: var(--accent);
}

.kpi-delta.bad {
  color: var(--fg-muted);
}
</style>
