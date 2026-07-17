<script setup lang="ts">
/**
 * pages/index.vue — Intro-Landingpage (Barbell-Version)
 * ======================================================
 * Zeigt den Wandel des deutschen Strommix 2015->2024 als
 * horizontales Barbell-Chart (D3). Lädt Dashboard-Daten
 * im Hintergrund vor (requestIdleCallback).
 */

import { ref, onMounted } from 'vue'
import { useVisualizationData } from '~/composables/useVisualizationData'
import { useData } from '~/composables/useData'
import type { YearlyMixPoint } from '~/types/visualization-data'

const { loadVisualizationData } = useVisualizationData()
const { loadHourly } = useData()

const yearlyData = ref<{ year2015: YearlyMixPoint; year2024: YearlyMixPoint } | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

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
    requestIdleCallback(() => { loadHourly().catch(() => {}) }, { timeout: 5000 })
  } else {
    setTimeout(() => { loadHourly().catch(() => {}) }, 2000)
  }
})
</script>

<template>
  <div class="intro-page">
    <IntroHero />
    <IntroTrustLine />
    <div v-if="loading" class="chart-loading">
      <div class="chart-skeleton"></div>
    </div>
    <div v-else-if="error" class="chart-error">
      {{ error }}
    </div>
    <div v-else-if="!yearlyData" class="chart-error">
      Für den Vergleich 2015–2024 sind keine vollständigen Daten verfügbar.
    </div>
    <IntroBarbellChart v-else :yearly-data="yearlyData" />
    <IntroCTA />
    <IntroMethodology />
  </div>
</template>

<style scoped>
.intro-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 32px 80px;
}
.intro-page > :deep(*) {
  margin-bottom: 96px;
}
.intro-page > :deep(:last-child) {
  margin-bottom: 0;
}
.chart-loading {
  margin-bottom: 96px;
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
</style>
