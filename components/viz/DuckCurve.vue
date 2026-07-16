<script setup lang="ts">
/**
 * DuckCurve.vue – Interaktiver Tagesvergleich für den deutschen Strommarkt.
 *
 * Zeigt Durchschnittsprofile für PV-Erzeugung, Residuallast, Preis und
 * CO₂-Intensität über 24 Stunden. Unterstützt verschiedene Modi (Sommer,
 * Winter, Werktag, etc.) und einen Zeitraum-Vergleich zwischen zwei Stunden.
 *
 * @example
 * <DuckCurve :data="hourlyData" />
 */

import { ref, computed, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'
import { getBerlinHour, getBerlinYear, getBerlinMonth, isBerlinWeekend } from '~/utils/berlin'

const props = defineProps<{ data: HourlyRow[]; selectedDay?: string }>()

type ProfileMode = 'durchschnitt' | 'sommer' | 'winter' | 'werktag' | 'wochenende' | 'jahr2015' | 'jahr2024'
const profileMode = ref<ProfileMode>('durchschnitt')

interface HourPoint { hour: number; pv: number; residuallast: number; price: number; co2: number }

/**
 * Prüft, ob ein Datum in den meteorologischen Sommer fällt (Juni–August).
 * Wird gebraucht, weil PV im Sommer halt am meisten bringt.
 *
 * @param d Das zu prüfende Datum (Berlin-Zeit).
 * @returns true bei Sommer.
 */
function inSummer(d: Date): boolean { const m = getBerlinMonth(d.getTime()); return m >= 5 && m <= 7 }
/**
 * Prüft auf meteorologischen Winter (Dezember–Februar).
 *
 * @param d Datum in Berlin-Zeit.
 * @returns true bei Winter.
 */
function inWinter(d: Date): boolean { const m = getBerlinMonth(d.getTime()); return m <= 2 || m >= 11 }
/**
 * Wochenende-Check (Samstag oder Sonntag).
 *
 * @param d Das Datum.
 * @returns true am Wochenende.
 */
function isWeekend(d: Date): boolean { return isBerlinWeekend(d.getTime()) }

/**
 * Berechnet die Residuallast in GW (Last minus EE-Erzeugung).
 * Alle EE-Quellen (Wind, PV, Biomasse, Hydro, Other) werden addiert.
 *
 * @param row Ein Datensatz aus dem SMARD-Datensatz.
 * @returns Residuallast in Gigawatt.
 */
function residuallastGW(row: HourlyRow): number {
  const g = row.generation_by_source
  const ee = (g.wind_onshore ?? 0) + (g.wind_offshore ?? 0) + (g.pv ?? 0) + (g.biomass ?? 0) + (g.hydro ?? 0) + (g.other_renewables ?? 0)
  return (row.load_mwh - ee) / 1000
}
/**
 * Extrahiert die PV-Erzeugung in GW aus einer Zeile.
 *
 * @param row Stündlicher Datensatz.
 * @returns PV in Gigawatt.
 */
function pvGW(row: HourlyRow): number { return (row.generation_by_source.pv ?? 0) / 1000 }

/**
 * Formatiert eine Zahl mit einem Dezimaltrennzeichen (deutsches Format, Komma statt Punkt).
 *
 * @param n Die zu formatierende Zahl.
 * @returns Formatierter String, z. B. "3,5".
 */
function fmtNum(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/**
 * Baut einen HTML-String für eine Differenzanzeige mit CSS-Klasse.
 * Positive Differenzen werden grün dargestellt, negative rot.
 *
 * @param diff Die Differenz oder null (wenn keine Angabe).
 * @param unit Die Einheit (z. B. "GW", "EUR/MWh").
 * @returns HTML-String oder leerer String bei null.
 */
function diffStr(diff: number | null, unit: string): string {
  if (diff === null) return ''
  const sign = diff >= 0 ? '+' : ''
  const cls = diff >= 0 ? 'diff-pos' : 'diff-neg'
  return `<span class="${cls}">${sign}${fmtNum(diff)} ${unit}</span>`
}

function computeProfile(rows: HourlyRow[], mode: ProfileMode): HourPoint[] {
  // 1. Zeilen nach Modus filtern
  let filtered = rows
  if (mode === 'sommer') filtered = rows.filter((r) => inSummer(new Date(r.timestamp)))
  else if (mode === 'winter') filtered = rows.filter((r) => inWinter(new Date(r.timestamp)))
  else if (mode === 'werktag') filtered = rows.filter((r) => !isWeekend(new Date(r.timestamp)))
  else if (mode === 'wochenende') filtered = rows.filter((r) => isWeekend(new Date(r.timestamp)))
  else if (mode === 'jahr2015') filtered = rows.filter((r) => getBerlinYear(r.timestamp) === 2015)
  else if (mode === 'jahr2024') filtered = rows.filter((r) => getBerlinYear(r.timestamp) === 2024)

  // 2. Stundenweise Buckets anlegen (0–23, Berliner Lokalzeit)
  const buckets: Array<{ hour: number; pv: number[]; residuallast: number[]; price: number[]; co2: number[] }> =
    Array.from({ length: 24 }, (_, hour) => ({ hour, pv: [], residuallast: [], price: [], co2: [] }))

  // 3. Werte in die passenden Buckets sortieren
  for (const row of filtered) {
    const hour = getBerlinHour(row.timestamp)
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


const profile = ref<HourPoint[]>([])
const current = computed(() => profile.value[currentHour.value] || profile.value[0])
const rangeStartPoint = computed(() => profile.value[rangeStart.value] || profile.value[0])
const rangeEndPoint = computed(() => profile.value[rangeEnd.value] || profile.value[0])
const sparkRefs = ref<(SVGSVGElement | null)[]>([])
function setSparkRef(i: number) { return (el: SVGSVGElement | null) => { sparkRefs.value[i] = el } }

watch(() => props.data, (rows) => { if (rows.length) profile.value = computeProfile(rows, profileMode.value) }, { immediate: true })
watch(profileMode, () => { if (props.data.length) profile.value = computeProfile(props.data, profileMode.value) })

function avgOf(data: HourPoint[], key: keyof HourPoint): number {
  const vals = data.map((d) => d[key] as number)
  return vals.reduce((a, v) => a + v, 0) / vals.length
}

const cards = computed(() => {
  const p = profile.value; if (!p.length) return []
  const h = compareTimeEnabled.value ? rangeStartPoint.value : current.value
  const hEnd = compareTimeEnabled.value ? rangeEndPoint.value : current.value
  const avgPv = avgOf(p, 'pv')
  const avgRl = avgOf(p, 'residuallast')
  const avgPrice = avgOf(p, 'price')
  const avgCo2 = avgOf(p, 'co2')

  return [
    { key: 'pv', label: 'PV-Erzeugung', unit: 'GW', color: '#E8B547',
      value: h.pv.toFixed(1), valueEnd: hEnd.pv.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.pv - h.pv : null,
      spark: p.map((d) => d.pv),
      context: `Durchschnitt: ${avgPv.toFixed(1)} GW` },
    { key: 'residuallast', label: 'Residuallast', unit: 'GW', color: '#3A3A3A',
      value: h.residuallast.toFixed(1), valueEnd: hEnd.residuallast.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.residuallast - h.residuallast : null,
      spark: p.map((d) => d.residuallast),
      context: `Durchschnitt: ${avgRl.toFixed(1)} GW` },
    { key: 'price', label: 'Day-Ahead-Preis', unit: 'EUR/MWh', color: 'var(--accent)',
      value: h.price.toFixed(1), valueEnd: hEnd.price.toFixed(1),
      diff: compareTimeEnabled.value ? hEnd.price - h.price : null,
      spark: p.map((d) => d.price),
      context: `Durchschnitt: ${avgPrice.toFixed(1)} EUR/MWh` },
    { key: 'co2', label: 'CO₂-Intensität', unit: 'g/kWh', color: '#6B4423',
      value: h.co2.toFixed(0), valueEnd: hEnd.co2.toFixed(0),
      diff: compareTimeEnabled.value ? hEnd.co2 - h.co2 : null,
      spark: p.map((d) => d.co2),
      context: `Durchschnitt: ${avgCo2.toFixed(0)} g/kWh` },
  ]
})

// Sparklines (mit nextTick, damit SVG-Refs existieren)
watch(() => profile.value, () => {
  nextTick(() => { drawSparklines() })
}, { deep: true })
watch(currentHour, () => { nextTick(() => { drawSparklines() }) })
watch(rangeStart, () => { nextTick(() => { drawSparklines() }) })
watch(rangeEnd, () => { nextTick(() => { drawSparklines() }) })

/**
 * Hauptfunktion zum Zeichnen aller vier Sparklines.
 * Wird durch Watches auf profile, currentHour, rangeStart und rangeEnd getriggert.
 * Nutzt nextTick, damit die SVG-Refs im DOM existieren.
 */
function drawSparklines() {
  const profile = profile.value; if (!profile.length) return
  const currentH = currentHour.value; const startH = rangeStart.value; const endH = rangeEnd.value
  const keys: (keyof HourPoint)[] = ['pv', 'residuallast', 'price', 'co2']

  for (let i = 0; i < 4; i++) {
    drawSingleSparkline(i, keys[i], profile, currentH, startH, endH)
  }
}

/**
 * Zeichnet eine einzelne Sparkline mit D3.
 * Enthält die gesamte Logik für Linie, Marker und Vergleichs-Marker.
 *
 * @param index Index in der KPI-Reihe (0–3).
 * @param key Metrik-Schlüssel (pv, residuallast, price, co2).
 * @param profile Die 24-Stunden-Daten.
 * @param currentH Aktuelle Stunde (Einzelmodus).
 * @param startH Start-Stunde (Vergleichsmodus).
 * @param endH End-Stunde (Vergleichsmodus).
 */
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
  { hour: 13, label: '13 Uhr PV-Peak' }, { hour: 18, label: '18 Uhr Abendhoch' }, { hour: 22, label: '22 Uhr Abend' },
]
/**
 * Setzt die ausgewählte Stunde (per Preset-Button).
 * Im Vergleichsmodus werden beide Slider auf die Stunde gesetzt.
 * @param h Die Ziel-Stunde (0–23).
 */
function goToHour(h: number) {
  if (compareTimeEnabled.value) {
    rangeStart.value = Math.max(0, Math.min(23, h))
    rangeEnd.value = Math.max(0, Math.min(23, h))
  } else {
    currentHour.value = Math.max(0, Math.min(23, h))
  }
}

const modeLabels: Record<ProfileMode, string> = { durchschnitt: 'Durchschnitt', sommer: 'Sommer', winter: 'Winter', werktag: 'Werktag', wochenende: 'Wochenende', jahr2015: '2015', jahr2024: '2024' }
</script>

<template>
  <div class="duck-section">
    <div class="duck-header">
      <h3 class="duck-heading">Stündliche Muster im Tagesverlauf</h3>
    </div>
    <p class="duck-subtitle">Jeder Wert zeigt den Mittelwert aller entsprechenden Stunden im Zeitraum 2015 bis 2024.</p>

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
      </div>

      <!-- Timeline A -->
      <div class="timeline-row">
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-eyebrow">AUSGANGSZEITPUNKT</span>
            <span class="timeline-time">{{ String(rangeStart).padStart(2, '0') }}:00</span>
          </div>
          <input type="range" class="timeline-slider timeline-slider-a" min="0" max="23" step="1" v-model.number="rangeStart" />
        </div>
      </div>

      <!-- Timeline B -->
      <div class="timeline-row">
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-eyebrow">VERGLEICHSZEITPUNKT</span>
            <span class="timeline-time timeline-time-b">{{ String(rangeEnd).padStart(2, '0') }}:00</span>
          </div>
          <input type="range" class="timeline-slider timeline-slider-b" min="0" max="23" step="1" v-model.number="rangeEnd" />
        </div>
      </div>

      <!-- Stundenachse (einmal unter beiden) -->
      <div class="timeline-axis-labels">
        <span v-for="h in [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]" :key="h" class="tl-label">{{ String(h).padStart(2, '0') }}</span>
      </div>

    </div>

    <!-- Einzel-Modus: einfacher Slider -->
    <div v-else class="single-slider-section">
      <div class="time-display"><span class="time-bullet">●</span> {{ String(currentHour).padStart(2, '0') }}:00 <span class="time-bullet">●</span></div>
      <input type="range" class="time-slider" min="0" max="23" step="1" v-model.number="currentHour" />
      <div class="tick-labels"><span v-for="h in [0, 4, 8, 12, 16, 20]" :key="h">{{ String(h).padStart(2, '0') }}</span></div>
      <div class="preset-row">
        <button v-for="pr in presets" :key="pr.hour" class="preset-btn" :class="{ active: currentHour === pr.hour }" @click="goToHour(pr.hour)">
          <span class="preset-marker" :class="{ active: currentHour === pr.hour }"></span>{{ pr.label }}
        </button>
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

/* Einzelne Timeline-Zeile */
.timeline-row { display:flex; align-items:flex-start; gap:12px; margin-bottom:20px; }


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


/* Schnellwahl — textbasiert, kleine Kreise als Marker */


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



/* ---- Responsive ---- */
@media (max-width:700px) { .kpi-row { grid-template-columns:repeat(2,1fr); } .card-cell:nth-child(2) { border-right:none; } }
</style>
