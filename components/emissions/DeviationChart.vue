<script setup lang="ts">
/**
 * Verbindet das Abweichungsdiagramm mit der Vue-Oberfläche
 *
 * Hier werden die Daten geladen und die Werte für
 * Diagramm, Tooltip, Slider und Seitenleiste vorbereitet
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
} from '~/components/emissions/deviationData'

import { DeviationChart } from '~/utils/charts/DeviationChart'

import type { DeviationHoverPayload } from '~/utils/charts/DeviationChart'
import type {
  DeviationYear,
  EmissionFactorsFile,
  MixSourceKey,
} from '~/types/emissions'

/* Typ für den Zugriff auf den Diagrammbereich */
type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

/* Mögliche Sortierungen der Balken */
type SortMode = 'category' | 'impact'

/**
 * Angaben für eine Sortiermöglichkeit
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

/*
 * Gleicher Bereich der x-Achse für alle Jahre
 *
 * Ich lasse die Grenzen fest, damit die Jahre
 * direkt miteinander verglichen werden können
 */
const xDomain: [number, number] = [-50, 50]

let chart: DeviationChart | null = null

/**
 * Laden der Emissionsfaktoren
 *
 * Bei einem Fehler wird die Meldung gespeichert
 * und später in der Oberfläche angezeigt
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

/*
 * Berechnen der Abweichungen für alle vorhandenen Jahre
 *
 * Ohne Emissionsfaktoren kann die Berechnung noch nicht starten
 */
const deviationYears = computed(function () {
  if (emissionFactors.value === null) {
    return []
  }

  return calculateMultipleYears(
    yearRows.value,
    emissionFactors.value.factors,
  )
})

/* Sammeln der Jahre für den Jahresregler */
const availableYears = computed(function () {
  const years: number[] = []

  for (const yearData of deviationYears.value) {
    years.push(yearData.year)
  }

  return years
})

/* Ermitteln des letzten verfügbaren Jahres */
const latestYear = computed(function () {
  const years = availableYears.value
  return years[years.length - 1] ?? null
})

/*
 * Ermitteln des Jahres, das gerade angezeigt werden soll
 *
 * Falls die Auswahl nicht vorhanden ist, wird das letzte Jahr genommen
 */
const activeYearNumber = computed(function () {
  const currentYear = selectedYear.value

  if (
    currentYear !== null
    && availableYears.value.includes(currentYear)
  ) {
    return currentYear
  }

  return latestYear.value
})

/* Suchen der Daten für das aktuell ausgewählte Jahr */
const activeYear = computed(function () {
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
})

/* Suchen der Daten für das Vergleichsjahr */
const baseYear = computed(function () {
  for (const yearData of deviationYears.value) {
    if (yearData.year === BASE_YEAR) {
      return yearData
    }
  }

  return null
})

/*
 * Berechnen der Emissionsintensität des aktuellen Jahres
 *
 * Bei einer Erzeugung von 0 gebe ich 0 zurück,
 * damit nicht durch 0 gerechnet wird
 */
const emissionIntensity = computed(function () {
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
})

/* Berechnen des Erneuerbaren-Anteils im aktuellen Jahr */
const renewableShare = computed(function () {
  if (activeYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    activeYear.value,
  )
})

/* Berechnen des Erneuerbaren-Anteils im Vergleichsjahr */
const baseRenewableShare = computed(function () {
  if (baseYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    baseYear.value,
  )
})

/*
 * Berechnen der Emissionsintensität des Vergleichsjahres
 *
 * Bei einer Erzeugung von 0 wird wieder 0 verwendet,
 * damit nicht durch 0 gerechnet wird
 */
const baseEmissionIntensity = computed(function () {
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
})

/**
 * Speichern der Daten für den Tooltip
 *
 * @param payload Daten und Position des Balkens
 */
function handleChartHover(
  payload: DeviationHoverPayload,
): void {
  hoverPayload.value = payload
}

/**
 * Zurücksetzen der Hover-Daten nach dem Verlassen des Diagramms
 */
function handleChartLeave(): void {
  hoverPayload.value = null
}

/**
 * Speichern des angeklickten Energieträgers
 *
 * @param sourceKey Ausgewählter Energieträger oder null
 */
function handleChartSelection(
  sourceKey: MixSourceKey | null,
): void {
  selectedSourceKey.value = sourceKey
}

/* Suchen der ausgewählten Zeile im aktuellen Jahr */
const selectedRow = computed(function () {
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
})

/*
 * Suchen des Erzeugungsanteils der Auswahl im Vergleichsjahr
 *
 * Der Wert wird für den Vergleich mit 2015 gebraucht
 */
const selectedRowBaseShare = computed(function () {
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
})

/**
 * Ändern der Sortierung im Diagramm
 *
 * @param mode Neue Sortierung
 */
function handleSortChange(mode: SortMode): void {
  sortMode.value = mode
  chart?.setSortMode(mode)
}

/**
 * Laden der Daten und anschließendes Erstellen des Diagramms
 *
 * Ich warte mit nextTick, bis Vue den Diagrammbereich erstellt hat
 */
async function loadAndCreateChart(): Promise<void> {
  await loadData()
  await loadEmissionFactors()
  await nextTick()
  createChart()
}

/**
 * Erstellen des D3-Diagramms
 *
 * Ohne Container oder Emissionsfaktoren kann das Diagramm
 * noch nicht aufgebaut werden
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
 * Weitergeben der neuen Jahresdaten an die D3-Klasse
 *
 * Hover und Auswahl werden beim Jahreswechsel zurückgesetzt,
 * damit keine Werte des vorherigen Jahres stehen bleiben
 *
 * @param updatedYear Daten des ausgewählten Jahres
 */
function updateChartYear(
  updatedYear: DeviationYear | null,
): void {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  hoverPayload.value = null
  selectedSourceKey.value = null
}

/**
 * Weitergeben des neuen Farbmodus an das Diagramm
 *
 * @param updatedMode Neuer Farbmodus
 */
function updateChartColors(
  updatedMode: 'default' | 'accessible',
): void {
  chart?.setColors(updatedMode)
}

onMounted(function () { loadAndCreateChart() })

onBeforeUnmount(function () {
  chart?.destroy()
  chart = null
  hoverPayload.value = null
  selectedSourceKey.value = null
})

watch(activeYear, updateChartYear)
watch(colorMode, updateChartColors)
</script>

<template>
  <div class="deviation-layout">
    <div
      v-if="emissionError"
      class="deviation-error"
    >
      {{ emissionError }}
    </div>

    <div
      v-else-if="pending && emissionFactors === null"
      class="deviation-loading"
    >
      Daten werden geladen …
    </div>

    <template v-else>
      <!-- Diagramm mit Tooltip und Sortierung -->
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
          @change="setSelectedYear"
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
/* Anordnung von Diagramm und Seitenleiste */
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

/* Gestaltung der Statusmeldungen */
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

/* Anordnung von Jahresregler und Kennzahlen */
.deviation-sidebar {
  display: flex;
  flex-direction: column;
}

.sidebar-divider {
  height: 1px;
  margin: 12px 0;
  background: var(--line-color);
}

/* Abstand für die Sortierung */
.sort-section {
  margin-bottom: 16px;
}

.sort-section h3 {
  margin-bottom: 12px;
}

/* Anordnung der Sortierbuttons */
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
</style>