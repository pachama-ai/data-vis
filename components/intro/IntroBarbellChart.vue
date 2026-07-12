<script setup lang="ts">
/**
 * components/intro/IntroBarbellChart.vue
 * =======================================
 * D3-Barbell-Chart: 9 horizontale Zeilen, 2015 vs 2024.
 * Sortiert nach Veränderung (stärkste zuerst).
 *
 * Animation:
 *  - Startet beim ersten Sichtbarwerden (IntersectionObserver)
 *  - Replay-Button (⟲) wiederholt die Animation
 *  - Bei prefers-reduced-motion: keine Animation, Button versteckt
 *
 * Bugfixes:
 *  - Kapsel wächst immer vom 2015-Punkt aus (auch bei schrumpfenden Trägern)
 *  - Labels kollidieren nicht: bei < 40 px Abstand kombiniertes Label
 *  - Animationsdauer auf 1,6 s verlangsamt, Staffelung 120 ms
 */

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as d3 from 'd3'
import type { EnergyMixRow } from '~/composables/useEnergyMixData'

const props = defineProps<{
  rows: EnergyMixRow[]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const animationKey = ref(0)

const MARGIN = { top: 40, right: 120, bottom: 36, left: 180 }
const ROW_H = 56
const ROW_GAP = 8
const CAPSULE_H = 24
const DOT_R = 8

const MIN_LABEL_DIST = 40 // px – darunter wird kombiniert
const ANIM_DELAY_ROW = 120   // ms Staffelung pro Zeile
const ANIM_FADE = 350        // ms Fade-In
const ANIM_GROW = 1600       // ms Kapsel wachsen + Zählen

const prefersReduced = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

let observer: IntersectionObserver | null = null

// Einmal zeichnen + Observer
onMounted(() => {
  if (!wrapperRef.value || !props.rows.length) return
  draw(false) // Initial-Zustand ohne Animation

  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && animationKey.value === 0) {
      animationKey.value = 1
    }
  }, { threshold: 0.3 })
  observer.observe(wrapperRef.value)

  // Sofort-Check: bereits sichtbar?
  const rect = wrapperRef.value.getBoundingClientRect()
  if (rect.top < window.innerHeight && rect.bottom > 0 && animationKey.value === 0) {
    animationKey.value = 1
  }
})

// Auf animationKey-Änderung reagieren (Observer + Replay)
watch(animationKey, (key) => {
  if (key > 0) draw(true)
})

onUnmounted(() => {
  observer?.disconnect()
})

function replay() {
  animationKey.value++
}

defineExpose({ replay })

// ----------------------------------------------------------------
// Zeichnen
// ----------------------------------------------------------------
function draw(animate: boolean) {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const data = props.rows
  if (!data.length) return

  const doAnim = animate && !prefersReduced
  const totalH = data.length * (ROW_H + ROW_GAP) - ROW_GAP + MARGIN.top + MARGIN.bottom
  const w = svgRef.value!.clientWidth || 800
  svg.attr('viewBox', `0 0 ${w} ${totalH}`)

  const labelW = 180
  const deltaW = 100
  const plotL = MARGIN.left + labelW
  const plotR = w - MARGIN.right - deltaW
  const plotW = Math.max(200, plotR - plotL)
  const xScale = d3.scaleLinear().domain([0, 30]).range([0, plotW])

  const chart = svg.append('g').attr('transform', `translate(${plotL},${MARGIN.top})`)

  // --- Legende (oben rechts) ---
  const L = chart.append('g').attr('transform', `translate(${plotW}, -20)`)
  L.append('circle').attr('cx', -100).attr('cy', 0).attr('r', 5).attr('fill', 'none').attr('stroke', '#6B7280').attr('stroke-width', 1.5)
  L.append('text').attr('x', -88).attr('y', 4).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase').style('letter-spacing', '0.04em').text('2015')
  L.append('circle').attr('cx', -50).attr('cy', 0).attr('r', 5).attr('fill', '#6B7280')
  L.append('text').attr('x', -38).attr('y', 4).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase').style('letter-spacing', '0.04em').text('2024')

  // Replay-Button (nur wenn Animation möglich)
  if (!prefersReduced) {
    const replayG = L.append('g').attr('cursor', 'pointer').on('click', () => replay())
    replayG.append('text').attr('x', 10).attr('y', 4).attr('font-size', '14px').attr('fill', 'var(--fg-muted)').style('cursor', 'pointer').text('⟲').on('mouseenter', function () { d3.select(this).attr('fill', 'var(--fg)') }).on('mouseleave', function () { d3.select(this).attr('fill', 'var(--fg-muted)') })
    replayG.append('text').attr('x', 28).attr('y', 4).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').style('text-transform', 'uppercase').style('letter-spacing', '0.04em').style('cursor', 'pointer').text('Animation')
  }

  // --- Zeilen ---
  const fmtPct = (v: number) => v.toFixed(1).replace('.', ',') + ' %'

  data.forEach((row, i) => {
    const y = i * (ROW_H + ROW_GAP)
    const x15 = xScale(row.share2015)
    const x24 = xScale(row.share2024)
    const xMin = Math.min(x15, x24)
    const capsuleW = Math.abs(x24 - x15) || 2
    const delta = row.share2024 - row.share2015
    const deltaSign = delta >= 0 ? '+' : ''
    const deltaStr = `${deltaSign}${delta.toFixed(1).replace('.', ',')} pp`
    const labelDist = Math.abs(x24 - x15)

    const g = chart.append('g')
      .attr('transform', `translate(0, ${y})`)
      .attr('class', 'barbell-row')
      .style('cursor', 'pointer')

    // Label (links)
    g.append('text').attr('x', -labelW + 12).attr('y', ROW_H / 2 - 4).attr('font-size', '14px').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)').text(row.label)
    g.append('text').attr('x', -labelW + 12).attr('y', ROW_H / 2 + 14).attr('font-size', '11px').attr('fill', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)').text(row.category)

    // Kapsel: startet bei x15 (2015) mit Breite 0, wächst zu xMin/capsuleW
    const capsule = g.append('rect')
      .attr('x', x15).attr('y', (ROW_H - CAPSULE_H) / 2)
      .attr('width', 0).attr('height', CAPSULE_H)
      .attr('rx', 12).attr('ry', 12)
      .attr('fill', row.color).attr('opacity', 0.85)
      .style('transition', 'opacity 0.2s')

    // 2015 Kreis (offen) – immer bei x15
    g.append('circle').attr('cx', x15).attr('cy', ROW_H / 2).attr('r', DOT_R).attr('fill', 'none').attr('stroke', row.color).attr('stroke-width', 2).attr('opacity', doAnim ? 0 : 1)
    g.append('circle').attr('cx', x15).attr('cy', ROW_H / 2).attr('r', 3).attr('fill', '#fff')

    // 2024 Kreis (gefüllt) – immer bei x24
    g.append('circle').attr('cx', x24).attr('cy', ROW_H / 2).attr('r', DOT_R).attr('fill', row.color).attr('opacity', doAnim ? 0 : 1)

    // Prozent-Labels
    const lbl15 = g.append('text').attr('x', x15).attr('y', ROW_H / 2 - DOT_R - 6).attr('text-anchor', 'middle').attr('font-size', '12px').attr('font-weight', '500').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')
    const lbl24 = g.append('text').attr('x', x24).attr('y', ROW_H / 2 - DOT_R - 6).attr('text-anchor', 'middle').attr('font-size', '12px').attr('font-weight', '500').attr('fill', 'var(--fg)').attr('font-family', 'var(--font-sans)')

    // Delta (rechts)
    const deltaColor = delta >= 0 ? row.color : 'var(--fg-muted)'
    g.append('text').attr('x', plotW + 12).attr('y', ROW_H / 2 + 5).attr('font-size', '14px').attr('font-weight', '500').attr('fill', deltaColor).attr('font-family', 'var(--font-sans)').text(deltaStr)

    // --- Animation ---
    const delay = i * ANIM_DELAY_ROW

    if (doAnim) {
      // Fade-In der Gruppe
      g.attr('opacity', 0).transition().delay(delay).duration(ANIM_FADE).ease(d3.easeCubicOut).attr('opacity', 1)

      // Kapsel: x von x15 → xMin, width von 0 → capsuleW
      capsule
        .transition().delay(delay + ANIM_FADE).duration(ANIM_GROW).ease(d3.easeCubicOut)
        .attr('x', xMin).attr('width', capsuleW)

      // Kreise einblenden
      g.selectAll('circle').transition().delay(delay + ANIM_FADE).duration(300).attr('opacity', 1)

      // Labels: Collision-Check – EINHEITLICHE Transition pro Label
      const labelDur = ANIM_GROW
      const labelDelay = delay + ANIM_FADE

      if (labelDist < MIN_LABEL_DIST) {
        // Kombiniertes Label (nur lbl24 verwenden)
        lbl15.attr('opacity', 0)
        lbl24.attr('y', ROW_H / 2 - DOT_R - 10).attr('opacity', 0)
        const t24 = lbl24.transition().delay(labelDelay).duration(labelDur)
          .attr('opacity', 1)
          .tween('text', function () {
            const i15 = d3.interpolateNumber(0, row.share2015)
            const i24 = d3.interpolateNumber(0, row.share2024)
            return (t: number) => { lbl24.text(`${fmtPct(i15(t))} → ${fmtPct(i24(t))}`) }
          })
        t24.on('end', () => { lbl24.text(`${fmtPct(row.share2015)} → ${fmtPct(row.share2024)}`) })
      } else {
        // Getrennte Labels
        lbl15.attr('opacity', 0).attr('y', ROW_H / 2 - DOT_R - 6)
        lbl24.attr('opacity', 0).attr('y', ROW_H / 2 - DOT_R - 6)

        const t15 = lbl15.transition().delay(labelDelay).duration(labelDur)
          .attr('opacity', 1)
          .tween('text', function () {
            const int = d3.interpolateNumber(0, row.share2015)
            return (t: number) => { lbl15.text(fmtPct(int(t))) }
          })
        t15.on('end', () => { lbl15.text(fmtPct(row.share2015)) })

        const t24 = lbl24.transition().delay(labelDelay).duration(labelDur)
          .attr('opacity', 1)
          .tween('text', function () {
            const int = d3.interpolateNumber(0, row.share2024)
            return (t: number) => { lbl24.text(fmtPct(int(t))) }
          })
        t24.on('end', () => { lbl24.text(fmtPct(row.share2024)) })
      }
    } else {
      // Keine Animation: Endzustand
      capsule.attr('x', xMin).attr('width', capsuleW)
      if (labelDist < MIN_LABEL_DIST) {
        lbl15.text('')
        lbl24.text(`${fmtPct(row.share2015)} → ${fmtPct(row.share2024)}`)
      } else {
        lbl15.text(fmtPct(row.share2015))
        lbl24.text(fmtPct(row.share2024))
      }
      g.selectAll('circle').attr('opacity', 1)
    }
  })

  // --- X-Achse ---
  const axisY = data.length * (ROW_H + ROW_GAP) - ROW_GAP + 8
  chart.append('g').attr('transform', `translate(0, ${axisY})`)
    .call(d3.axisBottom(xScale).tickValues([0, 10, 20, 30]).tickSize(0).tickFormat((d: any) => `${d}%`) as any)
    .attr('font-size', '11px').attr('color', 'var(--fg-muted)').attr('font-family', 'var(--font-sans)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .call((g: any) => g.select('.domain').attr('stroke', 'var(--hairline)'))

  // Hover
  chart.selectAll('.barbell-row').on('mouseenter', function () {
    chart.selectAll('.barbell-row rect').style('opacity', '0.4')
    d3.select(this).select('rect').style('opacity', '1')
  }).on('mouseleave', function () {
    chart.selectAll('.barbell-row rect').style('opacity', '0.85')
  })
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
