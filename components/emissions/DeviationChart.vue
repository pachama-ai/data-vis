<script setup lang="ts">
/**
 * Reiter „CO₂-Vergleich" im Dashboard.
 *
 * Lädt die Emissionsfaktoren, kombiniert sie mit den Erzeugungsdaten
 * und übergibt die berechneten Abweichungen an DeviationChart. Das
 * Diagramm zeigt für das gewählte Jahr die Abweichung zwischen dem
 * Emissionsanteil und dem Erzeugungsanteil eines Energieträgers.
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

import type {
  DeviationYear,
  EmissionFactorsFile,
  MixSourceKey,
} from '~/types/emissions'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

/**
 * Sortierrichtungen der Balken im Diagramm.
 * - 'category': Erneuerbare, Kernenergie, Fossile in dieser Reihenfolge
 * - 'impact': aufsteigend nach Abweichung in Prozentpunkten
 */
type SortMode = 'category' | 'impact'

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

// Emissionsfaktoren liegen in einer eigenen JSON, deshalb ein separater
// Ladezustand mit optionalem Fehlertext.
const emissionFactors = ref<EmissionFactorsFile | null>(null)
const emissionError = ref<string | null>(null)

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

// Fester X-Achsenbereich für alle Jahre, damit die Balkenlängen zwischen
// den Jahren direkt vergleichbar bleiben.
const xDomain: [number, number] = [-50, 50]

let chart: DeviationChart | null = null

/**
 * Lädt die Emissionsfaktoren aus der JSON-Datei. Ich fange Fehler ab,
 * damit die Seite trotzdem eine sinnvolle Meldung anzeigt und nicht
 * mit einer weißen Ansicht dasteht.
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

// Abweichungen für alle vorhandenen Jahre. Solange die Emissionsfaktoren
// noch nicht da sind, gebe ich ein leeres Array zurück.
const deviationYears = computed(function () {
  if (emissionFactors.value === null) {
    return []
  }

  return calculateMultipleYears(
    yearRows.value,
    emissionFactors.value.factors,
  )
})

// Verfügbare Jahre für den Slider.
const availableYears = computed(function () {
  const years: number[] = []

  for (const yearData of deviationYears.value) {
    years.push(yearData.year)
  }

  return years
})

// Fallback auf das neueste Jahr, wenn noch keine Auswahl getroffen wurde.
const latestYear = computed(function () {
  const years = availableYears.value
  return years[years.length - 1] ?? null
})

/**
 * Bestimmt das aktuell anzuzeigende Jahr. Ich prüfe zuerst die
 * gespeicherte Auswahl aus useMixSelection und falle sonst auf das
 * neueste Jahr zurück.
 *
 * @returns Jahreszahl oder null, wenn noch keine Daten geladen sind
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

// Vollständiger Datensatz zum aktiven Jahr.
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

// Vollständiger Datensatz zum Basisjahr, das als Vergleichspunkt dient.
const baseYear = computed(function () {
  for (const yearData of deviationYears.value) {
    if (yearData.year === BASE_YEAR) {
      return yearData
    }
  }

  return null
})

/**
 * Emissionsintensität des aktuellen Jahres in g CO₂/kWh.
 * Bei fehlenden Erzeugungsdaten gebe ich 0 zurück, damit der Rest
 * der Seite nicht mit NaN weiterrechnet.
 *
 * @returns Wert in g CO₂/kWh oder 0
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

// Erneuerbaren-Anteil des aktiven Jahres in Prozent.
const renewableShare = computed(function () {
  if (activeYear.value === null) {
    return 0
  }

  return calculateRenewableShare(activeYear.value)
})

// Erneuerbaren-Anteil des Basisjahres, für den Vergleich in der Sidebar.
const baseRenewableShare = computed(function () {
  if (baseYear.value === null) {
    return 0
  }

  return calculateRenewableShare(baseYear.value)
})

// Emissionsintensität des Basisjahres.
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
/**
 * Merkt sich den angeklickten Balken für die Sidebar-Anzeige.
 *
 * @param sourceKey Angeklickter Energieträger, oder null zum Zurücksetzen
 */
function handleChartSelection(
  sourceKey: MixSourceKey | null,
): void {
  selectedSourceKey.value = sourceKey
}

// Zeile des ausgewählten Energieträgers im aktiven Jahr oder null.
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

// Erzeugungsanteil des ausgewählten Energieträgers im Basisjahr.
// Null, wenn nichts ausgewählt ist oder der Träger 2015 noch nicht existierte.
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
 * Ändert die Sortierung und leitet sie an die Chart-Klasse weiter.
 *
 * @param mode Neue Sortierung
 */
function handleSortChange(mode: SortMode): void {
  sortMode.value = mode
  chart?.setSortMode(mode)
}

/**
 * Lädt Erzeugungs- und Emissionsdaten und erstellt danach das Diagramm.
 */
async function loadAndCreateChart(): Promise<void> {
  await loadData()
  await loadEmissionFactors()
  await nextTick()
  createChart()
}

/**
 * Erstellt die DeviationChart-Instanz und registriert alle Handler,
 * bevor sie zum ersten Mal Daten bekommt.
 */
function createChart(): void {
  const container = chartTemplate.value?.chartContainer

  if (
    container === null
    || container === undefined
    || emissionFactors.value === null
  ) {
    return
  }

  chart = new DeviationChart()

  // Handler zuerst, damit das erste Render bereits reagieren kann.
  chart.setSelectionHandler(handleChartSelection)
  chart.setColors(colorMode.value)

  chart.render(container)
  chart.setXDomain(xDomain)

  if (activeYear.value !== null) {
    chart.setData(activeYear.value.rows)
  }
}

/**
 * Übergibt die Zeilen des neu ausgewählten Jahres an das Diagramm.
 * Hover-Zustand und Klick-Auswahl werden zurückgesetzt, damit keine
 * veralteten Werte des Vorjahres in der Sidebar stehen bleiben.
 *
 * @param updatedYear Datensatz des neuen Jahres, oder null
 */
function updateChartYear(
  updatedYear: DeviationYear | null,
): void {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  selectedSourceKey.value = null
}

/**
 * Gibt den neuen Farbmodus an das Diagramm weiter.
 *
 * @param updatedMode Neuer Farbmodus
 */
function updateChartColors(
  updatedMode: 'default' | 'accessible',
): void {
  chart?.setColors(updatedMode)
}

onMounted(function () {
  loadAndCreateChart()
})

// Aufräumen beim Wechsel auf eine andere Seite, damit keine D3-Listener
// oder DOM-Reste zurückbleiben.
onBeforeUnmount(function () {
  chart?.destroy()
  chart = null
  selectedSourceKey.value = null
})

// Ein Watcher pro Chart-Methode, damit unnötige Aufrufe wegfallen.
watch(activeYear, updateChartYear)
watch(colorMode, updateChartColors)
</script>

<template>
  <div class="deviation-layout">
    <!-- Fehlerfall: Emissionsfaktoren konnten nicht geladen werden. -->
    <div
      v-if="emissionError"
      class="deviation-error"
    >
      {{ emissionError }}
    </div>

    <!-- Ladezustand: Daten sind noch nicht verfügbar. -->
    <div
      v-else-if="pending && emissionFactors === null"
      class="deviation-loading"
    >
      Daten werden geladen …
    </div>

    <template v-else>
      <div class="deviation-main">
        <ChartTemplate ref="chartTemplate">

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
                :aria-checked="sortMode === option.key"
                :class="{
                  'sort-chip--active':
                    sortMode === option.key,
                }"
                @click="handleSortChange(option.key)"
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
          :hovered-row="null"
          :selected-row="selectedRow"
          :selected-row-base-share="selectedRowBaseShare"
          :emission-intensity="emissionIntensity"
          :renewable-share="renewableShare"
          :base-renewable-share="baseRenewableShare"
          :base-emission-intensity="baseEmissionIntensity"
          :color-mode="colorMode"
        />
      </div>
    </template>

    <!-- Sonderfall: ein Jahr ist gewählt, aber es gibt keine Daten dafür. -->
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
 * Zweispaltiges Layout
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

.deviation-sidebar {
  display: flex;
  flex-direction: column;
}

.sidebar-divider {
  height: 1px;
  margin: 12px 0;
  background: var(--line-color);
}

.sort-section {
  margin-bottom: 16px;
}

.sort-section h3 {
  margin-bottom: 12px;
}

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