<script setup lang="ts">
/**
 * components/viz/DuckCurve.vue
 * ============================
 * Interaktive Duck-Curve-Analyse mit Story-Modus und Small Multiples.
 *
 * Drei gekoppelte Teilcharts (gleiche X-Achse, keine doppelte Y-Achse):
 *   1. PV-Erzeugung + Residuallast (GW)
 *   2. Day-Ahead-Preis (EUR/MWh) – Step-Line
 *   3. CO₂-Intensität (g CO₂/kWh)
 *
 * Story-Modus mit 5 Schritten, die die kausale Kette erklären:
 *   PV-Mittag → Residuallast-Tal → Preisreaktion → CO₂-Effekt → Abendrampe
 */

import { ref, computed, watch, watchEffect, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
const props = defineProps<{
  data: HourlyRow[]
  selectedDay?: string
}>()

// ----------------------------------------------------------------
// Hilfsfunktionen: Werte pro Stunde
// ----------------------------------------------------------------
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
// Profil-Berechnung (0-23h) – mit CO₂-Werten
// ----------------------------------------------------------------
interface HourPoint {
  hour: number
  pv: number
  residuallast: number
  price: number
  co2: number
}

function computeProfile(rows: HourlyRow[]): HourPoint[] {
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h, pv: [] as number[], residuallast: [] as number[],
    price: [] as number[], co2: [] as number[],
  }))

  for (const r of rows) {
    const h = new Date(r.timestamp).getUTCHours()
    byHour[h].pv.push(pvGW(r))
    byHour[h].residuallast.push(residuallastGW(r))
    byHour[h].price.push(r.price_eur_mwh)
    byHour[h].co2.push(r.co2_g_per_kwh)
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)
  return byHour.map((h) => ({
    hour: h.hour,
    pv: avg(h.pv),
    residuallast: avg(h.residuallast),
    price: avg(h.price),
    co2: avg(h.co2),
  }))
}

// ----------------------------------------------------------------
// D3-Refs + Chart-Masse (Small Multiples)
// ----------------------------------------------------------------
const svgRef = ref<SVGSVGElement | null>(null)
let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null
onUnmounted(() => { tooltipDiv?.remove() })

const MARGIN = { top: 8, right: 16, bottom: 4, left: 52 }
const AXIS_H = 28
const PANEL_W = 760
const PANEL_H = 110
const GAP = 8
const TOTAL_W = PANEL_W
const TOTAL_H = MARGIN.top + 3 * (PANEL_H + GAP) + AXIS_H
const INNER_W = PANEL_W - MARGIN.left - MARGIN.right
const INNER_H = PANEL_H - MARGIN.top - MARGIN.bottom

// ----------------------------------------------------------------
// Vergleichs-Presets
// ----------------------------------------------------------------
type PresetKey = 'average' | 'season' | 'weekday' | 'year'

interface Preset {
  key: PresetKey
  label: string
  groupA: string
  groupB: string
  filterA: (r: HourlyRow) => boolean
  filterB: (r: HourlyRow) => boolean
}

const PRESETS: Preset[] = [
  {
    key: 'average', label: 'Durchschnittlicher Tagesverlauf',
    groupA: 'Durchschnitt', groupB: '',
    filterA: () => true, filterB: () => false,
  },
  {
    key: 'season', label: 'Sommer vs Winter',
    groupA: 'Sommer', groupB: 'Winter',
    filterA: (r) => { const m = new Date(r.timestamp).getUTCMonth(); return m >= 5 && m <= 7 },
    filterB: (r) => { const m = new Date(r.timestamp).getUTCMonth(); return m === 11 || m <= 1 },
  },
  {
    key: 'weekday', label: 'Werktag vs Wochenende',
    groupA: 'Werktag', groupB: 'Wochenende',
    filterA: (r) => { const d = new Date(r.timestamp).getUTCDay(); return d >= 1 && d <= 5 },
    filterB: (r) => { const d = new Date(r.timestamp).getUTCDay(); return d === 0 || d === 6 },
  },
  {
    key: 'year', label: '2015 vs 2024',
    groupA: '2015', groupB: '2024',
    filterA: (r) => new Date(r.timestamp).getUTCFullYear() === 2015,
    filterB: (r) => new Date(r.timestamp).getUTCFullYear() === 2024,
  },
]

const activePreset = ref<PresetKey>('average')
const currentPreset = computed(() => PRESETS.find((p) => p.key === activePreset.value)!)

// ----------------------------------------------------------------
// Story-Schritte
// ----------------------------------------------------------------
interface StoryStep {
  key: string
  tab: string
  title: string
  explanation: string
  scientificNote: string
  highlight: [number, number]
  emphasisMetric: 'pv' | 'residuallast' | 'price' | 'co2'
}

const STORY_STEPS: StoryStep[] = [
  {
    key: 'pv', tab: '1 PV-Mittag',
    title: 'PV-Erzeugung zur Mittagszeit',
    explanation: 'Zur Mittagszeit erreicht die Photovoltaik-Erzeugung ihren Tageshöchstwert. Besonders im Sommer kann PV einen großen Teil der Stromnachfrage decken.',
    scientificNote: 'PV ist stark tageszeit- und saisonabhängig. Der Effekt konzentriert sich vor allem auf die Mittagsstunden.',
    highlight: [10, 15],
    emphasisMetric: 'pv',
  },
  {
    key: 'residuallast', tab: '2 Residuallast-Tal',
    title: 'Residuallast sinkt durch PV',
    explanation: 'Wenn PV viel Strom erzeugt, muss weniger Nachfrage durch steuerbare Kraftwerke, Speicher oder Importe gedeckt werden. Deshalb sinkt die Residuallast zur Mittagszeit.',
    scientificNote: 'Residuallast = Stromnachfrage − Wind − PV. Sie zeigt den verbleibenden Flexibilitäts- und Kraftwerksbedarf.',
    highlight: [10, 15],
    emphasisMetric: 'residuallast',
  },
  {
    key: 'price', tab: '3 Preisreaktion',
    title: 'Day-Ahead-Preis reagiert auf Knappheit',
    explanation: 'Sinkt die Residuallast, sinkt häufig auch der Day-Ahead-Preis. Der Markt bewertet dann geringere Knappheit. Bei hoher erneuerbarer Einspeisung können Preise sogar negativ werden.',
    scientificNote: 'Der Preis ist eine Marktreaktion auf Knappheit, aber kein direkter Klimabilanz-Indikator. Er hängt auch von Brennstoffpreisen, Importen und Marktereignissen ab.',
    highlight: [10, 15],
    emphasisMetric: 'price',
  },
  {
    key: 'co2', tab: '4 CO₂-Effekt',
    title: 'CO₂-Intensität verbessert sich',
    explanation: 'Wenn weniger fossile Erzeugung benötigt wird, kann die CO₂-Intensität des Strommixes sinken. Stunden mit hoher erneuerbarer Einspeisung sind häufig klimafreundlicher.',
    scientificNote: 'Die Klimabilanz hängt vom Zusammenspiel aus erneuerbarer Erzeugung, Nachfrage und verbleibender fossiler Erzeugung ab.',
    highlight: [10, 15],
    emphasisMetric: 'co2',
  },
  {
    key: 'ramp', tab: '5 Abendrampe',
    title: 'Abendrampe: Flexibilitätsbedarf steigt',
    explanation: 'Am Abend fällt die PV-Erzeugung schnell ab, während die Stromnachfrage oft hoch bleibt. Dadurch steigt die Residuallast stark an. Diese Abendrampe muss durch flexible Kraftwerke, Speicher oder Importe ausgeglichen werden.',
    scientificNote: 'Die Duck Curve zeigt nicht nur ein Mittagstief, sondern vor allem den Flexibilitätsbedarf beim Übergang vom PV-Mittag zum Abend.',
    highlight: [17, 21],
    emphasisMetric: 'residuallast',
  },
]

const storyStep = ref(0)
const currentStep = computed(() => STORY_STEPS[storyStep.value])

const mode = ref<'average' | 'concrete'>('average')
watch(() => props.selectedDay, (nd) => { if (nd) mode.value = 'concrete' })

// Benutzerdefinierte Auswahl (überschreibt Story-Highlight)
const userHighlight = ref<[number, number] | null>(null)
const isUserSelection = ref(false)
function setHighlight(range: [number, number] | null, userDriven: boolean) {
  if (userDriven) { userHighlight.value = range; isUserSelection.value = true }
}
function returnToStory() { userHighlight.value = null; isUserSelection.value = false }

const activeHighlight = computed((): [number, number] | null => {
  if (isUserSelection.value && userHighlight.value) return userHighlight.value
  return currentStep.value.highlight
})

// ----------------------------------------------------------------
// Daten: Profile pro Vergleichsgruppe
// ----------------------------------------------------------------
function computeDayProfile(rows: HourlyRow[], day: string): HourPoint[] {
  const start = new Date(day + 'T00:00:00Z').getTime()
  const end = start + 86400000
  return rows.filter((r) => r.timestamp >= start && r.timestamp < end)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      hour: new Date(r.timestamp).getUTCHours(),
      pv: pvGW(r), residuallast: residuallastGW(r),
      price: r.price_eur_mwh, co2: r.co2_g_per_kwh,
    }))
}

const profiles = computed(() => {
  const rows = props.data
  if (!rows.length) return { profileA: [] as HourPoint[], profileB: [] as HourPoint[] }
  if (mode.value === 'concrete' && props.selectedDay)
    return { profileA: computeDayProfile(rows, props.selectedDay), profileB: [] }
  const preset = currentPreset.value
  return {
    profileA: computeProfile(rows.filter(preset.filterA)),
    profileB: preset.key === 'average' ? [] : computeProfile(rows.filter(preset.filterB)),
  }
})

// ----------------------------------------------------------------
// Analyse-Werte für Highlight-Bereich
// ----------------------------------------------------------------
const analysis = computed(() => {
  const { profileA } = profiles.value; const hl = activeHighlight.value
  if (!hl || !profileA.length) return null
  const slice = profileA.filter((p) => p.hour >= hl[0] && p.hour <= hl[1])
  if (!slice.length) return null
  const avg = (f: keyof HourPoint) => slice.reduce((s, p) => s + (p[f] as number), 0) / slice.length
  return { range: `${hl[0]}:00–${hl[1]}:00`, pv: avg('pv'), residuallast: avg('residuallast'), price: avg('price'), co2: avg('co2'), hours: slice.length }
})

// Vergleich Mittag vs Abend (nur Schritt 5)
const comparison = computed(() => {
  if (currentStep.value.key !== 'ramp') return null
  const { profileA } = profiles.value; if (!profileA.length) return null
  const m = profileA.filter((p) => p.hour >= 11 && p.hour <= 15)
  const e = profileA.filter((p) => p.hour >= 18 && p.hour <= 21)
  if (!m.length || !e.length) return null
  const avg = (d: typeof m, f: keyof HourPoint) => d.reduce((s, p) => s + (p[f] as number), 0) / d.length
  return { residuallastDiff: avg(e, 'residuallast') - avg(m, 'residuallast'), priceDiff: avg(e, 'price') - avg(m, 'price'), co2Diff: avg(e, 'co2') - avg(m, 'co2') }
})

// ----------------------------------------------------------------
// D3-Rendering (Small Multiples)
// ----------------------------------------------------------------
watchEffect(() => {
  const { profileA, profileB } = profiles.value
  if (!profileA.length || !svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg.attr('width', TOTAL_W).attr('height', TOTAL_H)
    .attr('viewBox', `0 0 ${TOTAL_W} ${TOTAL_H}`)
    .attr('aria-label', 'Duck Curve Analyse: PV, Residuallast, Preis und CO₂ im Tagesverlauf')

  // Gemeinsame X-Skala
  const xScale = d3.scaleLinear().domain([0, 23]).range([0, INNER_W])

  // Y-Skalen pro Metrik
  const allPV = [...profileA.map((p) => p.pv), ...profileB.map((p) => p.pv)]
  const allRL = [...profileA.map((p) => p.residuallast), ...profileB.map((p) => p.residuallast)]
  const allPrice = [...profileA.map((p) => p.price), ...profileB.map((p) => p.price)]
  const allCO2 = [...profileA.map((p) => p.co2), ...profileB.map((p) => p.co2)]
  const scale = (vals: number[]) => { const lo = Math.min(0, d3.min(vals) ?? 0); const hi = d3.max(vals) ?? 1; const p = (hi - lo) * 0.08 || 1; return d3.scaleLinear().domain([lo - p, hi + p]).range([INNER_H, 0]) }
  const yPV = scale(allPV); const yRL = scale(allRL); const yPrice = scale(allPrice); const yCO2 = scale(allCO2)
  const hl = activeHighlight.value

  // Panel-Definitionen
  const panels = [
    { id: 'pv-rl', y: MARGIN.top, label: 'PV-Erzeugung und Residuallast', unit: 'GW',
      lines: [
        { key: 'pv', data: profileA, color: '#10b981', label: 'PV', curve: d3.curveCatmullRom },
        { key: 'residuallast', data: profileA, color: '#1a1a1a', label: 'Residuallast', curve: d3.curveCatmullRom },
        ...(profileB.length ? [
          { key: 'pv', data: profileB, color: '#10b981', label: `${currentPreset.value.groupA} PV`, curve: d3.curveCatmullRom, dashed: true },
          { key: 'residuallast', data: profileB, color: '#1a1a1a', label: `${currentPreset.value.groupA} RL`, curve: d3.curveCatmullRom, dashed: true },
        ] : []),
      ],
      yFn: (v: number, k: string) => k === 'residuallast' ? yRL(v) : yPV(v),
    },
    { id: 'price', y: MARGIN.top + (PANEL_H + GAP), label: 'Day-Ahead-Preis', unit: 'EUR/MWh',
      lines: [
        { key: 'price', data: profileA, color: '#2563eb', label: 'Preis', curve: d3.curveStepAfter },
        ...(profileB.length ? [{ key: 'price', data: profileB, color: '#2563eb', label: `${currentPreset.value.groupA} Preis`, curve: d3.curveStepAfter, dashed: true }] : []),
      ],
      yFn: (v: number) => yPrice(v),
    },
    { id: 'co2', y: MARGIN.top + 2 * (PANEL_H + GAP), label: 'CO₂-Intensität', unit: 'g CO₂/kWh',
      lines: [
        { key: 'co2', data: profileA, color: '#dc2626', label: 'CO₂', curve: d3.curveMonotoneX },
        ...(profileB.length ? [{ key: 'co2', data: profileB, color: '#dc2626', label: `${currentPreset.value.groupA} CO₂`, curve: d3.curveMonotoneX, dashed: true }] : []),
      ],
      yFn: (v: number) => yCO2(v),
    },
  ]

  for (const panel of panels) {
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${panel.y})`)
    if (hl) {
      g.append('rect').attr('x', xScale(hl[0])).attr('y', 0)
        .attr('width', xScale(hl[1]) - xScale(hl[0])).attr('height', INNER_H)
        .attr('fill', currentStep.value.key === 'ramp' ? '#fef3c7' : '#e0f2fe').attr('opacity', 0.45)
    }
    for (const line of panel.lines) {
      const yF = (d: HourPoint) => panel.yFn(d[line.key as keyof HourPoint] as number, line.key)
      const gen = d3.line<HourPoint>().x((d) => xScale(d.hour)).y(yF).curve(line.curve)
      g.append('path').datum(line.data).attr('d', gen).attr('fill', 'none')
        .attr('stroke', line.color).attr('stroke-width', currentStep.value.emphasisMetric === line.key ? 3 : 2)
        .attr('opacity', currentStep.value.emphasisMetric === line.key ? 1 : 0.7)
        .attr('stroke-dasharray', line.dashed ? '6,4' : 'none')
    }
    // Y-Achse & Label
    const ys = panel.id === 'pv-rl' ? yRL : panel.id === 'price' ? yPrice : yCO2
    g.append('g').call(d3.axisLeft(ys).ticks(4)).attr('font-size', '9px').attr('color', '#6b7280')
    g.append('text').attr('x', 0).attr('y', -4).attr('font-size', '10px').attr('font-weight', '600')
      .attr('fill', '#374151').text(panel.label)
  }

  // X-Achse unterstem Panel
  const xY = MARGIN.top + 3 * (PANEL_H + GAP)
  svg.append('g').attr('transform', `translate(${MARGIN.left}, ${xY})`)
    .call(d3.axisBottom(xScale).ticks(12).tickFormat((d) => `${d}:00`))
    .attr('font-size', '10px').attr('color', '#6b7280')

  // Tooltip
  if (!tooltipDiv) {
    tooltipDiv = d3.select('body').append('div').attr('class', 'duck-tooltip')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#1a1a1a').style('color', '#fff')
      .style('padding', '8px 12px').style('border-radius', '6px')
      .style('font-size', '11px').style('pointer-events', 'none')
      .style('z-index', '1000').style('line-height', '1.6')
  }

  // Hover-Overlay
  for (let pi = 0; pi < 3; pi++) {
    const p = panels[pi]
    svg.append('rect').attr('x', MARGIN.left).attr('y', p.y)
      .attr('width', INNER_W).attr('height', INNER_H)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', function (e: MouseEvent) {
        const [mx] = d3.pointer(e, svgRef.value!)
        const hour = Math.round(xScale.invert(mx - MARGIN.left))
        const cl = Math.max(0, Math.min(23, hour))
        const gv = (p: HourPoint[], k: keyof HourPoint, d: number) => { const x = p.find((h) => h.hour === cl); return x ? (x[k] as number).toFixed(d) : '–' }
        tooltipDiv!.style('display', 'block').html(
          `<strong>${String(cl).padStart(2, '0')}:00</strong><br/>` +
          `<span style="color:#10b981">●</span> PV: ${gv(profileA, 'pv', 1)} GW<br/>` +
          `<span style="color:#1a1a1a">●</span> RL: ${gv(profileA, 'residuallast', 1)} GW<br/>` +
          `<span style="color:#2563eb">●</span> Preis: ${gv(profileA, 'price', 1)} EUR/MWh<br/>` +
          `<span style="color:#dc2626">●</span> CO₂: ${gv(profileA, 'co2', 0)} g/kWh`
        ).style('left', `${Math.min(e.clientX + 14, window.innerWidth - 240)}px`)
         .style('top', `${Math.max(8, e.clientY - 20)}px`)
      })
      .on('mouseleave', () => { tooltipDiv!.style('display', 'none') })
      .on('click', function (e: MouseEvent) {
        const [mx] = d3.pointer(e, svgRef.value!)
        const hour = Math.round(xScale.invert(mx - MARGIN.left))
        const cl = Math.max(0, Math.min(23, hour))
        setHighlight([Math.max(0, cl - 2), Math.min(23, cl + 2)], true)
      })
  }
})
</script>

<template>
  <div class="duck-card">
    <!-- Header -->
    <div class="duck-header">
      <div class="duck-title">
        <span class="duck-number">4</span>
        <span class="duck-heading">Interaktive Duck-Curve-Analyse</span>
      </div>
    </div>
    <p class="duck-subtitle">
      Die Tagesprofile zeigen, wie Photovoltaik die Residuallast senkt,
      wie der Strommarkt darauf reagiert und wann sich die CO₂-Intensität verändert.
    </p>

    <!-- Story-Navigator -->
    <div class="story-nav">
      <div class="story-tabs">
        <button
          v-for="(step, i) in STORY_STEPS" :key="step.key"
          class="story-tab"
          :class="{ active: storyStep === i }"
          @click="storyStep = i; returnToStory()"
        >{{ step.tab }}</button>
      </div>
      <div class="story-buttons">
        <button class="story-btn" :disabled="storyStep === 0" @click="storyStep--">Zurück</button>
        <button class="story-btn" :disabled="storyStep === STORY_STEPS.length - 1" @click="storyStep++">Weiter</button>
      </div>
    </div>

    <!-- Vergleichs-Modus -->
    <div class="preset-row">
      <span class="preset-label">Vergleich:</span>
      <select v-model="activePreset" class="preset-select" :disabled="mode === 'concrete'">
        <option v-for="p in PRESETS" :key="p.key" :value="p.key">{{ p.label }}</option>
      </select>
      <div class="mode-toggle">
        <button class="mode-btn" :class="{ active: mode === 'average' }" @click="mode = 'average'">Durchschnitt</button>
        <button class="mode-btn" :class="{ active: mode === 'concrete' }" @click="mode = 'concrete'" :disabled="!selectedDay">Konkreter Tag</button>
      </div>
    </div>

    <!-- Small Multiples Chart -->
    <div class="duck-chart-wrap">
      <svg ref="svgRef" class="duck-svg"></svg>
    </div>

    <!-- Analyse-Box -->
    <div v-if="analysis" class="analysis-box">
      <div class="analysis-header">
        <strong>{{ isUserSelection ? 'Ausgewählter Zeitraum' : currentStep.title }}</strong>
        <span class="analysis-range">{{ analysis.range }} ({{ analysis.hours }} h)</span>
        <button v-if="isUserSelection" class="back-to-story-btn" @click="returnToStory">Zur Story zurückkehren</button>
      </div>
      <div class="analysis-grid">
        <div class="analysis-item"><span class="a-label">Ø PV</span><span class="a-value">{{ analysis.pv.toFixed(1) }} GW</span></div>
        <div class="analysis-item"><span class="a-label">Ø Residuallast</span><span class="a-value">{{ analysis.residuallast.toFixed(1) }} GW</span></div>
        <div class="analysis-item"><span class="a-label">Ø Preis</span><span class="a-value">{{ analysis.price.toFixed(1) }} EUR/MWh</span></div>
        <div class="analysis-item"><span class="a-label">Ø CO₂</span><span class="a-value">{{ analysis.co2.toFixed(0) }} g/kWh</span></div>
      </div>
    </div>

    <!-- Vergleich Mittag vs Abend (bei Schritt 5) -->
    <div v-if="comparison" class="comparison-box">
      <strong>Vergleich Mittag (11–15 Uhr) vs Abend (18–21 Uhr)</strong>
      <div class="comparison-grid">
        <div class="comp-item">
          <span class="comp-label">Residuallast</span>
          <span class="comp-value" :class="comparison.residuallastDiff > 0 ? 'up' : 'down'">
            {{ comparison.residuallastDiff > 0 ? '+' : '' }}{{ comparison.residuallastDiff.toFixed(1) }} GW am Abend
          </span>
        </div>
        <div class="comp-item">
          <span class="comp-label">Day-Ahead-Preis</span>
          <span class="comp-value" :class="comparison.priceDiff > 0 ? 'up' : 'down'">
            {{ comparison.priceDiff > 0 ? '+' : '' }}{{ comparison.priceDiff.toFixed(1) }} EUR/MWh am Abend
          </span>
        </div>
        <div class="comp-item">
          <span class="comp-label">CO₂-Intensität</span>
          <span class="comp-value" :class="comparison.co2Diff > 0 ? 'up' : 'down'">
            {{ comparison.co2Diff > 0 ? '+' : '' }}{{ comparison.co2Diff.toFixed(1) }} g/kWh am Abend
          </span>
        </div>
      </div>
    </div>

    <!-- Erklärungstext -->
    <div class="story-explanation">
      <p class="explanation-text">{{ currentStep.explanation }}</p>
      <p class="scientific-note">{{ currentStep.scientificNote }}</p>
    </div>

    <!-- Konkreter-Tag-Hinweis -->
    <p v-if="mode === 'concrete' && selectedDay" class="duck-day-hint">
      Zeige Tag: <strong>{{ selectedDay }}</strong>
    </p>

    <!-- Methodische Hinweise -->
    <details class="method-notes">
      <summary>Methodische Hinweise</summary>
      <ul>
        <li>Durchschnittsprofile glätten Extremereignisse.</li>
        <li>Konkrete Tage können Extremfälle zeigen, sind aber nicht repräsentativ.</li>
        <li>Preise sind Marktindikatoren, keine direkten Klimabilanz-Indikatoren.</li>
        <li>CO₂-Intensität hängt vom gesamten Strommix ab, nicht nur von PV.</li>
      </ul>
    </details>
  </div>
</template>
<style scoped>
.duck-card {
  width: 100%;
}

.duck-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.duck-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.duck-number {
  font-family: var(--font-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-muted);
  opacity: 0.5;
}

.duck-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg);
}

.duck-subtitle {
  font-size: 0.8rem;
  color: var(--fg-muted);
  margin: 4px 0 14px;
  line-height: 1.4;
}

/* Story-Navigator */
.story-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.story-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.story-tab {
  font-family: var(--font);
  font-size: 0.72rem;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.story-tab:hover { border-color: var(--accent); color: var(--fg); }
.story-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 500; }

.story-buttons { display: flex; gap: 6px; }

.story-btn {
  font-family: var(--font);
  font-size: 0.75rem;
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--fg);
  cursor: pointer;
  transition: all 0.15s;
}

.story-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.story-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Vergleichs-Modus */
.preset-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 0.7rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.preset-select {
  font-family: var(--font);
  font-size: 0.78rem;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--fg);
  cursor: pointer;
}

.mode-toggle {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
  margin-left: auto;
}

.mode-btn {
  font-family: var(--font);
  font-size: 0.72rem;
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn.active { background: var(--accent); color: #fff; font-weight: 500; }
.mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Charts */
.duck-chart-wrap {
  width: 100%;
  overflow-x: auto;
  min-width: 0;
}

.duck-svg {
  display: block;
  min-width: 600px;
}

@media (min-width: 1000px) {
  .duck-svg { width: 100%; height: auto; }
}

/* Analyse-Box */
.analysis-box {
  margin-top: 14px;
  padding: 14px 16px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 0.85rem;
  color: var(--fg);
}

.analysis-range { font-size: 0.75rem; color: var(--fg-muted); }

.back-to-story-btn {
  font-family: var(--font);
  font-size: 0.7rem;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--accent);
  cursor: pointer;
  margin-left: auto;
}

.back-to-story-btn:hover { background: #f0fdf4; }

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.analysis-item { display: flex; flex-direction: column; gap: 2px; }

.a-label {
  font-size: 0.65rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.a-value { font-size: 1rem; font-weight: 700; color: var(--fg); }

/* Vergleich Mittag vs Abend */
.comparison-box {
  margin-top: 12px;
  padding: 14px 16px;
  background: #fffbeb;
  border-radius: 10px;
  border: 1px solid #fde68a;
  font-size: 0.85rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.comp-item { display: flex; flex-direction: column; gap: 2px; }
.comp-label { font-size: 0.7rem; color: var(--fg-muted); }
.comp-value { font-size: 0.85rem; font-weight: 600; }
.comp-value.up { color: #dc2626; }
.comp-value.down { color: var(--accent); }

/* Erklärungstext */
.story-explanation {
  margin-top: 14px;
  padding: 14px 16px;
  background: #f0f9ff;
  border-radius: 10px;
  border: 1px solid #bae6fd;
  line-height: 1.6;
}

.explanation-text {
  font-size: 0.85rem;
  color: var(--fg);
  margin: 0 0 6px;
}

.scientific-note {
  font-size: 0.78rem;
  color: var(--fg-muted);
  font-style: italic;
  margin: 0;
}

.duck-day-hint {
  margin-top: 10px;
  font-size: 0.75rem;
  color: var(--fg-muted);
}

/* Methodische Hinweise */
.method-notes {
  margin-top: 14px;
  font-size: 0.75rem;
  color: var(--fg-muted);
  line-height: 1.6;
}

.method-notes summary { cursor: pointer; font-weight: 500; }
.method-notes ul { margin: 6px 0 0; padding-left: 18px; }
.method-notes li { margin-bottom: 4px; }
</style>
