<script setup lang="ts">
/**
 * components/viz/DuckCurve.vue
 * ============================
 * Interaktiver Zeitregler: Ein durchschnittlicher Tag im deutschen Strommarkt.
 */

import { ref, computed, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{ data: HourlyRow[]; selectedDay?: string }>()

type ProfileMode = 'durchschnitt' | 'sommer' | 'winter' | 'werktag' | 'wochenende' | 'jahr2015' | 'jahr2024'
const profileMode = ref<ProfileMode>('durchschnitt')

interface HourPoint { hour: number; pv: number; residuallast: number; price: number; co2: number }

function inSummer(d: Date): boolean { const m = d.getUTCMonth(); return m >= 4 && m <= 8 }
function inWinter(d: Date): boolean { const m = d.getUTCMonth(); return m <= 1 || m >= 10 }
function isWeekend(d: Date): boolean { return d.getUTCDay() === 0 || d.getUTCDay() === 6 }

function residuallastGW(row: HourlyRow): number {
  const g = row.generation_by_source
  const ee = (g.wind_onshore ?? 0) + (g.wind_offshore ?? 0) + (g.pv ?? 0) + (g.biomass ?? 0) + (g.hydro ?? 0) + (g.other_renewables ?? 0)
  return (row.load_mwh - ee) / 1000
}
function pvGW(row: HourlyRow): number { return (row.generation_by_source.pv ?? 0) / 1000 }

function diffStr(diff: number | null, unit: string): string {
  if (diff === null) return ''
  const sign = diff >= 0 ? '+' : ''
  const cls = diff >= 0 ? 'diff-pos' : 'diff-neg'
  return `<span class="${cls}">${sign}${diff.toFixed(1).replace('.', ',')} ${unit}</span>`
}

function computeProfile(rows: HourlyRow[], mode: ProfileMode): HourPoint[] {
  // 1. Zeilen nach Modus filtern
  let filtered = rows
  if (mode === 'sommer') filtered = rows.filter((r) => inSummer(new Date(r.timestamp)))
  else if (mode === 'winter') filtered = rows.filter((r) => inWinter(new Date(r.timestamp)))
  else if (mode === 'werktag') filtered = rows.filter((r) => !isWeekend(new Date(r.timestamp)))
  else if (mode === 'wochenende') filtered = rows.filter((r) => isWeekend(new Date(r.timestamp)))
  else if (mode === 'jahr2015') filtered = rows.filter((r) => new Date(r.timestamp).getUTCFullYear() === 2015)
  else if (mode === 'jahr2024') filtered = rows.filter((r) => new Date(r.timestamp).getUTCFullYear() === 2024)

  // 2. Stundenweise Buckets anlegen (0–23)
  const buckets: Array<{ hour: number; pv: number[]; residuallast: number[]; price: number[]; co2: number[] }> =
    Array.from({ length: 24 }, (_, hour) => ({ hour, pv: [], residuallast: [], price: [], co2: [] }))

  // 3. Werte in die passenden Buckets sortieren
  for (const row of filtered) {
    const hour = new Date(row.timestamp).getUTCHours()
    buckets[hour].pv.push(pvGW(row))
    buckets[hour].residuallast.push(residuallastGW(row))
    buckets[hour].price.push(row.price_eur_mwh)
    buckets[hour].co2.push(row.co2_g_per_kwh)
  }

  // 4. Pro Bucket den Durchschnitt berechnen
  return buckets.map((bucket) => ({
    hour: bucket.hour,
    pv: bucket.pv.length ? bucket.pv.reduce((a, v) => a + v, 0) / bucket.pv.length : 0,
    residuallast: bucket.residuallast.length ? bucket.residuallast.reduce((a, v) => a + v, 0) / bucket.residuallast.length : 0,
    price: bucket.price.length ? bucket.price.reduce((a, v) => a + v, 0) / bucket.price.length : 0,
    co2: bucket.co2.length ? bucket.co2.reduce((a, v) => a + v, 0) / bucket.co2.length : 0,
  }))
}

const currentHour = ref(13)
const rangeStart = ref(7)
const rangeEnd = ref(16)
const compareTimeEnabled = ref(false)

// Welcher Zeitpunkt gerade aktiv ist — A (Ausgang) oder B (Vergleich)
const activeTimepoint = ref<'A' | 'B'>('A')

function onSliderAInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  rangeStart.value = Math.min(v, 23)
  activeTimepoint.value = 'A'
}
function onSliderBInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  rangeEnd.value = Math.max(v, 0)
  activeTimepoint.value = 'B'
}
const profile = ref<HourPoint[]>([])
const current = computed(() => profile.value[currentHour.value] || profile.value[0])
const rangeStartPoint = computed(() => profile.value[rangeStart.value] || profile.value[0])
const rangeEndPoint = computed(() => profile.value[rangeEnd.value] || profile.value[0])
const sparkRefs = ref<(SVGSVGElement | null)[]>([])
function setSparkRef(i: number) { return (el: SVGSVGElement | null) => { sparkRefs.value[i] = el } }

watch(() => props.data, (rows) => { if (rows.length) profile.value = computeProfile(rows, profileMode.value) }, { immediate: true })
watch(profileMode, () => { if (props.data.length) profile.value = computeProfile(props.data, profileMode.value) })

function dayContext(v: number, mx: number, mn: number, av: number): string {
  const range = mx - mn
  if (range === 0) return `Ø ${av.toFixed(1).replace('.', ',')}`
  const third = range / 3
  let pos: string
  if (v >= mx - third) pos = 'nahe Tages-Max'
  else if (v <= mn + third) pos = 'nahe Tages-Min'
  else pos = 'mittlerer Tagesbereich'
  return `${pos} (Ø ${av.toFixed(1).replace('.', ',')})`
}

// Karten
const cards = computed(() => {
  const p = profile.value; if (!p.length) return []
  const h = compareTimeEnabled.value ? rangeStartPoint.value : current.value
  const hEnd = compareTimeEnabled.value ? rangeEndPoint.value : current.value
  const allPv = p.map((x) => x.pv); const allRl = p.map((x) => x.residuallast); const allPrice = p.map((x) => x.price); const allCo2 = p.map((x) => x.co2)
  const maxPv = Math.max(...allPv); const minPv = Math.min(...allPv); const avgPv = allPv.reduce((a, v) => a + v, 0) / allPv.length
  const maxRl = Math.max(...allRl); const minRl = Math.min(...allRl); const avgRl = allRl.reduce((a, v) => a + v, 0) / allRl.length
  const maxPrice = Math.max(...allPrice); const minPrice = Math.min(...allPrice); const avgPrice = allPrice.reduce((a, v) => a + v, 0) / allPrice.length
  const maxCo2 = Math.max(...allCo2); const minCo2 = Math.min(...allCo2); const avgCo2 = allCo2.reduce((a, v) => a + v, 0) / allCo2.length

  return [
    { key: 'pv', label: 'PV-Erzeugung', unit: 'GW', color: '#E8B547',
      value: h.pv.toFixed(1), valueEnd: hEnd.pv.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.pv - h.pv : null,
      spark: allPv,
      context: dayContext(h.pv, maxPv, minPv, avgPv) },
    { key: 'residuallast', label: 'Residuallast', unit: 'GW', color: '#3A3A3A',
      value: h.residuallast.toFixed(1), valueEnd: hEnd.residuallast.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.residuallast - h.residuallast : null,
      spark: allRl,
      context: dayContext(h.residuallast, maxRl, minRl, avgRl) },
    { key: 'price', label: 'Day-Ahead-Preis', unit: 'EUR/MWh', color: 'var(--accent)',
      value: h.price.toFixed(1), valueEnd: hEnd.price.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.price - h.price : null,
      spark: allPrice,
      context: dayContext(h.price, maxPrice, minPrice, avgPrice) },
    { key: 'co2', label: 'CO₂-Intensität', unit: 'g/kWh', color: '#6B4423',
      value: h.co2.toFixed(0), valueEnd: hEnd.co2.toFixed(0),
      diff: compareTimeEnabled.value ? hEnd.co2 - h.co2 : null,
      spark: allCo2,
      context: dayContext(h.co2, maxCo2, minCo2, avgCo2) },
  ]
})

// Sparklines (mit nextTick, damit SVG-Refs existieren)
watch(() => profile.value, () => {
  nextTick(() => { drawSparklines() })
}, { deep: true })
watch(currentHour, () => { nextTick(() => { drawSparklines() }) })
watch(rangeStart, () => { nextTick(() => { drawSparklines() }) })
watch(rangeEnd, () => { nextTick(() => { drawSparklines() }) })

function drawSparklines() {
  const profile = profile.value; if (!profile.length) return
  const currentH = currentHour.value; const startH = rangeStart.value; const endH = rangeEnd.value
  const keys: (keyof HourPoint)[] = ['pv', 'residuallast', 'price', 'co2']

  for (let i = 0; i < 4; i++) {
    drawSingleSparkline(i, keys[i], profile, currentH, startH, endH)
  }
}

function drawSingleSparkline(
  index: number, key: keyof HourPoint,
  profile: HourPoint[], currentH: number, startH: number, endH: number
) {
  const svg = sparkRefs.value[index]; if (!svg) return
  const data = profile.map((p) => p[key] as number)
  const width = 280; const height = 40; const padLeft = 28

  const xScale = d3.scaleLinear().domain([0, 23]).range([padLeft + 2, width - 2])
  const yMin = d3.min(data) ?? 0; const yMax = d3.max(data) ?? 1; const yPad = (yMax - yMin) * 0.08 || 0.1
  const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([height - 2, 2])
  const lineGen = d3.line<number>().x((_d, j) => xScale(j)).y((d) => yScale(d)).curve(d3.curveMonotoneX)

  const sel = d3.select(svg); sel.selectAll('*').remove(); sel.attr('viewBox', `0 0 ${width} ${height}`)
  const cardColor = cards.value[index]?.color || 'var(--accent)'

  sel.append('path').datum(data).attr('d', lineGen as any)
    .attr('fill', 'none').attr('stroke', cardColor).attr('stroke-width', 1.5).attr('opacity', 0.5)

  if (compareTimeEnabled.value) {
    // Vergleichs-Modus: zwei Marker
    const startG = sel.append('g').attr('class', 'marker-start')
    startG.append('line').attr('x1', xScale(startH)).attr('y1', 1).attr('x2', xScale(startH)).attr('y2', height - 1)
      .attr('stroke', cardColor).attr('stroke-width', 1.5).attr('opacity', 1)
    startG.append('circle').attr('cx', xScale(startH)).attr('cy', yScale(data[startH] || 0))
      .attr('r', 3).attr('fill', cardColor).attr('stroke', 'none')

    const endG = sel.append('g').attr('class', 'marker-end')
    endG.append('line').attr('x1', xScale(endH)).attr('y1', 1).attr('x2', xScale(endH)).attr('y2', height - 1)
      .attr('stroke', cardColor).attr('stroke-width', 1).attr('opacity', 0.6).attr('stroke-dasharray', '2,2')
    endG.append('circle').attr('cx', xScale(endH)).attr('cy', yScale(data[endH] || 0))
      .attr('r', 3).attr('fill', 'none').attr('stroke', cardColor).attr('stroke-width', 1.5).attr('opacity', 0.7)
  } else {
    // Einzel-Modus: eine Markierung
    const markerG = sel.append('g').attr('class', 'marker-group')
    markerG.append('line').attr('x1', xScale(currentH)).attr('y1', 1).attr('x2', xScale(currentH)).attr('y2', height - 1)
      .attr('stroke', cardColor).attr('stroke-width', 1.5).attr('opacity', 1)
    markerG.append('circle').attr('cx', xScale(currentH)).attr('cy', yScale(data[currentH] || 0))
      .attr('r', 3).attr('fill', cardColor).attr('stroke', 'none')
  }
}




const presets = [
  { hour: 3, label: '03 Uhr Nacht' }, { hour: 8, label: '08 Uhr Morgen' },
  { hour: 13, label: '13 Uhr PV-Peak' }, { hour: 18, label: '18 Uhr Abendrampe' }, { hour: 22, label: '22 Uhr Abend' },
]
// Prüft für eine Preset-Stunde, ob A, B, beide oder keiner aktiv ist
function presetMarkerState(prHour: number): 'A' | 'B' | 'both' | 'none' {
  if (!compareTimeEnabled.value) {
    return currentHour.value === prHour ? 'A' : 'none'
  }
  const aMatch = rangeStart.value === prHour
  const bMatch = rangeEnd.value === prHour
  if (aMatch && bMatch) return 'both'
  if (aMatch) return 'A'
  if (bMatch) return 'B'
  return 'none'
}
function goToHour(h: number) {
  if (compareTimeEnabled.value) {
    if (activeTimepoint.value === 'A') rangeStart.value = Math.max(0, Math.min(23, h))
    else rangeEnd.value = Math.max(0, Math.min(23, h))
  } else {
    currentHour.value = Math.max(0, Math.min(23, h))
  }
}

const modeLabels: Record<ProfileMode, string> = { durchschnitt: 'Durchschnitt', sommer: 'Sommer', winter: 'Winter', werktag: 'Werktag', wochenende: 'Wochenende', jahr2015: '2015', jahr2024: '2024' }
</script>

<template>
  <div class="duck-section">
    <div class="duck-header">
      <h3 class="duck-heading">Der Tag in Zahlen</h3>
    </div>
    <p class="duck-subtitle">Bewege den Regler durch den Tag und sieh, wie sich Erzeugung, Preis und CO₂-Intensität stündlich verändern. Basierend auf Durchschnittswerten aus SMARD und ENTSO-E.</p>

    <div class="mode-bar">
      <span class="mode-label">Modus:</span>
      <div class="segment-group">
        <button v-for="(label, key) in modeLabels" :key="key" class="segment-btn" :class="{ active: profileMode === key }" @click="profileMode = key as ProfileMode">{{ label }}</button>
      </div>
      <div class="compare-time-toggle">
        <span class="compare-time-label">Zeitraum-Vergleich</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="compareTimeEnabled" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="kpi-row">
      <div v-for="(card, ci) in cards" :key="card.key" class="card-cell" :class="{ 'has-divider': ci < 3 }">
        <div class="card-eyebrow">{{ card.label }}</div>
        <div class="card-value-row"><span class="card-dot" :style="{ background: card.color }"></span><span class="card-value">{{ card.value }}</span><span class="card-unit">{{ card.unit }}</span></div>
        <div v-if="compareTimeEnabled" class="card-value-row card-value-row-b"><span class="card-dot card-dot-b" :style="{ borderColor: card.color }"></span><span class="card-value card-value-b">{{ card.valueEnd }}</span><span class="card-unit">{{ card.unit }}</span></div>
        <div v-if="compareTimeEnabled && card.diff !== null" class="card-diff" v-html="diffStr(card.diff, card.unit)"></div>
        <div class="card-context">{{ card.context }}</div>
        <svg :ref="setSparkRef(ci)" class="card-spark"></svg>
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- Vergleichsbereich (nur sichtbar wenn compareTimeEnabled) -->
    <div v-if="compareTimeEnabled" class="comparison-section">
      <div class="comparison-eyebrow">ZEITVERGLEICH</div>

      <div class="comparison-summary">
        <span class="cs-range">{{ String(rangeStart).padStart(2, '0') }}:00 → {{ String(rangeEnd).padStart(2, '0') }}:00</span>
        <span class="cs-diff">{{ Math.abs(rangeEnd - rangeStart) }} Stunden Abstand</span>
      </div>

      <!-- Timeline A -->
      <div class="timeline-row">
        <span class="timeline-label-tag">A</span>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-eyebrow">AUSGANGSZEITPUNKT</span>
            <span class="timeline-time">{{ String(rangeStart).padStart(2, '0') }}:00</span>
          </div>
          <input type="range" class="timeline-slider timeline-slider-a" min="0" max="23" step="1" :value="rangeStart" @input="onSliderAInput($event)" />
        </div>
      </div>

      <!-- Timeline B -->
      <div class="timeline-row">
        <span class="timeline-label-tag timeline-label-tag-b">B</span>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-eyebrow">VERGLEICHSZEITPUNKT</span>
            <span class="timeline-time timeline-time-b">{{ String(rangeEnd).padStart(2, '0') }}:00</span>
          </div>
          <input type="range" class="timeline-slider timeline-slider-b" min="0" max="23" step="1" :value="rangeEnd" @input="onSliderBInput($event)" />
        </div>
      </div>

      <!-- Stundenachse (einmal unter beiden) -->
      <div class="timeline-axis-labels">
        <span v-for="h in [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]" :key="h" class="tl-label">{{ String(h).padStart(2, '0') }}</span>
      </div>

      <!-- A/B Auswahl -->
      <div class="ab-selector">
        <span class="ab-selector-label">ZEITPUNKT ÄNDERN:</span>
        <span class="ab-option" :class="{ active: activeTimepoint === 'A' }" @click="activeTimepoint = 'A'">A</span>
        <span class="ab-sep">/</span>
        <span class="ab-option" :class="{ active: activeTimepoint === 'B' }" @click="activeTimepoint = 'B'">B</span>
      </div>

      <!-- Schnellwahl -->
      <div class="quick-pick">
        <button v-for="pr in presets" :key="pr.hour" class="qp-btn"
          :class="{
            'qp-active-a': presetMarkerState(pr.hour) === 'A',
            'qp-active-b': presetMarkerState(pr.hour) === 'B',
            'qp-active-both': presetMarkerState(pr.hour) === 'both'
          }"
          @click="goToHour(pr.hour)">
          <span class="qp-dot"
            :class="{
              'qp-dot-a': presetMarkerState(pr.hour) === 'A',
              'qp-dot-b': presetMarkerState(pr.hour) === 'B',
              'qp-dot-both': presetMarkerState(pr.hour) === 'both'
            }"></span>
          {{ pr.label }}
        </button>
      </div>
    </div>

    <!-- Einzel-Modus: einfacher Slider -->
    <div v-else class="single-slider-section">
      <div class="time-display"><span class="time-bullet">●</span> {{ String(currentHour).padStart(2, '0') }}:00 <span class="time-bullet">●</span></div>
      <input type="range" class="time-slider" min="0" max="23" step="1" :value="currentHour" @input="currentHour = Number(($event.target as HTMLInputElement).value)" />
      <div class="tick-labels"><span v-for="h in [0, 4, 8, 12, 16, 20]" :key="h">{{ String(h).padStart(2, '0') }}</span></div>
      <div class="preset-row">
        <button v-for="pr in presets" :key="pr.hour" class="preset-btn" :class="{ active: currentHour === pr.hour }" @click="goToHour(pr.hour)">
          <span class="preset-marker" :class="{ active: currentHour === pr.hour }"></span>{{ pr.label }}
        </button>
      </div>
    </div>

    <!-- Abstand + Trennlinie vor Methodik -->
    <div class="methodik-gap"></div>
    <div class="methodik-rule"></div>

    <!-- Methodik-Bereich (immer sichtbar) -->
    <div class="methodik-section">
      <div class="methodik-eyebrow">METHODIK &amp; DATENQUELLEN</div>
      <h4 class="methodik-heading">Wie die Werte berechnet wurden</h4>

      <div class="methodik-block">
        <div class="methodik-block-kicker">PV-ERZEUGUNG</div>
        <div class="methodik-body">
          <p><strong>Datenquelle:</strong> SMARD — realisierte Erzeugung, Energieträger „Photovoltaik"</p>
          <p><strong>Auflösung:</strong> stündlich, Deutschland (Regelzone gesamt)</p>
          <p><strong>Berechnung:</strong> arithmetisches Mittel aller Stunden desselben Uhrzeit-Slots im gewählten Zeitraum. Beispiel: der Wert für 13:00 im Modus „Sommer" ist der Durchschnitt aller 13:00-Werte an Sommertagen (Juni–August) 2024.</p>
        </div>
      </div>

      <div class="methodik-block">
        <div class="methodik-block-kicker">RESIDUALLAST</div>
        <div class="methodik-body">
          <p><strong>Datenquelle:</strong> berechnet aus SMARD-Werten: realisierte Netzlast minus Wind Onshore minus Wind Offshore minus Photovoltaik minus Wasserkraft minus Biomasse</p>
          <p><strong>Auflösung:</strong> stündlich, Deutschland</p>
          <p><strong>Berechnung:</strong> arithmetisches Mittel aller Stunden desselben Uhrzeit-Slots im gewählten Zeitraum. Sie zeigt den Bedarf, der nach Einspeisung aller volatilen und erneuerbaren Quellen aus konventionellen Kraftwerken gedeckt werden muss.</p>
        </div>
      </div>

      <div class="methodik-block">
        <div class="methodik-block-kicker">DAY-AHEAD-PREIS</div>
        <div class="methodik-body">
          <p><strong>Datenquelle:</strong> ENTSO-E Transparency Platform — Day-Ahead-Auktion, Marktgebiet Deutschland-Luxemburg (DE-LU ab Oktober 2018, davor DE-AT-LU)</p>
          <p><strong>Auflösung:</strong> stündliche Preise in EUR/MWh</p>
          <p><strong>Berechnung:</strong> arithmetisches Mittel aller Stunden desselben Uhrzeit-Slots im gewählten Zeitraum. Negative Preise werden mit ihrem tatsächlichen negativen Wert einbezogen, nicht bei null abgeschnitten.</p>
        </div>
      </div>

      <div class="methodik-block">
        <div class="methodik-block-kicker">CO₂-INTENSITÄT</div>
        <div class="methodik-body">
          <p><strong>Datenquelle:</strong> berechnet aus SMARD-Erzeugungswerten und UBA-Emissionsfaktoren pro Energieträger (Braunkohle, Steinkohle, Erdgas, Kernkraft, Erneuerbare)</p>
          <p><strong>Auflösung:</strong> stündlich</p>
          <p><strong>Berechnung:</strong> für jede Stunde: Summe aus (Erzeugung Träger × Emissionsfaktor Träger) geteilt durch Gesamterzeugung. Diese Stundenwerte werden für den Zeitregler pro Uhrzeit-Slot gemittelt.</p>
        </div>
      </div>

      <div class="methodik-block">
        <div class="methodik-block-kicker">ZEITRAUM-VERGLEICH</div>
        <div class="methodik-body">
          <p>Mit dem Schalter „Zeitraum-Vergleich" aktivierst du zwei Regler-Griffe: einen Start- und einen Endzeitpunkt. Die Karten zeigen dann beide Werte sowie die Differenz (Ende − Start). Der Start-Griff ist gefüllt, der End-Griff als offener Kreis dargestellt.</p>
        </div>
      </div>

      <div class="methodik-block">
        <div class="methodik-block-kicker">AUSSAGEGRENZE</div>
        <div class="methodik-body">
          <p>Alle angezeigten Werte sind Durchschnitte über viele Tage. Einzelne Tage weichen deutlich ab. An sonnigen Sommertagen kann der PV-Peak über 30 GW liegen und der Preis mittags unter null fallen. An windarmen Wintertagen erreicht der Preis 200 EUR/MWh und mehr. Die Sektion zeigt typische Muster, keine Einzelfälle.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.duck-section { width:100%; }
.duck-header { margin-bottom:2px; }

.duck-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.duck-subtitle { font-family:var(--font-sans); font-size:15px; color:var(--fg-muted); max-width:720px; line-height:1.5; margin:8px 0 24px; }

/* ---- Modus-Bar + Vergleichs-Toggle ---- */
.mode-bar { display:flex; align-items:center; gap:12px; margin-bottom:28px; flex-wrap:wrap; }
.mode-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); flex-shrink:0; }
.segment-group { display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden; flex-wrap:wrap; }
.segment-btn { font-family:var(--font-sans); font-size:11px; font-weight:500; padding:4px 10px; border:none; background:transparent; color:var(--fg); cursor:pointer; transition:all .15s; border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
.segment-btn:last-child { border-right:none; }
.segment-btn:hover { background:var(--bg); }
.segment-btn.active { background:var(--accent); color:#fff; }
.compare-time-toggle { display:flex; align-items:center; gap:8px; margin-left:auto; }
.compare-time-label { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); white-space:nowrap; }
.toggle-switch { position:relative; display:inline-block; width:36px; height:20px; flex-shrink:0; }
.toggle-switch input { opacity:0; width:0; height:0; }
.toggle-slider { position:absolute; cursor:pointer; inset:0; background:var(--hairline); border-radius:20px; transition:background .2s; }
.toggle-slider::before { content:''; position:absolute; left:2px; bottom:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,0.15); }
.toggle-switch input:checked + .toggle-slider { background:var(--accent); }
.toggle-switch input:checked + .toggle-slider::before { transform:translateX(16px); }

/* ---- KPI-Karten ---- */
.kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
.card-cell { padding:16px 20px; display:flex; flex-direction:column; }
.card-cell.has-divider { border-right:1px solid var(--hairline); }
.card-eyebrow { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:10px; }
.card-value-row { display:flex; align-items:baseline; gap:6px; margin-bottom:4px; }
.card-value-row-b { margin-top:2px; }
.card-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.card-dot-b { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:transparent; border:1.5px solid; }
.card-value { font-family:var(--font-serif); font-size:32px; font-weight:500; color:var(--fg); line-height:1.1; }
.card-value-b { font-size:22px; color:var(--fg-muted); }
.card-unit { font-family:var(--font-sans); font-size:13px; color:var(--fg-muted); }
.card-diff { font-family:var(--font-sans); font-size:12px; font-weight:600; margin-bottom:4px; }
.diff-pos { color:var(--accent); }
.diff-neg { color:var(--fg-muted); }
.card-context { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); margin-bottom:8px; }
.card-spark { width:100%; height:40px; display:block; }

/* ---- Trennlinie zwischen Karten und Regler ---- */
.section-divider { height:1px; background:var(--hairline); margin:0 0 32px; }

/* ---- Vergleichsbereich (editorial, zwei Timelines) ---- */
.comparison-section { margin-bottom:40px; }
.comparison-eyebrow { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:8px; }

.comparison-summary { display:flex; align-items:baseline; gap:12px; margin-bottom:28px; }
.cs-range { font-family:var(--font-serif); font-size:26px; font-weight:500; color:var(--fg); }
.cs-diff { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); }

/* Einzelne Timeline-Zeile */
.timeline-row { display:flex; align-items:flex-start; gap:12px; margin-bottom:20px; }
.timeline-label-tag { font-family:var(--font-sans); font-size:11px; font-weight:600; color:var(--fg); width:16px; text-align:center; margin-top:2px; flex-shrink:0; }
.timeline-label-tag-b { color:var(--fg-muted); }

.timeline-content { flex:1; }
.timeline-header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
.timeline-eyebrow { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); }
.timeline-time { font-family:var(--font-serif); font-size:20px; font-weight:500; color:var(--fg); }
.timeline-time-b { color:var(--fg-muted); }

/* Slider-Stil — dünne Linie, präzise Marker */
.timeline-slider { width:100%; height:4px; -webkit-appearance:none; appearance:none; background:transparent; cursor:pointer; outline:none; margin:0; }
.timeline-slider::-webkit-slider-runnable-track { height:4px; background:var(--hairline); border-radius:2px; }
.timeline-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; margin-top:-6px; cursor:pointer; }
.timeline-slider::-moz-range-track { height:4px; background:var(--hairline); border-radius:2px; }
.timeline-slider::-moz-range-thumb { width:16px; height:16px; border-radius:50%; cursor:pointer; border:none; }

.timeline-slider-a::-webkit-slider-thumb { background:var(--fg); border:2px solid var(--bg); }
.timeline-slider-a::-moz-range-thumb { background:var(--fg); }
.timeline-slider-b::-webkit-slider-thumb { background:var(--bg); border:2px solid var(--fg-muted); }
.timeline-slider-b::-moz-range-thumb { background:var(--bg); border:2px solid var(--fg-muted); }

/* Stundenachse unter beiden Timelines */
.timeline-axis-labels { display:flex; justify-content:space-between; padding:0 2px; margin:4px 0 24px 28px; }
.tl-label { font-family:var(--font-sans); font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--fg-muted); opacity:0.6; }

/* A/B Selector — textbasiert, kein Toggle */
.ab-selector { display:flex; align-items:center; gap:4px; margin-bottom:20px; margin-left:28px; }
.ab-selector-label { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-right:8px; }
.ab-option { font-family:var(--font-sans); font-size:13px; font-weight:500; color:var(--fg-muted); cursor:pointer; padding:1px 0; border-bottom:1.5px solid transparent; transition:all .15s; }
.ab-option.active { color:var(--fg); border-bottom-color:var(--fg); }
.ab-option:hover { color:var(--fg); }
.ab-sep { font-family:var(--font-sans); font-size:13px; color:var(--fg-muted); opacity:0.4; margin:0 2px; }

/* Schnellwahl — textbasiert, kleine Kreise als Marker */
.quick-pick { display:flex; gap:20px; flex-wrap:wrap; margin-left:28px; }
.qp-btn { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); background:none; border:none; cursor:pointer; padding:3px 0; display:inline-flex; align-items:center; gap:6px; transition:color .15s; }
.qp-btn:hover { color:var(--fg); }
.qp-dot { display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--fg-muted); opacity:0.3; flex-shrink:0; transition:all .15s; }
.qp-dot-a { background:var(--fg); opacity:1; }
.qp-dot-b { background:transparent; border:1.5px solid var(--fg-muted); opacity:1; width:6px; height:6px; }
.qp-dot-both { background:var(--fg); opacity:1; }
.qp-active-a { color:var(--fg); font-weight:500; }
.qp-active-b { color:var(--fg); }
.qp-active-both { color:var(--fg); font-weight:500; }

/* ---- Einzel-Modus Slider ---- */
.single-slider-section { margin-bottom:32px; }
.time-display { font-family:var(--font-serif); font-size:28px; font-weight:500; color:var(--fg); text-align:center; margin-bottom:12px; display:flex; align-items:center; justify-content:center; gap:10px; }
.time-bullet { font-size:10px; color:var(--fg-muted); opacity:0.4; }
.time-slider { width:100%; height:4px; -webkit-appearance:none; appearance:none; background:transparent; cursor:pointer; outline:none; margin:0 0 4px; }
.time-slider::-webkit-slider-runnable-track { height:4px; background:var(--hairline); border-radius:2px; }
.time-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:var(--fg); border:2px solid var(--bg); margin-top:-6px; cursor:pointer; }
.time-slider::-moz-range-track { height:4px; background:var(--hairline); border-radius:2px; }
.time-slider::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:var(--fg); border:2px solid var(--bg); cursor:pointer; }
.tick-labels { display:flex; justify-content:space-between; font-family:var(--font-sans); font-size:11px; letter-spacing:0.04em; text-transform:uppercase; color:var(--fg-muted); margin-top:4px; padding:0 4px; }

/* ---- Preset-Buttons (Einzel-Modus) ---- */
.preset-row { display:flex; justify-content:center; gap:24px; flex-wrap:wrap; margin:20px 0 0; }
.preset-btn { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); background:none; border:none; cursor:pointer; padding:6px 12px; border-radius:4px; transition:all .15s; display:inline-flex; align-items:center; gap:6px; }
.preset-btn:hover { background:var(--hairline); color:var(--fg); }
.preset-btn.active { color:var(--fg); font-weight:500; }
.preset-marker { display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--fg-muted); opacity:0.3; flex-shrink:0; transition:all .15s; }
.preset-marker.active { background:var(--fg); opacity:1; }

/* ---- Abstand + Trennlinie vor Methodik ---- */
.methodik-gap { height:64px; }
.methodik-rule { height:1px; background:var(--hairline); margin-bottom:32px; }

/* ---- Methodik-Bereich ---- */
.methodik-section { max-width:800px; }
.methodik-eyebrow { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:4px; }
.methodik-heading { font-family:var(--font-serif); font-size:20px; font-weight:500; color:var(--fg); margin:0 0 28px; }
.methodik-block { margin-bottom:24px; }
.methodik-block:last-child { margin-bottom:0; }
.methodik-block-kicker { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:6px; }
.methodik-body { font-family:var(--font-sans); font-size:14px; color:var(--fg); line-height:1.6; max-width:720px; }
.methodik-body p { margin:0 0 4px; }
.methodik-body p:last-child { margin-bottom:0; }
.methodik-body strong { font-weight:600; color:var(--fg); }

/* ---- Responsive ---- */
@media (max-width:700px) { .kpi-row { grid-template-columns:repeat(2,1fr); } .card-cell:nth-child(2) { border-right:none; } }
</style>
