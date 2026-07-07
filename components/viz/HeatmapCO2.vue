<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{
  data: HourlyRow[]
}>()

const emit = defineEmits<{
  'day-selected': [isoDate: string]
}>()

// Metric-Switcher
type MetricKey = 'co2' | 'ee' | 'fossil' | 'price'

interface MetricConfig {
  key: MetricKey
  label: string
  unit: string
  value: (row: HourlyRow) => number
  scaleDomain: [number, number] | 'auto'
  interpolator: (t: number) => string
  legendLabel: string
}

const METRICS: MetricConfig[] = [
  { key: 'co2', label: 'CO₂-Intensität', unit: 'g/kWh', value: (r) => r.co2_g_per_kwh, scaleDomain: [800, 100], interpolator: d3.interpolateRdYlGn, legendLabel: 'Dunkelgrün = niedrige / rot = hohe CO₂-Intensität' },
  { key: 'ee', label: 'EE-Anteil', unit: '%', value: (r) => r.ee_share, scaleDomain: [0, 100], interpolator: d3.interpolateGreens, legendLabel: 'Hellgrün = niedriger / dunkelgrün = hoher EE-Anteil' },
  { key: 'fossil', label: 'Fossiler Anteil', unit: '%', value: (r) => r.fossil_share, scaleDomain: [0, 100], interpolator: d3.interpolateReds, legendLabel: 'Hellrot = niedriger / dunkelrot = hoher fossiler Anteil' },
  { key: 'price', label: 'Day-Ahead-Preis', unit: 'EUR/MWh', value: (r) => r.price_eur_mwh, scaleDomain: 'auto', interpolator: d3.interpolateViridis, legendLabel: 'Dunkel = niedrig / hell = hoher Preis' },
]

const activeMetric = ref<MetricKey>('co2')
const currentMetric = computed(() => METRICS.find((m) => m.key === activeMetric.value)!)
const showCO2 = ref(false)

const heatmapTitle = computed(() => {
  const titles: Record<MetricKey, string> = {
    co2: 'Stündliche CO₂-Heatmap',
    ee: 'Stündliche EE-Anteil-Heatmap',
    fossil: 'Stündliche Fossil-Anteil-Heatmap',
    price: 'Stündliche Preis-Heatmap',
  }
  return titles[activeMetric.value]
})

// Lokaler Saison-Fokus (nur fuer Heatmap, nicht global)
type SeasonFocus = 'all' | 'winter' | 'spring' | 'summer' | 'autumn'
const seasonFocus = ref<SeasonFocus>('all')

const SEASON_BUTTONS: { key: SeasonFocus; label: string }[] = [
  { key: 'all', label: 'Ganzes Jahr' },
  { key: 'winter', label: 'Winter' },
  { key: 'spring', label: 'Frühling' },
  { key: 'summer', label: 'Sommer' },
  { key: 'autumn', label: 'Herbst' },
]

// Saison-Monatsbereich (0-based)
function getSeasonMonths(s: SeasonFocus): [number, number] | null {
  if (s === 'all') return null
  const map: Record<SeasonFocus, [number, number]> = {
    all: [0, 11],
    winter: [11, 2],   // Dez, Jan, Feb (uebers Jahr)
    spring: [2, 4],
    summer: [5, 7],
    autumn: [8, 10],
  }
  return map[s]
}

// Container-Ref + ResizeObserver fuer responsive Breite
const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(800)

let resizeObs: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
    })
    resizeObs.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObs?.disconnect()
})

// SVG-Ref + Tooltip
const svgRef = ref<SVGSVGElement | null>(null)
let tooltipEl: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null

onUnmounted(() => { tooltipEl?.remove() })

// Chart-Dimensionen
const MARGIN = { top: 28, right: 70, bottom: 32, left: 48 }
const CHART_H = 260

watchEffect(() => {
  const rows = props.data
  if (!rows.length || !svgRef.value || containerWidth.value < 100) return

  // Jahr bestimmen (spaetestes im Filter)
  const jahre = [...new Set(rows.map((r) => new Date(r.timestamp).getUTCFullYear()))].sort()
  const jahr = jahre[jahre.length - 1]
  const yearData = rows.filter((r) => new Date(r.timestamp).getUTCFullYear() === jahr)

  const istSchalt = (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0

  // Monats-Start-Tage berechnen
  const monthStarts: { day: number; label: string }[] = []
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(jahr, m, 1))
    const doy = Math.floor((d.getTime() - Date.UTC(jahr, 0, 0)) / 86400000)
    monthStarts.push({ day: doy, label: d.toLocaleDateString('de-DE', { month: 'short' }) })
  }

  // Season-Fokus anwenden
  const months = getSeasonMonths(seasonFocus.value)
  let visibleDays: number[]
  let dayOffset = 0
  if (months) {
    const [startM, endM] = months
    if (startM <= endM) {
      // Normaler Fall (z.B. 2-4 = Mrz-Mai)
      visibleDays = []
      for (let m = startM; m <= endM; m++) {
        const startDay = monthStarts[m].day
        const endDay = m < 11 ? monthStarts[m + 1].day : (istSchalt ? 367 : 366)
        for (let d = startDay; d < endDay; d++) visibleDays.push(d)
      }
      dayOffset = monthStarts[startM].day
    } else {
      // Winter: startM=11 (Dez) -> endM=2 (Feb) = Dez + Jan + Feb
      visibleDays = []
      for (let m = startM; m <= 11; m++) {
        const startDay = monthStarts[m].day
        const endDay = m < 11 ? monthStarts[m + 1].day : (istSchalt ? 367 : 366)
        for (let d = startDay; d < endDay; d++) visibleDays.push(d)
      }
      for (let m = 0; m <= endM; m++) {
        const startDay = monthStarts[m].day
        const endDay = m < 11 ? monthStarts[m + 1].day : (istSchalt ? 367 : 366)
        for (let d = startDay; d < endDay; d++) visibleDays.push(d)
      }
      dayOffset = 0
    }
  } else {
    visibleDays = Array.from({ length: istSchalt ? 366 : 365 }, (_, i) => i + 1)
    dayOffset = 0
  }

  // Lookup: dayOfYear + hour -> Wert
  const lookup = new Map<string, number>()
  for (const r of yearData) {
    const d = new Date(r.timestamp)
    const doy = Math.floor((r.timestamp - Date.UTC(jahr, 0, 0)) / 86400000)
    const h = d.getUTCHours()
    const value = currentMetric.value.value(r)
    lookup.set(`${doy}-${h}`, value)
  }

  // Farbskala
  const metric = currentMetric.value
  let colorScale: d3.ScaleSequential<string, never>
  if (metric.scaleDomain === 'auto') {
    const vals = yearData.map(metric.value).filter((v) => v != null && !isNaN(v))
    // Preis: Perzentil-Clipping (1./99.), damit Ausreisser die Skala nicht dominieren
    if (metric.key === 'price') {
      const sorted = [...vals].sort((a, b) => a - b)
      const min = d3.quantile(sorted, 0.01) ?? 0
      const max = d3.quantile(sorted, 0.99) ?? 1
      colorScale = d3.scaleSequential(metric.interpolator).domain([min, max])
    } else {
      const min = d3.min(vals) ?? 0
      const max = d3.max(vals) ?? 1
      colorScale = d3.scaleSequential(metric.interpolator).domain([min, max])
    }
  } else {
    colorScale = d3.scaleSequential(metric.interpolator).domain(metric.scaleDomain)
  }

  // Dynamische Zellgroessen
  const w = containerWidth.value
  const plotWidth = w - MARGIN.left - MARGIN.right
  const cellWidth = Math.max(3, plotWidth / visibleDays.length)
  const cellHeight = CHART_H / 24
  const svgHeight = MARGIN.top + CHART_H + MARGIN.bottom
  const totalWidth = MARGIN.left + plotWidth + MARGIN.right

  // SVG aufbauen
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', totalWidth).attr('height', svgHeight)

  // Monatslabels
  const xLabelGroup = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top - 6})`)
  for (const ms of monthStarts) {
    if (months) {
      const [sM, eM] = months
      if (sM <= eM) { if (ms.day < monthStarts[sM].day || ms.day > monthStarts[eM].day) continue }
      else { if (ms.day > monthStarts[eM].day && ms.day < monthStarts[sM].day) continue }
    }
    const x = (ms.day - dayOffset) * cellWidth
    xLabelGroup.append('text')
      .attr('x', x).attr('y', 0).attr('text-anchor', 'start')
      .attr('font-size', '10px').attr('fill', '#64748b').text(ms.label)
  }

  // Stundenlabels
  const yLabelGroup = svg.append('g').attr('transform', `translate(${MARGIN.left - 6}, ${MARGIN.top})`)
  for (let h = 0; h < 24; h += 4) {
    yLabelGroup.append('text')
      .attr('x', 0).attr('y', h * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', '10px').attr('fill', '#64748b')
      .text(`${String(h).padStart(2, '0')}:00`)
  }

  // Heatmap-Zellen
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  if (!tooltipEl) {
    tooltipEl = d3.select('body').append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#1a1a1a').style('color', '#fff')
      .style('padding', '6px 10px').style('border-radius', '4px')
      .style('font-size', '12px').style('pointer-events', 'none')
      .style('z-index', '1000').style('line-height', '1.4')
  }

  const cellData: { doy: number; hour: number; value: number | undefined }[] = []
  for (const doy of visibleDays) {
    for (let h = 0; h < 24; h++) {
      const v = lookup.get(`${doy}-${h}`)
      cellData.push({ doy, hour: h, value: v })
    }
  }

  const cells = g.selectAll('rect').data(cellData).join('rect')
    .attr('x', (d) => (d.doy - dayOffset) * cellWidth)
    .attr('y', (d) => d.hour * cellHeight)
    .attr('width', Math.max(1, cellWidth - 1))
    .attr('height', Math.max(1, cellHeight - 1))
    .attr('rx', 1)
    .attr('fill', (d) => {
      if (d.value === undefined || isNaN(d.value)) return '#f1f5f9'
      return colorScale(d.value)
    })
    .attr('stroke', 'none')

  // Monats-Trennlinien
  for (const ms of monthStarts) {
    const x = (ms.day - dayOffset) * cellWidth
    if (x > 0 && x < plotWidth) {
      g.append('line')
        .attr('x1', x).attr('y1', 0)
        .attr('x2', x).attr('y2', CHART_H)
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.6)
    }
  }

  // Hover + Click
  cells
    .on('mouseenter', function (event: MouseEvent, d) {
      if (tooltipEl) {
        const datum = new Date(Date.UTC(jahr, 0, d.doy))
        const tagStr = `${String(datum.getUTCDate()).padStart(2, '0')}.${String(datum.getUTCMonth() + 1).padStart(2, '0')}.`
        const wertStr = d.value !== undefined && !isNaN(d.value) ? `${Math.round(d.value * 100) / 100} ${metric.unit}` : 'keine Daten'
        tooltipEl.style('display', 'block').html(`${tagStr} ${String(d.hour).padStart(2, '0')}:00<br/>${wertStr}`)
          .style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
        d3.select(this).attr('stroke', '#333').attr('stroke-width', 1)
      }
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltipEl) tooltipEl.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
    })
    .on('mouseleave', function () {
      if (tooltipEl) tooltipEl.style('display', 'none')
      d3.select(this).attr('stroke', 'none')
    })
    .on('click', function (_event: MouseEvent, d) {
      const datum = new Date(Date.UTC(jahr, 0, d.doy))
      const iso = `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}-${String(datum.getUTCDate()).padStart(2, '0')}`
      emit('day-selected', iso)
    })

  // Farblegende rechts
  const legGroup = svg.append('g').attr('transform', `translate(${MARGIN.left + plotWidth + 12}, ${MARGIN.top})`)
  const gradId = `heatmap-grad-${metric.key}`
  const grad = legGroup.append('defs').append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')

  const legDomain = metric.scaleDomain === 'auto' ? colorScale.domain() : metric.scaleDomain
  const gradSteps = 10
  for (let i = 0; i <= gradSteps; i++) {
    const t = i / gradSteps
    const val = legDomain[0] + t * (legDomain[1] - legDomain[0])
    grad.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorScale(val))
  }

  legGroup.append('rect').attr('width', 12).attr('height', 140).attr('rx', 2).style('fill', `url(#${gradId})`)
  legGroup.append('text').attr('x', 16).attr('y', 0).attr('dominant-baseline', 'hanging').attr('font-size', '9px').attr('fill', '#64748b').text(Math.round(legDomain[1] * 10) / 10)
  legGroup.append('text').attr('x', 16).attr('y', 140).attr('dominant-baseline', 'auto').attr('font-size', '9px').attr('fill', '#64748b').text(Math.round(legDomain[0] * 10) / 10)

  // Jahr-Hinweis
  svg.append('text')
    .attr('x', MARGIN.left).attr('y', svgHeight - 6)
    .attr('font-size', '10px').attr('fill', '#94a3b8')
    .text(`Jahr: ${jahr}  (${yearData.length} Stunden)`)
})
</script>

<template>
  <div class="heatmap-card">
    <div class="heatmap-header">
      <div class="heatmap-title-row">
        <div class="heatmap-title">
          <span class="heatmap-number">3</span>
          <span class="heatmap-heading">{{ heatmapTitle }}</span>
        </div>
        <div class="metric-tabs">
          <button v-for="m in METRICS" :key="m.key" class="metric-tab" :class="{ active: activeMetric === m.key }" @click="activeMetric = m.key">{{ m.label }}</button>
        </div>
      </div>
      <div class="season-focus-row">
        <button v-for="btn in SEASON_BUTTONS" :key="btn.key" class="season-btn" :class="{ active: seasonFocus === btn.key }" @click="seasonFocus = btn.key">{{ btn.label }}</button>
      </div>
    </div>

    <div ref="containerRef" class="heatmap-scroll">
      <svg ref="svgRef"></svg>
    </div>

    <p class="heatmap-legend-text">{{ currentMetric.legendLabel }}<span v-if="activeMetric === 'price'"> &middot; Skala: 1.&ndash;99. Perzentil</span></p>
  </div>
</template>

<style scoped>
.heatmap-card {
  width: 100%;
}

.heatmap-header {
  margin-bottom: 14px;
}

.heatmap-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.heatmap-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.heatmap-number {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-muted);
  opacity: 0.5;
}

.heatmap-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg);
}

.metric-tabs {
  display: flex;
  gap: 2px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}

.metric-tab {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.metric-tab:hover { color: var(--fg); }
.metric-tab.active { background: var(--accent); color: #fff; font-weight: 500; }

.season-focus-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.season-btn {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.season-btn:hover { border-color: var(--accent); color: var(--fg); }
.season-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.heatmap-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.heatmap-scroll svg {
  display: block;
}

.heatmap-legend-text {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 10px;
  margin-bottom: 0;
  line-height: 1.4;
}
</style>
