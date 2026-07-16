<script setup lang="ts">
/**
 * HeatmapCO2.vue – Monatliche Heatmap der CO₂-Intensität und anderer Metriken.
 *
 * Zeigt eine 24×12-Matrix (Stunde × Monat) farbcodiert an.
 * Unterstützt verschiedene Metriken (CO₂, EE-Anteil, Fossil, Preis)
 * und zwei Skalierungsmodi (Jahresvergleich vs. Muster im Jahr).
 *
 * @example
 * <HeatmapCO2 :data="hourlyData" @day-selected="onDaySelected" />
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import type { HourlyRow } from '~/composables/useData'

const props = defineProps<{ data: HourlyRow[] }>()
const emit = defineEmits<{ 'day-selected': [isoDate: string] }>()

// welche metrik gerade angezeigt wird
type MetricKey = 'co2' | 'ee' | 'fossil' | 'price'

interface MetricConfig {
  key: MetricKey
  label: string
  unit: string
  value: (row: HourlyRow) => number
  colorLo: string
  colorHi: string
  diverging?: boolean
  legendLo: string
  legendHi: string
}

const METRICS: MetricConfig[] = [
  { key: 'co2',    label: 'CO₂-Intensität',   unit: 'g CO₂/kWh', value: (r) => r.co2_g_per_kwh,      colorLo: '#F5F5F0', colorHi: '#6B4423', legendLo: 'niedrige', legendHi: 'hohe CO₂-Intensität' },
  { key: 'ee',     label: 'EE-Anteil',         unit: '%',       value: (r) => r.ee_share,           colorLo: '#F5F5F0', colorHi: '#2D6A4F', legendLo: 'niedriger', legendHi: 'hoher EE-Anteil' },
  { key: 'fossil', label: 'Konventioneller Anteil', unit: '%',  value: (r) => r.fossil_share,        colorLo: '#F5F5F0', colorHi: '#3A3A3A', legendLo: 'niedriger', legendHi: 'hoher konventioneller Anteil' },
  { key: 'price',  label: 'Day-Ahead-Preis',   unit: '€/MWh', value: (r) => r.price_eur_mwh,       colorLo: '#F5F5F0', colorHi: '#D97742', diverging: true, legendLo: 'negativ', legendHi: 'hoher Preis' },
]

const activeMetric = ref<MetricKey>('co2')
const currentMetric = computed(() => METRICS.find((m) => m.key === activeMetric.value)!)

// jahr und skalierungsmodus
const YEAR_OPTIONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
const selectedYear = ref(2024)
const scaleMode = ref<'einheitlich' | 'jaehrlich'>('einheitlich')

// TODO: irgendwann in shared file, kommt aktuell auch in stacked area vor
const ALL_MONTHS = [0,1,2,3,4,5,6,7,8,9,10,11]

/**
 * Baut die 24×12-Matrix mit Mittelwerten pro (Monat, Stunde) für ein Jahr.
 * Berücksichtigt nur Zeilen mit endlichen Werten.
 *
 * @param rows Alle Stunden-Datensätze.
 * @param year Gewünschtes Jahr.
 * @param metric Die aktuelle Metrik (z. B. CO₂, EE-Anteil).
 * @param months Monats-Indizes (0–11), die berücksichtigt werden sollen.
 * @returns 12×24-Matrix (Monat × Stunde). Fehlende Zellen = NaN.
 */
function computeMonthlyHeatmap(rows: HourlyRow[], year: number, metric: MetricConfig, months: number[]): {
  values: number[][]
  counts: number[][]
} {
  const values: number[][] = Array.from({ length: 12 }, () => Array(24).fill(NaN))
  const counts: number[][] = Array.from({ length: 12 }, () => Array(24).fill(0))
  for (const r of rows) {
    const ts = r.timestamp
    const y = getBerlinYear(ts)
    if (y !== year) continue
    const m = getBerlinMonth(ts) - 1
    if (!months.includes(m)) continue
    const h = getBerlinHour(ts)
    const v = metric.value(r)
    if (!Number.isFinite(v)) continue
    if (isNaN(values[m][h])) { values[m][h] = v; counts[m][h] = 1 }
    else { values[m][h] += v; counts[m][h]++ }
  }
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      if (counts[m][h] > 0) values[m][h] /= counts[m][h]
    }
  }
  return { values, counts }
}

/**
 * Wandelt die 24×12-Matrix in ein flaches Array um, z. B. für Sortierung und Extremwerte.
 * @param matrix Die 12×24-Matrix.
 * @returns Array von { month, hour, value }-Objekten.
 */
function getFlatData(matrix: number[][]): { month: number; hour: number; value: number }[] {
  const out: { month: number; hour: number; value: number }[] = []
  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const v = matrix[m][h]
      if (!isNaN(v)) out.push({ month: m, hour: h, value: v })
    }
  }
  return out
}

/**
 * Erzeugt eine D3-Farbskala für die Heatmap-Zellen.
 * Bei divergierenden Metriken (Preis) wird 0 als Bedeutungs-Schwelle verwendet.
 *
 * @param metric Die Metrik-Konfiguration.
 * @param dataMin Minimaler Datenwert.
 * @param dataMax Maximaler Datenwert.
 * @param useFixedScale Ob eine feste Skala (für Jahresvergleich) verwendet wird.
 * @returns D3-Skala (Farbe aus Zahl).
 */
function makeColorScale(metric: MetricConfig, dataMin: number, dataMax: number, useFixedScale: boolean) {
  if (metric.diverging) {
    if (useFixedScale) {
      // Feste inhaltliche Skala für Jahresvergleich: −50 bis 300 €/MWh
      const domain = [-50, 0, 50, 100, 200, 300]
      const colors = ['#4A90A4', '#F5F5F0', '#FDE8D0', '#F5C6A0', '#D97742', '#B85C3A']
      return d3.scaleLinear<string>().domain(domain).range(colors).clamp(true)
    }
    // Muster im Jahr: Skala an Datenbereich anpassen, 0 bleibt Bedeutungsschwelle
    const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax), 1)
    const cLo = dataMin < 0 ? '#4A90A4' : '#F5F5F0' // Blau nur wenn negative Werte existieren
    const cHi = dataMax > 0 ? '#D97742' : '#F5F5F0' // Orange nur wenn positive Werte existieren
    if (dataMin >= 0) {
      // Nur positive Werte: weiß → orange
      return d3.scaleLinear<string>().domain([0, dataMax]).range(['#F5F5F0', '#B85C3A']).clamp(true)
    }
    if (dataMax <= 0) {
      // Nur negative Werte: blau → weiß
      return d3.scaleLinear<string>().domain([dataMin, 0]).range(['#4A90A4', '#F5F5F0']).clamp(true)
    }
    // Gemischt: blau → weiß → orange
    return d3.scaleLinear<string>().domain([dataMin, 0, dataMax]).range(['#4A90A4', '#F5F5F0', '#D97742']).clamp(true)
  }
  return d3.scaleSequential(d3.interpolateRgb(metric.colorLo, metric.colorHi)).domain([dataMin, dataMax])
}

// sidebar: höchster/niedrigster wert + monat mit größter spanne
const sidebarExtremes = computed(() => {
  const { values: matrix } = computeMonthlyHeatmap(props.data, selectedYear.value, currentMetric.value, ALL_MONTHS)
  const flat = getFlatData(matrix)
  if (!flat.length) return null
  const metric = currentMetric.value
  const sorted = [...flat].sort((a, b) => a.value - b.value)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  let maxRange = 0; let maxRangeMonth = 0
  for (let m = 0; m < 12; m++) {
    const vals = matrix[m].filter(v => !isNaN(v))
    if (vals.length < 4) continue
    const mn = Math.min(...vals); const mx = Math.max(...vals)
    const r = mx - mn
    if (r > maxRange) { maxRange = r; maxRangeMonth = m }
  }

  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const fmt = (v: number) => metric.key === 'co2' ? `${Math.round(v)} g/kWh` : v.toFixed(1).replace('.', ',') + ' ' + metric.unit

  return {
    max: { label: monthNames[max.month], hour: max.hour, value: fmt(max.value) },
    min: { label: monthNames[min.month], hour: min.hour, value: fmt(min.value) },
    range: { month: monthNames[maxRangeMonth], diff: metric.key === 'co2' ? `${Math.round(maxRange)} g/kWh` : maxRange.toFixed(1).replace('.', ',') + ' ' + metric.unit },
  }
})

// container + resize observer
const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(800)
let resizeObs: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) { containerWidth.value = entry.contentRect.width }
    })
    resizeObs.observe(containerRef.value)
  }
})
onUnmounted(() => { resizeObs?.disconnect() })

const svgRef = ref<SVGSVGElement | null>(null)
let tooltipEl: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null
onUnmounted(() => { tooltipEl?.remove() })

const MARGIN = { top: 28, right: 70, bottom: 36, left: 48 }
const CHART_H = 300
const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// zeichnen (watch + initial)
watch([() => activeMetric.value, () => selectedYear.value, scaleMode, containerWidth], () => { drawHeatmap() }, { deep: false })
onMounted(() => { drawHeatmap() })

/**
 * Ermittelt den globalen Wertebereich einer Metrik über alle zehn Jahre (2015–2024).
 * Wird für den Modus "Jahresvergleich" (einheitliche Skala) benötigt.
 * Bei Preisen wird eine feste Skala von −50 bis 300 EUR/MWh verwendet.
 *
 * @param metric Die Metrik-Konfiguration.
 * @returns Tuple [min, max].
 */
function globalMinMax(metric: MetricConfig): [number, number] {
  if (metric.diverging) {
    // Feste Skala für Preise: −50 bis 300 EUR/MWh
    return [-50, 300]
  }
  let gMin = Infinity; let gMax = -Infinity
  for (let y = 2015; y <= 2024; y++) {
    const { values: m } = computeMonthlyHeatmap(props.data, y, metric, ALL_MONTHS)
    const flat = getFlatData(m)
    if (!flat.length) continue
    const vals = flat.map(d => d.value)
    gMin = Math.min(gMin, d3.min(vals) ?? Infinity)
    gMax = Math.max(gMax, d3.max(vals) ?? -Infinity)
  }
  if (!Number.isFinite(gMin)) return [0, 1]
  const pad = (gMax - gMin) * 0.02 || 1
  return [gMin - pad, gMax + pad]
}

function drawHeatmap() {
  if (!svgRef.value || containerWidth.value < 100) return
  const rows = props.data
  if (!rows.length) return

  const metric = currentMetric.value
  const { values: matrix, counts } = computeMonthlyHeatmap(rows, selectedYear.value, metric, ALL_MONTHS)
  const flat = getFlatData(matrix)
  const allVals = flat.map(d => d.value)
  let dataMin: number; let dataMax: number
  if (scaleMode.value === 'einheitlich') {
    const [gMin, gMax] = globalMinMax(metric)
    dataMin = gMin; dataMax = gMax
  } else {
    dataMin = d3.min(allVals) ?? 0; dataMax = d3.max(allVals) ?? 1
  }

  drawSingle(svgRef.value, matrix, flat, counts, metric, dataMin, dataMax, selectedYear.value, containerWidth.value)
}

/**
 * Haupt-Rendering-Funktion. Baut das komplette SVG mit Zellen, Achsen,
 * Farblegende und Tooltip auf. Wird bei jeder Änderung von Metrik, Jahr
 * oder Skalierungsmodus neu aufgerufen.
 *
 * @param svgEl Das Ziel-SVG-Element im DOM.
 * @param matrix 12×24-Datenmatrix.
 * @param flat Flache Version der Daten (für D3-Data-Join).
 * @param metric Metrik-Konfiguration.
 * @param dataMin Minimaler Farbwert.
 * @param dataMax Maximaler Farbwert.
 * @param year Aktuelles Jahr (für Label).
 * @param width Verfügbare Breite in Pixeln.
 */
function drawSingle(
  svgEl: SVGSVGElement,
  matrix: number[][],
  flat: { month: number; hour: number; value: number }[],
  counts: number[][],
  metric: MetricConfig,
  dataMin: number,
  dataMax: number,
  year: number,
  width: number
) {
  const svg = d3.select(svgEl); svg.selectAll('*').remove()
  const plotWidth = width - MARGIN.left - MARGIN.right
  const cellW = plotWidth / 12
  const cellH = CHART_H / 24
  const svgH = MARGIN.top + CHART_H + MARGIN.bottom

  svg.attr('width', width).attr('height', svgH)

  const colorScale = makeColorScale(metric, dataMin, dataMax, scaleMode.value === 'einheitlich')

  if (!tooltipEl) {
    tooltipEl = d3.select('body').append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'fixed').style('display', 'none')
      .style('background', '#FFFFFF').style('border', '1px solid var(--hairline)')
      .style('border-radius', '6px').style('padding', '8px 12px')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.06)')
      .style('font-family', 'var(--font-sans)').style('font-size', '12px')
      .style('pointer-events', 'none').style('z-index', '1000').style('line-height', '1.5')
  }

  // Y-Achse (Stunden)
  const yLabelG = svg.append('g').attr('transform', `translate(${MARGIN.left - 8}, ${MARGIN.top})`)
  for (let h = 0; h < 24; h += 4) {
    yLabelG.append('text')
      .attr('x', 0).attr('y', h * cellH + cellH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(String(h).padStart(2, '0'))
  }
  for (let h = 0; h < 24; h++) {
    svg.append('line')
      .attr('x1', MARGIN.left).attr('x2', MARGIN.left + plotWidth)
      .attr('y1', MARGIN.top + h * cellH).attr('y2', MARGIN.top + h * cellH)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }

  // X-Achse (Monate)
  const xLabelG = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top - 6})`)
  for (let m = 0; m < 12; m++) {
    xLabelG.append('text')
      .attr('x', m * cellW + cellW / 2).attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
      .attr('fill', 'var(--fg-muted)')
      .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
      .text(MONTH_LABELS[m])
  }

  // Heatmap-Zellen
  const g = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)
  const cells = g.selectAll('rect').data(flat).join('rect')
    .attr('x', (d) => d.month * cellW)
    .attr('y', (d) => d.hour * cellH)
    .attr('width', Math.max(1, cellW - 1))
    .attr('height', Math.max(1, cellH - 1))
    .attr('rx', 1)
    .attr('fill', (d) => isNaN(d.value) ? '#F0F0F0' : colorScale(d.value))
    .attr('stroke', 'none')

  // Monats-Trennlinien
  for (let m = 1; m < 12; m++) {
    g.append('line')
      .attr('x1', m * cellW).attr('y1', 0).attr('x2', m * cellW).attr('y2', CHART_H)
      .attr('stroke', '#DCDCDC').attr('stroke-width', 0.5)
  }

  // Tooltip
  cells
    .on('mouseenter', function (event: MouseEvent, d) {
      if (!tooltipEl) return
      const cnt = counts[d.month][d.hour]
      const wert = isNaN(d.value) ? 'keine Daten' : `Ø ${d.value.toFixed(metric.key === 'co2' ? 0 : 1).replace('.', ',')} ${metric.unit}`
      const tage = cnt > 0 ? `Ø über ${cnt} verf\u00fcgbare Tage` : ''
      tooltipEl.style('display', 'block')
        .html(`${MONTH_LABELS[d.month]}, ${String(d.hour).padStart(2, '0')}:00<br><span style="color:var(--fg-muted)">${wert} · ${tage}</span>`)
        .style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
      d3.select(this).attr('stroke', 'var(--fg)').attr('stroke-width', 1)
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltipEl) tooltipEl.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 10}px`)
    })
    .on('mouseleave', function () {
      if (tooltipEl) tooltipEl.style('display', 'none')
      d3.select(this).attr('stroke', 'none')
    })

  // Farblegende rechts
  const legG = svg.append('g').attr('transform', `translate(${MARGIN.left + plotWidth + 12}, ${MARGIN.top})`)
  const gradId = `heatmap-grad-${metric.key}-${year}`
  const gradDefs = legG.append('defs').append('linearGradient').attr('id', gradId)
    .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const val = dataMin + t * (dataMax - dataMin)
    gradDefs.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorScale(val))
  }
  legG.append('rect').attr('width', 12).attr('height', 140).attr('rx', 2).style('fill', `url(#${gradId})`)
  legG.append('text').attr('x', 16).attr('y', 2).attr('dominant-baseline', 'hanging')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(metric.key === 'co2' || metric.key === 'price' ? Math.round(dataMax) + '' : dataMax.toFixed(1))
  legG.append('text').attr('x', 16).attr('y', 142).attr('dominant-baseline', 'auto')
    .attr('font-size', '11px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .style('text-transform', 'uppercase').style('letter-spacing', '0.04em')
    .text(metric.key === 'co2' || metric.key === 'price' ? Math.round(dataMin) + '' : dataMin.toFixed(1))
  legG.append('text').attr('x', 0).attr('y', 152)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)').text(metric.unit)

  svg.append('text')
    .attr('x', MARGIN.left).attr('y', svgH - 6)
    .attr('font-size', '10px').attr('font-family', 'var(--font-sans)')
    .attr('fill', 'var(--fg-muted)')
    .text(`${year} · ${flat.filter(d => !isNaN(d.value)).length} Zellen`)
}
</script>

<template>
  <div class="heatmap-card">
    <div class="heatmap-header">
      <h3 class="heatmap-heading">Stündliche Muster über den Tag</h3>
    </div>
    <p class="heatmap-subtitle">Jede Zelle zeigt den Durchschnitt eines Monats zu einer bestimmten Uhrzeit.</p>

    <div class="heatmap-controls">

      <div class="control-group">
        <span class="control-label">Zeige:</span>
        <div class="segment-group">
          <button v-for="m in METRICS" :key="m.key"
            class="segment-btn" :class="{ active: activeMetric === m.key }"
            @click="activeMetric = m.key">{{ m.label }}</button>
        </div>
      </div>
    </div>

    <div class="heatmap-year-row">
      <span class="control-label">Jahr:</span>
      <div class="segment-group year-chips">
        <button v-for="y in YEAR_OPTIONS" :key="y"
          class="segment-btn" :class="{ active: selectedYear === y }"
          @click="selectedYear = y">{{ y }}</button>
      </div>
      <span class="control-label" style="margin-left:24px">Skala:</span>
      <div class="segment-group scale-chips">
        <button class="segment-btn" :class="{ active: scaleMode === 'einheitlich' }" @click="scaleMode = 'einheitlich'">Jahresvergleich</button>
        <button class="segment-btn" :class="{ active: scaleMode === 'jaehrlich' }" @click="scaleMode = 'jaehrlich'">Muster im Jahr</button>
      </div>
    </div>

    <div class="heatmap-layout">
      <div class="heatmap-main">
        <div ref="containerRef" class="heatmap-scroll">
          <svg ref="svgRef"></svg>
        </div>
        <p class="heatmap-legend-text">
          <template v-if="currentMetric.key === 'price'">Blau = negativer Preis · Orange = positiver Preis · gleiche Farbskala für alle Jahre</template>
          <template v-else>Je dunkler das Feld, desto höher die {{ currentMetric.legendHi }}. Die Farbskala ist für alle Jahre identisch.</template>
        </p>
      </div>
      <aside class="heatmap-sidebar">
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Höchster Durchschnitt</div>
          <div class="tile-value">{{ sidebarExtremes.max.value }}</div>
          <div class="tile-context">{{ sidebarExtremes.max.label }}, {{ String(sidebarExtremes.max.hour).padStart(2, '0') }}:00</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Niedrigster Durchschnitt</div>
          <div class="tile-value">{{ sidebarExtremes.min.value }}</div>
          <div class="tile-context">{{ sidebarExtremes.min.label }}, {{ String(sidebarExtremes.min.hour).padStart(2, '0') }}:00</div>
        </div>
        <div class="metric-divider"></div>
        <div class="metric-tile" v-if="sidebarExtremes">
          <div class="tile-eyebrow">Größter Unterschied im Tagesverlauf</div>
          <div class="tile-value">{{ sidebarExtremes.range.diff }}</div>
          <div class="tile-context">im {{ sidebarExtremes.range.month }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.heatmap-card { width:100%; }
.heatmap-header { margin-bottom:2px; }

.heatmap-heading { font-family:var(--font-serif); font-size:22px; font-weight:500; color:var(--fg); margin:0; }
.heatmap-subtitle { font-family:var(--font-sans); font-size:15px; color:var(--fg-muted); max-width:640px; line-height:1.5; margin:8px 0 24px; }
.heatmap-controls { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.control-group { display:flex; align-items:center; gap:8px; }
.control-label { font-family:var(--font-sans); font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); flex-shrink:0; }
.segment-group { display:flex; border:1px solid var(--hairline); border-radius:6px; overflow:hidden; flex-wrap:wrap; }
.segment-btn { font-family:var(--font-sans); font-size:11px; font-weight:500; padding:4px 10px; border:none; background:transparent; color:var(--fg); cursor:pointer; transition:all .15s; border-right:1px solid var(--hairline); text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
.segment-btn:last-child { border-right:none; }
.segment-btn:hover { background:var(--bg); }
.segment-btn.active { background:var(--accent); color:#fff; }
.heatmap-year-row { display:flex; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
.year-chips .segment-btn { font-size:11px; padding:3px 8px; }
.heatmap-layout { display:grid; grid-template-columns:1fr 260px; gap:32px; align-items:start; }
.heatmap-main { min-width:0; }
.heatmap-scroll { width:100%; overflow-x:auto; overflow-y:hidden; }
.heatmap-scroll svg { display:block; }
.heatmap-legend-text { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); margin-top:10px; margin-bottom:0; line-height:1.4; }
.heatmap-sidebar { border-left:1px solid var(--hairline); padding:4px 0 4px 20px; position:sticky; top:20px; }
.metric-tile { padding:20px 0; position:relative; }
.metric-divider { height:1px; background:var(--hairline); margin:0; }
.tile-eyebrow { font-family:var(--font-sans); font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--fg-muted); margin-bottom:6px; }
.tile-value { font-family:var(--font-serif); font-size:24px; font-weight:500; color:var(--fg); line-height:1.1; margin-bottom:4px; }
.tile-context { font-family:var(--font-sans); font-size:12px; color:var(--fg-muted); }
@media (max-width:1000px) { .heatmap-layout { grid-template-columns:1fr; } .heatmap-sidebar { position:static; border-left:none; border-top:1px solid var(--hairline); padding:16px 0 0; } }
@media (max-width:700px) { .heatmap-controls { flex-direction:column; align-items:flex-start; } }
</style>
