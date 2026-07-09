<script setup lang="ts">
/**
 * components/viz/StackedArea.vue
 * ===============================
 * Zeigt den Erzeugungsmix ueber die Zeit als gestapelte Flaeche.
 *
 * Datenbasis: hourly_2015_2024.json (via loadHourly).
 * Die Stunden-Daten werden in Wochen-Buckets aggregiert (ISO-Wochen),
 * weil ~520 Datenpunkte fuer 10 Jahre die beste Balance aus
 * Detailgrad und Lesbarkeit bieten.
 *
 * Features:
 *   - Toggle Absolut / Prozent (d3.stackOffsetExpand)
 *   - Anklickbare Legende zum Ein-/Ausblenden von Energie-traegern
 *   - Vertikale Annotations-Linien fuer Kohleausstieg und Atomausstieg
 *   - Optionale CO2-Linie (zweite Y-Achse), per Toggle unten
 *   - Tooltip mit Werten fuer den Zeitpunkt unter der Maus
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

// ----------------------------------------------------------------
// Farben fuer die Energietraeger (konstant, fuer Legende + Chart)
// ----------------------------------------------------------------
const COLORS: Record<string, string> = {
  wind:       '#2D6A4F',   // tealgrün
  pv:         '#facc15',   // gelb
  lignite:    '#451a03',   // sehr dunkelbraun (abgrenzbar zu Gas)
  hardcoal:   '#374151',   // dunkel-slate (IEA/Ember-Konvention)
  gas:        '#f97316',   // orange
  nuclear:    '#8b5cf6',   // violett
  biomass:    '#16a34a',   // dunkelgruen
  hydro:      '#38bdf8',   // hellblau
  other:      '#d1d5db',   // hellgrau (Sonstige)
}

// Reihenfolge der Legende und des Stapels
const ALL_KEYS: (keyof typeof COLORS)[] = [
  'wind', 'pv', 'lignite', 'hardcoal', 'gas',
  'nuclear', 'biomass', 'hydro', 'other',
]

// ----------------------------------------------------------------
// Sichtbarkeit der Energietraeger (Legende togglen)
// ----------------------------------------------------------------
const visibleKeys = ref<Set<string>>(new Set(ALL_KEYS))

function toggleKey(key: string) {
  if (visibleKeys.value.has(key)) {
    visibleKeys.value.delete(key)
    // Mindestens ein Traeger muss sichtbar bleiben
    if (visibleKeys.value.size === 0) visibleKeys.value.add(key)
  } else {
    visibleKeys.value.add(key)
  }
  // Set-Ersatz fuer Reactivity
  visibleKeys.value = new Set(visibleKeys.value)
}

// ----------------------------------------------------------------
// Absolut / Prozent Toggle
// ----------------------------------------------------------------
const mode = ref<'absolute' | 'percent'>('percent')

// ----------------------------------------------------------------
// CO2-Linie an/aus
// ----------------------------------------------------------------
const showCO2 = ref(false)

// ----------------------------------------------------------------
// Weekly-Aggregation
// ----------------------------------------------------------------
/**
 * Aggregiert Stunden-Daten zu Wochenwerten.
 * Gibt ein Array von { date, wind, pv, lignite, ..., co2_avg, total } zurueck.
 */
function aggregateWeekly(rows: HourlyRow[]) {
  const weeks = new Map<string, d3.Map<number>>()

  // Hilfsfunktion: Energietraeger aus generation_by_source auf unsere Kategorien mappen
  function mapSources(gen: HourlyRow['generation_by_source']) {
    return {
      wind: (gen.wind_onshore ?? 0) + (gen.wind_offshore ?? 0),
      pv: gen.pv ?? 0,
      lignite: gen.lignite ?? 0,
      hardcoal: gen.hardcoal ?? 0,
      gas: gen.gas ?? 0,
      nuclear: gen.nuclear ?? 0,
      biomass: gen.biomass ?? 0,
      hydro: gen.hydro ?? 0,
      other: (gen.other_renewables ?? 0) + (gen.other_fossil ?? 0) + (gen.pumped_storage ?? 0),
    }
  }

  // Jede Stunde in Wochen-Bucket einsortieren
  for (const row of rows) {
    const d = new Date(row.timestamp)
    // ISO-Wochen-Key: Jahr-Woche (z.B. "2015-W03")
    // Donnerstag der Woche bestimmen fuer ISO-Woche
    const do4 = new Date(d)
    do4.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)))
    const y = do4.getUTCFullYear()
    const j0 = new Date(Date.UTC(y, 0, 1))
    const kw = Math.ceil(((do4.getTime() - j0.getTime()) / 86400000 + 1) / 7)
    const key = `${y}-W${String(kw).padStart(2, '0')}`

    if (!weeks.has(key)) {
      weeks.set(key, {
        date: new Date(Date.UTC(y, 0, 1 + (kw - 1) * 7)),
        co2Sum: 0,
        co2Count: 0,
        total: 0,
        ...Object.fromEntries(ALL_KEYS.map((k) => [k, 0])),
      })
    }

    const w = weeks.get(key)!
    const sources = mapSources(row.generation_by_source)
    for (const k of ALL_KEYS) {
      w[k] += sources[k]
    }
    w.total += Object.values(sources).reduce((a, b) => a + b, 0)
    w.co2Sum += row.co2_g_per_kwh
    w.co2Count++
  }

  return [...weeks.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ----------------------------------------------------------------
// D3-Refs
// ----------------------------------------------------------------
const chartContainer = ref<HTMLDivElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null

onUnmounted(() => {
  tooltipDiv?.remove()
})

// ----------------------------------------------------------------
// Chart-Masse
// ----------------------------------------------------------------
const MARGIN = { top: 20, right: 90, bottom: 40, left: 65 }
const WIDTH = 900
const HEIGHT = 370
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// D3-Stacked-Area Rendering
// ----------------------------------------------------------------
watchEffect(() => {
  const rows = props.data
  if (!rows.length || !svgRef.value) return

  // 1. Daten zu Wochen aggregieren
  const weekly = aggregateWeekly(rows)

  // 2. Nur sichtbare Keys beruecksichtigen
  const activeKeys = ALL_KEYS.filter((k) => visibleKeys.value.has(k))

  // 3. D3-Stack vorbereiten
  const stack = d3.stack<d3.Map<number>>()
    .keys(activeKeys)
    .value((d, key) => d[key] / 1000) // MWh -> GWh fuer lesbare Y-Achse

  if (mode.value === 'percent') {
    // Prozentmodus: Jede Woche auf 100% normieren
    stack.offset(d3.stackOffsetExpand)
  }

  const stackedData = stack(weekly)
  // stackedData: Array von Series, jede Series hat Array von [y0, y1] pro Datenpunkt

  // 4. Skalen
  const xScale = d3.scaleTime()
    .domain(d3.extent(weekly, (d) => d.date) as [Date, Date])
    .range([0, INNER_W])

  let yMax: number
  if (mode.value === 'percent') {
    yMax = 1
  } else {
    yMax = d3.max(stackedData, (series) => d3.max(series, (d) => d[1])) ?? 0
  }
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([INNER_H, 0])

  // CO2-Skala (zweite Y-Achse, falls aktiv)
  const co2Domain = d3.extent(weekly, (d) => d.co2Sum / d.co2Count) as [number, number]
  const co2Scale = d3.scaleLinear()
    .domain([0, Math.ceil(co2Domain[1] / 100) * 100])
    .range([INNER_H, 0])

  // 5. SVG aufbauen
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg
    .attr('width', WIDTH)
    .attr('height', HEIGHT)
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  const chart = svg.append('g')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  // 6. Bereiche (Area) zeichnen
  const area = d3.area<[number, number]>()
    .x((_d, i) => xScale(weekly[i].date))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  // Pfade fuer jeden Energietraeger
  for (let i = activeKeys.length - 1; i >= 0; i--) {
    const key = activeKeys[i]
    chart.append('path')
      .datum(stackedData[i])
      .attr('d', area as any)
      .attr('fill', COLORS[key])
      .attr('opacity', 0.85)
      .attr('stroke', 'none')
  }

  // 7. X-Achse (Jahreslabels)
  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeYear.every(1))
    .tickFormat(d3.timeFormat('%Y') as any)

  chart.append('g')
    .attr('transform', `translate(0, ${INNER_H})`)
    .call(xAxis)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // 8. Y-Achse (TWh oder %)
  const yAxis = d3.axisLeft(yScale)
    .ticks(6)
    .tickFormat((d) => mode.value === 'percent' ? `${(d as number) * 100}%` : `${(d as number).toFixed(0)} GWh`)

  chart.append('g')
    .call(yAxis)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // Y-Achsen-Beschriftung
  chart.append('text')
    .attr('x', -40)
    .attr('y', 10)
    .attr('font-size', '11px')
    .attr('fill', '#6b7280')
    .text(mode.value === 'percent' ? 'Anteil' : 'GWh / Woche')

  // 9. CO2-Linie (optional)
  if (showCO2.value) {
    const line = d3.line<d3.Map<number>>()
      .x((d) => xScale(d.date))
      .y((d) => co2Scale(d.co2Sum / d.co2Count))
      .curve(d3.curveMonotoneX)

    chart.append('path')
      .datum(weekly)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6)

    // Zweite Y-Achse rechts
    const co2Axis = d3.axisRight(co2Scale)
      .ticks(5)
      .tickFormat((d) => `${d} g`)

    chart.append('g')
      .attr('transform', `translate(${INNER_W}, 0)`)
      .call(co2Axis)
      .attr('font-size', '10px')
      .attr('color', '#1a1a1a')

    chart.append('text')
      .attr('x', INNER_W + 45)
      .attr('y', 10)
      .attr('font-size', '10px')
      .attr('fill', '#1a1a1a')
      .text('CO2 g/kWh')
  }

  // 10. Annotations-Linien
  const annotations = [
    { date: new Date(2020, 0, 1), label: 'Kohleausstiegsbeschluss 2020\nZiel: 2038', color: '#78350f' },
    { date: new Date(2023, 3, 15), label: 'Atomausstieg\n2023', color: '#8b5cf6' },
    { date: new Date(2018, 9, 1), label: 'Datenlücke 2018\n(ENTSO-E-Wechsel)', color: '#94a3b8' },
  ]

  for (const ann of annotations) {
    const x = xScale(ann.date)
    if (x < 0 || x > INNER_W) continue

    chart.append('line')
      .attr('x1', x).attr('y1', 0)
      .attr('x2', x).attr('y2', INNER_H)
      .attr('stroke', ann.color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.6)

    const lines = ann.label.split('\n')
    let yOff = 12
    for (const line of lines) {
      chart.append('text')
        .attr('x', x + 4)
        .attr('y', yOff)
        .attr('font-size', '9px')
        .attr('fill', ann.color)
        .attr('font-weight', '500')
        .text(line)
      yOff += 13
    }
  }

  // 11. Tooltip: vertikale Linie + Werte-Overlay
  if (!tooltipDiv) {
    tooltipDiv = d3.select('body').append('div')
      .attr('class', 'stacked-tooltip')
      .style('position', 'fixed')
      .style('display', 'none')
      .style('background', '#1a1a1a')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('line-height', '1.6')
      .style('max-height', '300px')
      .style('overflow-y', 'auto')
  }

  // Tooltip-Linie (vertikaler Strich)
  const tooltipLine = chart.append('line')
    .attr('y1', 0)
    .attr('y2', INNER_H)
    .attr('stroke', '#333')
    .attr('stroke-width', 1)
    .attr('opacity', 0)

  // Invertiere x-Position zu Datum
  const bisectDate = d3.bisector<d3.Map<number>, Date>((d) => d.date).left

  chart.append('rect')
    .attr('width', INNER_W)
    .attr('height', INNER_H)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const x0 = xScale.invert(mx)
      const i = bisectDate(weekly, x0, 1)
      const left = weekly[i - 1]
      const right = weekly[i]
      if (!left || !right) return
      const d0 = x0.getTime() - left.date.getTime()
      const d1 = right.date.getTime() - x0.getTime()
      const entry = d0 < d1 ? left : right

      // Tooltip-Linie positionieren
      const xPos = xScale(entry.date)
      tooltipLine.attr('x1', xPos).attr('x2', xPos).attr('opacity', 0.5)

      // Werte-Overlay
      const dateStr = entry.date.toISOString().slice(0, 10)
      const totalGwh = (entry.total / 1000).toFixed(1)
      let html = `<strong>${dateStr}</strong><br/>Gesamt: ${totalGwh} GWh<br/>`
      for (const k of ALL_KEYS) {
        const val = entry[k] / 1000
        const anteil = entry.total > 0 ? (entry[k] / entry.total * 100).toFixed(1) : '0.0'
        html += `<span style="color:${COLORS[k]}">●</span> ${k}: ${val.toFixed(1)} GWh (${anteil}%)<br/>`
      }
      if (showCO2.value) {
        const co2 = (entry.co2Sum / entry.co2Count).toFixed(1)
        html += `<span style="color:#1a1a1a">■</span> CO2: ${co2} g/kWh`
      }

      tooltipDiv!
        .style('display', 'block')
        .html(html)
        .style('left', `${event.clientX + 14}px`)
        .style('top', `${Math.max(10, event.clientY - 20)}px`)
    })
    .on('mouseleave', function () {
      tooltipLine.attr('opacity', 0)
      tooltipDiv!.style('display', 'none')
    })

  // 12. Platzhalter entfernt – kein Range-Slider implementiert
})
</script>

<template>
  <div class="stacked-card">
    <!-- Kopfzeile -->
    <div class="stacked-header">
      <div class="stacked-title">
        <span class="stacked-number">1</span>
        <span class="stacked-heading">Erzeugungsmix über die Zeit</span>
      </div>
      <div class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: mode === 'absolute' }"
          @click="mode = 'absolute'"
        >Absolut</button>
        <button
          class="mode-btn"
          :class="{ active: mode === 'percent' }"
          @click="mode = 'percent'"
        >% Anteil</button>
      </div>
    </div>

    <!-- Legende horizontal -->
    <div class="legend-bar">
      <button
        v-for="key in ALL_KEYS"
        :key="key"
        class="legend-item"
        :class="{ dimmed: !visibleKeys.has(key) }"
        @click="toggleKey(key)"
      >
        <span class="legend-dot" :style="{ background: COLORS[key] }"></span>
        <span class="legend-label">{{ key }}</span>
      </button>
    </div>

    <!-- SVG-Container -->
    <div ref="chartContainer" class="chart-wrap">
      <svg ref="svgRef"></svg>
    </div>

    <!-- CO2-Toggle unten -->
    <div class="co2-toggle">
      <label class="toggle-label">
        <input type="checkbox" v-model="showCO2" />
        <span class="toggle-slider"></span>
        <span>CO2-Intensitaet (g/kWh)</span>
      </label>
    </div>

    <!-- Hinweis bei Absolut-Modus -->
    <p v-if="mode === 'absolute'" class="stacked-hint">
      Hinweis: 2018 enthält ab Oktober Datenlücken durch den ENTSO-E-Marktgebietswechsel.
      Prozentwerte und Durchschnittswerte sind dadurch besser vergleichbar als Jahressummen.
    </p>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Container
   ---------------------------------------------------------------- */
.stacked-card {
  width: 100%;
}

/* ----------------------------------------------------------------
   Kopfzeile
   ---------------------------------------------------------------- */
.stacked-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stacked-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stacked-number {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-muted);
  opacity: 0.5;
  margin-right: 6px;
}

.stacked-heading {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg);
}

.mode-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--hairline);
  padding: 2px;
}

.mode-btn {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.7rem;
  padding: 3px 8px;
  transition: color 0.15s, background 0.15s;
}

.mode-btn.active {
  background: var(--fg);
  color: var(--bg);
  font-weight: 500;
}

/* ----------------------------------------------------------------
   Legende
   ---------------------------------------------------------------- */
.legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--fg);
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: opacity 0.15s;
}

.legend-item:hover {
  background: #f3f4f6;
}

.legend-item.dimmed {
  opacity: 0.35;
  text-decoration: line-through;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  text-transform: capitalize;
}

/* ----------------------------------------------------------------
   Chart-Container
   ---------------------------------------------------------------- */
.chart-wrap {
  width: 100%;
  min-width: 0;
}

.chart-wrap svg {
  width: 100%;
  height: auto;
  display: block;
}

@media (max-width: 900px) {
  .chart-wrap {
    overflow-x: auto;
  }
}

/* ----------------------------------------------------------------
   CO2-Toggle (Checkbox-Styling)
   ---------------------------------------------------------------- */
.co2-toggle {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--fg-muted);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* ----------------------------------------------------------------
   Hinweistext bei Absolut-Modus
   ---------------------------------------------------------------- */
.stacked-hint {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.4;
}
</style>
