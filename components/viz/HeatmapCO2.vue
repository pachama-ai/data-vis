<script setup lang="ts">
/**
 * components/viz/HeatmapCO2.vue
 * ==============================
 * Zeigt eine 365x24-Heatmap fuer ein einzelnes Jahr.
 * Die X-Achse bildet den Tag des Jahres ab (1-365), die Y-Achse die
 * Stunde (0-23). Jede Zelle ist ein <rect> im SVG, eingefaerbt nach
 * der ausgewaehlten Metrik.
 *
 * Metriken: CO2-Intensitaet, EE-Anteil, Fossiler Anteil, Day-Ahead-Preis
 *
 * Das Jahr wird automatisch aus dem Datensatz ermittelt: es wird das
 * spaeteste Jahr im aktuellen Filterzeitraum angezeigt.
 */

import { ref, computed, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
const props = defineProps<{
  data: HourlyRow[]
}>()

const emit = defineEmits<{
  'day-selected': [isoDate: string]
}>()

// ----------------------------------------------------------------
// Metric-Switcher
// ----------------------------------------------------------------
type MetricKey = 'co2' | 'ee' | 'fossil' | 'price'

interface MetricConfig {
  key: MetricKey
  label: string
  unit: string
  /** Gibt den Wert aus einer HourlyRow fuer diese Metrik zurueck */
  value: (row: HourlyRow) => number
  /** Farbskala: d3-Scale, wird im watchEffect erzeugt */
  scaleDomain: [number, number] | 'auto'
  /** D3-Interpolator-Name oder -Funktion */
  interpolator: (t: number) => string
  /** Beschriftung unter der Heatmap */
  legendLabel: string
}

const METRICS: MetricConfig[] = [
  {
    key: 'co2',
    label: 'CO2-Intensitaet',
    unit: 'g/kWh',
    value: (r) => r.co2_g_per_kwh,
    scaleDomain: [800, 100],
    interpolator: d3.interpolateRdYlGn,
    legendLabel: 'Dunkelgruen = niedrige / rot = hohe CO2-Intensitaet',
  },
  {
    key: 'ee',
    label: 'EE-Anteil',
    unit: '%',
    value: (r) => r.ee_share,
    scaleDomain: [0, 100],
    interpolator: d3.interpolateGreens,
    legendLabel: 'Hellgruen = niedriger / dunkelgruen = hoher EE-Anteil',
  },
  {
    key: 'fossil',
    label: 'Fossiler Anteil',
    unit: '%',
    value: (r) => r.fossil_share,
    scaleDomain: [0, 100],
    interpolator: d3.interpolateReds,
    legendLabel: 'Hellrot = niedriger / dunkelrot = hoher fossiler Anteil',
  },
  {
    key: 'price',
    label: 'Day-Ahead-Preis',
    unit: 'EUR/MWh',
    value: (r) => r.price_eur_mwh,
    scaleDomain: 'auto',
    interpolator: d3.interpolateViridis,
    legendLabel: 'Dunkel = niedrig / hell = hoher Day-Ahead-Preis',
  },
]

// Aktive Metrik, Default: CO2
const activeMetric = ref<MetricKey>('co2')
const currentMetric = computed(() => METRICS.find((m) => m.key === activeMetric.value)!)

// ----------------------------------------------------------------
// SVG-Ref und Groesse
// ----------------------------------------------------------------
const svgContainer = ref<HTMLDivElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

const CELL = 13        // Zellen-Schritt inkl. 1px Abstand
const PAD_TOP = 30     // Platz fuer Monatslabels
const PAD_LEFT = 40    // Platz fuer Stundenlabels
const PAD_RIGHT = 70   // Platz fuer Farblegende
const PAD_BOTTOM = 10
const LEGEND_W = 14    // Breite der Farb-Legende
const LEGEND_H = 180   // Hoehe der Farb-Legende

const SVG_W = PAD_LEFT + 365 * CELL + PAD_RIGHT
const SVG_H = PAD_TOP + 24 * CELL + PAD_BOTTOM + LEGEND_H + 20

// ----------------------------------------------------------------
// Tooltip-Div (wird in setup erzeugt, nicht im Template)
// ----------------------------------------------------------------
let tooltipEl: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null

onUnmounted(() => {
  tooltipEl?.remove()
})

// ----------------------------------------------------------------
// D3-Heatmap-Rendering
// ----------------------------------------------------------------
watchEffect(() => {
  const rows = props.data
  if (!rows.length || !svgRef.value) return

  // --- Daten auf ein Jahr reduzieren (spaetestes im Filter) ---
  const jahre = [...new Set(rows.map((r) => new Date(r.timestamp).getUTCFullYear()))].sort()
  const jahr = jahre[jahre.length - 1]
  const yearData = rows.filter((r) => new Date(r.timestamp).getUTCFullYear() === jahr)

  // Pruefen ob es ein Schaltjahr ist
  const istSchalt = (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0
  const tageImJahr = istSchalt ? 366 : 365

  // Month-Start-Tage berechnen
  const monthStarts: { day: number; label: string }[] = []
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(jahr, m, 1))
    const doy = Math.floor((d.getTime() - Date.UTC(jahr, 0, 0)) / 86400000)
    monthStarts.push({ day: doy, label: d.toLocaleDateString('de-DE', { month: 'short' }) })
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

  // --- Farbskala ---
  const metric = currentMetric.value
  let colorScale: d3.ScaleSequential<string, never>

  if (metric.scaleDomain === 'auto') {
    // Preis: domain aus Daten
    const vals = yearData.map(metric.value).filter((v) => v != null && !isNaN(v))
    const min = d3.min(vals) ?? 0
    const max = d3.max(vals) ?? 1
    colorScale = d3.scaleSequential(metric.interpolator).domain([min, max])
  } else {
    colorScale = d3.scaleSequential(metric.interpolator).domain(metric.scaleDomain)
  }

  // --- SVG aufbauen ---
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', SVG_W).attr('height', SVG_H)

  // Hintergrund
  svg.append('rect').attr('width', SVG_W).attr('height', SVG_H).attr('fill', 'none')

  // --- Monatslabels (X-Achse) ---
  const xLabelGroup = svg.append('g').attr('transform', `translate(${PAD_LEFT}, ${PAD_TOP - 6})`)
  for (const ms of monthStarts) {
    xLabelGroup
      .append('text')
      .attr('x', ms.day * CELL)
      .attr('y', 0)
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280')
      .text(ms.label)
  }

  // --- Stundenlabels (Y-Achse) ---
  const yLabelGroup = svg.append('g').attr('transform', `translate(${PAD_LEFT - 6}, ${PAD_TOP})`)
  for (let h = 0; h < 24; h += 3) {
    yLabelGroup
      .append('text')
      .attr('x', 0)
      .attr('y', h * CELL + CELL / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280')
      .text(`${String(h).padStart(2, '0')}:00`)
  }

  // --- Heatmap-Zellen ---
  const g = svg.append('g').attr('transform', `translate(${PAD_LEFT}, ${PAD_TOP})`)

  // Tooltip erzeugen (einmalig)
  if (!tooltipEl) {
    tooltipEl = d3.select('body').append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'fixed')
      .style('display', 'none')
      .style('background', '#1a1a1a')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('line-height', '1.4')
  }

  // Alle 365/366 x 24 Zellen rendern (auch leere)
  const cellData: { doy: number; hour: number; value: number | undefined }[] = []
  for (let doy = 1; doy <= tageImJahr; doy++) {
    for (let h = 0; h < 24; h++) {
      const v = lookup.get(`${doy}-${h}`)
      cellData.push({ doy, hour: h, value: v })
    }
  }

  const cells = g
    .selectAll('rect')
    .data(cellData)
    .join('rect')
    .attr('x', (d) => (d.doy - 1) * CELL)
    .attr('y', (d) => d.hour * CELL)
    .attr('width', CELL - 1)
    .attr('height', CELL - 1)
    .attr('rx', 1)
    .attr('fill', (d) => {
      if (d.value === undefined || isNaN(d.value)) return '#f0f0f0'
      return colorScale(d.value)
    })
    .attr('stroke', 'none')

  // Hover-Tooltip
  cells
    .on('mouseenter', function (event: MouseEvent, d) {
      if (tooltipEl) {
        const datum = new Date(Date.UTC(jahr, 0, d.doy))
        const tagStr = `${String(datum.getUTCDate()).padStart(2, '0')}.${String(datum.getUTCMonth() + 1).padStart(2, '0')}.`
        const wertStr = d.value !== undefined && !isNaN(d.value) ? `${Math.round(d.value * 100) / 100} ${metric.unit}` : 'keine Daten'

        tooltipEl
          .style('display', 'block')
          .html(`${tagStr} ${String(d.hour).padStart(2, '0')}:00<br/>${wertStr}`)
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 10}px`)

        // Hover-Zelle hervorheben
        d3.select(this).attr('stroke', '#333').attr('stroke-width', 1)
      }
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltipEl) {
        tooltipEl
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 10}px`)
      }
    })
    .on('mouseleave', function () {
      if (tooltipEl) tooltipEl.style('display', 'none')
      d3.select(this).attr('stroke', 'none')
    })
    // Klick: emit day-selected
    .on('click', function (_event: MouseEvent, d) {
      const datum = new Date(Date.UTC(jahr, 0, d.doy))
      const iso = `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}-${String(datum.getUTCDate()).padStart(2, '0')}`
      emit('day-selected', iso)
    })

  // --- Farblegende vertikal rechts ---
  const legGroup = svg.append('g').attr('transform', `translate(${PAD_LEFT + 365 * CELL + 16}, ${PAD_TOP})`)

  // Verlauf (Gradient)
  const gradId = `heatmap-grad-${metric.key}`
  const grad = legGroup.append('defs').append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
  grad.append('stop').attr('offset', '0%').attr('stop-color', colorScale(metric.scaleDomain === 'auto' ? colorScale.domain()[0] : metric.scaleDomain[0]))
  grad.append('stop').attr('offset', '50%').attr('stop-color', colorScale((metric.scaleDomain === 'auto' ? (colorScale.domain()[0] + colorScale.domain()[1]) / 2 : (metric.scaleDomain[0] + metric.scaleDomain[1]) / 2)))
  grad.append('stop').attr('offset', '100%').attr('stop-color', colorScale(metric.scaleDomain === 'auto' ? colorScale.domain()[1] : metric.scaleDomain[1]))

  legGroup.append('rect')
    .attr('width', LEGEND_W)
    .attr('height', LEGEND_H)
    .attr('rx', 2)
    .style('fill', `url(#${gradId})`)

  // Skalen-Beschriftung
  const legDomain = metric.scaleDomain === 'auto' ? colorScale.domain() : metric.scaleDomain
  legGroup.append('text')
    .attr('x', LEGEND_W + 6)
    .attr('y', 0)
    .attr('dominant-baseline', 'hanging')
    .attr('font-size', '9px')
    .attr('fill', '#6b7280')
    .text(Math.round(legDomain[1] * 10) / 10)

  legGroup.append('text')
    .attr('x', LEGEND_W + 6)
    .attr('y', LEGEND_H / 2)
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '9px')
    .attr('fill', '#6b7280')
    .text(Math.round((legDomain[0] + legDomain[1]) / 2 * 10) / 10)

  legGroup.append('text')
    .attr('x', LEGEND_W + 6)
    .attr('y', LEGEND_H)
    .attr('dominant-baseline', 'auto')
    .attr('font-size', '9px')
    .attr('fill', '#6b7280')
    .text(Math.round(legDomain[0] * 10) / 10)

  // --- Jahr-Hinweis unter dem Grid ---
  svg.append('text')
    .attr('x', PAD_LEFT)
    .attr('y', PAD_TOP + 24 * CELL + 16)
    .attr('font-size', '11px')
    .attr('fill', '#6b7280')
    .text(`Jahr: ${jahr}  (${yearData.length} Stunden, ${tageImJahr} Tage)`)
})
</script>

<template>
  <div class="heatmap-card">
    <!-- Kopfzeile: Nummer + Titel links, Metric-Tabs rechts -->
    <div class="heatmap-header">
      <div class="heatmap-title">
        <span class="heatmap-number">2</span>
        <span class="heatmap-heading">Stuendliche CO2-Heatmap</span>
      </div>
      <div class="metric-tabs">
        <button
          v-for="m in METRICS"
          :key="m.key"
          class="metric-tab"
          :class="{ active: activeMetric === m.key }"
          @click="activeMetric = m.key"
        >
          {{ m.label }}
        </button>
      </div>
    </div>

    <!-- SVG-Container mit horizontalem Scroll -->
    <div ref="svgContainer" class="heatmap-scroll">
      <svg ref="svgRef"></svg>
    </div>

    <!-- Legendentext unten -->
    <p class="heatmap-legend-text">{{ currentMetric.legendLabel }}</p>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Card: weisser Hintergrund, abgerundet, Border, Schatten
   ---------------------------------------------------------------- */
.heatmap-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ----------------------------------------------------------------
   Kopfzeile
   ---------------------------------------------------------------- */
.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.heatmap-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.heatmap-number {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-muted);
  background: #f3f4f6;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.heatmap-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg);
}

/* ----------------------------------------------------------------
   Metric-Tabs
   ---------------------------------------------------------------- */
.metric-tabs {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
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
  color: var(--fg-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.metric-tab:hover {
  color: var(--fg);
}

.metric-tab.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

/* ----------------------------------------------------------------
   SVG-Container mit Scroll bei Ueberbreite
   ---------------------------------------------------------------- */
.heatmap-scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.heatmap-scroll svg {
  display: block;
}

/* ----------------------------------------------------------------
   Legendentext unten
   ---------------------------------------------------------------- */
.heatmap-legend-text {
  font-size: 0.75rem;
  color: var(--fg-muted);
  margin-top: 10px;
  margin-bottom: 0;
  line-height: 1.4;
}
</style>
