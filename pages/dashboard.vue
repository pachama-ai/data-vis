<script setup lang="ts">
/**
 * dashboard.vue – Haupt-Dashboard-Seite.
 *
 * Zwei Tabs: Strommix (KPIs, StackedArea, HeatmapCO2)
 * und Einflussfaktoren (ScatterSimple).
 * Lädt visualization-data.json einmalig bei onMounted
 * und verteilt die Daten an die Visualisierungskomponenten.
 * Keine fachliche Aggregation – alle Werte sind build-time berechnet.
 */

import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useVisualizationData } from '~/composables/useVisualizationData'
import type { VisualizationData } from '~/types/visualization-data'

import VizStackedArea from '~/components/viz/StackedArea.vue'

const VizScatterSimple = defineAsyncComponent(() => import('~/components/viz/ScatterSimple.vue'))
const VizHeatmapCO2 = defineAsyncComponent(() => import('~/components/viz/HeatmapCO2.vue'))

// ── Daten ──
// Ein zentrales Ref. Die vier Arrays werden via Computed abgeleitet,
// sodass es nur eine Zustandsquelle gibt.
const visualizationData = ref<VisualizationData | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)

const monthlyMix = computed(() => visualizationData.value?.monthlyMix ?? [])
const heatmapCo2 = computed(() => visualizationData.value?.heatmapCo2 ?? [])
const scatterDaily = computed(() => visualizationData.value?.scatterDaily ?? [])
const yearlyMix = computed(() => visualizationData.value?.yearlyMix ?? [])

// KPI-Datensatz für 2024 – direkt aus yearlyMix, keine Aggregation.
const yearlyMix2024 = computed(() =>
  yearlyMix.value.find((p) => p.year === 2024) ?? null,
)

function formatPercent(v: number): string { return v.toFixed(1) + ' %' }
function formatCo2(v: number): string { return Math.round(v) + ' g CO\u2082/kWh' }
function formatTwh(vMwh: number): string { return (vMwh / 1_000_000).toFixed(1) + ' TWh' }

// ── Laden ──
const { loadVisualizationData } = useVisualizationData()

async function loadDashboardData(): Promise<void> {
  isLoading.value = true
  loadError.value = null

  try {
    visualizationData.value = await loadVisualizationData()
  } catch (caughtError: unknown) {
    loadError.value =
      caughtError instanceof Error
        ? caughtError.message
        : 'Die Visualisierungsdaten konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboardData)

// ── Tabs ──
type DashboardTab = 'strommix' | 'einflussfaktoren'
const activeTab = ref<DashboardTab>('strommix')
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <div>
        <span class="dashboard-eyebrow">Stromerzeugung 2015\u20132024</span>
        <h1 class="dashboard-title">Die Klimabilanz des deutschen Stroms</h1>
        <p class="dashboard-subtitle">
          Eine interaktive Analyse auf Basis von SMARD- (Erzeugung), UBA- (Emissionsfaktoren)
          und ENTSO-E-Daten (Preise).
        </p>
      </div>
      <NuxtLink to="/" class="back-link">\u2190 Zur\u00fcck zur \u00dcbersicht</NuxtLink>
    </header>

    <p v-if="isLoading" class="dashboard-loading">Daten werden geladen \u2026</p>
    <p v-else-if="loadError" class="dashboard-error" role="alert">{{ loadError }}</p>

    <template v-else-if="visualizationData">
      <!-- KPI-Zahlen 2024 -->
      <section class="kpi-section">
        <div v-if="!yearlyMix2024" class="kpi-empty">F\u00fcr 2024 sind keine KPI-Daten verf\u00fcgbar.</div>
        <div v-else class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">EE-Anteil 2024</span>
            <span class="kpi-value">{{ formatPercent(yearlyMix2024.renewableSharePercent) }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">CO\u2082-Intensit\u00e4t 2024</span>
            <span class="kpi-value">{{ formatCo2(yearlyMix2024.co2GramsPerKwh) }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Gesamterzeugung 2024</span>
            <span class="kpi-value">{{ formatTwh(yearlyMix2024.totalGenerationMwh) }}</span>
          </div>
        </div>
      </section>

      <!-- Tab-Navigation -->
      <nav class="tab-nav">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'strommix' }"
          :aria-pressed="activeTab === 'strommix'"
          @click="activeTab = 'strommix'"
        >Strommix</button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'einflussfaktoren' }"
          :aria-pressed="activeTab === 'einflussfaktoren'"
          @click="activeTab = 'einflussfaktoren'"
        >Einflussfaktoren</button>
      </nav>

      <!-- Strommix -->
      <section v-if="activeTab === 'strommix'" class="tab-content">
        <div class="overview-stacked">
          <VizStackedArea :data="monthlyMix" />
        </div>
        <div class="overview-heatmap">
          <VizHeatmapCO2 :data="heatmapCo2" />
        </div>
      </section>

      <!-- Einflussfaktoren -->
      <section v-if="activeTab === 'einflussfaktoren'" class="tab-content">
        <VizScatterSimple :data="scatterDaily" />
      </section>

      <footer class="dashboard-footer">
        <span>API: SMARD (Erzeugung), ENTSO-E (Preise) \u00b7 Datenquelle: UBA (Emissionsfaktoren)</span>
      </footer>
    </template>

    <p v-else class="dashboard-loading">Keine Visualisierungsdaten verf\u00fcgbar.</p>
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
.kpi-empty {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg-muted);
  padding: 24px 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-label {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.kpi-value {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 500;
  color: var(--fg);
  line-height: 1.2;
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

.overview-stacked {
  margin-bottom: 48px;
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

@media (max-width: 900px) {
  .dashboard-header { flex-direction: column; gap: 8px; }
}
@media (max-width: 600px) {
  .dashboard-page { padding: 20px; }
  .kpi-grid { grid-template-columns: 1fr; gap: 16px; }
  .tab-btn { margin-right: 16px; font-size: 0.72rem; }
}
</style>


