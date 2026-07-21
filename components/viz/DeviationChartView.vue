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

import ChartTemplate from '~/components/viz/ChartTemplate.vue'
import DeviationTooltip from '~/components/viz/DeviationTooltip.vue'
import YearSlider from '~/components/viz/YearSlider.vue'
import DeviationSidebar from '~/components/viz/DeviationSidebar.vue'
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

import type { EmissionFactorsFile, EmissionRow } from '~/types/mix'
import type { DeviationHoverPayload } from '~/utils/charts/DeviationChart'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const { monthRows, yearRows, pending, error, loadData } = useMixData()
const { selectedYear, setSelectedYear } = useMixSelection()

const hoverPayload = ref<DeviationHoverPayload | null>(null)

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

const xDomain = computed<[number, number]>(() => {
  const rowsByYear: EmissionRow[][] = []

  for (const yearData of deviationYears.value) {
    rowsByYear.push(yearData.rows)
  }

  const maximumDeviation = findMaximumAbsoluteDeviation(rowsByYear)

  return createSymmetricDomain(maximumDeviation)
})

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

// =========================================================================
// Slider-Handler
// =========================================================================

function handleYearChange(year: number): void {
  setSelectedYear(year)
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

  chart.render(container)
  chart.setXDomain(xDomain.value)

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

watch(xDomain, (updatedDomain) => {
  chart?.setXDomain(updatedDomain)
})

watch(activeYear, (updatedYear) => {
  const rows = updatedYear?.rows ?? []

  chart?.setData(rows)

  hoverPayload.value = null
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
          subtitle="Dargestellt ist die Differenz zwischen Emissionsanteil und Stromanteil in Prozentpunkten."
        >
          <template #overlay>
            <DeviationTooltip
              v-if="hoverPayload"
              :row="hoverPayload.row"
              :chart-x="hoverPayload.chartX"
              :chart-y="hoverPayload.chartY"
            />
          </template>

          <YearSlider
            v-if="activeYearNumber !== null"
            :years="availableYears"
            :selected-year="activeYearNumber"
            @change="handleYearChange"
          />

          <p class="deviation-note">
            Die direkten CO₂-Emissionen wurden aus den SMARD-Erzeugungsdaten und
            Emissionsfaktoren des Umweltbundesamtes berechnet.
          </p>
        </ChartTemplate>
      </div>

      <DeviationSidebar
        :active-year="activeYear"
        :base-year="baseYear"
        :hovered-row="hoverPayload?.row ?? null"
        :largest-mismatch="largestMismatch"
        :emission-intensity="emissionIntensity"
        :renewable-share="renewableShare"
        :base-renewable-share="baseRenewableShare"
        :base-emission-intensity="baseEmissionIntensity"
      />
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

.deviation-error {
  color: #b33;
}

.deviation-note {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-muted);
  margin: 8px 0 0;
  line-height: 1.4;
}

@media (max-width: 900px) {
  .deviation-layout {
    grid-template-columns: 1fr;
  }
}
</style>
