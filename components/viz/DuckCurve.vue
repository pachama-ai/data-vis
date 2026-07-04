<script setup lang="ts">
/**
 * components/viz/DuckCurve.vue
 * ============================
 * Zeigt Tagesprofile (0-24h) als Liniendiagramm mit zwei Gruppen
 * (z.B. Sommer vs Winter, 2015 vs 2024, Werktag vs Wochenende).
 *
 * Drei Linien pro Gruppe:
 *   - PV-Erzeugung (GW)        – Akzent-gruen
 *   - Residuallast (GW)        – schwarz
 *   - Day-Ahead-Preis (EUR/MWh) – dunkelblau
 *
 * Gruppe 1 = durchgezogen, Gruppe 2 = gestrichelt.
 * Die Residuallast ist Last minus erneuerbare Erzeugung.
 * Sie erzeugt den typischen "Duck Curve"-Verlauf: mittags ein Einbruch
 * durch Solar, abends ein steiler Anstieg wenn die Sonne weg ist.
 *
 * Zwei Modi:
 *   - Durchschnitt: Mittelt alle Stunden im Filterzeitraum
 *   - Konkreter Tag: Zeigt nur einen bestimmten Tag (via selectedDay-Prop)
 */

import { ref, computed, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
const props = defineProps<{
  data: HourlyRow[]
  selectedDay?: string   // ISO-Datum "YYYY-MM-DD", von HeatmapCO2
}>()

// ----------------------------------------------------------------
// Vergleichs-Presets
// ----------------------------------------------------------------
type PresetKey = 'season' | 'year' | 'weekday'

interface Preset {
  key: PresetKey
  label: string
  /** Name der ersten Gruppe (z.B. "Sommer") */
  groupA: string
  /** Name der zweiten Gruppe (z.B. "Winter") */
  groupB: string
  /** Filter-Funktion: gehoert row zu Gruppe A? */
  filterA: (row: HourlyRow) => boolean
  /** Filter-Funktion: gehoert row zu Gruppe B? */
  filterB: (row: HourlyRow) => boolean
}

const PRESETS: Preset[] = [
  {
    key: 'season',
    label: 'Sommer (Jun-Aug) vs Winter (Dez-Feb)',
    groupA: 'Sommer',
    groupB: 'Winter',
    filterA: (r) => { const m = new Date(r.timestamp).getUTCMonth(); return m >= 5 && m <= 7 },
    filterB: (r) => { const m = new Date(r.timestamp).getUTCMonth(); return m === 11 || m <= 1 },
  },
  {
    key: 'year',
    label: '2015 vs 2024',
    groupA: '2015',
    groupB: '2024',
    filterA: (r) => new Date(r.timestamp).getUTCFullYear() === 2015,
    filterB: (r) => new Date(r.timestamp).getUTCFullYear() === 2024,
  },
  {
    key: 'weekday',
    label: 'Werktag vs Wochenende',
    groupA: 'Werktag',
    groupB: 'Wochenende',
    filterA: (r) => { const d = new Date(r.timestamp).getUTCDay(); return d >= 1 && d <= 5 },
    filterB: (r) => { const d = new Date(r.timestamp).getUTCDay(); return d === 0 || d === 6 },
  },
]

const activePreset = ref<PresetKey>('season')
const currentPreset = computed(() => PRESETS.find((p) => p.key === activePreset.value)!)

// ----------------------------------------------------------------
// Modus: Durchschnitt oder Konkreter Tag
// ----------------------------------------------------------------
const mode = ref<'average' | 'concrete'>('average')

// ----------------------------------------------------------------
// Sichtbare Linien (Legende togglen)
// ----------------------------------------------------------------
type LineKey = 'pv' | 'residuallast' | 'price'

const visibleLines = ref<Set<LineKey>>(new Set(['pv', 'residuallast', 'price']))

const LINE_META: { key: LineKey; label: string; color: string }[] = [
  { key: 'pv',            label: 'PV-Erzeugung (GW)', color: '#10b981' },
  { key: 'residuallast',  label: 'Residuallast (GW)', color: '#1a1a1a' },
  { key: 'price',         label: 'Day-Ahead-Preis',   color: '#2563eb' },
]

function toggleLine(key: LineKey) {
  if (visibleLines.value.has(key)) {
    visibleLines.value.delete(key)
    if (visibleLines.value.size === 0) visibleLines.value.add(key)
  } else {
    visibleLines.value.add(key)
  }
  visibleLines.value = new Set(visibleLines.value)
}

// ----------------------------------------------------------------
// D3-Refs + Tooltip
// ----------------------------------------------------------------
const svgRef = ref<SVGSVGElement | null>(null)
let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null

onUnmounted(() => { tooltipDiv?.remove() })

// ----------------------------------------------------------------
// Hilfsfunktionen: Werte pro Stunde
// ----------------------------------------------------------------
/** Residuallast in GW: Last - erneuerbare Erzeugung */
function residuallastGW(row: HourlyRow): number {
  const gen = row.generation_by_source
  const ee = (gen.wind_onshore ?? 0) + (gen.wind_offshore ?? 0)
    + (gen.pv ?? 0) + (gen.biomass ?? 0) + (gen.hydro ?? 0)
    + (gen.other_renewables ?? 0)
  return (row.load_mwh - ee) / 1000
}

function pvGW(row: HourlyRow): number {
  return (row.generation_by_source.pv ?? 0) / 1000
}

// ----------------------------------------------------------------
// Profile berechnen (0-24h)
// ----------------------------------------------------------------
interface HourPoint {
  hour: number
  pv: number
  residuallast: number
  price: number
}

/**
 * Aggregiert Stunden-Daten zu einem Tagesprofil (0-23h).
 * Im average-Modus: Mittelwert aller Stunden der Gruppe.
 * Im concrete-Modus: exakte Werte des selectedDay.
 */
function computeProfiles(rows: HourlyRow[]): HourPoint[] {
  if (mode.value === 'concrete' && props.selectedDay) {
    // Nur der konkrete Tag
    const dayStart = new Date(props.selectedDay + 'T00:00:00Z').getTime()
    const dayEnd = dayStart + 86400000
    const dayRows = rows
      .filter((r) => r.timestamp >= dayStart && r.timestamp < dayEnd)
      .sort((a, b) => a.timestamp - b.timestamp)

    return dayRows.map((r) => {
      const d = new Date(r.timestamp)
      return {
        hour: d.getUTCHours(),
        pv: pvGW(r),
        residuallast: residuallastGW(r),
        price: r.price_eur_mwh,
      }
    })
  }

  // Durchschnitts-Modus: Mittelwert pro Stunde
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour, pv: [] as number[], residuallast: [] as number[], price: [] as number[]
  }))

  for (const r of rows) {
    const h = new Date(r.timestamp).getUTCHours()
    byHour[h].pv.push(pvGW(r))
    byHour[h].residuallast.push(residuallastGW(r))
    byHour[h].price.push(r.price_eur_mwh)
  }

  return byHour.map((h) => ({
    hour: h.hour,
    pv: h.pv.reduce((a, b) => a + b, 0) / Math.max(1, h.pv.length),
    residuallast: h.residuallast.reduce((a, b) => a + b, 0) / Math.max(1, h.residuallast.length),
    price: h.price.reduce((a, b) => a + b, 0) / Math.max(1, h.price.length),
  }))
}

// ----------------------------------------------------------------
// Chart-Masse
// ----------------------------------------------------------------
const MARGIN = { top: 30, right: 85, bottom: 40, left: 65 }
const WIDTH = 700
const HEIGHT = 380
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// D3-Rendering
// ----------------------------------------------------------------
watchEffect(() => {
  const rows = props.data
  if (!rows.length || !svgRef.value) return

  // 1. Daten in zwei Gruppen teilen
  const preset = currentPreset.value
  const groupARows = rows.filter(preset.filterA)
  const groupBRows = rows.filter(preset.filterB)

  const profileA = computeProfiles(groupARows)
  const profileB = computeProfiles(groupBRows)

  // 2. Skalen
  const xScale = d3.scaleLinear()
    .domain([0, 23])
    .range([0, INNER_W])

  // Y-Achse links: GW (PV + Residuallast)
  const allGW = [
    ...profileA.map((p) => p.pv),
    ...profileA.map((p) => p.residuallast),
    ...profileB.map((p) => p.pv),
    ...profileB.map((p) => p.residuallast),
  ].filter((v) => v != null && !isNaN(v))
  const gwMin = 0
  const gwMax = d3.max(allGW) ?? 100

  const yLeft = d3.scaleLinear()
    .domain([gwMin, Math.ceil(gwMax / 5) * 5])
    .range([INNER_H, 0])

  // Y-Achse rechts: Preis
  const allPrices = [
    ...profileA.map((p) => p.price),
    ...profileB.map((p) => p.price),
  ].filter((v) => v != null && !isNaN(v))
  const priceMin = Math.min(0, d3.min(allPrices) ?? 0)
  const priceMax = d3.max(allPrices) ?? 200

  const yRight = d3.scaleLinear()
    .domain([priceMin, Math.ceil(priceMax / 20) * 20])
    .range([INNER_H, 0])

  // 3. SVG aufbauen
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg
    .attr('width', WIDTH)
    .attr('height', HEIGHT)
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  const chart = svg.append('g')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  // 4. Linien-Generator
  const lineGen = d3.line<HourPoint>()
    .x((d) => xScale(d.hour))
    .curve(d3.curveCatmullRom)

  // 5. Linien zeichnen fuer jede Gruppe + Metrik
  type GroupMeta = { data: HourPoint[]; label: string; dashed: boolean }
  const groups: GroupMeta[] = [
    { data: profileA, label: currentPreset.value.groupA, dashed: false },
    { data: profileB, label: currentPreset.value.groupB, dashed: true },
  ]

  for (const group of groups) {
    for (const meta of LINE_META) {
      if (!visibleLines.value.has(meta.key)) continue

      const yScale = meta.key === 'price' ? yRight : yLeft
      const gen = lineGen.y((d) => yScale(d[meta.key]))

      chart.append('path')
        .datum(group.data)
        .attr('d', gen)
        .attr('fill', 'none')
        .attr('stroke', meta.color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.85)
        .attr('stroke-dasharray', group.dashed ? '6,4' : 'none')

      // Gruppen-Label am rechten Ende der Linie
      if (meta.key === 'residuallast') {
        const last = group.data[group.data.length - 1]
        if (last) {
          chart.append('text')
            .attr('x', xScale(last.hour) + 4)
            .attr('y', yScale(last.residuallast) + 4)
            .attr('font-size', '9px')
            .attr('fill', meta.color)
            .attr('font-weight', '500')
            .text(group.label)
        }
      }
    }
  }

  // 6. Achsen
  const xAxis = d3.axisBottom(xScale).ticks(8).tickFormat((d) => `${d}:00`)
  chart.append('g')
    .attr('transform', `translate(0, ${INNER_H})`)
    .call(xAxis)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  const yAxisLeft = d3.axisLeft(yLeft).ticks(6)
  chart.append('g')
    .call(yAxisLeft)
    .attr('font-size', '11px')
    .attr('color', '#6b7280')

  // Y-Achsen-Beschriftung
  chart.append('text')
    .attr('x', -40)
    .attr('y', 12)
    .attr('font-size', '10px')
    .attr('fill', '#6b7280')
    .text('GW')

  if (visibleLines.value.has('price')) {
    const yAxisRight = d3.axisRight(yRight).ticks(6)
    chart.append('g')
      .attr('transform', `translate(${INNER_W}, 0)`)
      .call(yAxisRight)
      .attr('font-size', '11px')
      .attr('color', '#2563eb')

    chart.append('text')
      .attr('x', INNER_W + 50)
      .attr('y', 12)
      .attr('font-size', '10px')
      .attr('fill', '#2563eb')
      .text('EUR/MWh')
  }

  // 7. Legende (oben im Chart)
  const legendGroup = chart.append('g')
    .attr('transform', `translate(8, 8)`)

  // Hintergrund fuer Legende
  legendGroup.append('rect')
    .attr('width', 190)
    .attr('height', LINE_META.length * 20 + 8)
    .attr('fill', 'rgba(255,255,255,0.85)')
    .attr('rx', 4)
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 1)

  for (let i = 0; i < LINE_META.length; i++) {
    const meta = LINE_META[i]
    const yPos = 14 + i * 20
    const isVisible = visibleLines.value.has(meta.key)

    legendGroup.append('line')
      .attr('x1', 8).attr('y1', yPos)
      .attr('x2', 28).attr('y2', yPos)
      .attr('stroke', isVisible ? meta.color : '#d1d5db')
      .attr('stroke-width', 2.5)
      .attr('opacity', isVisible ? 0.85 : 0.4)

    legendGroup.append('text')
      .attr('x', 34).attr('y', yPos + 4)
      .attr('font-size', '10px')
      .attr('fill', isVisible ? meta.color : '#d1d5db')
      .attr('font-weight', isVisible ? '500' : '400')
      .style('cursor', 'pointer')
      .text(meta.label)
      .on('click', () => toggleLine(meta.key))

    // Unsichtbarer breiterer Bereich fuer Klick
    legendGroup.append('rect')
      .attr('x', 0).attr('y', yPos - 10)
      .attr('width', 190).attr('height', 20)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', () => toggleLine(meta.key))
  }

  // 8. Tooltip
  if (!tooltipDiv) {
    tooltipDiv = d3.select('body').append('div')
      .attr('class', 'duck-tooltip')
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
  }

  const tooltipLine = chart.append('line')
    .attr('y1', 0).attr('y2', INNER_H)
    .attr('stroke', '#9ca3af')
    .attr('stroke-width', 1)
    .attr('opacity', 0)

  chart.append('rect')
    .attr('width', INNER_W).attr('height', INNER_H)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const hour = Math.round(xScale.invert(mx))
      const clampedHour = Math.max(0, Math.min(23, hour))
      const xPos = xScale(clampedHour)

      tooltipLine
        .attr('x1', xPos).attr('x2', xPos)
        .attr('opacity', 0.5)

      const getVal = (p: HourPoint[], key: string, label: string, unit: string, decimals: number) => {
        const entry = p.find((e) => e.hour === clampedHour)
        return entry
          ? `${label}: ${entry[key as keyof HourPoint].toFixed(decimals)} ${unit}`
          : null
      }

      let html = `<strong>${String(clampedHour).padStart(2, '0')}:00</strong><br/>`
      for (const meta of LINE_META) {
        if (!visibleLines.value.has(meta.key)) continue
        const unit = meta.key === 'price' ? 'EUR/MWh' : 'GW'
        const dec = meta.key === 'price' ? 1 : 2

        const vA = getVal(profileA, meta.key, `${currentPreset.value.groupA} ${meta.label}`, unit, dec)
        if (vA) html += `<span style="color:${meta.color}">●</span> ${vA}<br/>`

        if (mode.value !== 'concrete') {
          const vB = getVal(profileB, meta.key, `${currentPreset.value.groupB} ${meta.label}`, unit, dec)
          if (vB) html += `<span style="color:${meta.color};opacity:0.6">◌</span> ${vB}<br/>`
        }
      }

      tooltipDiv!
        .style('display', 'block')
        .html(html)
        .style('left', `${Math.min(event.clientX + 14, window.innerWidth - 260)}px`)
        .style('top', `${Math.max(10, event.clientY - 20)}px`)
    })
    .on('mouseleave', function () {
      tooltipLine.attr('opacity', 0)
      tooltipDiv!.style('display', 'none')
    })
})
</script>

<template>
  <div class="duck-card">
    <!-- Kopfzeile -->
    <div class="duck-header">
      <div class="duck-title">
        <span class="duck-number">4</span>
        <span class="duck-heading">Duck Curve / Tagesprofil-Vergleicher</span>
      </div>
      <div class="duck-controls">
        <div class="mode-toggle">
          <button class="mode-btn" :class="{ active: mode === 'average' }" @click="mode = 'average'">Durchschnitt</button>
          <button class="mode-btn" :class="{ active: mode === 'concrete' }" @click="mode = 'concrete'" :disabled="!selectedDay">Konkreter Tag</button>
        </div>
        <select class="preset-select" v-model="activePreset" :disabled="mode === 'concrete'">
          <option v-for="p in PRESETS" :key="p.key" :value="p.key">{{ p.label }}</option>
        </select>
      </div>
    </div>

    <!-- SVG-Container -->
    <div class="duck-chart-wrap">
      <svg ref="svgRef"></svg>
    </div>

    <!-- Hinweis bei konkreten Tag -->
    <p v-if="mode === 'concrete' && selectedDay" class="duck-day-hint">
      Zeige Tag: <strong>{{ selectedDay }}</strong>
      (Klick auf Heatmap-Zelle aendert das Datum)
    </p>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Card
   ---------------------------------------------------------------- */
.duck-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ----------------------------------------------------------------
   Kopfzeile
   ---------------------------------------------------------------- */
.duck-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.duck-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.duck-number {
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

.duck-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg);
}

.duck-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-toggle {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
}

.mode-btn {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mode-btn.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.preset-select {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  max-width: 240px;
}

.preset-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ----------------------------------------------------------------
   Chart-Container
   ---------------------------------------------------------------- */
.duck-chart-wrap {
  overflow-x: auto;
}

.duck-chart-wrap svg {
  display: block;
}

/* ----------------------------------------------------------------
   Tag-Hinweis
   ---------------------------------------------------------------- */
.duck-day-hint {
  font-size: 0.75rem;
  color: var(--fg-muted);
  margin-top: 10px;
  margin-bottom: 0;
  text-align: center;
}
</style>
