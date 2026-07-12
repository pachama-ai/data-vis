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
  // Vergleichsmodus
  if (state.mode === 'vergleich') {
    const baseY = state.baseYear
    const compY = state.compareYear
    const baseData = dataForYear(hourly.value, baseY)
    const compData = dataForYear(hourly.value, compY)
    if (!baseData.length || !compData.length) return null

    const baseEE = baseData.reduce((s, r) => s + r.ee_share, 0) / baseData.length
    const compEE = compData.reduce((s, r) => s + r.ee_share, 0) / compData.length
    const baseCO2 = baseData.reduce((s, r) => s + r.co2_g_per_kwh, 0) / baseData.length
    const compCO2 = compData.reduce((s, r) => s + r.co2_g_per_kwh, 0) / compData.length
    const basePrice = baseData.reduce((s, r) => s + r.price_eur_mwh, 0) / baseData.length
    const compPrice = compData.reduce((s, r) => s + r.price_eur_mwh, 0) / compData.length
    const baseNeg = baseData.filter((r) => r.price_eur_mwh < 0).length
    const compNeg = compData.filter((r) => r.price_eur_mwh < 0).length

    const sparkLabels = [String(baseY), String(compY)]
    const sparkEE = [baseEE, compEE]
    const sparkCO2 = [baseCO2, compCO2]
    const sparkPrice = [basePrice, compPrice]
    const sparkNeg = [baseNeg, compNeg]

    function buildDelta(current: number, base: number, unit: string, betterWhenHigher: boolean, isSum: boolean) {
      const diff = current - base
      if (Math.abs(diff) < 0.05) return { label: null, positive: true, tooltip: '' }
      const sign = diff > 0 ? '+' : ''
      const pos = betterWhenHigher ? diff > 0 : diff < 0
      return {
        label: `${sign}${diff.toFixed(1)} ${unit} vs. ${baseY}`,
        positive: pos,
        tooltip: `Differenz zwischen ${compY} und ${baseY}`,
      }
    }

    function sparkMinMax(arr: number[], decimals = 1): { min: string; max: string } {
      const mn = Math.min(...arr); const mx = Math.max(...arr)
      return { min: mn.toFixed(decimals), max: mx.toFixed(decimals) }
    }

    return {
      ee: {
        value: compEE.toFixed(1), unit: '%', spark: sparkEE, sparkLabels,
        deltaLabel: buildDelta(compEE, baseEE, 'PP', true, false).label,
        deltaPositive: buildDelta(compEE, baseEE, 'PP', true, false).positive,
        deltaTooltip: buildDelta(compEE, baseEE, 'PP', true, false).tooltip,
        aggLabel: String(compY), minMax: sparkMinMax(sparkEE),
      },
      co2: {
        value: compCO2.toFixed(0), unit: 'g/kWh', spark: sparkCO2, sparkLabels,
        deltaLabel: buildDelta(compCO2, baseCO2, 'g/kWh', false, false).label,
        deltaPositive: buildDelta(compCO2, baseCO2, 'g/kWh', false, false).positive,
        deltaTooltip: buildDelta(compCO2, baseCO2, 'g/kWh', false, false).tooltip,
        aggLabel: String(compY), minMax: sparkMinMax(sparkCO2, 0),
      },
      price: {
        value: compPrice.toFixed(1), unit: 'EUR/MWh', spark: sparkPrice, sparkLabels,
        deltaLabel: buildDelta(compPrice, basePrice, 'EUR/MWh', false, false).label,
        deltaPositive: buildDelta(compPrice, basePrice, 'EUR/MWh', false, false).positive,
        deltaTooltip: buildDelta(compPrice, basePrice, 'EUR/MWh', false, false).tooltip,
        aggLabel: String(compY), minMax: sparkMinMax(sparkPrice),
      },
      neg: {
        value: compNeg.toLocaleString('de-DE'), unit: 'h', spark: sparkNeg, sparkLabels,
        deltaLabel: buildDelta(compNeg, baseNeg, 'h', false, true).label,
        deltaPositive: buildDelta(compNeg, baseNeg, 'h', false, true).positive,
        deltaTooltip: buildDelta(compNeg, baseNeg, 'h', false, true).tooltip,
        aggLabel: String(compY), minMax: sparkMinMax(sparkNeg, 0),
      },
    }
  }

  const data = filteredKpiData(hourly.value)
  if (!data.length) return null
  const avgEE = data.reduce((s, r) => s + r.ee_share, 0) / data.length
  const avgCO2 = data.reduce((s, r) => s + r.co2_g_per_kwh, 0) / data.length
  const avgPrice = data.reduce((s, r) => s + r.price_eur_mwh, 0) / data.length
  const negHours = data.filter((r) => r.price_eur_mwh < 0).length

  // Sparklines: 10-Jahres-Trend
  const sparkLabels = [...Array(10).keys()].map((i) => String(2015 + i))
  const sparkEE: number[] = yearly.value.map((y) => y.avg_ee_share)
  const sparkCO2: number[] = yearly.value.map((y) => y.avg_co2)

  // Preis-Sparkline pro Jahr
  const priceByYear: Record<number, number[]> = {}
  for (const r of hourly.value) {
    const y = new Date(r.timestamp).getUTCFullYear()
    if (!priceByYear[y]) priceByYear[y] = []
    priceByYear[y].push(r.price_eur_mwh)
  }
  const sparkPrice = Object.keys(priceByYear).sort()
    .map((y) => (priceByYear[Number(y)] ?? [0]).reduce((a, b) => a + b, 0) / (priceByYear[Number(y)] ?? [1]).length)

  // Negativ-Sparkline pro Jahr
  const negByYearAll: Record<number, number> = {}
  for (const r of hourly.value) {
    if (r.price_eur_mwh < 0) {
      const y = new Date(r.timestamp).getUTCFullYear()
      negByYearAll[y] = (negByYearAll[y] ?? 0) + 1
    }
  }
  const sparkNeg: number[] = Object.keys(negByYearAll).sort().map((y) => negByYearAll[Number(y)] ?? 0)

  // Aggregations-Label
  const isAll = state.year === null
  const yearLabel = isAll ? '2015–2024' : String(state.year)
  const aggLabel = (isSum: boolean) => isAll
    ? (isSum ? `Σ ${yearLabel}` : `Ø ${yearLabel}`)
    : yearLabel

  // Delta / Trend-Logik
  function buildDelta(
    current: number,
    spark: number[],
    unit: string,
    betterWhenHigher: boolean,
    isSum: boolean,
  ): { label: string | null; positive: boolean; tooltip: string } {
    if (state.year === 2015) {
      return { label: null, positive: true, tooltip: '' }
    }
    if (state.year !== null) {
      const base = yearValue(2015, isSum ? 'neg' : betterWhenHigher ? 'ee' : 'co2')
      if (base === null) return { label: null, positive: true, tooltip: '' }
      const diff = current - base
      if (Math.abs(diff) < 0.05) return { label: null, positive: true, tooltip: '' }
      const sign = diff > 0 ? '+' : ''
      const pos = betterWhenHigher ? diff > 0 : diff < 0
      const tip = unit === 'PP' ? 'Differenz in Prozentpunkten gegenüber 2015' : `Differenz gegenüber 2015`
      return { label: `${sign}${diff.toFixed(1)} ${unit} vs. 2015`, positive: pos, tooltip: tip }
    }
    // Gesamtzeitraum
    if (spark.length < 2) return { label: null, positive: true, tooltip: '' }
    const startVal = spark[0] as number
    const endVal = spark[spark.length - 1] as number
    const trend = endVal - startVal
    if (Math.abs(trend) < 0.05) return { label: null, positive: true, tooltip: '' }
    const sign = trend > 0 ? '+' : ''
    const pos = betterWhenHigher ? trend > 0 : trend < 0
    const tip = unit === 'PP'
      ? 'Trend: Differenz in Prozentpunkten zwischen 2015 und 2024'
      : 'Trend: Differenz zwischen 2015 und 2024'
    return { label: `Trend 2015→2024: ${sign}${trend.toFixed(1)} ${unit}`, positive: pos, tooltip: tip }
  }

  // Min/Max für Sparklines
  function sparkMinMax(arr: number[], decimals = 1): { min: string; max: string } {
    const mn = Math.min(...arr)
    const mx = Math.max(...arr)
    return { min: mn.toFixed(decimals), max: mx.toFixed(decimals) }
  }

  const eeDelta = buildDelta(avgEE, sparkEE, 'PP', true, false)
  const co2Delta = buildDelta(avgCO2, sparkCO2, 'g/kWh', false, false)
  const priceDelta = buildDelta(avgPrice, sparkPrice, 'EUR/MWh', false, false)
  const negDelta = buildDelta(negHours, sparkNeg, 'h', false, true)

  return {
    ee: {
      value: avgEE.toFixed(1), unit: '%', spark: sparkEE, sparkLabels,
      deltaLabel: eeDelta.label, deltaPositive: eeDelta.positive, deltaTooltip: eeDelta.tooltip,
      aggLabel: aggLabel(false), minMax: sparkMinMax(sparkEE),
    },
    co2: {
      value: avgCO2.toFixed(0), unit: 'g/kWh', spark: sparkCO2, sparkLabels,
      deltaLabel: co2Delta.label, deltaPositive: co2Delta.positive, deltaTooltip: co2Delta.tooltip,
      aggLabel: aggLabel(false), minMax: sparkMinMax(sparkCO2, 0),
    },
    price: {
      value: avgPrice.toFixed(1), unit: 'EUR/MWh', spark: sparkPrice, sparkLabels,
      deltaLabel: priceDelta.label, deltaPositive: priceDelta.positive, deltaTooltip: priceDelta.tooltip,
      aggLabel: aggLabel(false), minMax: sparkMinMax(sparkPrice),
    },
    neg: {
      value: negHours.toLocaleString('de-DE'), unit: 'h', spark: sparkNeg, sparkLabels,
      deltaLabel: negDelta.label, deltaPositive: negDelta.positive, deltaTooltip: negDelta.tooltip,
      aggLabel: aggLabel(true), minMax: sparkMinMax(sparkNeg, 0),
    },
  }
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
  margin-bottom: 48px;
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


