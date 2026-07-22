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

import type { EmissionFactorsFile, EmissionRow, MixSourceKey } from '~/types/mix'
import type { DeviationHoverPayload } from '~/utils/charts/DeviationChart'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const { monthRows, yearRows, pending, error, loadData } = useMixData()
const { selectedYear, colorMode, setSelectedYear, toggleColorMode } = useMixSelection()

const hoverPayload = ref<DeviationHoverPayload | null>(null)
const selectedSourceKey = ref<MixSourceKey | null>(null)

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
  chart.setColors(colorMode.value)
  chart.setSelectionHandler(handleChartSelection)
  chart.setSubtitle('Dargestellt ist die Differenz zwischen Emissionsanteil und Stromanteil in Prozentpunkten')

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

          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <button
              type="button"
              class="legend-chip legend-contrast-button"
              :class="{ 'legend-chip--active': colorMode === 'accessible' }"
              :aria-pressed="colorMode === 'accessible'"
              aria-label="Kontrastfarben umschalten"
              @click="toggleColorMode"
            >
              <span class="legend-label">Kontrastfarben</span>
            </button>

            <YearSlider
              v-if="activeYearNumber !== null"
              :years="availableYears"
              :selected-year="activeYearNumber"
              @change="handleYearChange"
            />
          </div>

          <details class="reading-help">
            <summary class="reading-help-summary">So liest du das Diagramm</summary>
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
        :selected-row="selectedRow"
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

.reading-help {
  margin: 16px 0 0;
  font-family: var(--font-sans);
}

.reading-help-summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--fg-muted);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  cursor: pointer;
  font-style: normal;
}

.reading-help-summary:hover {
  background: rgba(0, 0, 0, 0.06);
}

.reading-help-text {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg);
  max-width: 600px;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  padding: 6px 12px;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.legend-chip:hover {
  border-color: var(--fg-muted);
}

.legend-chip--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 500;
}

@media (max-width: 900px) {
  .deviation-layout {
    grid-template-columns: 1fr;
  }
}
</style>
