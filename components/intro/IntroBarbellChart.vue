<script setup lang="ts">
/**
 * components/intro/IntroBarbellChart.vue
 * =======================================
 * D3-Barbell-Chart: 6 Energieträger, 2015 vs 2024.
 * Sortiert nach Veränderung.
 *
 * Daten kommen aus yearlyMix der visualization-data.json.
 * Anteile werden aus MWh-Summen berechnet.
 *
 * Animation: Einfacher Fade-In + Kapsel-Wachsen beim ersten
 * Zeichnen. Kein IntersectionObserver, kein Replay, keine Tweens.
 */

import { ref, onMounted } from 'vue'
import * as d3 from 'd3'
import type { YearlyMixPoint, EnergySourceValues } from '~/types/visualization-data'

const props = defineProps<{
  yearlyData: { year2015: YearlyMixPoint; year2024: YearlyMixPoint }
}>()

const svgRef = ref<SVGSVGElement | null>(null)

// prefers-reduced-motion für Barrierefreiheit
const prefersReduced =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

// Sechs fachlich wichtige Energieträger, die den Wandel zeigen:
// Erneuerbare (Wind, PV) vs. Konventionelle (Kohle, Kernenergie)
interface BarbellItem {
  label: string
  color: string
  share2015: number // Anteil in % (0–100)
  share2024: number
}

const ITEMS: { key: keyof EnergySourceValues; label: string; color: string }[] = [
  { key: 'wind_onshore',  label: 'Wind an Land',      color: '#4A90A4' },
  { key: 'wind_offshore', label: 'Wind auf See',       color: '#1A4A5A' },
  { key: 'pv',            label: 'Photovoltaik',       color: '#E8B547' },
  { key: 'lignite',       label: 'Braunkohle',         color: '#6B4423' },
  { key: 'hardcoal',      label: 'Steinkohle',         color: '#3A3A3A' },
  { key: 'nuclear',       label: 'Kernenergie',        color: '#B85C8E' },
]

const MARGIN = { top: 40, right: 100, bottom: 40, left: 130 }
const ROW_H = 56
const ROW_GAP = 8
const CAPSULE_H = 20
const DOT_R = 7

onMounted(() => {
  draw()
})

function draw() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const d2015 = props.yearlyData.year2015
  const d2024 = props.yearlyData.year2024
  if (!d2015 || !d2024) return

  // Anteile aus MWh-Summen berechnen (erzeugungsgewichtet).
  // totalGenerationMwh > 0 ist durch build-data.ts sichergestellt.
  const tot2015 = d2015.totalGenerationMwh
  const tot2024 = d2024.totalGenerationMwh
  const rows: BarbellItem[] = ITEMS.map((item) => {
    const val2015 = tot2015 > 0 ? (d2015.sources[item.key] / tot2015) * 100 : 0
    const val2024 = tot2024 > 0 ? (d2024.sources[item.key] / tot2024) * 100 : 0
    return { label: item.label, color: item.color, share2015: val2015, share2024: val2024 }
  })
  // Sortieren nach absoluter Veränderung (absteigend)
  rows.sort((a, b) => Math.abs(b.share2024 - b.share2015) - Math.abs(a.share2024 - a.share2015))

  const totalH = rows.length * (ROW_H + ROW_GAP) - ROW_GAP + MARGIN.top + MARGIN.bottom
  const w = svgRef.value!.clientWidth || 800
  svg.attr('viewBox', `0 0 ${w} ${totalH}`)

  const plotL = MARGIN.left
  const plotW = Math.max(200, w - MARGIN.left - MARGIN.right)
  const xScale = d3.scaleLinear().domain([0, 30]).range([0, plotW])

  const chart = svg.append('g').attr('transform', `translate(${plotL},${MARGIN.top})`)

  // Legende oben rechts
  const leg = chart.append('g').attr('transform', `translate(${plotW}, -20)`)
  leg.append('circle').attr('cx', -90).attr('cy', 0).attr('r', 5).attr('fill', 'none').attr('stroke', '#6B7280').attr('stroke-width', 1.5)
  leg.append('text').attr('x', -78).attr('y', 4).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase').text('2015')
  leg.append('circle').attr('cx', -35).attr('cy', 0).attr('r', 5).attr('fill', '#6B7280')
  leg.append('text').attr('x', -23).attr('y', 4).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase').text('2024')

  const fmt = (v: number) => v.toFixed(1).replace('.', ',') + ' %'

  const doAnim = !prefersReduced

  rows.forEach((row, i) => {
    const y = i * (ROW_H + ROW_GAP)
    const x15 = xScale(row.share2015)
    const x24 = xScale(row.share2024)
    const xMin = Math.min(x15, x24)
    const capsuleW = Math.max(2, Math.abs(x24 - x15))
    const delta = row.share2024 - row.share2015
    const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1).replace('.', ',') + ' pp'

    const g = chart.append('g').attr('transform', `translate(0, ${y})`)

    // Label
    g.append('text').attr('x', -MARGIN.left + 12).attr('y', ROW_H / 2 + 4)
      .attr('font-size', '13px').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(row.label)

    // Kapsel (bei Animation von x15 aus wachsend, sonst direkt im Endzustand)
    const capsule = g.append('rect')
      .attr('y', (ROW_H - CAPSULE_H) / 2).attr('height', CAPSULE_H).attr('rx', 10).attr('ry', 10)
      .attr('fill', row.color).attr('opacity', 0.85)
    if (doAnim) {
      capsule.attr('x', x15).attr('width', 0)
        .transition().delay(i * 80).duration(600).ease(d3.easeCubicOut)
        .attr('x', xMin).attr('width', capsuleW)
    } else {
      capsule.attr('x', xMin).attr('width', capsuleW)
    }

    // 2015 Kreis (offen)
    g.append('circle').attr('cx', x15).attr('cy', ROW_H / 2).attr('r', DOT_R)
      .attr('fill', 'none').attr('stroke', row.color).attr('stroke-width', 2)
    g.append('circle').attr('cx', x15).attr('cy', ROW_H / 2).attr('r', 3).attr('fill', '#fff')

    // 2024 Kreis (gefüllt)
    g.append('circle').attr('cx', x24).attr('cy', ROW_H / 2).attr('r', DOT_R)
      .attr('fill', row.color)

    // Prozent-Label 2015
    g.append('text').attr('x', x15).attr('y', ROW_H / 2 - DOT_R - 5)
      .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '500')
      .attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(fmt(row.share2015))

    // Prozent-Label 2024
    g.append('text').attr('x', x24).attr('y', ROW_H / 2 - DOT_R - 5)
      .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '500')
      .attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
      .text(fmt(row.share2024))

    // Delta rechts
    g.append('text').attr('x', plotW + 8).attr('y', ROW_H / 2 + 4)
      .attr('font-size', '12px').attr('font-weight', '500')
      .attr('fill', delta >= 0 ? row.color : 'var(--fg-muted)')
      .attr('font-family', 'var(--font-sans)').text(deltaStr)
  })

  // X-Achse
  const axisY = rows.length * (ROW_H + ROW_GAP) - ROW_GAP + 8
  chart.append('g').attr('transform', `translate(0, ${axisY})`)
    .call(d3.axisBottom(xScale).tickValues([0, 10, 20, 30]).tickSize(0)
      .tickFormat((d: any) => `${d}%`) as any)
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .call((g: any) => g.select('.domain').attr('stroke', 'var(--hairline)'))
}
</script>

<template>
  <div ref="wrapperRef" class="barbell-wrapper">
    <svg ref="svgRef" class="barbell-svg"></svg>
  </div>
</template>

<style scoped>
.barbell-wrapper {
  width: 100%;
  margin-bottom: 96px;
}
.barbell-svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>
