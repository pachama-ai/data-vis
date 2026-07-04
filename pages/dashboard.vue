<script setup lang="ts">
/**
 * pages/dashboard.vue — Haupt-Dashboard-Seite
 * =============================================
 *
 * Layout (CSS Grid, 2 Spalten):
 *   - Header: Titel + Untertitel links, FilterBar rechts
 *   - Zeile 1: StackedArea (Erzeugungsmix) | HeatmapCO2
 *   - Zeile 2: ScatterAnalysis (Zusammenhaenge) | DuckCurve
 *   - Zeile 3: KPI-Karten (4 nebeneinander)
 *   - Footer: Quellenangaben
 *
 * Cross-Viz-Verdrahtung:
 *   HeatmapCO2 emittiert @day-selected -> setzt selectedDay
 *   DuckCurve bekommt :selected-day="selectedDay"
 *
 * Daten werden einmalig via useData().loadHourly() geladen und als
 * Prop an alle Viz-Komponenten weitergegeben. Der Filter-State lebt
 * in useFilters() und wird von der FilterBar geschrieben.
 */

import { ref, computed } from 'vue'
import { useData } from '~/composables/useData'
import { useFilters } from '~/composables/useFilters'
import type { HourlyRow, YearlyRow } from '~/composables/useData'

const { loadHourly, loadYearly } = useData()
const { state, filteredHours } = useFilters()

// ----------------------------------------------------------------
// Daten laden (einmalig beim Mount)
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// Gefilterte Daten (reagiert auf Filter-Aenderungen)
// ----------------------------------------------------------------
const filtered = computed(() => filteredHours(hourly.value))

// ----------------------------------------------------------------
// Cross-Vis-Verdrahtung: Heatmap -> DuckCurve
// ----------------------------------------------------------------
const selectedDay = ref<string | undefined>(undefined)

function handleDaySelected(isoDate: string) {
  selectedDay.value = isoDate
}

// ----------------------------------------------------------------
// KPI-Berechnungen
// ----------------------------------------------------------------
const kpis = computed(() => {
  const data = hourly.value
  if (!data.length) return null

  const avgEE = data.reduce((s, r) => s + r.ee_share, 0) / data.length
  const avgCO2 = data.reduce((s, r) => s + r.co2_g_per_kwh, 0) / data.length
  const avgPrice = data.reduce((s, r) => s + r.price_eur_mwh, 0) / data.length
  const negHours = data.filter((r) => r.price_eur_mwh < 0).length

  // Sparkline: Jahresverlauf aus yearly_mix
  const sparkEE = yearly.value.map((y) => y.avg_ee_share)
  const sparkCO2 = yearly.value.map((y) => y.avg_co2)

  // Preis-Verlauf aus hourly pro Jahr
  const priceByYear: Record<number, number[]> = {}
  for (const r of data) {
    const y = new Date(r.timestamp).getUTCFullYear()
    if (!priceByYear[y]) priceByYear[y] = []
    priceByYear[y].push(r.price_eur_mwh)
  }
  const sparkPrice = Object.keys(priceByYear).sort()
    .map((y) => priceByYear[Number(y)].reduce((a, b) => a + b, 0) / priceByYear[Number(y)].length)

  // Negativ-Stunden pro Jahr
  const negByYear: Record<number, number> = {}
  for (const r of data) {
    if (r.price_eur_mwh < 0) {
      const y = new Date(r.timestamp).getUTCFullYear()
      negByYear[y] = (negByYear[y] ?? 0) + 1
    }
  }
  const negYears = Object.keys(negByYear).sort().map(Number)
  const sparkNeg = negYears.map((y) => negByYear[y])

  // Delta: letztes vs erstes Jahr
  const years = yearly.value
  const first = years[0]
  const last = years[years.length - 1]
  const firstNeg = negByYear[negYears[0]] ?? 0
  const lastNeg = negByYear[negYears[negYears.length - 1]] ?? 0

  // Preis-Delta: erster vs letzter Jahresdurchschnitt
  const firstPrice = priceByYear[first.year]?.reduce((a, b) => a + b, 0) / (priceByYear[first.year]?.length ?? 1)
  const lastPrice = priceByYear[last.year]?.reduce((a, b) => a + b, 0) / (priceByYear[last.year]?.length ?? 1)

  return {
    ee: {
      value: avgEE.toFixed(1), unit: '%',
      spark: sparkEE,
      delta: `${(last.avg_ee_share - first.avg_ee_share) > 0 ? '+' : ''}${(last.avg_ee_share - first.avg_ee_share).toFixed(1)} PP vs. ${first.year}`,
      positive: last.avg_ee_share >= first.avg_ee_share,
    },
    co2: {
      value: avgCO2.toFixed(0), unit: 'g/kWh',
      spark: sparkCO2,
      delta: `${(last.avg_co2 - first.avg_co2) <= 0 ? '' : '+'}${(last.avg_co2 - first.avg_co2).toFixed(1)} g/kWh vs. ${first.year}`,
      positive: last.avg_co2 <= first.avg_co2,
    },
    price: {
      value: avgPrice.toFixed(1), unit: 'EUR/MWh',
      spark: sparkPrice,
      delta: `${(lastPrice - firstPrice) > 0 ? '+' : ''}${(lastPrice - firstPrice).toFixed(1)} EUR/MWh vs. ${first.year}`,
      positive: false,
    },
    neg: {
      value: negHours.toLocaleString('de-DE'), unit: 'h',
      spark: sparkNeg,
      delta: `${(lastNeg - firstNeg) > 0 ? '+' : ''}${(lastNeg - firstNeg)} h vs. ${negYears[0]}`,
      positive: lastNeg <= firstNeg,
    },
  }
})
</script>

<template>
  <div class="dashboard">
    <!-- Header: Titel + Untertitel links, FilterBar rechts -->
    <header class="dashboard-header">
      <div class="dashboard-intro">
        <h1 class="dashboard-title">Wovon haengt die Klimabilanz des deutschen Stroms ab?</h1>
        <p class="dashboard-subtitle">
          Eine interaktive Analyse auf Basis von SMARD- und ENTSO-E-Daten, 2015-2024.
        </p>
      </div>
      <div class="dashboard-filter">
        <DashboardFilterBar />
      </div>
    </header>

    <!-- Ladezustand -->
    <div v-if="loading" class="dashboard-loading">Daten werden geladen...</div>
    <div v-else-if="error" class="dashboard-error">{{ error }}</div>

    <!-- Dashboard-Inhalt -->
    <template v-if="!loading && !error">
      <!-- Grid: Viz 1 + Viz 2 (Zeile 1) -->
      <div class="viz-grid">
        <VizStackedArea :data="filtered" />
        <VizHeatmapCO2 :data="filtered" @day-selected="handleDaySelected" />
      </div>

      <!-- Grid: Viz 3 + Viz 4 (Zeile 2) -->
      <div class="viz-grid">
        <VizScatterAnalysis :data="filtered" />
        <VizDuckCurve :data="hourly" :selected-day="selectedDay" />
      </div>

      <!-- KPI-Reihe (Zeile 3) -->
      <div v-if="kpis" class="kpi-row">
        <DashboardKpiCard
          title="EE-Anteil (Durchschnitt)"
          :value="kpis.ee.value"
          :unit="kpis.ee.unit"
          :sparkline-data="kpis.ee.spark"
          :delta-label="kpis.ee.delta"
          :delta-positive="kpis.ee.positive"
        />
        <DashboardKpiCard
          title="CO2-Intensitaet (Durchschnitt)"
          :value="kpis.co2.value"
          :unit="kpis.co2.unit"
          :sparkline-data="kpis.co2.spark"
          :delta-label="kpis.co2.delta"
          :delta-positive="kpis.co2.positive"
        />
        <DashboardKpiCard
          title="Day-Ahead-Preis (Durchschnitt)"
          :value="kpis.price.value"
          :unit="kpis.price.unit"
          :sparkline-data="kpis.price.spark"
          :delta-label="kpis.price.delta"
          :delta-positive="kpis.price.positive"
        />
        <DashboardKpiCard
          title="Stunden mit negativen Preisen"
          :value="kpis.neg.value"
          :unit="kpis.neg.unit"
          :sparkline-data="kpis.neg.spark"
          :delta-label="kpis.neg.delta"
          :delta-positive="kpis.neg.positive"
        />
      </div>

      <!-- Footer -->
      <footer class="dashboard-footer">
        Quelle: SMARD (Erzeugung, installierte Leistung), ENTSO-E (Stromfluesse, Preise),
        UBA-Emissionsfaktoren  &bull;
        Technologiestack: Vue / D3 / Nuxt  &bull;
        Datenstand: Mai 2025
      </footer>
    </template>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Dashboard-Container
   ---------------------------------------------------------------- */
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ----------------------------------------------------------------
   Header
   ---------------------------------------------------------------- */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 8px;
}

.dashboard-intro {
  flex: 1;
  min-width: 0;
}

.dashboard-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 4px;
  line-height: 1.3;
}

.dashboard-subtitle {
  font-size: 0.8rem;
  color: var(--fg-muted);
  margin: 0;
}

.dashboard-filter {
  flex-shrink: 0;
}

/* ----------------------------------------------------------------
   Ladezustand
   ---------------------------------------------------------------- */
.dashboard-loading,
.dashboard-error {
  text-align: center;
  padding: 80px 0;
  font-size: 0.9rem;
  color: var(--fg-muted);
}

.dashboard-error {
  color: #dc2626;
}

/* ----------------------------------------------------------------
   Viz-Grid (2 Spalten)
   ---------------------------------------------------------------- */
.viz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* ----------------------------------------------------------------
   KPI-Reihe (4 Spalten)
   ---------------------------------------------------------------- */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

/* ----------------------------------------------------------------
   Footer
   ---------------------------------------------------------------- */
.dashboard-footer {
  text-align: center;
  font-size: 0.7rem;
  color: var(--fg-muted);
  padding: 20px 0 8px;
  border-top: 1px solid var(--border);
  line-height: 1.6;
}
</style>


