<script setup lang="ts">
import { ref, shallowRef, computed, defineAsyncComponent } from 'vue'
import { useData } from '~/composables/useData'
import { useFilters } from '~/composables/useFilters'
import type { HourlyRow, YearlyRow } from '~/composables/useData'

// Explizite Imports (Auto-Import ohne Directory-Prefix)
import DashboardFilterBar from '~/components/dashboard/FilterBar.vue'
import DashboardKpiCard from '~/components/dashboard/KpiCard.vue'
import VizStackedArea from '~/components/viz/StackedArea.vue'
import ExtremeValuesPanel from '~/components/dashboard/ExtremeValuesPanel.vue'
import StartEndComparison from '~/components/dashboard/StartEndComparison.vue'
import type { MonthlyDataPoint } from '~/composables/useExtremeValues'

const { loadHourly, loadYearly } = useData()

// shallowRef: große Arrays sind unveränderlich, keine tiefe Reaktivität nötig
const hourly = shallowRef<HourlyRow[]>([])
const yearly = shallowRef<YearlyRow[]>([])

// Lazy Loading: Nur der direkt sichtbare Tab "Strommix" lädt synchron.
// Die drei anderen Charts werden asynchron geladen, sobald der Nutzer
// den entsprechenden Tab anklickt. Spart ~80 kB initiales Bundle.
const VizScatterAnalysis = defineAsyncComponent(() => import('~/components/viz/ScatterAnalysis.vue'))
const VizHeatmapCO2 = defineAsyncComponent(() => import('~/components/viz/HeatmapCO2.vue'))
const VizDuckCurve = defineAsyncComponent(() => import('~/components/viz/DuckCurve.vue'))

const loading = ref(true)
const error = ref<string | null>(null)

// Sichtbarer Zeitraum aus StackedArea-Zoom
const visibleRange = ref<{ start: Date; end: Date } | null>(null)
function onVisibleRangeChange(range: { start: Date; end: Date } | null) {
  visibleRange.value = range
}

// Aggregat-Funktion (identisch zu StackedArea)
const ALL_KEYS = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite', 'other']
function aggregateMonths(rows: import('~/composables/useData').HourlyRow[]): MonthlyDataPoint[] {
  const map = new Map<string, any>()
  function getKey(d: Date): string {
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
  }
  function getDate(key: string): Date {
    const parts = key.split('-')
    return new Date(Date.UTC(+(parts[0] ?? 0), +(parts[1] ?? 1) - 1, 1))
  }
  for (const row of rows) {
    const d = new Date(row.timestamp), key = getKey(d)
    if (!map.has(key)) {
      const init: any = { date: getDate(key), total: 0, hours: 0 }
      for (const k of ALL_KEYS) init[k] = 0
      map.set(key, init)
    }
    const b = map.get(key)!
    b.hours++
    b.hydro += row.generation_by_source.hydro ?? 0
    b.biomass += row.generation_by_source.biomass ?? 0
    b.wind_onshore += row.generation_by_source.wind_onshore ?? 0
    b.wind_offshore += row.generation_by_source.wind_offshore ?? 0
    b.pv += row.generation_by_source.pv ?? 0
    b.nuclear += row.generation_by_source.nuclear ?? 0
    b.gas += row.generation_by_source.gas ?? 0
    b.hardcoal += row.generation_by_source.hardcoal ?? 0
    b.lignite += row.generation_by_source.lignite ?? 0
    b.other += (row.generation_by_source.other_renewables ?? 0) + (row.generation_by_source.other_fossil ?? 0) + (row.generation_by_source.pumped_storage ?? 0)
    b.total += Object.values(row.generation_by_source).reduce((a: number, v: any) => a + (v ?? 0), 0)
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Monatliche Daten im sichtbaren Bereich
const monthlyData = computed<MonthlyDataPoint[]>(() => {
  if (!hourly.value.length) return []
  const all = aggregateMonths(hourly.value)
  if (!visibleRange.value) return all
  return all.filter((d) => d.date >= visibleRange.value!.start && d.date <= visibleRange.value!.end)
})

const highlightedKey = ref<string | null>(null)
function onHighlightChange(key: string | null) {
  highlightedKey.value = key
}

async function loadData() {
  try {
    loading.value = true
    hourly.value = await loadHourly()
    yearly.value = await loadYearly()
  } catch (e: any) {
    error.value = e.message ?? 'Fehler beim Laden der Daten'
  } finally {
    loading.value = false
  }
}
loadData()

const { state, filteredKpiData, dataForYear } = useFilters()

// Tab-Navigation
const activeTab = ref<'ueberblick' | 'zusammenhaenge' | 'tagesmuster' | 'preise'>('ueberblick')

const tabs = [
  { id: 'ueberblick' as const, label: 'Strommix' },
  { id: 'zusammenhaenge' as const, label: 'Einflussfaktoren' },
  { id: 'tagesmuster' as const, label: 'Tagesmuster' },
  { id: 'preise' as const, label: 'Markt & Preise' },
]
const selectedDay = ref<string | undefined>(undefined)
function handleDaySelected(isoDate: string) { selectedDay.value = isoDate }

// Sparkline-Hover-Sync
const hoveredIndex = ref<number | null>(null)

// Hilfsfunktion: Werte für ein bestimmtes Jahr
function yearValue(year: number, field: string): number | null {
  const yd = hourly.value.filter((r) => new Date(r.timestamp).getUTCFullYear() === year)
  if (!yd.length) return null
  if (field === 'ee') return yd.reduce((s, r) => s + r.ee_share, 0) / yd.length
  if (field === 'co2') return yd.reduce((s, r) => s + r.co2_g_per_kwh, 0) / yd.length
  if (field === 'price') return yd.reduce((s, r) => s + r.price_eur_mwh, 0) / yd.length
  if (field === 'neg') return yd.filter((r) => r.price_eur_mwh < 0).length
  return null
}

const isGesamt = computed(() => state.year === null && state.mode !== 'vergleich')
const isEinzeljahr2015 = computed(() => state.year === 2015)
const selectedYear = computed(() => state.year)
const selectedYearIndex = computed(() => {
  if (state.year === null) return null
  return state.year - 2015
})

const kpis = computed(() => {
  // Dynamische Sparkline-Hilfsfunktionen
  function yearlyValues(field: 'ee' | 'co2' | 'price' | 'neg'): number[] {
    if (field === 'price') {
      const byY: Record<number, number[]> = {}
      for (const r of hourly.value) {
        const y = new Date(r.timestamp).getUTCFullYear()
        if (!byY[y]) byY[y] = []
        byY[y].push(r.price_eur_mwh)
      }
      return Object.keys(byY).sort().map((y) => (byY[Number(y)] ?? [0]).reduce((a, b) => a + b, 0) / (byY[Number(y)] ?? [1]).length)
    }
    if (field === 'neg') {
      const byY: Record<number, number> = {}
      for (const r of hourly.value) {
        if (r.price_eur_mwh < 0) { const y = new Date(r.timestamp).getUTCFullYear(); byY[y] = (byY[y] ?? 0) + 1 }
      }
      return Object.keys(byY).sort().map((y) => byY[Number(y)] ?? 0)
    }
    return yearly.value.map((y) => field === 'ee' ? y.avg_ee_share : y.avg_co2)
  }

  function monthlyValues(year: number, field: 'ee' | 'co2' | 'price' | 'neg'): number[] {
    const yd = hourly.value.filter((r) => new Date(r.timestamp).getUTCFullYear() === year)
    const byM: number[][] = [[],[],[],[],[],[],[],[],[],[],[],[]]
    for (const r of yd) {
      const m = new Date(r.timestamp).getUTCMonth()
      let v: number
      if (field === 'ee') v = r.ee_share
      else if (field === 'co2') v = r.co2_g_per_kwh
      else if (field === 'price') v = r.price_eur_mwh
      else v = r.price_eur_mwh < 0 ? 1 : 0
      byM[m]!.push(v)
    }
    return Object.values(byM).map((arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
  }

  function singleYearValue(year: number, field: 'ee' | 'co2' | 'price' | 'neg'): number {
    const yd = hourly.value.filter((r) => new Date(r.timestamp).getUTCFullYear() === year)
    if (!yd.length) return 0
    if (field === 'ee') return yd.reduce((s, r) => s + r.ee_share, 0) / yd.length
    if (field === 'co2') return yd.reduce((s, r) => s + r.co2_g_per_kwh, 0) / yd.length
    if (field === 'price') return yd.reduce((s, r) => s + r.price_eur_mwh, 0) / yd.length
    return yd.filter((r) => r.price_eur_mwh < 0).length
  }

  function sparkMinMax(arr: number[], dec = 1) {
    const mn = Math.min(...arr); const mx = Math.max(...arr)
    return { min: mn.toFixed(dec), max: mx.toFixed(dec) }
  }

  function buildDeltaStr(diff: number, unit: string, label: string): { label: string | null; positive: boolean; tooltip: string } | null {
    if (Math.abs(diff) < 0.05) return null
    const sign = diff > 0 ? '+' : ''
    return { label: `${sign}${diff.toFixed(1).replace('.', ',')} ${unit} ${label}`, positive: diff > 0, tooltip: label }
  }

  function prevYear(y: number): number {
    const first = Math.min(...hourly.value.map((r) => new Date(r.timestamp).getUTCFullYear()))
    return y > first ? y - 1 : y
  }

  interface KpiResult {
    value: string; unit: string; spark: number[]; sparkLabels: string[]
    deltaLabel: string | null; deltaPositive: boolean; deltaTooltip: string
    aggLabel: string; minMax: { min: string; max: string }
  }

  function buildResult(
    field: 'ee' | 'co2' | 'price' | 'neg',
    displayValue: number,
    unit: string,
    spark: number[],
    sparkLabels: string[],
    aggLabel: string,
    deltaLabel: string | null,
    deltaPositive: boolean,
    deltaTooltip: string,
    mn: string, mx: string,
  ): KpiResult {
    return {
      value: displayValue.toFixed(field === 'co2' || field === 'neg' ? 0 : 1),
      unit, spark, sparkLabels,
      deltaLabel, deltaPositive, deltaTooltip, aggLabel,
      minMax: { min: mn, max: mx },
    }
  }

  // ----------------------------------------------------------------
  // Vergleichsmodus
  // ----------------------------------------------------------------
  if (state.mode === 'vergleich') {
    const baseY = state.baseYear; const compY = state.compareYear
    const start = Math.min(baseY, compY); const end = Math.max(baseY, compY)

    function compareSpark(field: 'ee' | 'co2' | 'price' | 'neg'): { spark: number[]; labels: string[] } {
      const vals: number[] = []
      const labs: string[] = []
      for (let y = start; y <= end; y++) {
        vals.push(singleYearValue(y, field))
        labs.push(String(y))
      }
      return { spark: vals, labels: labs }
    }

    const fields: { key: 'ee' | 'co2' | 'price' | 'neg'; unit: string; deltaUnit: string; betterHigher: boolean; isSum: boolean }[] = [
      { key: 'ee', unit: '%', deltaUnit: 'PP', betterHigher: true, isSum: false },
      { key: 'co2', unit: 'g/kWh', deltaUnit: 'g/kWh', betterHigher: false, isSum: false },
      { key: 'price', unit: 'EUR/MWh', deltaUnit: 'EUR/MWh', betterHigher: false, isSum: false },
      { key: 'neg', unit: 'h', deltaUnit: 'h', betterHigher: false, isSum: true },
    ]

    const result: Record<string, KpiResult> = {}
    for (const f of fields) {
      const baseV = singleYearValue(baseY, f.key)
      const compV = singleYearValue(compY, f.key)
      const sv = compareSpark(f.key)
      const mm = sparkMinMax(sv.spark, f.key === 'co2' || f.key === 'neg' ? 0 : 1)
      const delta = buildDeltaStr(compV - baseV, f.deltaUnit, `${compY} vs. ${baseY}`) ?? { label: null, positive: true, tooltip: '' }
      result[f.key] = buildResult(f.key, compV, f.unit, sv.spark, sv.labels, String(compY),
        delta.label, delta.positive, delta.tooltip, mm.min, mm.max)
    }
    return result as any
  }

  // ----------------------------------------------------------------
  // Einzel-Modus: Gesamt oder Jahr
  // ----------------------------------------------------------------
  const data = filteredKpiData(hourly.value)
  if (!data.length) return null

  const isAll = state.year === null
  const year = state.year

  const ees = yearlyValues('ee'); const co2s = yearlyValues('co2'); const ps = yearlyValues('price'); const ns = yearlyValues('neg')
  const fullLabels = [...Array(10).keys()].map((i) => String(2015 + i))

  // Sparkline + Labels je nach Modus
  type FieldConfig = { key: 'ee' | 'co2' | 'price' | 'neg'; unit: string; deltaUnit: string; betterHigher: boolean; isSum: boolean }
  const cfgs: FieldConfig[] = [
    { key: 'ee', unit: '%', deltaUnit: 'PP', betterHigher: true, isSum: false },
    { key: 'co2', unit: 'g/kWh', deltaUnit: 'g/kWh', betterHigher: false, isSum: false },
    { key: 'price', unit: 'EUR/MWh', deltaUnit: 'EUR/MWh', betterHigher: false, isSum: false },
    { key: 'neg', unit: 'h', deltaUnit: 'h', betterHigher: false, isSum: true },
  ]

  function getSparkline(cfg: FieldConfig): { spark: number[]; labels: string[]; aggLabel: string; displayVal: number } {
    const yearlyData = cfg.key === 'ee' ? ees : cfg.key === 'co2' ? co2s : cfg.key === 'price' ? ps : ns
    if (isAll) {
      const avg = yearlyData.reduce((a, b) => a + b, 0) / yearlyData.length
      return { spark: yearlyData, labels: fullLabels, aggLabel: cfg.isSum ? 'Σ 2015–2024' : 'Ø 2015–2024', displayVal: avg }
    }
    // Einzeljahr
    if (year) {
      const months = monthlyValues(year, cfg.key)
      const val = singleYearValue(year, cfg.key)
      const monthLabs = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
      return { spark: months, labels: monthLabs, aggLabel: String(year), displayVal: val }
    }
    return { spark: yearlyData, labels: fullLabels, aggLabel: '', displayVal: 0 }
  }

  function getDelta(cfg: FieldConfig, displayVal: number): { label: string | null; positive: boolean; tooltip: string } {
    if (isAll) {
      const all = cfg.key === 'ee' ? ees : cfg.key === 'co2' ? co2s : cfg.key === 'price' ? ps : ns
      if (all.length < 2) return { label: null, positive: true, tooltip: '' }
      const first = all[0]; const last = all[all.length - 1]
      if (first === undefined || last === undefined) return { label: null, positive: true, tooltip: '' }
      const diff = last - first
      return buildDeltaStr(diff, cfg.deltaUnit, 'Trend 2015 → 2024') ?? { label: null, positive: true, tooltip: '' }
    }
    if (year) {
      if (year === 2015) return { label: null, positive: true, tooltip: '' }
      const prevV = singleYearValue(prevYear(year), cfg.key)
      const diff = displayVal - prevV
      return buildDeltaStr(diff, cfg.deltaUnit, `vs. Vorjahr (${prevYear(year)})`) ?? { label: null, positive: true, tooltip: '' }
    }
    return { label: null, positive: true, tooltip: '' }
  }

  const result: Record<string, KpiResult> = {}
  for (const cfg of cfgs) {
    const { spark, labels, aggLabel, displayVal } = getSparkline(cfg)
    const mm = sparkMinMax(spark, cfg.key === 'co2' || cfg.key === 'neg' ? 0 : 1)
    const delta = getDelta(cfg, displayVal)
    result[cfg.key] = buildResult(cfg.key, displayVal, cfg.unit, spark, labels, aggLabel,
      delta.label, delta.positive, delta.tooltip, mm.min, mm.max)
  }
  return result as any
})
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <div>
        <span class="dashboard-eyebrow">Datenprojekt · SMARD &amp; ENTSO-E</span>
        <h1 class="dashboard-title">Die Klimabilanz des deutschen Stroms</h1>
        <p class="dashboard-subtitle">Eine interaktive Analyse auf Basis von SMARD-, UBA- und ENTSO-E-Daten, 2015–2024.</p>
      </div>
      <NuxtLink to="/" class="back-link">← Zurück zur Übersicht</NuxtLink>
    </header>

    <div v-if="loading" class="dashboard-loading">Daten werden geladen...</div>
    <div v-else-if="error" class="dashboard-error">{{ error }}</div>

    <template v-if="!loading && !error">
      <!-- KPI-Filter + KPI-Reihe -->
      <section class="kpi-section">
        <DashboardFilterBar />
        <section v-if="kpis" class="kpi-grid">
          <DashboardKpiCard
            title="EE-Anteil" :value="kpis.ee.value" :unit="kpis.ee.unit"
            :agg-label="kpis.ee.aggLabel"
            :sparkline-data="kpis.ee.spark" :spark-labels="kpis.ee.sparkLabels"
            :delta-label="kpis.ee.deltaLabel" :delta-positive="kpis.ee.deltaPositive" :delta-tooltip="kpis.ee.deltaTooltip"
            :spark-color="'#4A90A4'" :show-divider="true"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.ee.minMax.min" :max-label="kpis.ee.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="CO₂-Intensität" :value="kpis.co2.value" :unit="kpis.co2.unit"
            :agg-label="kpis.co2.aggLabel"
            :sparkline-data="kpis.co2.spark" :spark-labels="kpis.co2.sparkLabels"
            :delta-label="kpis.co2.deltaLabel" :delta-positive="kpis.co2.deltaPositive" :delta-tooltip="kpis.co2.deltaTooltip"
            :spark-color="'#6B4423'" :show-divider="true"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.co2.minMax.min" :max-label="kpis.co2.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Day-Ahead-Preis" :value="kpis.price.value" :unit="kpis.price.unit"
            :agg-label="kpis.price.aggLabel"
            :sparkline-data="kpis.price.spark" :spark-labels="kpis.price.sparkLabels"
            :delta-label="kpis.price.deltaLabel" :delta-positive="kpis.price.deltaPositive" :delta-tooltip="kpis.price.deltaTooltip"
            :spark-color="'#D97742'" :show-divider="true"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.price.minMax.min" :max-label="kpis.price.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Negativpreis-Stunden" :value="kpis.neg.value" :unit="kpis.neg.unit"
            :agg-label="kpis.neg.aggLabel"
            :sparkline-data="kpis.neg.spark" :spark-labels="kpis.neg.sparkLabels"
            :delta-label="kpis.neg.deltaLabel" :delta-positive="kpis.neg.deltaPositive" :delta-tooltip="kpis.neg.deltaTooltip"
            :spark-color="'#E8B547'" :show-divider="false"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.neg.minMax.min" :max-label="kpis.neg.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
        </section>
      </section>

      <!-- Tab-Navigation -->
      <nav class="tab-nav">
        <button v-for="t in tabs" :key="t.id" class="tab-btn" :class="{ active: activeTab === t.id }" @click="activeTab = t.id">
          {{ t.label }}
        </button>
      </nav>

      <!-- Tab-Inhalte -->
      <!-- Überblick -->
      <section v-if="activeTab === 'ueberblick'" class="tab-content overview-layout">
        <div class="overview-chart">
          <VizStackedArea :data="hourly" @visible-range-change="onVisibleRangeChange" />
        </div>
        <aside class="context-panel context-panel-new">
          <ExtremeValuesPanel :monthly-data="monthlyData" />
          <div class="comp-spacer"></div>
          <StartEndComparison :monthly-data="monthlyData" @highlight-change="onHighlightChange" />
        </aside>
      </section>

      <!-- Zusammenhänge -->
      <section v-if="activeTab === 'zusammenhaenge'" class="tab-content">
        <Suspense>
          <VizScatterAnalysis :data="hourly" />
          <template #fallback>
            <div class="chart-loading">Visualisierung wird geladen …</div>
          </template>
        </Suspense>
      </section>

      <!-- Tagesmuster -->
      <section v-if="activeTab === 'tagesmuster'" class="tab-content">
        <Suspense>
          <VizHeatmapCO2 :data="hourly" @day-selected="handleDaySelected" />
          <template #fallback>
            <div class="chart-loading">Visualisierung wird geladen …</div>
          </template>
        </Suspense>
      </section>

      <!-- Preise -->
      <section v-if="activeTab === 'preise'" class="tab-content">
        <Suspense>
          <VizDuckCurve :data="hourly" :selected-day="selectedDay" />
          <template #fallback>
            <div class="chart-loading">Visualisierung wird geladen …</div>
          </template>
        </Suspense>
      </section>

      <footer class="dashboard-footer">
        <span>Quellen: SMARD (Erzeugung) &middot; UBA (Emissionsfaktoren) &middot; ENTSO-E (Preise)</span>
        <span>Technologiestack: Vue 3 / Nuxt 3 / D3 &middot; Datenstand: Mai 2025</span>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 28px 32px 32px;
  overflow-x: hidden;
  box-sizing: border-box;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 56px;
}

.dashboard-eyebrow {
  display: block;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 12px;
}

.dashboard-title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 3.5vw, 40px);
  font-weight: 500;
  line-height: 1.08;
  max-width: 800px;
  letter-spacing: -0.02em;
  color: var(--fg);
  margin-bottom: 12px;
  white-space: nowrap;
}

.dashboard-subtitle {
  color: var(--fg-muted);
  font-size: 17px;
  max-width: 640px;
  line-height: 1.5;
  font-family: var(--font-sans);
  margin-top: 0;
}

.back-link {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg-muted);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  padding-top: 6px;
}

.back-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

.header-meta {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--fg-muted);
  white-space: nowrap;
  padding-top: 6px;
  letter-spacing: 0.02em;
  opacity: 0.7;
}

.kpi-section {
  margin-bottom: 80px;
  position: relative;
}
.kpi-section::after {
  content: '';
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--hairline);
  pointer-events: none;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  border: none;
}

.kpi-grid > :last-child {
  border-right: none;
}

/* Tab-Navigation */
.tab-nav {
  display: flex;
  gap: 0;
  margin-bottom: 40px;
  border-bottom: 1px solid var(--hairline);
  padding: 0;
}

.tab-btn {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 400;
  padding: 8px 0;
  margin-right: 28px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: var(--fg);
}

.tab-btn.active {
  color: var(--fg);
  border-bottom-color: var(--accent);
  font-weight: 500;
}

.tab-content {
  margin-bottom: 64px;
}

/* Überblick-Layout */
.overview-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 32px;
  align-items: start;
}

.overview-chart {
  min-width: 0;
}

/* Kontext-Panel – neue Daten-Kacheln */
.context-panel {
  border-left: 1px solid var(--hairline);
  padding: 4px 0 4px 20px;
  position: sticky;
  top: 20px;
}
.context-panel-new {
  padding-top: 0;
}
.comp-spacer {
  height: 32px;
}

.context-block {
  margin-bottom: 20px;
}

.context-block:last-child { margin-bottom: 0; }

.context-heading {
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0 0 10px;
}

.context-list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
}

.context-list li {
  position: relative;
  padding-left: 14px;
  margin-bottom: 6px;
}

.context-list li::before {
  content: "–";
  position: absolute;
  left: 0;
  color: var(--fg-muted);
}

.context-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg);
}

.dashboard-loading, .dashboard-error {
  text-align: center;
  padding: 80px 0;
  font-size: 0.9rem;
  color: var(--fg-muted);
}
.chart-loading {
  text-align: center;
  padding: 60px 0;
  font-size: 0.8rem;
  color: var(--fg-muted);
}
.dashboard-error { color: var(--accent); }

.dashboard-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px 0 4px;
  border-top: 1px solid var(--hairline);
  font-size: 0.65rem;
  color: var(--fg-muted);
  line-height: 1.6;
  opacity: 0.6;
}

@media (max-width: 1200px) {
  .overview-layout { grid-template-columns: 1fr; }
  .context-panel { position: static; border-left: none; border-top: 1px solid var(--hairline); padding: 16px 0 0; }
}
@media (max-width: 900px) {
  .dashboard-header { flex-direction: column; gap: 8px; }
  .header-meta { white-space: normal; }
}
@media (max-width: 600px) {
  .dashboard-page { padding: 20px; }
  .kpi-grid { grid-template-columns: 1fr; }
  .tab-btn { margin-right: 16px; font-size: 0.72rem; }
}
</style>


