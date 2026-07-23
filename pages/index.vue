<script setup lang="ts">
/**
 * pages/index.vue — Intro-Landingpage (GroupedBar-Version)
 * =========================================================
 * Zeigt den Wandel des deutschen Strommix 2015→2024 als
 * horizontales gruppiertes Balkendiagramm (D3). Lädt Dashboard-
 * Daten im Hintergrund vor (requestIdleCallback).
 */

import { ref, computed, onMounted } from 'vue'
import { useVisualizationData } from '~/composables/useVisualizationData'
import type { YearlyMixPoint } from '~/types/visualization-data'
import type { EnergyDataPoint } from '~/components/intro/GroupedBarChart.vue'
import {
  ITEM_CONFIG,
  calculateSharePercent,
  transformYearlyDataToChartData,
} from '~/pages/index.transform'

const { loadVisualizationData } = useVisualizationData()

const yearlyData = ref<{ year2015: YearlyMixPoint; year2024: YearlyMixPoint } | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// ── Transformation: YearlyMixPoint → EnergyDataPoint[] ──
// Die Logik (calculateSharePercent, ITEM_CONFIG) ist in
// pages/index.transform.ts ausgelagert und dort getestet.

const strommixData = computed<EnergyDataPoint[]>(() => {
  const yearlyDataValue = yearlyData.value
  if (yearlyDataValue === null) {
    return []
  }
  return transformYearlyDataToChartData(yearlyDataValue.year2015, yearlyDataValue.year2024)
})

onMounted(async () => {
  try {
    const data = await loadVisualizationData()
    const y2015 = data.yearlyMix.find((y) => y.year === 2015)
    const y2024 = data.yearlyMix.find((y) => y.year === 2024)
    if (!y2015 || !y2024) {
      throw new Error('Jahresdaten unvollständig')
    }
    yearlyData.value = { year2015: y2015, year2024: y2024 }
  } catch (caughtError: unknown) {
    error.value =
      caughtError instanceof Error
        ? caughtError.message
        : 'Die Visualisierungsdaten konnten nicht geladen werden.'
  } finally {
    loading.value = false
  }

  // Dashboard-Daten im Hintergrund vorladen (kein Fehler nötig)
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => { loadVisualizationData().catch(() => {}) }, { timeout: 5000 })
  } else {
    setTimeout(() => { loadVisualizationData().catch(() => {}) }, 2000)
  }
})
</script>

<template>
  <div class="intro-page">
    <div class="intro-top-bar">
      <IntroHero />
      <IntroTrustLine />
      <NuxtLink to="/dashboard" class="dashboard-arrow" aria-label="Zum Dashboard" title="Zum Dashboard">
        <span aria-hidden="true">→</span>
      </NuxtLink>
    </div>
    <div v-if="loading" class="chart-loading">
      <div class="chart-skeleton"></div>
    </div>
    <div v-else-if="error" class="chart-error">
      {{ error }}
    </div>
    <div v-else-if="!yearlyData" class="chart-error">
      Für den Vergleich 2015–2024 sind keine vollständigen Daten verfügbar.
    </div>
    <GroupedBarChart v-else :data="strommixData" />
    <p class="chart-footnote">
      Dargestellt sind zehn ausgewählte Energieträger der öffentlichen
      Nettostromerzeugung nach SMARD. Kleinere Energieträger wie sonstige
      erneuerbare Energien und Pumpspeicher sind nicht einzeln aufgeführt.
      Deshalb ergeben die dargestellten Anteile zusammen rund 97,9 % im
      Jahr 2015 und 97,3 % im Jahr 2024. Die Werte sind auf eine
      Nachkommastelle gerundet.
    </p>
    <NuxtLink to="/dashboard" class="dashboard-link">
      Entwicklung von 2015 bis 2024 erkunden
      <span class="dashboard-link-arrow" aria-hidden="true">→</span>
    </NuxtLink>
    <IntroMethodology />
  </div>
</template>

<style scoped>
.intro-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}
.intro-page > :deep(*) {
  margin-bottom: 48px;
}
.intro-page > :deep(:last-child) {
  margin-bottom: 0;
}
.chart-loading {
  margin-bottom: 48px;
}
.chart-skeleton {
  width: 100%;
  height: 600px;
  background: linear-gradient(135deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.chart-error {
  text-align: center;
  padding: 80px 0;
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--fg-muted);
  margin-bottom: 96px;
}

.chart-footnote {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.55;
  max-width: 62ch;
  margin-top: 24px;
  margin-bottom: 48px;
}

.dashboard-link {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--fg);
  text-decoration: none;
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  transition: border-color 300ms ease-out;
  margin-top: 40px;
  margin-bottom: 96px;
}

.dashboard-link:hover {
  border-bottom-color: var(--fg);
}

.dashboard-link-arrow {
  display: inline-block;
  transition: transform 300ms ease-out;
}

.dashboard-link:hover .dashboard-link-arrow {
  transform: translateX(4px);
}

.dashboard-link:focus-visible {
  outline: 2px solid rgba(122, 158, 110, 0.6);
  outline-offset: 4px;
  border-radius: 2px;
}

.intro-top-bar {
  position: relative;
}

.dashboard-arrow {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--accent);
  border-radius: 50%;
  color: var(--accent);
  font-size: 14px;
  line-height: 1;
  text-decoration: none;
  transition: all 0.2s ease;
}

.dashboard-arrow:hover {
  background: rgba(45, 106, 79, 0.08);
}

.dashboard-arrow:hover span {
  display: inline-block;
  transform: translateX(3px);
  transition: transform 0.2s ease;
}

.dashboard-arrow:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

</style>
