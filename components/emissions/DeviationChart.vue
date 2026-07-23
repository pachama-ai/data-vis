<script setup lang="ts">
/**
 * DeviationChartView.vue – Vue-Adapter für das DeviationChart.
 *
 * Verbindet Daten, Emissionsfaktoren, Berechnungen, D3-Klasse und
 * UI-Komponenten (Tooltip, Slider, Sidebar).
 * Enthält keine Fachberechnung – ruft nur reine Funktionen auf.
 */

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import ChartTemplate from '~/components/common/ChartTemplate.vue'
import DeviationTooltip from '~/components/emissions/DeviationTooltip.vue'
import YearSlider from '~/components/emissions/YearSlider.vue'
import DeviationSidebar from '~/components/emissions/DeviationSidebar.vue'
import { useMixData } from '~/composables/useMixData'
import { useMixSelection } from '~/composables/useMixSelection'
import {
  loadEmissionFactorsFile,
  calculateEmissionIntensity,
} from '~/composables/useEmissions'
import {
  calculateMultipleYears,
  findLargestPositiveDeviation,
  calculateRenewableShare,
  BASE_YEAR,
} from '~/composables/useDeviation'
import {
  DeviationChart,
  createSymmetricDomain,
  findMaximumAbsoluteDeviation,
} from '~/utils/charts/DeviationChart'

import type { EmissionFactorsFile, EmissionRow, MixSourceKey } from '~/types/mix'
import type { DeviationHoverPayload } from '~/utils/charts/DeviationChart'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const { monthRows, yearRows, pending, error, loadData } = useMixData()
const { selectedYear, colorMode, setSelectedYear } = useMixSelection()

const hoverPayload = ref<DeviationHoverPayload | null>(null)
const selectedSourceKey = ref<MixSourceKey | null>(null)
const sortMode = ref<'category' | 'impact'>('category')

const sortModes = [
  { key: 'category' as const, label: 'Nach Kategorie' },
  { key: 'impact' as const, label: 'Nach Klimawirkung' },
]

// =========================================================================
// Emissionsfaktoren laden
// =========================================================================

const emissionFactors = ref<EmissionFactorsFile | null>(null)
const emissionError = ref<string | null>(null)

async function loadEmissionFactors(): Promise<void> {
  emissionError.value = null

  try {
    const data = await loadEmissionFactorsFile()

    emissionFactors.value = data
  } catch (caughtError: unknown) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : 'Emissionsfaktoren konnten nicht geladen werden.'

    emissionError.value = message
  }
}

// =========================================================================
// Berechnungen
// =========================================================================

const deviationYears = computed(() => {
  if (!emissionFactors.value) {
    return []
  }

  return calculateMultipleYears(
    yearRows.value,
    emissionFactors.value.factors,
  )
})

const availableYears = computed(() => {
  const years: number[] = []

  for (const yearData of deviationYears.value) {
    years.push(yearData.year)
  }

  return years
})

const latestYear = computed(() => {
  const years = availableYears.value
  const lastYear = years[years.length - 1]

  return lastYear ?? null
})

const activeYearNumber = computed(() => {
  if (selectedYear.value !== null) {
    const yearExists = availableYears.value.includes(
      selectedYear.value,
    )

    if (yearExists) {
      return selectedYear.value
    }
  }

  return latestYear.value
})

const activeYear = computed(() => {
  const year = activeYearNumber.value

  if (year === null) {
    return null
  }

  return (
    deviationYears.value.find((yearData) => {
      return yearData.year === year
    }) ?? null
  )
})

const baseYear = computed(() => {
  return (
    deviationYears.value.find((yearData) => {
      return yearData.year === BASE_YEAR
    }) ?? null
  )
})

// =========================================================================
// Feste x-Domain über alle Jahre
// =========================================================================

// Feste x-Achse von −50 bis +50 pp für ehrlichen Jahresvergleich
const xDomain: [number, number] = [-50, 50]

// =========================================================================
// Sidebar-Werte
// =========================================================================

const largestMismatch = computed(() => {
  if (!activeYear.value) {
    return null
  }

  return findLargestPositiveDeviation(activeYear.value.rows)
})

const emissionIntensity = computed(() => {
  if (!activeYear.value || activeYear.value.totalGenerationTwh === 0) {
    return 0
  }

  return calculateEmissionIntensity(
    activeYear.value.totalEmissionsMt,
    activeYear.value.totalGenerationTwh,
  )
})

const renewableShare = computed(() => {
  if (!activeYear.value) {
    return 0
  }

  return calculateRenewableShare(activeYear.value)
})

const baseRenewableShare = computed(() => {
  if (!baseYear.value) {
    return 0
  }

  return calculateRenewableShare(baseYear.value)
})

const baseEmissionIntensity = computed(() => {
  if (!baseYear.value || baseYear.value.totalGenerationTwh === 0) {
    return 0
  }

  return calculateEmissionIntensity(
    baseYear.value.totalEmissionsMt,
    baseYear.value.totalGenerationTwh,
  )
})

// =========================================================================
// Chart-Instanz
// =========================================================================

let chart: DeviationChart | null = null

// =========================================================================
// Hover-Handler
// =========================================================================

function handleChartHover(payload: DeviationHoverPayload): void {
  hoverPayload.value = payload
}

function handleChartLeave(): void {
  hoverPayload.value = null
}

function handleChartSelection(sourceKey: MixSourceKey | null): void {
  selectedSourceKey.value = sourceKey
}

const selectedRow = computed(() => {
  if (selectedSourceKey.value === null || !activeYear.value) {
    return null
  }

  return (
    activeYear.value.rows.find((row) => {
      return row.sourceKey === selectedSourceKey.value
    }) ?? null
  )
})

const selectedRowBaseShare = computed(() => {
  if (selectedSourceKey.value === null || !baseYear.value) {
    return null
  }

  const baseRow = baseYear.value.rows.find((row) => {
    return row.sourceKey === selectedSourceKey.value
  })

  return baseRow?.generationShare ?? null
})

// =========================================================================
// Slider-Handler
// =========================================================================

function handleYearChange(year: number): void {
  setSelectedYear(year)
}

function handleSortChange(mode: 'category' | 'impact'): void {
  sortMode.value = mode
  chart?.setSortMode(mode)
}

// =========================================================================
// Initialisierung
// =========================================================================

async function initializeAll(): Promise<void> {
  await Promise.all([loadData(), loadEmissionFactors()])

  await nextTick()

  initializeChart()
}

function initializeChart(): void {
  const container = chartTemplate.value?.chartContainer

  if (!container) {
    return
  }

  if (!emissionFactors.value) {
    return
  }

  chart = new DeviationChart()

  chart.setHoverHandler(handleChartHover)
  chart.setHoverEndHandler(handleChartLeave)
  chart.setColors(colorMode.value)
  chart.setSelectionHandler(handleChartSelection)

  chart.render(container)
  chart.setXDomain(xDomain)

  if (activeYear.value) {
    chart.setData(activeYear.value.rows)
  }
}

// =========================================================================
// Lifecycle
// =========================================================================

onMounted(() => {
  initializeAll()
})

onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
  hoverPayload.value = null
})

// =========================================================================
// Watcher
// =========================================================================

watch(activeYear, (updatedYear) => {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  hoverPayload.value = null
  selectedSourceKey.value = null
})

watch(colorMode, (updatedMode) => {
  chart?.setColors(updatedMode)
})
</script>

<template>
  <div class="deviation-layout">
    <!-- Fehlerzustand -->
    <div
      v-if="emissionError"
      class="deviation-error"
    >
      {{ emissionError }}
    </div>

    <!-- Ladezustand -->
    <div
      v-else-if="pending && emissionFactors === null"
      class="deviation-loading"
    >
      Daten werden geladen …
    </div>

    <!-- Normalzustand -->
    <template v-else>
      <div class="deviation-main">
        <ChartTemplate
          ref="chartTemplate"
          title=""
          subtitle=""
        >
          <template #overlay>
            <DeviationTooltip
              v-if="hoverPayload"
              :row="hoverPayload.row"
              :chart-x="hoverPayload.chartX"
              :chart-y="hoverPayload.chartY"
            />
          </template>

          <div class="sort-section" role="radiogroup" aria-label="Sortierung">
            <h3 class="eyebrow">Sortierung</h3>
            <div class="sort-chips">
              <button
                v-for="mode in sortModes"
                :key="mode.key"
                type="button"
                class="sort-chip"
                role="radio"
                :aria-checked="sortMode === mode.key"
                :class="{ 'sort-chip--active': sortMode === mode.key }"
                @click="handleSortChange(mode.key)"
              >
                {{ mode.label }}
              </button>
            </div>
          </div>

          <details class="reading-help">
            <summary class="reading-help-summary">
              <span class="reading-help-chevron">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              So liest du das Diagramm
            </summary>
            <p class="reading-help-text">
              Die Balken vergleichen den Anteil eines Energieträgers an der
              Stromerzeugung mit seinem Anteil an den direkten
              CO₂-Emissionen. Balken links von 0 bedeuten: Der
              Energieträger verursacht anteilig weniger Emissionen, als er
              Strom erzeugt. Balken rechts von 0 bedeuten: Er verursacht
              anteilig mehr Emissionen. Je länger der Balken, desto größer
              ist der Unterschied.
            </p>
          </details>
        </ChartTemplate>
      </div>

      <div class="deviation-sidebar-wrapper">
        <YearSlider
          v-if="activeYearNumber !== null"
          :years="availableYears"
          :selected-year="activeYearNumber"
          @change="handleYearChange"
        />

        <DeviationSidebar
          :active-year="activeYear"
          :base-year="baseYear"
          :hovered-row="hoverPayload?.row ?? null"
          :selected-row="selectedRow"
          :selected-row-base-share="selectedRowBaseShare"
          :largest-mismatch="largestMismatch"
          :emission-intensity="emissionIntensity"
          :renewable-share="renewableShare"
          :base-renewable-share="baseRenewableShare"
          :base-emission-intensity="baseEmissionIntensity"
          :color-mode="colorMode"
        />
      </div>
    </template>

    <!-- Keine Daten für Jahr -->
    <p
      v-if="
        activeYearNumber !== null && activeYear === null
      "
      class="deviation-empty"
    >
      Für das ausgewählte Jahr liegen keine Daten vor.
    </p>
  </div>
</template>

<style scoped>
.deviation-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 24px;
  align-items: start;
}

.deviation-main {
  min-width: 0;
}

.deviation-loading,
.deviation-error,
.deviation-empty {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg-muted);
  padding: 24px 0;
}

.deviation-sidebar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.deviation-error {
  color: #b33;
}

.reading-help {
  margin: 28px 0 0;
  font-family: var(--font-sans);
}

.reading-help-summary {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-muted);
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  padding: 8px 0;
  border-radius: 4px;
  transition: color 200ms ease-out, background 200ms ease-out;
}

.reading-help-summary:hover {
  color: var(--fg);
}

.reading-help-summary::-webkit-details-marker {
  display: none;
}

.reading-help-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  transition: transform 200ms ease-out;
  flex-shrink: 0;
}

details[open] .reading-help-chevron {
  transform: rotate(90deg);
}

.reading-help-text {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg);
  max-width: 600px;
}

/* Sortier-Steuerung – als Legenden-Chips */
.sort-section {
  margin-bottom: 16px;
}


.sort-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sort-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.sort-chip:hover {
  color: var(--fg);
  border-color: var(--fg-muted);
}

.sort-chip--active {
  color: var(--fg);
  border-color: var(--accent);
  background: rgba(45, 106, 79, 0.06);
}

.sort-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .deviation-layout {
    grid-template-columns: 1fr;
  }
}
</style>
