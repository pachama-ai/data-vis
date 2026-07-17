<script setup lang="ts">
/**
 * dashboard.vue – Haupt-Dashboard-Seite der Datenvisualisierung.
 *
 * Enthält die Tab-Navigation zwischen Strommix, Einflussfaktoren,
 * Tagesmustern und Markt & Preisen. Lädt hourly+yearly Daten und
 * aggregiert sie für die Unterseiten.
 */

import { ref, shallowRef, computed, defineAsyncComponent } from 'vue'
import { useData } from '~/composables/useData'
import { useVisualizationData } from '~/composables/useVisualizationData'
import { useFilters } from '~/composables/useFilters'
import { getBerlinYear, getBerlinMonth } from '~/utils/berlin'
import type { HourlyRow } from '~/composables/useData'
import type {
  MonthlyMixPoint,
  HeatmapCo2Cell,
  ScatterDailyPoint,
} from '~/types/visualization-data'

// explizite imports weil auto-import manchmal spinnt
import DashboardFilterBar from '~/components/dashboard/FilterBar.vue'
import DashboardKpiCard from '~/components/dashboard/KpiCard.vue'
import VizStackedArea from '~/components/viz/StackedArea.vue'
import ExtremeValuesPanel from '~/components/dashboard/ExtremeValuesPanel.vue'
import StartEndComparison from '~/components/dashboard/StartEndComparison.vue'
import type { YearlyRow } from '~/composables/useData'
import type { MonthlyDataPoint } from '~/composables/useExtremeValues'
import { aggregate } from '~/utils/aggregate'

const { loadHourly, loadYearly } = useData()

// shallowRef: große Arrays sind unveränderlich, keine tiefe Reaktivität nötig
const hourly = shallowRef<HourlyRow[]>([])
const yearly = shallowRef<YearlyRow[]>([])

// Aggregation-Level und Modus (noch von ExtremeValuesPanel/StartEndComparison genutzt)
const aggLevel = ref<'tag' | 'woche' | 'monat' | 'quartal'>('monat')
const chartMode = ref<'absolute' | 'percent'>('percent')

// Lazy Loading: Nur der direkt sichtbare Tab "Strommix" lädt synchron.
// Die drei anderen Charts werden asynchron geladen, sobald der Nutzer
// den entsprechenden Tab anklickt. Spart ~80 kB initiales Bundle.
const VizScatterSimple = defineAsyncComponent(() => import('~/components/viz/ScatterSimple.vue'))
const VizHeatmapCO2 = defineAsyncComponent(() => import('~/components/viz/HeatmapCO2.vue'))
const VizHourlyProfile = defineAsyncComponent(() => import('~/components/viz/HourlyProfile.vue'))

const loading = ref(true)
const error = ref<string | null>(null)

// Aggregierte Daten (noch von ExtremeValuesPanel/StartEndComparison genutzt)
/** Nach aggLevel aggregierte Stunden-Daten. */
const monthlyData = computed<MonthlyDataPoint[]>(() => {
  if (!hourly.value.length) return []
  return aggregate(hourly.value, { level: aggLevel.value })
})

const highlightedKey = ref<string | null>(null)
/** Merkt den hervorgehobenen Energieträger aus StartEndComparison */
function onHighlightChange(key: string | null) {
  highlightedKey.value = key
}

/**
 * Lädt Stunden- und Jahresdaten von der API.
 * Setzt loading-Status und fängt Fehler (wird im Template angezeigt).
 */
async function loadData() {
  try {
    loading.value = true
    hourly.value = await loadHourly()
    yearly.value = await loadYearly()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden der Daten'
  } finally {
    loading.value = false
  }
}
loadData()

// Build-time aggregierte Daten (monthlyMix, heatmapCo2, …)
const monthlyMix = ref<MonthlyMixPoint[]>([])
const monthlyMixLoading = ref(true)
const monthlyMixError = ref<string | null>(null)
const heatmapCo2 = ref<HeatmapCo2Cell[]>([])
const scatterDaily = ref<ScatterDailyPoint[]>([])

const { loadVisualizationData } = useVisualizationData()

async function loadVisualization() {
  try {
    monthlyMixLoading.value = true
    monthlyMixError.value = null
    const visData = await loadVisualizationData()
    monthlyMix.value = visData.monthlyMix
    heatmapCo2.value = visData.heatmapCo2
    scatterDaily.value = visData.scatterDaily
  } catch (e: unknown) {
    monthlyMixError.value = e instanceof Error ? e.message : 'Fehler beim Laden der Visualisierungsdaten'
  } finally {
    monthlyMixLoading.value = false
  }
}
loadVisualization()

const { state, filteredKpiData, dataForYear } = useFilters()

// Tab-Navigation
const activeTab = ref<'ueberblick' | 'zusammenhaenge' | 'tagesmuster' | 'preise'>('ueberblick')

const tabs = [
  { id: 'ueberblick' as const, label: 'Strommix' },
  { id: 'zusammenhaenge' as const, label: 'Einflussfaktoren' },
  { id: 'tagesmuster' as const, label: 'Tagesmuster' },
  { id: 'preise' as const, label: 'Markt & Preise' },
]


// Sparkline-Hover-Sync über mehrere KPI-Karten
const hoveredIndex = ref<number | null>(null)

/** True, wenn der KPI-Modus 'Gesamt' ist */
const isGesamt = computed(() => state.year === null && state.mode !== 'vergleich')
const isEinzeljahr2015 = computed(() => state.year === 2015)
const selectedYear = computed(() => state.year)
const selectedYearIndex = computed(() => {
  if (state.year === null) return null
  return state.year - 2015
})

const kpis = computed(() => {
  // TODO: yearlyValues und monthlyValues sind fast gleich, könnte man zusammenlegen
  function yearlyValues(field: 'ee' | 'co2' | 'price' | 'neg'): number[] {
    if (field === 'price') {
      const byY: Record<number, number[]> = {}
      for (const r of hourly.value) {
        const y = getBerlinYear(r.timestamp)
        if (y < 2015 || y > 2024) continue
        if (!byY[y]) byY[y] = []
        byY[y].push(r.price_eur_mwh)
      }
      // Alle 10 Jahre sicherstellen
      const years = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024]
      return years.map((y) => {
        const vals = byY[y]
        return vals ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      })
    }
    if (field === 'neg') {
      const byY: Record<number, number> = {}
      for (const r of hourly.value) {
        if (r.price_eur_mwh < 0) { const y = getBerlinYear(r.timestamp); byY[y] = (byY[y] ?? 0) + 1 }
      }
      // Alle 10 Jahre sicherstellen, auch Jahre mit 0 Negativstunden
      const years = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024]
      return years.map((y) => byY[y] ?? 0)
    }
    return yearly.value.map((y) => field === 'ee' ? y.avg_ee_share : y.avg_co2)
  }

  function monthlyValues(year: number, field: 'ee' | 'co2' | 'price' | 'neg'): number[] {
    const yd = hourly.value.filter((r) => getBerlinYear(r.timestamp) === year)
    const byM: number[][] = [[],[],[],[],[],[],[],[],[],[],[],[]]
    for (const r of yd) {
      const m = getBerlinMonth(r.timestamp) - 1 // 1-based → 0-based für Array
      let v: number
      if (field === 'ee') v = r.ee_share
      else if (field === 'co2') v = r.co2_g_per_kwh
      else if (field === 'price') v = r.price_eur_mwh
      else v = r.price_eur_mwh < 0 ? 1 : 0
      byM[m]!.push(v)
    }
    // Negativ: absolute Summe statt Mittelwert
    if (field === 'neg') {
      return byM.map((arr) => arr.reduce((a, b) => a + b, 0))
    }
    return Object.values(byM).map((arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
  }

  function singleYearValue(year: number, field: 'ee' | 'co2' | 'price' | 'neg'): number {
    const yd = hourly.value.filter((r) => getBerlinYear(r.timestamp) === year)
    if (!yd.length) return 0
    if (field === 'ee') return yd.reduce((s, r) => s + r.ee_share, 0) / yd.length
    if (field === 'co2') return yd.reduce((s, r) => s + r.co2_g_per_kwh, 0) / yd.length
    if (field === 'price') return yd.reduce((s, r) => s + r.price_eur_mwh, 0) / yd.length
    return yd.filter((r) => r.price_eur_mwh < 0).length
  }

  function buildDeltaStr(diff: number, unit: string, label: string): { label: string | null; positive: boolean; tooltip: string } | null {
    if (Math.abs(diff) < 0.05) return null
    const sign = diff > 0 ? '+' : ''
    const fmtDiff = Math.abs(diff).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const unitLower = unit === 'PP' ? 'pp' : unit
    return { label: `${label}: ${sign}${fmtDiff} ${unitLower}`, positive: diff > 0, tooltip: label }
  }

  function prevYear(y: number): number {
    const first = Math.min(...hourly.value.map((r) => getBerlinYear(r.timestamp)))
    return y > first ? y - 1 : y
  }

  interface KpiResult {
    value: string; unit: string; spark: number[]; sparkLabels: string[]
    deltaLabel: string | null; deltaPositive: boolean; deltaTooltip: string
    aggLabel: string
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
  ): KpiResult {
    return {
      value: field === 'co2' || field === 'neg' ? Math.round(displayValue).toLocaleString('de-DE') : displayValue.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      unit, spark, sparkLabels,
      deltaLabel, deltaPositive, deltaTooltip, aggLabel,
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
      const delta = buildDeltaStr(compV - baseV, f.deltaUnit, `${baseY} → ${compY}`) ?? { label: null, positive: true, tooltip: '' }
      result[f.key] = buildResult(f.key, compV, f.unit, sv.spark, sv.labels, String(compY),
        delta.label, delta.positive, delta.tooltip)
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
      return buildDeltaStr(diff, cfg.deltaUnit, '2015 → 2024') ?? { label: null, positive: true, tooltip: '' }
    }
    if (year) {
      if (year === 2015) return { label: null, positive: true, tooltip: '' }
      const prevV = singleYearValue(prevYear(year), cfg.key)
      const diff = displayVal - prevV
      return buildDeltaStr(diff, cfg.deltaUnit, 'vs. Vorjahr') ?? { label: null, positive: true, tooltip: '' }
    }
    return { label: null, positive: true, tooltip: '' }
  }

  const result: Record<string, KpiResult> = {}
  for (const cfg of cfgs) {
    const { spark, labels, aggLabel, displayVal } = getSparkline(cfg)
    const delta = getDelta(cfg, displayVal)
    result[cfg.key] = buildResult(cfg.key, displayVal, cfg.unit, spark, labels, aggLabel,
      delta.label, delta.positive, delta.tooltip)
  }
  return result as any
})
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <div>
        <span class="dashboard-eyebrow">Stromerzeugung 2015–2024</span>
        <h1 class="dashboard-title">Die Klimabilanz des deutschen Stroms</h1>
        <p class="dashboard-subtitle">Eine interaktive Analyse auf Basis von SMARD- (Erzeugung), UBA- (Emissionsfaktoren) und ENTSO-E-Daten (Preise).</p>
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
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="CO₂-Intensität" :value="kpis.co2.value" :unit="kpis.co2.unit"
            :agg-label="kpis.co2.aggLabel"
            :sparkline-data="kpis.co2.spark" :spark-labels="kpis.co2.sparkLabels"
            :delta-label="kpis.co2.deltaLabel" :delta-positive="kpis.co2.deltaPositive" :delta-tooltip="kpis.co2.deltaTooltip"
            :spark-color="'#6B4423'" :show-divider="true"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Day-Ahead-Preis" :value="kpis.price.value" :unit="kpis.price.unit"
            :agg-label="kpis.price.aggLabel"
            :sparkline-data="kpis.price.spark" :spark-labels="kpis.price.sparkLabels"
            :delta-label="kpis.price.deltaLabel" :delta-positive="kpis.price.deltaPositive" :delta-tooltip="kpis.price.deltaTooltip"
            :spark-color="'#D97742'" :show-divider="true"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Negativpreis-Stunden" :value="kpis.neg.value" :unit="kpis.neg.unit"
            :agg-label="kpis.neg.aggLabel"
            :sparkline-data="kpis.neg.spark" :spark-labels="kpis.neg.sparkLabels"
            :delta-label="kpis.neg.deltaLabel" :delta-positive="kpis.neg.deltaPositive" :delta-tooltip="kpis.neg.deltaTooltip"
            :spark-color="'#E8B547'" :show-divider="false"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
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
          <div v-if="monthlyMixLoading" class="chart-loading">Monatsdaten werden geladen …</div>
          <div v-else-if="monthlyMixError" class="chart-error">{{ monthlyMixError }}</div>
          <div v-else-if="monthlyMix.length === 0" class="chart-empty">Keine Monatsdaten für den Strommix verfügbar.</div>
          <VizStackedArea v-else :data="monthlyMix" />
        </div>
        <aside class="context-panel context-panel-new">
          <ExtremeValuesPanel :monthly-data="monthlyData" :agg-level="aggLevel" :mode="chartMode" />
          <div class="comp-spacer"></div>
          <StartEndComparison :monthly-data="monthlyData" @highlight-change="onHighlightChange" />
        </aside>
      </section>

      <!-- Zusammenhänge -->
      <section v-if="activeTab === 'zusammenhaenge'" class="tab-content">
        <div v-if="monthlyMixLoading" class="chart-loading">Tagesdaten werden geladen …</div>
        <div v-else-if="monthlyMixError" class="chart-error">{{ monthlyMixError }}</div>
        <div v-else-if="scatterDaily.length === 0" class="chart-empty">Keine Tagesdaten für das Streudiagramm verfügbar.</div>
        <VizScatterSimple v-else :data="scatterDaily" />
      </section>

      <!-- Tagesmuster -->
      <section v-if="activeTab === 'tagesmuster'" class="tab-content">
        <div v-if="monthlyMixLoading" class="chart-loading">CO₂-Daten werden geladen …</div>
        <div v-else-if="monthlyMixError" class="chart-error">{{ monthlyMixError }}</div>
        <div v-else-if="heatmapCo2.length === 0" class="chart-empty">Keine CO₂-Heatmap-Daten verfügbar.</div>
        <VizHeatmapCO2 v-else :data="heatmapCo2" />
      </section>

      <!-- Preise -->
      <section v-if="activeTab === 'preise'" class="tab-content">
        <Suspense>
          <VizHourlyProfile :data="hourly" />
          <template #fallback>
            <div class="chart-loading">Visualisierung wird geladen …</div>
          </template>
        </Suspense>
      </section>

      <footer class="dashboard-footer">
        <span>API: SMARD (Erzeugung), ENTSO-E (Preise) &middot; Datenquelle: UBA (Emissionsfaktoren)</span>
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
  white-space: nowrap;
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


