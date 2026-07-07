<script setup lang="ts">
import { ref, computed } from 'vue'
import { useData } from '~/composables/useData'
import { useFilters } from '~/composables/useFilters'
import type { HourlyRow, YearlyRow } from '~/composables/useData'

const { loadHourly, loadYearly } = useData()
const { state, filteredKpiData } = useFilters()

const hourly = ref<HourlyRow[]>([])
const yearly = ref<YearlyRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

const kpiFiltered = computed(() => filteredKpiData(hourly.value))

// Tab-Navigation
const activeTab = ref<'ueberblick' | 'zusammenhaenge' | 'tagesmuster' | 'preise'>('ueberblick')

const tabs = [
  { id: 'ueberblick' as const, label: 'Überblick' },
  { id: 'zusammenhaenge' as const, label: 'Zusammenhänge' },
  { id: 'tagesmuster' as const, label: 'Tagesmuster' },
  { id: 'preise' as const, label: 'Preise' },
]
const selectedDay = ref<string | undefined>(undefined)
function handleDaySelected(isoDate: string) { selectedDay.value = isoDate }

// Sparkline-Hover-Sync
const hoveredIndex = ref<number | null>(null)

// Hilfsfunktion: Wert aus 2015 als Baseline
function get2015Baseline(field: string): number | null {
  const entry = yearly.value.find((y) => y.year === 2015)
  if (!entry) return null
  if (field === 'ee') return entry.avg_ee_share
  if (field === 'co2') return entry.avg_co2
  if (field === 'price') {
    const yd = hourly.value.filter((r) => new Date(r.timestamp).getUTCFullYear() === 2015)
    return yd.length ? yd.reduce((s, r) => s + r.price_eur_mwh, 0) / yd.length : null
  }
  if (field === 'neg') {
    return hourly.value.filter((r) => new Date(r.timestamp).getUTCFullYear() === 2015 && r.price_eur_mwh < 0).length
  }
  return null
}

const isGesamt = computed(() => state.year === null)
const isEinzeljahr2015 = computed(() => state.year === 2015)
const selectedYear = computed(() => state.year)
const selectedYearIndex = computed(() => {
  if (state.year === null) return null
  return state.year - 2015
})

const kpis = computed(() => {
  const data = kpiFiltered.value
  if (!data.length) return null
  const avgEE = data.reduce((s, r) => s + r.ee_share, 0) / data.length
  const avgCO2 = data.reduce((s, r) => s + r.co2_g_per_kwh, 0) / data.length
  const avgPrice = data.reduce((s, r) => s + r.price_eur_mwh, 0) / data.length
  const negHours = data.filter((r) => r.price_eur_mwh < 0).length

  // Sparklines: 10-Jahres-Trend
  const sparkLabels = [...Array(10).keys()].map((i) => String(2015 + i))
  const sparkEE = yearly.value.map((y) => y.avg_ee_share)
  const sparkCO2 = yearly.value.map((y) => y.avg_co2)

  // Preis-Sparkline pro Jahr
  const priceByYear: Record<number, number[]> = {}
  for (const r of hourly.value) {
    const y = new Date(r.timestamp).getUTCFullYear()
    if (!priceByYear[y]) priceByYear[y] = []
    priceByYear[y].push(r.price_eur_mwh)
  }
  const sparkPrice = Object.keys(priceByYear).sort()
    .map((y) => priceByYear[Number(y)].reduce((a, b) => a + b, 0) / priceByYear[Number(y)].length)

  // Negativ-Sparkline pro Jahr
  const negByYearAll: Record<number, number> = {}
  for (const r of hourly.value) {
    if (r.price_eur_mwh < 0) {
      const y = new Date(r.timestamp).getUTCFullYear()
      negByYearAll[y] = (negByYearAll[y] ?? 0) + 1
    }
  }
  const sparkNeg = Object.keys(negByYearAll).sort().map((y) => negByYearAll[Number(y)])

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
      // Einzeljahr 2015 → kein Delta
      return { label: null, positive: true, tooltip: '' }
    }
    if (state.year !== null) {
      // Einzeljahr > 2015 → Delta vs. 2015
      const base = get2015Baseline(isSum ? 'neg' : betterWhenHigher ? 'ee' : 'co2')
      if (base === null) return { label: null, positive: true, tooltip: '' }
      const diff = current - base
      if (Math.abs(diff) < 0.05) return { label: null, positive: true, tooltip: '' }
      const sign = diff > 0 ? '+' : ''
      const pos = betterWhenHigher ? diff > 0 : diff < 0
      const tip = unit === 'PP' ? 'Differenz in Prozentpunkten gegenüber 2015' : `Differenz gegenüber 2015`
      return { label: `${sign}${diff.toFixed(1)} ${unit} vs. 2015`, positive: pos, tooltip: tip }
    }
    // Gesamtzeitraum → Trend 2015 → 2024 (Ende minus Anfang)
    if (spark.length < 2) return { label: null, positive: true, tooltip: '' }
    const startVal = spark[0]
    const endVal = spark[spark.length - 1]
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
      // Bei Gesamtzeitraum negHours ist die Summe, bei Einzeljahr die Stundenanzahl
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
        <h1 class="dashboard-title">Wovon hängt die Klimabilanz des deutschen Stroms ab?</h1>
        <p class="dashboard-subtitle">Der deutsche Strommix wird sauberer – aber auch volatiler. Erneuerbare Energien dominieren zunehmend, während Kohle an Bedeutung verliert. Eine interaktive Analyse auf Basis von SMARD-, UBA- und ENTSO-E-Daten, 2015–2024.</p>
      </div>
      <div class="header-meta">
        <span>Datenstand: 31.12.2024</span>
      </div>
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
            :spark-color="'var(--accent)'"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.ee.minMax.min" :max-label="kpis.ee.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="CO₂-Intensität" :value="kpis.co2.value" :unit="kpis.co2.unit"
            :agg-label="kpis.co2.aggLabel"
            :sparkline-data="kpis.co2.spark" :spark-labels="kpis.co2.sparkLabels"
            :delta-label="kpis.co2.deltaLabel" :delta-positive="kpis.co2.deltaPositive" :delta-tooltip="kpis.co2.deltaTooltip"
            :spark-color="kpis.co2.deltaPositive ? 'var(--accent)' : 'var(--fg-muted)'"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.co2.minMax.min" :max-label="kpis.co2.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Day-Ahead-Preis" :value="kpis.price.value" :unit="kpis.price.unit"
            :agg-label="kpis.price.aggLabel"
            :sparkline-data="kpis.price.spark" :spark-labels="kpis.price.sparkLabels"
            :delta-label="kpis.price.deltaLabel" :delta-positive="kpis.price.deltaPositive" :delta-tooltip="kpis.price.deltaTooltip"
            :spark-color="'var(--fg-muted)'"
            :hovered-index="hoveredIndex" :selected-index="selectedYearIndex"
            :min-label="kpis.price.minMax.min" :max-label="kpis.price.minMax.max"
            @hover="hoveredIndex = $event" @leave="hoveredIndex = null"
          />
          <DashboardKpiCard
            title="Negativpreis-Stunden" :value="kpis.neg.value" :unit="kpis.neg.unit"
            :agg-label="kpis.neg.aggLabel"
            :sparkline-data="kpis.neg.spark" :spark-labels="kpis.neg.sparkLabels"
            :delta-label="kpis.neg.deltaLabel" :delta-positive="kpis.neg.deltaPositive" :delta-tooltip="kpis.neg.deltaTooltip"
            :spark-color="'var(--fg-muted)'"
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
          <VizStackedArea :data="hourly" />
        </div>
        <aside class="context-panel">
          <div class="context-block">
            <h3 class="context-heading">Kernaussage</h3>
            <ul class="context-list">
              <li>Der <strong>EE-Anteil</strong> stieg von 27 % (2015) auf 57 % (2024) – ein Plus von 30 Prozentpunkten.</li>
              <li>Die <strong>CO₂-Intensität</strong> sank im gleichen Zeitraum um rund 70 g/kWh auf 342 g/kWh (2024).</li>
              <li>Kohle (Braunkohle + Steinkohle) verlor von 42 % auf 17 % Anteil am Strommix.</li>
              <li>Gas bleibt mit 9–14 % stabiler Backup-Energieträger.</li>
            </ul>
          </div>
          <div class="context-block">
            <h3 class="context-heading">Nächster Schritt</h3>
            <p class="context-text">Erkunde im Tab <strong>„Zusammenhänge“</strong>, welchen Einfluss der Strommix auf die CO₂-Intensität hat – und wann er besonders sauber oder besonders schmutzig ist.</p>
          </div>
        </aside>
      </section>

      <!-- Zusammenhänge -->
      <section v-if="activeTab === 'zusammenhaenge'" class="tab-content">
        <VizScatterAnalysis :data="hourly" />
      </section>

      <!-- Tagesmuster -->
      <section v-if="activeTab === 'tagesmuster'" class="tab-content">
        <VizHeatmapCO2 :data="hourly" @day-selected="handleDaySelected" />
      </section>

      <!-- Preise -->
      <section v-if="activeTab === 'preise'" class="tab-content">
        <VizDuckCurve :data="hourly" :selected-day="selectedDay" />
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
  margin-bottom: 18px;
}

.dashboard-title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 3vw, 44px);
  font-weight: 800;
  line-height: 1.08;
  max-width: 920px;
  letter-spacing: -0.03em;
  color: var(--fg);
  margin-bottom: 0;
}

.dashboard-subtitle {
  margin-top: 8px;
  color: var(--fg-muted);
  font-size: 14px;
  max-width: 700px;
  line-height: 1.5;
  font-family: var(--font-sans);
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
  margin-bottom: 20px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

/* Tab-Navigation – Print-Stil */
.tab-nav {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--hairline);
  padding: 0;
}

.tab-btn {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 8px 0;
  margin-right: 24px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  letter-spacing: 0.02em;
}

.tab-btn:hover {
  color: var(--fg);
}

.tab-btn.active {
  color: var(--fg);
  border-bottom-color: var(--fg);
  font-weight: 600;
}

.tab-content {
  margin-bottom: 24px;
}

/* Überblick-Layout */
.overview-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  align-items: start;
}

.overview-chart {
  min-width: 0;
}

/* Kontext-Panel – Print-Stil */
.context-panel {
  border-left: 1px solid var(--hairline);
  padding: 4px 0 4px 20px;
  position: sticky;
  top: 20px;
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
  font-size: 0.82rem;
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
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--fg);
}

.dashboard-loading, .dashboard-error {
  text-align: center;
  padding: 80px 0;
  font-size: 0.9rem;
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


