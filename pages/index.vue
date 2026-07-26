<script setup lang="ts">
/**
 * Startseite mit dem Vergleich des deutschen Strommixes
 * in den Jahren 2015 und 2024.
 *
 * @author Selina Schneider
 * @created 11.06.2026
 * @lastModified 23.07.2026
 */

import { onMounted, ref } from 'vue'

import { useVisualizationData } from '~/data/loadVisualizationData'
import { transformYearlyDataToChartData } from '~/pages/homeDataTransform'

import type { EnergyDataPoint } from '~/components/home/GroupedBarChart.vue'
import type { YearlyMixPoint } from '~/types/visualization-data'

const { loadVisualizationData } = useVisualizationData()

const strommixData = ref<EnergyDataPoint[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Sucht die Daten f�r ein bestimmtes Jahr.
 */
function findYear(
  data: YearlyMixPoint[],
  year: number,
): YearlyMixPoint | undefined {
  for (const item of data) {
    if (item.year === year) {
      return item
    }
  }

  return undefined
}

/**
 * L�dt die Daten f�r die beiden Vergleichsjahre.
 */
async function loadPageData(): Promise<void> {
  try {
    const data = await loadVisualizationData()

    const year2015 = findYear(data.yearlyMix, 2015)
    const year2024 = findYear(data.yearlyMix, 2024)

    if (year2015 === undefined || year2024 === undefined) {
      throw new Error(
        'F\u00fcr den Vergleich 2015\u20132024 sind keine vollst\u00e4ndigen Daten verf\u00fcgbar.',
      )
    }

    strommixData.value = transformYearlyDataToChartData(
      year2015,
      year2024,
    )
  } catch (caughtError: unknown) {
    if (caughtError instanceof Error) {
      error.value = caughtError.message
    } else {
      error.value =
        'Die Visualisierungsdaten konnten nicht geladen werden.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadPageData)
</script>

<template>
  <div class="intro-page">
    <div class="intro-top-bar">
      <IntroHero />
      <IntroTrustLine />
    </div>

    <div
      v-if="loading"
      class="chart-loading"
    >
      <div class="chart-skeleton"></div>
    </div>

    <div
      v-else-if="error"
      class="chart-error"
    >
      {{ error }}
    </div>

    <GroupedBarChart
      v-else
      :data="strommixData"
    />

    <p class="chart-footnote">
      Dargestellt sind zehn ausgew�hlte Energietr�ger der �ffentlichen
      Nettostromerzeugung nach SMARD. Kleinere Energietr�ger wie sonstige
      erneuerbare Energien und Pumpspeicher sind nicht einzeln aufgef�hrt.
      Deshalb ergeben die dargestellten Anteile zusammen rund 97,9&nbsp;% im
      Jahr 2015 und 97,3&nbsp;% im Jahr 2024. Die Werte sind auf eine
      Nachkommastelle gerundet.
    </p>

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
  background: linear-gradient(
    135deg,
    #f0f0f0 25%,
    #e8e8e8 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.chart-error {
  margin-bottom: 96px;
  padding: 80px 0;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 15px;
  text-align: center;
}

.chart-footnote {
  max-width: 62ch;
  margin-top: 24px;
  margin-bottom: 48px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 12px;
  line-height: 1.55;
}

.intro-top-bar {
  position: relative;
}
</style>

