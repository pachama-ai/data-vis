<script setup lang="ts">
/**
 * Verbindet das Abweichungsdiagramm mit der Vue-Oberfläche.
 *
 * Die Komponente lädt die Daten, verwaltet das ausgewählte Jahr
 * und gibt die passenden Werte an Diagramm, Tooltip, Slider
 * und Seitenleiste weiter.
 *
 * @author Selina Schneider
 */

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import ChartTemplate from '~/components/shared/ChartTemplate.vue'
import DeviationSidebar from '~/components/emissions/DeviationSidebar.vue'
import DeviationTooltip from '~/components/emissions/DeviationTooltip.vue'
import YearSlider from '~/components/emissions/YearSlider.vue'

import { useMixData } from '~/composables/useMixData'
import { useMixSelection } from '~/composables/useMixSelection'

import {
  calculateEmissionIntensity,
  loadEmissionFactorsFile,
} from '~/components/emissions/emissionsData'

import {
  BASE_YEAR,
  calculateMultipleYears,
  calculateRenewableShare,
  findLargestPositiveDeviation,
} from '~/components/emissions/deviationData'

import { DeviationChart } from '~/utils/charts/DeviationChart'

import type { DeviationHoverPayload } from '~/utils/charts/DeviationChart'
import type {
  EmissionFactorsFile,
  MixSourceKey,
} from '~/types/mix'

/**
 * Instanz des gemeinsamen Diagrammrahmens.
 */
type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

/**
 * Mögliche Sortierungen des Diagramms.
 */
type SortMode = 'category' | 'impact'

/**
 * Ein Eintrag für die Sortierauswahl.
 */
interface SortOption {
  key: SortMode
  label: string
}

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const {
  yearRows,
  pending,
  loadData,
} = useMixData()

const {
  selectedYear,
  colorMode,
  setSelectedYear,
} = useMixSelection()

const emissionFactors = ref<EmissionFactorsFile | null>(null)
const emissionError = ref<string | null>(null)

const hoverPayload = ref<DeviationHoverPayload | null>(null)
const selectedSourceKey = ref<MixSourceKey | null>(null)
const sortMode = ref<SortMode>('category')

const sortOptions: SortOption[] = [
  {
    key: 'category',
    label: 'Nach Kategorie',
  },
  {
    key: 'impact',
    label: 'Nach Klimawirkung',
  },
]

/**
 * Feste x-Achse für alle Jahre.
 *
 * Dadurch lassen sich die Jahre direkt vergleichen.
 */
const xDomain: [number, number] = [-50, 50]

let chart: DeviationChart | null = null

/**
 * Lädt die Emissionsfaktoren.
 *
 * KI-Hilfe bei der Fehlerbehandlung. TypeScript behandelt
 * den Fehler im catch-Block als unknown. Der direkte Zugriff
 * auf message führte deshalb zu einem Typfehler.
 *
 * @returns Promise ohne Rückgabewert
 */
async function loadEmissionFactors(): Promise<void> {
  emissionError.value = null

  try {
    emissionFactors.value = await loadEmissionFactorsFile()
  } catch (caughtError: unknown) {
    if (caughtError instanceof Error) {
      emissionError.value = caughtError.message
      return
    }

    emissionError.value =
      'Emissionsfaktoren konnten nicht geladen werden.'
  }
}

/**
 * Berechnet die Werte für alle Jahre.
 *
 * @returns Jahresdaten oder ein leeres Array
 */
function createDeviationYears() {
  if (emissionFactors.value === null) {
    return []
  }

  return calculateMultipleYears(
    yearRows.value,
    emissionFactors.value.factors,
  )
}

const deviationYears = computed(createDeviationYears)

/**
 * Sammelt alle verfügbaren Jahre.
 *
 * @returns Liste der verfügbaren Jahre
 */
function createAvailableYears(): number[] {
  const years: number[] = []

  for (const yearData of deviationYears.value) {
    years.push(yearData.year)
  }

  return years
}

const availableYears = computed(createAvailableYears)

/**
 * Liest das letzte Jahr aus der Liste.
 *
 * @returns Letztes Jahr oder null
 */
function findLatestYear(): number | null {
  const years = availableYears.value
  const lastYear = years[years.length - 1]

  return lastYear ?? null
}

const latestYear = computed(findLatestYear)

/**
 * Bestimmt das aktuell angezeigte Jahr.
 *
 * @returns Gewähltes Jahr oder letztes verfügbares Jahr
 */
function findActiveYearNumber(): number | null {
  const currentYear = selectedYear.value

  if (
    currentYear !== null
    && availableYears.value.includes(currentYear)
  ) {
    return currentYear
  }

  return latestYear.value
}

const activeYearNumber = computed(findActiveYearNumber)

/**
 * Sucht die Daten des aktiven Jahres.
 *
 * @returns Jahresdaten oder null
 */
function findActiveYear() {
  const year = activeYearNumber.value

  if (year === null) {
    return null
  }

  for (const yearData of deviationYears.value) {
    if (yearData.year === year) {
      return yearData
    }
  }

  return null
}

const activeYear = computed(findActiveYear)

/**
 * Sucht die Daten des Basisjahres.
 *
 * @returns Daten von 2015 oder null
 */
function findBaseYear() {
  for (const yearData of deviationYears.value) {
    if (yearData.year === BASE_YEAR) {
      return yearData
    }
  }

  return null
}

const baseYear = computed(findBaseYear)

/**
 * Sucht die größte positive Abweichung im aktiven Jahr.
 *
 * @returns Größte Abweichung oder null
 */
function findLargestMismatch() {
  if (activeYear.value === null) {
    return null
  }

  return findLargestPositiveDeviation(
    activeYear.value.rows,
  )
}

const largestMismatch = computed(findLargestMismatch)

/**
 * Berechnet die Emissionsintensität des aktiven Jahres.
 *
 * @returns Emissionsintensität oder 0
 */
function calculateActiveEmissionIntensity(): number {
  const yearData = activeYear.value

  if (
    yearData === null
    || yearData.totalGenerationTwh === 0
  ) {
    return 0
  }

  return calculateEmissionIntensity(
    yearData.totalEmissionsMt,
    yearData.totalGenerationTwh,
  )
}

const emissionIntensity = computed(
  calculateActiveEmissionIntensity,
)

/**
 * Berechnet den Anteil erneuerbarer Energien
 * im aktiven Jahr.
 *
 * @returns Anteil in Prozent oder 0
 */
function calculateActiveRenewableShare(): number {
  if (activeYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    activeYear.value,
  )
}

const renewableShare = computed(
  calculateActiveRenewableShare,
)

/**
 * Berechnet den Anteil erneuerbarer Energien
 * im Basisjahr.
 *
 * @returns Anteil in Prozent oder 0
 */
function calculateBaseRenewableShare(): number {
  if (baseYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    baseYear.value,
  )
}

const baseRenewableShare = computed(
  calculateBaseRenewableShare,
)

/**
 * Berechnet die Emissionsintensität des Basisjahres.
 *
 * @returns Emissionsintensität oder 0
 */
function calculateBaseEmissionIntensity(): number {
  const yearData = baseYear.value

  if (
    yearData === null
    || yearData.totalGenerationTwh === 0
  ) {
    return 0
  }

  return calculateEmissionIntensity(
    yearData.totalEmissionsMt,
    yearData.totalGenerationTwh,
  )
}

const baseEmissionIntensity = computed(
  calculateBaseEmissionIntensity,
)

/**
 * Speichert den Balken unter dem Mauszeiger.
 *
 * @param payload Daten und Position des Balkens
 */
function handleChartHover(
  payload: DeviationHoverPayload,
): void {
  hoverPayload.value = payload
}

/**
 * Entfernt die Hover-Daten.
 */
function handleChartLeave(): void {
  hoverPayload.value = null
}

/**
 * Speichert den angeklickten Energieträger.
 *
 * @param sourceKey Energieträger oder null
 */
function handleChartSelection(
  sourceKey: MixSourceKey | null,
): void {
  selectedSourceKey.value = sourceKey
}

/**
 * Sucht die ausgewählte Zeile im aktiven Jahr.
 *
 * @returns Ausgewählte Zeile oder null
 */
function findSelectedRow() {
  const sourceKey = selectedSourceKey.value
  const yearData = activeYear.value

  if (
    sourceKey === null
    || yearData === null
  ) {
    return null
  }

  for (const row of yearData.rows) {
    if (row.sourceKey === sourceKey) {
      return row
    }
  }

  return null
}

const selectedRow = computed(findSelectedRow)

/**
 * Sucht den Erzeugungsanteil der ausgewählten Quelle
 * im Basisjahr.
 *
 * @returns Erzeugungsanteil oder null
 */
function findSelectedBaseShare(): number | null {
  const sourceKey = selectedSourceKey.value
  const yearData = baseYear.value

  if (
    sourceKey === null
    || yearData === null
  ) {
    return null
  }

  for (const row of yearData.rows) {
    if (row.sourceKey === sourceKey) {
      return row.generationShare
    }
  }

  return null
}

const selectedRowBaseShare = computed(
  findSelectedBaseShare,
)

/**
 * Übernimmt das ausgewählte Jahr.
 *
 * @param year Neues Jahr
 */
function handleYearChange(year: number): void {
  setSelectedYear(year)
}

/**
 * Ändert die Sortierung der Balken.
 *
 * @param mode Neue Sortierung
 */
function handleSortChange(mode: SortMode): void {
  sortMode.value = mode
  chart?.setSortMode(mode)
}

/**
 * Lädt die Daten und erstellt danach das Diagramm.
 *
 * KI-Einsatz bei der Reihenfolge. Das Diagramm wurde
 * vorher erstellt, bevor Daten und Container bereit waren.
 * Dadurch blieb die Zeichenfläche leer. nextTick wartet,
 * bis Vue den Container in das DOM eingefügt hat.
 *
 * @returns Promise ohne Rückgabewert
 */
async function loadAndCreateChart(): Promise<void> {
  await Promise.all([
    loadData(),
    loadEmissionFactors(),
  ])

  await nextTick()

  createChart()
}

/**
 * Erstellt das D3-Diagramm und verbindet die Ereignisse.
 *
 * KI-Hilfe beim Zugriff auf chartContainer. Der Wert war
 * beim ersten Aufruf null, weil die Kindkomponente noch nicht
 * fertig aufgebaut war. Die Prüfung verhindert den Aufbau
 * ohne Container.
 */
function createChart(): void {
  const container =
    chartTemplate.value?.chartContainer

  if (
    container === null
    || container === undefined
    || emissionFactors.value === null
  ) {
    return
  }

  chart = new DeviationChart()

  chart.setHoverHandler(handleChartHover)
  chart.setHoverEndHandler(handleChartLeave)
  chart.setSelectionHandler(handleChartSelection)
  chart.setColors(colorMode.value)

  chart.render(container)
  chart.setXDomain(xDomain)

  if (activeYear.value !== null) {
    chart.setData(activeYear.value.rows)
  }
}

/**
 * Startet das Laden nach dem Aufbau der Komponente.
 */
function handleMounted(): void {
  loadAndCreateChart()
}

/**
 * Entfernt das Diagramm vor dem Verlassen der Seite.
 */
function handleBeforeUnmount(): void {
  chart?.destroy()
  chart = null
  hoverPayload.value = null
  selectedSourceKey.value = null
}

/**
 * Aktualisiert das Diagramm nach einem Jahreswechsel.
 *
 * KI-Einsatz bei der Verbindung zwischen Vue und D3.
 * Die Vue-Daten änderten sich vorher, das SVG blieb aber
 * beim alten Jahr. Der Watcher gibt die neuen Zeilen
 * direkt an die D3-Klasse weiter.
 *
 * @param updatedYear Neue Jahresdaten oder null
 */
function updateChartYear(
  updatedYear: typeof activeYear.value,
): void {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  hoverPayload.value = null
  selectedSourceKey.value = null
}

/**
 * Übernimmt den neuen Farbmodus im Diagramm.
 *
 * @param updatedMode Neuer Farbmodus
 */
function updateChartColors(
  updatedMode: 'default' | 'accessible',
): void {
  chart?.setColors(updatedMode)
}

onMounted(handleMounted)
onBeforeUnmount(handleBeforeUnmount)

watch(activeYear, updateChartYear)
watch(colorMode, updateChartColors)
</script>

<template>
  <div class="deviation-layout">
    <!-- Fehler beim Laden -->
    <div
      v-if="emissionError"
      class="deviation-error"
    >
      {{ emissionError }}
    </div>

    <!-- Ladeanzeige -->
    <div
      v-else-if="pending && emissionFactors === null"
      class="deviation-loading"
    >
      Daten werden geladen …
    </div>

    <template v-else>
      <!-- Diagramm und Sortierung -->
      <div class="deviation-main">
        <ChartTemplate ref="chartTemplate">
          <template #overlay>
            <DeviationTooltip
              v-if="hoverPayload"
              :row="hoverPayload.row"
              :chart-x="hoverPayload.chartX"
              :chart-y="hoverPayload.chartY"
            />
          </template>

          <div
            class="sort-section"
            role="radiogroup"
            aria-label="Sortierung"
          >
            <h3 class="title-label">
              Sortierung
            </h3>

            <div class="sort-chips">
              <button
                v-for="option in sortOptions"
                :key="option.key"
                type="button"
                class="sort-chip"
                role="radio"
                :aria-checked="
                  sortMode === option.key
                "
                :class="{
                  'sort-chip--active':
                    sortMode === option.key,
                }"
                @click="
                  handleSortChange(option.key)
                "
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </ChartTemplate>
      </div>

      <!-- Jahresauswahl und Kennzahlen -->
      <div class="deviation-sidebar">
        <YearSlider
          v-if="activeYearNumber !== null"
          :years="availableYears"
          :selected-year="activeYearNumber"
          @change="handleYearChange"
        />

        <div class="sidebar-divider"></div>

        <DeviationSidebar
          :active-year="activeYear"
          :base-year="baseYear"
          :hovered-row="
            hoverPayload?.row ?? null
          "
          :selected-row="selectedRow"
          :selected-row-base-share="
            selectedRowBaseShare
          "
          :largest-mismatch="
            largestMismatch
          "
          :emission-intensity="
            emissionIntensity
          "
          :renewable-share="
            renewableShare
          "
          :base-renewable-share="
            baseRenewableShare
          "
          :base-emission-intensity="
            baseEmissionIntensity
          "
          :color-mode="colorMode"
        />
      </div>
    </template>

    <!-- Hinweis bei fehlenden Jahresdaten -->
    <p
      v-if="
        activeYearNumber !== null
        && activeYear === null
      "
      class="deviation-empty"
    >
      Für das ausgewählte Jahr liegen keine Daten vor.
    </p>
  </div>
</template>

<style scoped>
/*
 * Ordnet Diagramm und Seitenleiste nebeneinander an.
 *
 * KI hat responsives Grid umgesetzt. Die erste Version
 * war auf schmalen Bildschirmen breiter als das Fenster
 * und erzeugte einen horizontalen Scrollbalken.
 */
.deviation-layout {
  display: grid;
  grid-template-columns:
    minmax(0, 2fr)
    minmax(260px, 1fr);
  align-items: start;
  gap: 24px;
}

.deviation-main {
  min-width: 0;
}

/* Statusmeldungen der Seite. */
.deviation-loading,
.deviation-error,
.deviation-empty {
  padding: 24px 0;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 14px;
}

.deviation-error {
  color: #b33;
}

/* Jahresregler und Kennzahlen. */
.deviation-sidebar {
  display: flex;
  flex-direction: column;
}

.sidebar-divider {
  height: 1px;
  margin: 12px 0;
  background: var(--line-color);
}

/* Bereich der Sortierauswahl. */
.sort-section {
  margin-bottom: 16px;
}

.sort-section h3 {
  margin-bottom: 12px;
}

/* Knöpfe für die Sortierung. */
.sort-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sort-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--line-color);
  border-radius: 4px;
  background: transparent;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 11px;
  cursor: pointer;
  transition:
    color 150ms,
    border-color 150ms,
    background 150ms;
}

.sort-chip:hover {
  border-color: var(--muted-text-color);
  color: var(--text-color);
}

.sort-chip--active {
  border-color: var(--accent-color);
  background: rgba(45, 106, 79, 0.06);
  color: var(--text-color);
}

.sort-chip:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Setzt die Seitenleiste unter das Diagramm. */
@media (max-width: 900px) {
  .deviation-layout {
    grid-template-columns: 1fr;
  }
}
</style>
