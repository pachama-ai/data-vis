<script setup lang="ts">
/**
 * components/dashboard/StartEndComparison.vue
 * ============================================
 * Mini-Barbell-Vergleich der drei Träger mit der größten Veränderung.
 * Angekoppelt an den Hauptchart: Klick auf eine Zeile hebt den Träger
 * im Chart hervor (emittiert highlightChange).
 *
 * Animationsablauf bei Daten-Änderung:
 * 1. Kapseln schrumpfen auf Start-Position (300 ms)
 * 2. Wachsen zur End-Position (500 ms, cubic-bezier)
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as d3 from 'd3'
import { useStartEndComparison } from '~/composables/useStartEndComparison'
import type { MonthlyDataPoint, BarbellRow } from '~/composables/useStartEndComparison'

const props = defineProps<{
  monthlyData: MonthlyDataPoint[]
}>()

const emit = defineEmits<{
  highlightChange: [key: string | null]
}>()

const { rows, dateRangeLabel, maxShare } = useStartEndComparison(
  computed(() => props.monthlyData)
)

const svgRef = ref<SVGSVGElement | null>(null)
const highlighted = ref<string | null>(null)

const prefersReduced = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

// Marge und Maße
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 }
const ROW_H = 44
const CAPSULE_H = 12
const DOT_R = 5
const INNER_DOT_R = 2
const LABEL_W = 90
const DELTA_W = 60

function draw(animate: boolean) {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const data = rows.value
  if (!data.length) return

  const w = svgRef.value!.clientWidth || 280
  const totalH = data.length * ROW_H
  svg.attr('viewBox', `0 0 ${w} ${totalH}`)

  const plotL = LABEL_W
  const plotR = w - DELTA_W
  const plotW = Math.max(60, plotR - plotL)
  const xScale = d3.scaleLinear().domain([0, maxShare.value]).range([0, plotW])

  const chart = svg.append('g').attr('transform', `translate(${plotL},0)`)

  const doAnim = animate && !prefersReduced

  data.forEach((row: BarbellRow, i: number) => {
    const y = i * ROW_H
    const xStart = xScale(row.shareStart)
    const xEnd = xScale(row.shareEnd)
    const xMin = Math.min(xStart, xEnd)
    const capsuleW = Math.max(2, Math.abs(xEnd - xStart))

    const g = chart.append('g').attr('transform', `translate(0,${y})`)
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        if (!highlighted.value) {
          chart.selectAll('g').filter((_: any, j: number) => j !== i).style('opacity', '0.4')
        }
      })
      .on('mouseleave', function () {
        if (!highlighted.value) {
          chart.selectAll('g').style('opacity', '1')
        }
      })
      .on('click', function () {
        if (highlighted.value === row.key) {
          highlighted.value = null
          emit('highlightChange', null)
          chart.selectAll('g').style('opacity', '1')
        } else {
          highlighted.value = row.key
          emit('highlightChange', row.key)
          chart.selectAll('g').style('opacity', '0.4')
          g.style('opacity', '1')
        }
      })

    // Träger-Name (links)
    g.append('text').attr('x', -LABEL_W + 4).attr('y', ROW_H / 2 + 4)
      .attr('font-size', '12px').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(row.label)

    // Kapsel
    const capsule = g.append('rect')
      .attr('y', (ROW_H - CAPSULE_H) / 2)
      .attr('height', CAPSULE_H).attr('rx', 6).attr('ry', 6)
      .attr('fill', row.color).attr('opacity', 0.85)

    // Start-Kreis (offen) – immer bei xStart
    const startDot = g.append('circle')
      .attr('cy', ROW_H / 2).attr('r', DOT_R).attr('fill', 'none')
      .attr('stroke', row.color).attr('stroke-width', 1.5)
    g.append('circle').attr('cx', xStart).attr('cy', ROW_H / 2).attr('r', INNER_DOT_R).attr('fill', '#fff')

    // End-Kreis (gefüllt)
    const endDot = g.append('circle')
      .attr('cy', ROW_H / 2).attr('r', DOT_R).attr('fill', row.color)

    // Delta-Wert (rechts)
    const deltaStr = (row.delta >= 0 ? '+' : '') + (row.delta * 100).toFixed(1).replace('.', ',') + ' pp'
    const deltaColor = row.delta >= 0 ? row.color : 'var(--fg-muted)'
    const deltaText = g.append('text').attr('x', plotW + 8).attr('y', ROW_H / 2 + 4)
      .attr('font-size', '12px').attr('font-weight', '500').attr('fill', deltaColor)
      .attr('font-family', 'var(--font-sans)').text(deltaStr)

    if (doAnim) {
      // Phase 1: Schrumpfen auf Start-Position (300 ms)
      const shrinkDur = 300
      capsule.attr('x', xStart).attr('width', 0)
        .transition().duration(shrinkDur).ease(d3.easeCubicOut)
        .attr('x', xStart).attr('width', 0)

      startDot.attr('cx', xStart).attr('opacity', 0)
        .transition().duration(shrinkDur).attr('opacity', 1)
      endDot.attr('cx', xStart).attr('opacity', 0)
        .transition().duration(shrinkDur).attr('opacity', 1)
      deltaText.attr('opacity', 0)

      // Phase 2: Wachsen zur End-Position (500 ms)
      const growDur = 500
      capsule.transition().delay(shrinkDur).duration(growDur)
        .ease(d3.easeCubicOut as any)
        .attr('x', xMin).attr('width', capsuleW)

      endDot.transition().delay(shrinkDur).duration(growDur)
        .ease(d3.easeCubicOut as any).attr('cx', xEnd)

      deltaText.transition().delay(shrinkDur).duration(growDur)
        .attr('opacity', 1)
    } else {
      // Endzustand
      capsule.attr('x', xMin).attr('width', capsuleW)
      startDot.attr('cx', xStart).attr('opacity', 1)
      endDot.attr('cx', xEnd).attr('opacity', 1)
    }
  })
}

let prevRowsLength = 0

watch(rows, async () => {
  await nextTick()
  const animate = prevRowsLength > 0
  draw(animate)
  prevRowsLength = rows.value.length
}, { deep: true })

onMounted(() => {
  if (rows.value.length) {
    prevRowsLength = rows.value.length
    nextTick(() => draw(false))
  }
})
</script>

<template>
  <div class="comparison-panel">
    <div class="comp-title">VERGLEICH START ↔ ENDE</div>
    <div v-if="dateRangeLabel" class="comp-range">{{ dateRangeLabel }}</div>
    <div v-if="!monthlyData.length" class="comp-empty">Keine Daten im sichtbaren Bereich</div>
    <svg v-else ref="svgRef" class="comp-svg"></svg>
  </div>
</template>

<style scoped>
.comparison-panel {
  width: 100%;
}

.comp-title {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 4px;
}

.comp-range {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg);
  margin-bottom: 8px;
}

.comp-empty {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-muted);
  font-style: italic;
  padding: 12px 0;
}

.comp-svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>
