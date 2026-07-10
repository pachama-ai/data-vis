<script setup lang="ts">
/**
 * components/landing/RecordTimeline.vue
 * ======================================
 * D3-SVG-Animation: Wochenmaxima (grau) + laufender EE-Rekord (grün).
 * Mit animiertem Eintritt und Meilenstein-Markern.
 *
 * Props:
 *  - weeklyData: WeeklyRecordPoint[]
 *  - milestones: Milestone[]
 *  - activeMilestone: string | null (ID des aktiven Meilensteins)
 *  - activeCategory: string | null (Filter-Kategorie)
 *
 * Emits:
 *  - hover-milestone(id): beim Hover/Fokus auf Marker
 *  - leave-milestone(): beim Verlassen
 *  - select-milestone(id): beim Klick/Enter auf Marker
 */

import { ref, watchEffect, onMounted, onUnmounted, shallowRef } from 'vue'
import * as d3 from 'd3'
import type { WeeklyRecordPoint, Milestone } from '~/composables/useLandingData'

const props = defineProps<{
  weeklyData: WeeklyRecordPoint[]
  milestones: Milestone[]
  activeMilestone: string | null
  activeCategory: string | null
}>()

const emit = defineEmits<{
  'hover-milestone': [id: string | null]
  'select-milestone': [id: string]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const CONTAINER_PAD = 20

let resizeObs: ResizeObserver | null = null
let animFrame = 0

// Responsive Maße
const W = shallowRef(960)
const H = 380
const M = { top: 24, right: 48, bottom: 40, left: 56 }

const INNER_W = () => Math.max(200, W.value - M.left - M.right - CONTAINER_PAD * 2)
const INNER_H = H - M.top - M.bottom

onMounted(() => {
  resizeObs = new ResizeObserver(([entry]) => {
    W.value = entry.contentRect.width
  })
  if (svgRef.value?.parentElement) {
    resizeObs.observe(svgRef.value.parentElement)
  }
})

onUnmounted(() => {
  resizeObs?.disconnect()
  if (animFrame) cancelAnimationFrame(animFrame)
})

// Sichtbare Meilensteine (nach Kategorie-Filter)
function getVisibleMilestones() {
  if (!props.activeCategory) return props.milestones
  return props.milestones.filter(m => m.category === props.activeCategory)
}

// Render bei Daten- oder Größenänderung
watchEffect(() => {
  if (!svgRef.value) return
  const wd = props.weeklyData
  const ms = props.milestones
  const w = W.value // reaktiv
  if (!wd.length || !ms.length) return
  render()
})

let rendered = false

function render() {
  const svg = d3.select(svgRef.value!)
  const w = INNER_W()
  const h = INNER_H
  if (w < 100) return

  const data = props.weeklyData
  if (!data.length) return

  const xScale = d3.scaleLinear()
    .domain([data[0].weekStart, data[data.length - 1].weekStart])
    .range([0, w])

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([h, 0])

  // Clear
  svg.selectAll('*').remove()

  const chart = svg.append('g')
    .attr('transform', `translate(${M.left + CONTAINER_PAD},${M.top})`)
    .attr('clip-path', 'url(#rc-clip)')

  // Clip path
  svg.append('defs').append('clipPath').attr('id', 'rc-clip')
    .append('rect').attr('width', w).attr('height', h)

  // --- Achsen ---
  const xAxis = d3.axisBottom(xScale)
    .tickValues(d3.range(2015, 2026).map(y => new Date(Date.UTC(y, 0, 1)).getTime()))
    .tickFormat(d => String(new Date(d).getUTCFullYear()))
    .tickSize(0)

  const yAxis = d3.axisLeft(yScale)
    .tickValues([0, 0.2, 0.4, 0.6, 0.8, 1.0])
    .tickFormat(d => `${(d * 100).toFixed(0)}%`)
    .tickSize(0)

  const axisGroup = chart.append('g').attr('class', 'rc-axes')
  axisGroup.append('g')
    .attr('transform', `translate(0,${h})`)
    .call(xAxis as any)
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick text').attr('fill', '#9CA3AF').attr('font-size', '10px').attr('font-family', 'var(--font-sans)'))

  axisGroup.append('g')
    .call(yAxis as any)
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick text').attr('fill', '#9CA3AF').attr('font-size', '10px').attr('font-family', 'var(--font-sans)'))

  // Horizontale Gridlines
  axisGroup.append('g').attr('class', 'rc-grid')
    .call(d3.axisLeft(yScale).tickValues([0, 0.2, 0.4, 0.6, 0.8, 1.0]).tickSize(-w).tickFormat(() => '') as any)
    .call(g => g.selectAll('line').attr('stroke', '#E2E4E8').attr('stroke-width', 1))
    .call(g => g.select('.domain').remove())

  // --- Wochenmaxima (graue Punkte) ---
  chart.append('g').attr('class', 'rc-points')
    .selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => xScale(d.weekStart))
    .attr('cy', d => yScale(d.maxRenewableShare))
    .attr('r', 1.5)
    .attr('fill', '#D1D5DB')
    .attr('opacity', 0)

  // --- Laufender Rekord (grüne Treppenlinie) ---
  const lineGen = d3.line<WeeklyRecordPoint>()
    .x(d => xScale(d.weekStart))
    .y(d => yScale(d.runningRecord))
    .curve(d3.curveStepAfter)

  const pathLength = w
  chart.append('path')
    .datum(data)
    .attr('class', 'rc-record-line')
    .attr('d', lineGen as any)
    .attr('fill', 'none')
    .attr('stroke', '#2D6A4F')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
    .attr('stroke-dashoffset', pathLength)

  // --- Y-Achsen-Label ---
  chart.append('text')
    .attr('x', -40).attr('y', -8)
    .attr('text-anchor', 'start').attr('font-size', '9px')
    .attr('fill', '#9CA3AF').attr('font-family', 'var(--font-sans)')
    .text('EE-Anteil an der Last')

  // --- Meilenstein-Marker ---
  const msGroup = chart.append('g').attr('class', 'rc-markers')

  for (const m of getVisibleMilestones()) {
    const x = xScale(m.timestamp)
    if (x < 0 || x > w) continue
    const isActive = props.activeMilestone === m.id

    // Vertikale Linie
    msGroup.append('line')
      .attr('x1', x).attr('y1', 0).attr('x2', x).attr('y2', h)
      .attr('stroke', '#2D6A4F').attr('stroke-width', isActive ? 2 : 1)
      .attr('stroke-dasharray', '4,3').attr('opacity', isActive ? 0.8 : 0.4)

    // Marker-Kreis
    const circle = msGroup.append('circle')
      .attr('cx', x).attr('cy', h - 10)
      .attr('r', isActive ? 7 : 5)
      .attr('fill', isActive ? '#2D6A4F' : '#9CA3AF')
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', `${m.title}: ${m.description}`)
      .style('cursor', 'pointer')
      .on('mouseenter', () => emit('hover-milestone', m.id))
      .on('mouseleave', () => emit('hover-milestone', null))
      .on('focus', () => emit('hover-milestone', m.id))
      .on('blur', () => emit('hover-milestone', null))
      .on('click', () => emit('select-milestone', m.id))
      .on('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          emit('select-milestone', m.id)
        }
      })

    // Label
    msGroup.append('text')
      .attr('x', x).attr('y', h + 16)
      .attr('text-anchor', 'middle').attr('font-size', '8px')
      .attr('fill', '#6B7280').attr('font-family', 'var(--font-sans)')
      .text(m.year)
  }

  // --- Animation ---
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!prefersReduced) {
    // Wochenpunkte einblenden
    chart.selectAll('.rc-points circle')
      .transition()
      .delay((_, i) => i * 2)
      .duration(10)
      .attr('opacity', 0.6)

    // Rekordlinie zeichnen
    chart.select('.rc-record-line')
      .transition()
      .delay(500)
      .duration(2000)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0)

    // Marker einblenden
    msGroup.selectAll('line, circle, text')
      .style('opacity', 0)
      .transition()
      .delay((_, i) => 2500 + i * 200)
      .duration(300)
      .style('opacity', 1)
  } else {
    // reduced motion: alles sofort sichtbar
    chart.selectAll('.rc-points circle').attr('opacity', 0.6)
    chart.select('.rc-record-line').attr('stroke-dashoffset', 0)
    msGroup.selectAll('line, circle, text').style('opacity', 1)
  }

  rendered = true
}
</script>

<template>
  <div class="record-timeline-wrapper">
    <svg ref="svgRef" class="record-timeline-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet"
      role="img" aria-label="Rekord-Timeline des EE-Anteils 2015–2024">
      <title>Entwicklung des laufenden Rekords des EE-Anteils an der Stromnachfrage</title>
      <desc>Wöchentliche Maxima (grau) und laufender Höchstwert (grün) des Anteils erneuerbarer Energien. Die
        Meilensteine markieren datenbasierte Rekorde und strukturelle Kipppunkte.</desc>
    </svg>
  </div>
</template>

<style scoped>
.record-timeline-wrapper {
  width: 100%;
  max-width: 100%;
}

.record-timeline-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}
</style>
