<script setup lang="ts">
/**
 * Startseite mit dem Vergleich des deutschen Strommixes
 * in den Jahren 2015 und 2024.
 *
 * Die Seite lädt die aufbereiteten Jahresdaten und übergibt die
 * Vergleichswerte an das GroupedBarChart. Load-, Error- und
 * Datenzustand werden über drei separate refs verwaltet – so kann
 * das Template gezielt die passende Ansicht rendern.
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

// Drei getrennte refs für die klassischen drei Zustände einer
// Ladeoperation. Ich habe mich bewusst gegen eine einzige „state"-
// Variable entschieden, weil das Template dadurch mit einfachen
// v-if-Zweigen auskommt.
const strommixData = ref<EnergyDataPoint[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Sucht die Daten für ein bestimmtes Jahr.
 *
 * @param data Liste der Jahres-Datenpunkte
 * @param year Gesuchtes Jahr
 * @returns Datenpunkt oder undefined, wenn das Jahr fehlt
 */
function findYear(
  data: YearlyMixPoint[],
  year: number,
): YearlyMixPoint | undefined {
  return data.find(function (item) { return item.year === year })
}

/**
 * Lädt die Daten für die beiden Vergleichsjahre und rechnet sie
 * über transformYearlyDataToChartData in das Format des Diagramms um.
 *
 * Im catch-Zweig prüfe ich mit `caughtError instanceof Error`, weil
 * dort alles ankommen kann (Error, String, undefined, …) und ich mir
 * bei `caughtError.message` sonst einen zweiten Fehler einfangen
 * würde, falls `caughtError` gar kein Error-Objekt ist.
 */
async function loadPageData(): Promise<void> {
  try {
    const data = await loadVisualizationData()

    const year2015 = findYear(data.yearlyMix, 2015)
    const year2024 = findYear(data.yearlyMix, 2024)

    if (year2015 === undefined || year2024 === undefined) {
      throw new Error(
        'Für den Vergleich 2015–2024 sind keine vollständigen Daten verfügbar.',
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

    <!-- Ladezustand: schmales Platzhalter-Skeleton, damit der Layout-
         Sprung beim späteren Einblenden des Charts kleiner ausfällt. -->
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

    <!-- Prozentwerte in der Fußnote sind aus den Rohdaten berechnet:
         nur die zehn im Diagramm dargestellten Träger, geteilt durch
         die Gesamterzeugung des Jahres. Ich habe sie hier fest
         eingetragen, damit die Grafik ohne zusätzliche Rechenlogik
         auch bei einem Datenfehler noch die richtige Aussage macht. -->
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
/*
 * Responsives Verhalten der Seite: Zentrierung, maximale Breite,
 * Innenabstände und die Textbreite der Fußnote sind so gewählt,
 * dass der Inhalt auf allen Bildschirmgrößen gut lesbar bleibt.
 * Farbvariablen und Schriftgrößen richten sich nach dem restlichen
 * Projekt.
 */

.intro-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

/* Alle direkten Kinder bekommen einen einheitlichen Abstand
   nach unten, damit ich nicht überall einzeln margin setzen muss. */
.intro-page > :deep(*) {
  margin-bottom: 48px;
}

.intro-page > :deep(:last-child) {
  margin-bottom: 0;
}

.chart-loading {
  margin-bottom: 48px;
}

/*
 * Skeleton-Fläche mit Shimmer-Animation als Ladeanzeige.
 * Der Farbverlauf mit verschobener background-position über
 * keyframes wirkt weniger statisch als ein einfacher grauer
 * Kasten. Farben und Dauer sind auf die restliche Seite abgestimmt.
 */
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

/* max-width: 62ch begrenzt die Fußnote auf eine gut lesbare
   Zeilenlänge (~62 Zeichen).*/
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