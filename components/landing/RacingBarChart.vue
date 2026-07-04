<script setup lang="ts">
/**
 * components/landing/RacingBarChart.vue
 * =======================================
 * Racing Bar Chart fuer die Landing-Seite.
 *
 * Zeigt die Top-8-Energietraeger pro Jahr als horizontale Balken,
 * die von 2015 bis 2024 durchlaufen. Die Balken sortieren sich jedes
 * Jahr neu – Veraenderungen in der Rangfolge sind als Animation
 * sichtbar.
 *
 * Datenbasis: yearly_mix.json aus /data/yearly_mix.json
 * Die Rohdaten (MWh) werden in TWh umgerechnet.
 *
 * Animations-Strategie:
 *   - D3-Key-Join: Jeder Balken hat einen fixen Key (Energietraeger),
 *     sodass D3 verfolgen kann, wo jeder Balken hin muss
 *   - Transition duration 800ms, Pause zwischen Jahren 200ms
 *   - Gesamtlaufzeit: ~8 Sekunden (10 Jahre)
 *   - Startet automatisch 1s nach Mount
 */

import { ref, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'

// ----------------------------------------------------------------
// Quell-Definitionen (Farben + Label + Mapping zu yearly_mix-Keys)
// ----------------------------------------------------------------
interface SourceDef {
  key: string
  label: string
  color: string
  /** Keys in yearly_mix.sources, die aufgelaufen werden */
  sourceKeys: string[]
}

const SOURCE_DEFS: SourceDef[] = [
  { key: 'wind',       label: 'Wind',        color: '#2563eb', sourceKeys: ['wind_onshore', 'wind_offshore'] },
  { key: 'pv',         label: 'PV',          color: '#facc15', sourceKeys: ['pv'] },
  { key: 'lignite',    label: 'Braunkohle',  color: '#78350f', sourceKeys: ['lignite'] },
  { key: 'hardcoal',   label: 'Steinkohle',  color: '#6b7280', sourceKeys: ['hardcoal'] },
  { key: 'gas',        label: 'Erdgas',      color: '#f97316', sourceKeys: ['gas'] },
  { key: 'nuclear',    label: 'Kernenergie',  color: '#8b5cf6', sourceKeys: ['nuclear'] },
  { key: 'biomass',    label: 'Biomasse',     color: '#16a34a', sourceKeys: ['biomass'] },
  { key: 'hydro',      label: 'Wasserkraft',  color: '#38bdf8', sourceKeys: ['hydro'] },
  { key: 'other',      label: 'Sonstige',     color: '#d1d5db', sourceKeys: ['other_renewables', 'other_fossil', 'pumped_storage'] },
]

// ----------------------------------------------------------------
// Daten-Interface aus yearly_mix.json
// ----------------------------------------------------------------
interface YearlyEntry {
  year: number
  sources: Record<string, number>
}

// ----------------------------------------------------------------
// Ein Balken im Chart
// ----------------------------------------------------------------
interface BarData {
  key: string
  label: string
  value: number  // TWh
  color: string
}

// ----------------------------------------------------------------
// D3-Refs + State
// ----------------------------------------------------------------
const svgRef = ref<SVGSVGElement | null>(null)
const running = ref(false)
const currentYear = ref(2015)
const done = ref(false)

// Breite und Hoehe des Charts
const W = 700
const H = 500
const MARGIN = { top: 20, right: 120, bottom: 40, left: 10 }
const INNER_W = W - MARGIN.left - MARGIN.right
const INNER_H = H - MARGIN.top - MARGIN.bottom
const BAR_H = 40
const BAR_GAP = 8
const SHOW_BARS = 8

// ----------------------------------------------------------------
// Daten laden
// ----------------------------------------------------------------
let yearData: YearlyEntry[] = []

async function loadData() {
  try {
    const res = await fetch('/data/yearly_mix.json')
    yearData = (await res.json()) as YearlyEntry[]
  } catch (e) {
    console.error('RacingBarChart: Fehler beim Laden von yearly_mix.json', e)
  }
}

// ----------------------------------------------------------------
// Pro Jahr die Top-8-Energietraeger berechnen
// ----------------------------------------------------------------
function getBarsForYear(year: number, data: YearlyEntry[]): BarData[] {
  const entry = data.find((d) => d.year === year)
  if (!entry) return []

  // Werte pro SourceDef aufsummieren
  const raw: BarData[] = SOURCE_DEFS.map((def) => {
    let totalMWh = 0
    for (const sk of def.sourceKeys) {
      totalMWh += entry.sources[sk] ?? 0
    }
    return {
      key: def.key,
      label: def.label,
      value: totalMWh / 1_000_000, // MWh -> TWh
      color: def.color,
    }
  })

  // Nach TWh sortieren, Top 8 nehmen
  return raw.sort((a, b) => b.value - a.value).slice(0, SHOW_BARS)
}

// ----------------------------------------------------------------
// Animation starten
// ----------------------------------------------------------------
let timer: ReturnType<typeof setInterval> | null = null

function startAnimation() {
  if (!svgRef.value || yearData.length === 0) return
  running.value = true
  done.value = false
  currentYear.value = 2015

  const years = yearData.map((d) => d.year).sort()
  let idx = 0

  // Initialen Zustand zeichnen
  renderYear(years[idx])

  timer = setInterval(() => {
    idx++
    if (idx >= years.length) {
      // Fertig
      if (timer) clearInterval(timer)
      timer = null
      running.value = false
      done.value = true
      return
    }
    currentYear.value = years[idx]
    renderYear(years[idx])
  }, 1000)
}

// ----------------------------------------------------------------
// Ein Jahr rendern (mit D3-Transition)
// ----------------------------------------------------------------
function renderYear(year: number) {
  const svg = d3.select(svgRef.value)
  const bars = getBarsForYear(year, yearData)

  // Y-Skala (Band-Scale fuer Balken-Position)
  const yScale = d3.scaleBand<string>()
    .domain(bars.map((b) => b.key))
    .range([0, SHOW_BARS * (BAR_H + BAR_GAP)])
    .padding(0.15)

  // X-Skala (TWh)
  const maxVal = d3.max(bars, (b) => b.value) ?? 100
  const xScale = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([0, INNER_W])

  // Chart-Gruppe
  const chart = svg.select('.chart-group')

  // ---- Balken: Data-Join mit Key ----
  const barGroups = chart.selectAll<SVGGElement, BarData>('.bar-group')
    .data(bars, (d: any) => d.key)

  // EXIT: alte Balken ausblenden
  barGroups.exit()
    .transition()
    .duration(400)
    .attr('opacity', 0)
    .remove()

  // ENTER: neue Balken
  const enter = barGroups.enter()
    .append('g')
    .attr('class', 'bar-group')
    .attr('opacity', 0)

  // Rechteck
  enter.append('rect')
    .attr('height', yScale.bandwidth())
    .attr('rx', 4)

  // Text: Wert (TWh) rechts neben dem Balken
  enter.append('text')
    .attr('class', 'bar-value')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('font-weight', '600')

  // Text: Label links neben dem Balken
  enter.append('text')
    .attr('class', 'bar-label')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', '500')

  // ENTER + UPDATE zusammen
  const merged = enter.merge(barGroups)

  merged.transition()
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr('opacity', 1)
    .attr('transform', (d) => `translate(0, ${yScale(d.key) ?? 0})`)

  merged.select('rect')
    .transition()
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr('width', (d) => Math.max(0, xScale(d.value)))
    .attr('fill', (d) => d.color)
    .attr('opacity', 0.85)

  merged.select<SVGTextElement>('.bar-value')
    .transition()
    .duration(800)
    .attr('x', (d) => xScale(d.value) + 8)
    .attr('y', yScale.bandwidth() / 2)
    .text((d) => `${d.value.toFixed(1)} TWh`)

  merged.select<SVGTextElement>('.bar-label')
    .transition()
    .duration(800)
    .attr('x', -6)
    .attr('y', yScale.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .text((d) => d.label)

  // ---- Jahreszahl unten rechts ----
  chart.select('.year-text')
    .remove()

  chart.append('text')
    .attr('class', 'year-text')
    .attr('x', INNER_W)
    .attr('y', INNER_H)
    .attr('text-anchor', 'end')
    .attr('font-size', '64px')
    .attr('font-weight', '800')
    .attr('fill', '#e5e7eb')
    .attr('opacity', 0)
    .text(String(year))
    .transition()
    .duration(600)
    .attr('opacity', 0.6)
}

// ----------------------------------------------------------------
// Zuruecksetzen
// ----------------------------------------------------------------
function resetChart() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  running.value = false
  done.value = false
  currentYear.value = 2015

  // SVG leeren und neu initialisieren
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  initSvg(svg)

  // Nach 1s neu starten
  setTimeout(() => startAnimation(), 1000)
}

// ----------------------------------------------------------------
// SVG initialisieren
// ----------------------------------------------------------------
function initSvg(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
  svg
    .attr('width', W)
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`)

  svg.append('g')
    .attr('class', 'chart-group')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top + 20})`)
}

// ----------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------
onMounted(async () => {
  await loadData()
  if (svgRef.value) {
    initSvg(d3.select(svgRef.value))
    // Automatischer Start nach 1s Verzoegerung
    setTimeout(() => startAnimation(), 1000)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="racing-chart">
    <svg ref="svgRef"></svg>

    <!-- Reset-Button (nur wenn fertig) -->
    <button v-if="done" class="reset-btn" @click="resetChart">
      Zuruecksetzen
    </button>

    <!-- Lade-Hinweis -->
    <p v-if="!yearData.length && !done" class="loading-hint">Lade Daten...</p>
  </div>
</template>

<style scoped>
.racing-chart {
  position: relative;
  width: 700px;
  margin: 0 auto;
}

.racing-chart svg {
  display: block;
}

.reset-btn {
  display: block;
  margin: 8px auto 0;
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.reset-btn:hover {
  color: var(--fg);
  border-color: var(--accent);
}

.loading-hint {
  text-align: center;
  font-size: 0.8rem;
  color: var(--fg-muted);
  padding: 40px 0;
}
</style>
