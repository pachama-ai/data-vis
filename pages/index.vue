<script setup lang="ts">
/**
 * Startseite mit dem Vergleich des deutschen Strommixes
 * in den Jahren 2015 und 2024.
 *
 * Die Daten werden geladen, aufbereitet und anschließend
 * in einem gruppierten Balkendiagramm dargestellt.
 *
 * @author Selina Schneider
 * @created 11.06.2026
 * @lastModified 23.07.2026
 */

import { computed, onMounted, ref } from 'vue'

import { useVisualizationData } from '~/data/loadVisualizationData'
import { transformYearlyDataToChartData } from '~/pages/homeDataTransform'

import type { EnergyDataPoint } from '~/components/home/GroupedBarChart.vue'
import type { YearlyMixPoint } from '~/types/visualization-data'

type SelectedYears = {
  year2015: YearlyMixPoint
  year2024: YearlyMixPoint
}

const { loadVisualizationData } = useVisualizationData()

const yearlyData = ref<SelectedYears | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Sucht die Daten für ein bestimmtes Jahr.
 *
 * @param data Alle verfügbaren Jahresdaten
 * @param year Gesuchtes Jahr
 * @returns Daten des Jahres oder undefined
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
 * Bereitet die Daten für das Balkendiagramm auf.
 *
 * Solange noch keine Jahresdaten geladen wurden,
 * wird ein leeres Array zurückgegeben.
 *
 * @returns Daten für das Balkendiagramm
 */
function createChartData(): EnergyDataPoint[] {
  const data = yearlyData.value

  if (data === null) {
    return []
  }

  return transformYearlyDataToChartData(
    data.year2015,
    data.year2024,
  )
}

const strommixData = computed<EnergyDataPoint[]>(createChartData)

/**
 * Lädt die Daten für die beiden Vergleichsjahre.
 *
 * Fehlt eines der Jahre, wird eine Fehlermeldung
 * für die Startseite gesetzt.
 *
 * Bei dieser Funktion habe ich KI genutzt, weil ich bei der
 * Fehlerbehandlung mit try, catch und finally unsicher war.
 * Vor allem war mir nicht klar, warum caughtError in TypeScript
 * als unknown behandelt wird und wie ich trotzdem sicher auf
 * die Fehlermeldung zugreifen kann.
 *
 * @returns Promise ohne Rückgabewert
 */
async function loadPageData(): Promise<void> {
  try {
    const data = await loadVisualizationData()

    const year2015 = findYear(data.yearlyMix, 2015)
    const year2024 = findYear(data.yearlyMix, 2024)

    if (year2015 === undefined || year2024 === undefined) {
      throw new Error('Jahresdaten unvollständig')
    }

    yearlyData.value = {
      year2015,
      year2024,
    }
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

/**
 * Lädt die Daten noch einmal im Hintergrund.
 *
 * Dadurch stehen sie beim Wechsel zum Dashboard
 * möglichst schon im Zwischenspeicher bereit.
 */
function preloadDashboardData(): void {
  loadVisualizationData().catch(function () {
    // Das Vorladen ist nur eine Unterstützung.
    // Ein Fehler beeinflusst die Startseite nicht.
  })
}

/**
 * Startet das Vorladen, wenn der Browser gerade
 * weniger zu tun hat.
 *
 * Hier habe ich KI genutzt, weil ich requestIdleCallback
 * vorher nicht kannte. Ich wollte die Daten im Hintergrund
 * laden, ohne den sichtbaren Aufbau der Startseite zu bremsen.
 * Die Ersatzlösung mit setTimeout war nötig, weil
 * requestIdleCallback nicht in jedem Browser verfügbar ist.
 */
function startPreloading(): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(
      preloadDashboardData,
      { timeout: 5000 },
    )

    return
  }

  setTimeout(preloadDashboardData, 2000)
}

/**
 * Bereitet die Startseite nach dem Laden vor.
 *
 * Zuerst werden die sichtbaren Daten geladen.
 * Danach beginnt das Vorladen für das Dashboard.
 *
 * Bei dieser Stelle wurde kurz KI genutzt, weil ich
 * unsicher war, wie eine asynchrone Funktion mit
 * onMounted verbunden wird. Wichtig war dabei, dass
 * das Vorladen erst nach dem Laden der sichtbaren
 * Daten beginnt.
 *
 * @returns Promise ohne Rückgabewert
 */
async function preparePage(): Promise<void> {
  await loadPageData()
  startPreloading()
}

onMounted(preparePage)
</script>

<template>
  <div class="intro-page">
    <!-- Einleitung und kurze Information zur Datenquelle -->
    <div class="intro-top-bar">
      <IntroHero />
      <IntroTrustLine />
    </div>

    <!-- Zustand während des Ladens -->
    <div
      v-if="loading"
      class="chart-loading"
    >
      <div class="chart-skeleton"></div>
    </div>

    <!-- Fehlermeldung beim Laden der Daten -->
    <div
      v-else-if="error"
      class="chart-error"
    >
      {{ error }}
    </div>

    <!-- Hinweis bei fehlenden Jahresdaten -->
    <div
      v-else-if="yearlyData === null"
      class="chart-error"
    >
      Für den Vergleich 2015–2024 sind keine vollständigen Daten verfügbar.
    </div>

    <!-- Vergleich der Energieträger -->
    <GroupedBarChart
      v-else
      :data="strommixData"
    />

    <p class="chart-footnote">
      Dargestellt sind zehn ausgewählte Energieträger der öffentlichen
      Nettostromerzeugung nach SMARD. Kleinere Energieträger wie sonstige
      erneuerbare Energien und Pumpspeicher sind nicht einzeln aufgeführt.
      Deshalb ergeben die dargestellten Anteile zusammen rund 97,9&nbsp;% im
      Jahr 2015 und 97,3&nbsp;% im Jahr 2024. Die Werte sind auf eine
      Nachkommastelle gerundet.
    </p>

    <IntroMethodology />
  </div>
</template>

<style scoped>
/* Begrenzt die Breite und setzt die äußeren Abstände der Startseite. */
.intro-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

/* Hält den Abstand zwischen den Hauptbereichen einheitlich. */
.intro-page > :deep(*) {
  margin-bottom: 48px;
}

.intro-page > :deep(:last-child) {
  margin-bottom: 0;
}

/* Platzhalter während die Diagrammdaten geladen werden. */
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

/* Bewegt den hellen Bereich durch den Ladeplatzhalter. */
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

/* Gemeinsame Darstellung für Lade- und Datenfehler. */
.chart-error {
  margin-bottom: 96px;
  padding: 80px 0;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 15px;
  text-align: center;
}

/* Ergänzende Angaben direkt unter dem Diagramm. */
.chart-footnote {
  max-width: 62ch;
  margin-top: 24px;
  margin-bottom: 48px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 12px;
  line-height: 1.55;
}

/* Bezugspunkt für Elemente innerhalb des oberen Bereichs. */
.intro-top-bar {
  position: relative;
}
</style>

