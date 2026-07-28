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
} from '~/types/emissions'

/* Typ der gemeinsam verwendeten Diagramm-Komponente. */
type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

/* Mögliche Sortierungen der Balken. */
type SortMode = 'category' | 'impact'

/**
 * Beschreibt eine Auswahlmöglichkeit für die Sortierung.
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
 * Die x-Achse bleibt für alle Jahre gleich.
 * So lassen sich die Abweichungen direkt vergleichen.
 */
const xDomain: [number, number] = [-50, 50]

let chart: DeviationChart | null = null

/**
 * Lädt die Emissionsfaktoren und speichert mögliche Fehlermeldungen.
 *
 * TypeScript behandelt den Wert im catch-Block als unknown.
 * Deshalb wird zuerst geprüft, ob wirklich ein Error vorliegt.
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

const deviationYears = computed(function () {
  if (emissionFactors.value === null) {
    return []
  }

  return calculateMultipleYears(
    yearRows.value,
    emissionFactors.value.factors,
  )
})

const availableYears = computed(function () {
  const years: number[] = []

  for (const yearData of deviationYears.value) {
    years.push(yearData.year)
  }

  return years
})

const latestYear = computed(function () {
  const years = availableYears.value
  return years[years.length - 1] ?? null
})

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

const baseYear = computed(function () {
  for (const yearData of deviationYears.value) {
    if (yearData.year === BASE_YEAR) {
      return yearData
    }
  }

  return null
})

const largestMismatch = computed(function () {
  if (activeYear.value === null) {
    return null
  }

  return findLargestPositiveDeviation(
    activeYear.value.rows,
  )
})

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

const renewableShare = computed(function () {
  if (activeYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    activeYear.value,
  )
})

const baseRenewableShare = computed(function () {
  if (baseYear.value === null) {
    return 0
  }

  return calculateRenewableShare(
    baseYear.value,
  )
})

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
 * Speichert den Balken, über dem sich die Maus befindet.
 *
 * @param payload Daten und Position des Balkens
 */
function handleChartHover(
  payload: DeviationHoverPayload,
): void {
  hoverPayload.value = payload
}

/**
 * Entfernt die Hover-Daten, sobald die Maus das Diagramm verlässt.
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
 * Ändert die Sortierung der Balken.
 *
 * @param mode Neue Sortierung
 */
function handleSortChange(mode: SortMode): void {
  sortMode.value = mode
  chart?.setSortMode(mode)
}

/**
 * Lädt Daten und Emissionsfaktoren, erstellt danach das Diagramm
 */
async function loadAndCreateChart(): Promise<void> {
  await loadData()
  await loadEmissionFactors()
  await nextTick()
  createChart()
}

/**
 * Erstellt das D3-Diagramm und verbindet seine Ereignisse
 * mit der Vue-Komponente.
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
 * Gibt neue Jahresdaten an die D3-Klasse weiter
 */
function updateChartYear(
  updatedYear: typeof activeYear.value,
): void {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  hoverPayload.value = null
  selectedSourceKey.value = null
}

/** Übernimmt einen neuen Farbmodus */
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
      <!-- Diagramm mit Tooltip und Sortierung. -->
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

      <!-- Jahresauswahl und Kennzahlen. -->
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
/* Ordnet Diagramm und Seitenleiste nebeneinander an. */
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

/* Gemeinsame Gestaltung der Statusmeldungen. */
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

/* Bereich für die Sortierung. */
.sort-section {
  margin-bottom: 16px;
}

.sort-section h3 {
  margin-bottom: 12px;
}

/* Schaltflächen für die beiden Sortierungen. */
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

/* Setzt die Seitenleiste bei wenig Platz unter das Diagramm. */

</style>