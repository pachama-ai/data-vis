<script setup lang="ts">
/**
 * components/landing/MilestoneCard.vue
 * =====================================
 * Detailkarte für einen Meilenstein mit Datenvisualisierung.
 * Zeigt bei stündlichen Ereignissen einen ±24h Strommix,
 * bei Jahresvergleichen ein Balkendiagramm,
 * bei Preisereignissen den stündlichen Preisverlauf.
 */

import { ref, computed, watch, onMounted, nextTick } from 'vue'
import * as d3 from 'd3'
import type { Milestone, DetailData } from '~/composables/useLandingData'
import type { SmardRow } from '~/composables/useData'

const props = defineProps<{
  milestone: Milestone | null
  detailData: DetailData | null
}>()

const chartRef = ref<HTMLDivElement | null>(null)

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

// Farben für Stacked-Mix
const MIX_COLORS: Record<string, string> = {
  solar: '#F4D03F',
  windOnshore: '#52B788',
  windOffshore: '#2D6A4F',
  biomasse: '#8B5CF6',
  wasserkraft: '#3B82F6',
  sonstigeErneuerbare: '#9CA3AF',
  braunkohle: '#451a03',
  steinkohle: '#374151',
  erdgas: '#F97316',
  kernenergie: '#A855F7',
}

const MIX_ORDER = ['solar', 'windOnshore', 'windOffshore', 'biomasse', 'wasserkraft', 'sonstigeErneuerbare',
  'erdgas', 'braunkohle', 'steinkohle', 'kernenergie']

// Detail-Chart rendern
watch(() => props.detailData, async (dd) => {
  await nextTick()
  if (!chartRef.value || !dd) return

  const el = chartRef.value
  el.innerHTML = ''
  const rect = el.getBoundingClientRect()
  const w = Math.min(rect.width || 320, 400)
  const h = 120
  const m = { top: 8, right: 8, bottom: 20, left: 40 }

  const svg = d3.select(el).append('svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .style('display', 'block')

  const chart = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)
  const iw = w - m.left - m.right
  const ih = h - m.top - m.bottom

  if (dd.type === 'hourlyMix' && dd.hours && dd.hours.length > 0) {
    // Gestapelter Strommix ±24h
    const hours = dd.hours
    const xScale = d3.scaleLinear()
      .domain(d3.extent(hours, d => d.timestamp) as [number, number])
      .range([0, iw])

    const stackData = hours.map(h => {
      const obj: Record<string, number> = {}
      for (const key of MIX_ORDER) {
        obj[key] = (h as any)[key] ?? 0
      }
      obj._total = MIX_ORDER.reduce((s, k) => s + obj[k], 0)
      return obj
    })

    const yMax = d3.max(stackData, d => d._total) || 1
    const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0])

    // Nur die wichtigsten Quellen zeichnen
    const topKeys = ['solar', 'windOnshore', 'windOffshore', 'braunkohle', 'steinkohle', 'erdgas', 'kernenergie']
    const areaGen = d3.area<number>()
      .x((_, i) => xScale(hours[i].timestamp))
      .y1(d => yScale(d))
      .y0(ih)
      .curve(d3.curveMonotoneX)

    for (const key of topKeys) {
      const values = stackData.map(d => d[key])
      if (d3.max(values) === 0) continue
      chart.append('path')
        .datum(values)
        .attr('d', areaGen as any)
        .attr('fill', MIX_COLORS[key] || '#9CA3AF')
        .attr('opacity', 0.8)
    }
  } else if (dd.type === 'yearlyComparison' && dd.years && dd.years.length > 0) {
    // Balkendiagramm
    const years = dd.years
    const xScale = d3.scaleBand<number>()
      .domain(years.map(y => y.year))
      .range([0, iw])
      .padding(0.3)

    const yMax = d3.max(years, d => d.value) || 1
    const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0])

    chart.selectAll('rect')
      .data(years)
      .join('rect')
      .attr('x', d => xScale(d.year)!)
      .attr('y', d => yScale(d.value))
      .attr('width', xScale.bandwidth())
      .attr('height', d => ih - yScale(d.value))
      .attr('fill', '#2D6A4F')
      .attr('opacity', 0.7)
      .attr('rx', 2)

    chart.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).tickSize(0) as any)
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick text').attr('fill', '#9CA3AF').attr('font-size', '8px'))
  } else if (dd.type === 'dailyPrice' && dd.prices && dd.prices.length > 0) {
    // Preisverlauf
    const prices = dd.prices
    const xScale = d3.scaleLinear().domain([0, 23]).range([0, iw])
    const yMin = d3.min(prices, d => d.price) || 0
    const yMax = d3.max(prices, d => d.price) || 1
    const yScale = d3.scaleLinear()
      .domain([Math.min(yMin, 0), yMax * 1.1])
      .range([ih, 0])

    const lineGen = d3.line<{ hour: number; price: number }>()
      .x(d => xScale(d.hour)).y(d => yScale(d.price))
      .curve(d3.curveStepAfter)

    chart.append('path')
      .datum(prices)
      .attr('d', lineGen as any)
      .attr('fill', 'none').attr('stroke', '#D97706').attr('stroke-width', 1.5)

    // Nulllinie
    if (yMin < 0) {
      chart.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#D1D5DB').attr('stroke-dasharray', '3,2')
    }

    chart.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(0).tickFormat(d => `${d}:00`) as any)
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick text').attr('fill', '#9CA3AF').attr('font-size', '7px'))
  }
}, { immediate: false })
</script>

<template>
  <div v-if="milestone" class="milestone-card" role="region" :aria-label="`Detail: ${milestone.title}`">
    <div class="mc-header">
      <span class="mc-badge" :class="`mc-badge--${milestone.category}`">
        {{ milestone.category === 'renewables' ? 'Erneuerbare' : milestone.category === 'structural' ? 'Strukturwandel' : 'Preise' }}
      </span>
    </div>

    <h4 class="mc-title">{{ milestone.title }}</h4>
    <p class="mc-description">{{ milestone.description }}</p>

    <div class="mc-meta">
      <span class="mc-meta-item">
        <strong>Datum:</strong>
        {{ milestone.resolution === 'P1Y' ? milestone.year : formatDate(milestone.timestamp) }}
        {{ milestone.resolution === 'PT60M' ? `, ${formatTime(milestone.timestamp)} Uhr` : '' }}
      </span>
      <span v-if="milestone.value !== undefined" class="mc-meta-item">
        <strong>Wert:</strong> {{ milestone.value?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} {{ milestone.unit }}
      </span>
      <span class="mc-meta-item">
        <strong>Quelle:</strong> {{ milestone.source }}
      </span>
      <span class="mc-meta-item">
        <strong>Auflösung:</strong> {{ milestone.resolution === 'PT60M' ? 'Stundenwert' : 'Jahreswert' }}
      </span>
    </div>

    <p class="mc-definition">
      <strong>Definition:</strong> {{ milestone.definition }}
    </p>

    <!-- Detail-Diagramm -->
    <div v-if="detailData" ref="chartRef" class="mc-chart"></div>
  </div>
</template>

<style scoped>
.milestone-card {
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 20px;
  font-family: var(--font-sans);
}

.mc-header {
  margin-bottom: 8px;
}

.mc-badge {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 4px;
}

.mc-badge--renewables { background: #D1FAE5; color: #065F46; }
.mc-badge--structural { background: #DBEAFE; color: #1E40AF; }
.mc-badge--prices    { background: #FEF3C7; color: #92400E; }

.mc-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 6px;
  color: var(--fg);
  line-height: 1.3;
}

.mc-description {
  font-size: 0.82rem;
  color: var(--fg-muted);
  margin: 0 0 12px;
  line-height: 1.5;
}

.mc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 0.72rem;
  color: var(--fg-muted);
  margin-bottom: 8px;
}

.mc-meta-item strong {
  font-weight: 600;
  color: var(--fg);
}

.mc-definition {
  font-size: 0.68rem;
  color: var(--fg-muted);
  font-style: italic;
  margin: 0 0 12px;
  line-height: 1.4;
}

.mc-chart {
  width: 100%;
  min-height: 120px;
  margin-top: 8px;
}
</style>
