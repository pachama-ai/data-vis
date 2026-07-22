<script setup lang="ts">
/**
 * StackedArea.vue – Vue-Adapter für die StackedAreaChart-Klasse.
 *
 * Lädt Daten über useMixData, initialisiert die Chart-Klasse in
 * onMounted und räumt in onBeforeUnmount auf.
 * Keine Chart-Berechnungen – alles in StackedAreaChart.ts.
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ChartTemplate from '~/components/viz/ChartTemplate.vue'
import StackedAreaLegend from '~/components/viz/StackedAreaLegend.vue'
import MixTooltip from '~/components/viz/MixTooltip.vue'
import AnnotationMarkers from '~/components/viz/AnnotationMarkers.vue'
import MixSidebar from '~/components/viz/MixSidebar.vue'
import { useMixData } from '~/composables/useMixData'
import { useMixSelection } from '~/composables/useMixSelection'
import { StackedAreaChart } from '~/utils/charts/StackedAreaChart'
import {
  getAnnotationContext,
  getOverviewMetrics,
  getSourceMetrics,
} from '~/composables/useMixMetrics'

import type { MixMode, MixSourceKey, MixAnnotation } from '~/types/mix'
import type { MixHoverPayload } from '~/utils/charts/StackedAreaChart'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const { monthRows, yearRows, pending, error, loadData } = useMixData()
const { mode, colorMode, highlighted, selectedAnnotation, selectedYear, setMode, setColorMode, toggleColorMode, setHighlighted, setSelectedAnnotation, setSelectedYear, toggleHighlighted, toggleAnnotation } = useMixSelection()

const hoverPayload = ref<MixHoverPayload | null>(null)

const annotations = ref<MixAnnotation[]>([])

let chart: StackedAreaChart | null = null

// =========================================================================
// Datenstand-Metainformation
// =========================================================================

const accessedAt = new Date()

const latestDataMonth = computed<string | null>(() => {
  const lastMonthRow = monthRows.value[monthRows.value.length - 1]

  if (!lastMonthRow) {
    return null
  }

  const monthFormatter = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  })

  return monthFormatter.format(lastMonthRow.date)
})

const dataStatusLabel = computed<string | null>(() => {
  if (latestDataMonth.value === null) {
    return null
  }

  const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const formattedDate = dateFormatter.format(accessedAt)

  return `Quelle: SMARD. Datenstand: ${latestDataMonth.value}. Abruf: ${formattedDate}.`
})

// =========================================================================
// Metrik-Computed-Werte
// =========================================================================

const activeAnnotation = computed(() => {
  if (selectedAnnotation.value === null) {
    return null
  }

  const foundAnnotation = annotations.value.find((annotationItem) => {
    return annotationItem.id === selectedAnnotation.value
  })

  return foundAnnotation ?? null
})

const overviewMetrics = computed(() => {
  return getOverviewMetrics(yearRows.value)
})

const sourceMetrics = computed(() => {
  if (highlighted.value === null) {
    return null
  }

  return getSourceMetrics(
    yearRows.value,
    monthRows.value,
    highlighted.value,
  )
})

const annotationContext = computed(() => {
  if (activeAnnotation.value === null) {
    return null
  }

  return getAnnotationContext(
    monthRows.value,
    activeAnnotation.value,
  )
})

// =========================================================================
// Hervorzuhebende Quellen: Annotation hat Vorrang vor Legende
// =========================================================================

const highlightedSources = computed<MixSourceKey[] | null>(() => {
  const activeAnnotationValue = activeAnnotation.value

  if (activeAnnotationValue) {
    return activeAnnotationValue.highlight
  }

  if (highlighted.value) {
    return [highlighted.value]
  }

  return null
})

// =========================================================================
// Chart initialisieren
// =========================================================================

function initializeChart(): void {
  const container = chartTemplate.value?.chartContainer

  if (!container) {
    return
  }

  chart = new StackedAreaChart()
  chart.render(container)
  chart.setHoverHandler(handleChartHover)
  chart.setHoverEndHandler(handleChartLeave)
  chart.setBackgroundClickHandler(handleChartBackgroundClick)
  chart.setHighlightedSources(highlightedSources.value)
  chart.setColors(colorMode.value)
  chart.setSubtitle('Monatliche Entwicklung der öffentlichen Nettostromerzeugung in Deutschland, dargestellt nach Energieträgern auf Basis von SMARD-Daten')
  chart.setMode(mode.value)
  chart.setData(monthRows.value)
  chart.setAnnotations(annotations.value)
}

function handleChartHover(payload: MixHoverPayload): void {
  hoverPayload.value = payload
}

function handleChartLeave(): void {
  hoverPayload.value = null
}

function handleChartBackgroundClick(): void {
  setHighlighted(null)
  setSelectedAnnotation(null)
  setSelectedYear(null)
}

function handleModeChange(nextMode: MixMode): void {
  setMode(nextMode)
}

function handleSourceSelect(
  sourceKey: MixSourceKey | null,
): void {
  if (sourceKey === null) {
    setHighlighted(null)
    return
  }

  toggleHighlighted(sourceKey)
}

function handleAnnotationSelect(annotation: MixAnnotation): void {
  const parts = annotation.date.split('-')
  const year = Number.parseInt(parts[0] ?? '0', 10)

  // Ereignisauswahl setzt vorherige Quellenwahl zurück
  setHighlighted(null)
  toggleAnnotation(annotation.id, year)
}

// =========================================================================
// Daten laden und Chart starten
// =========================================================================

onMounted(async () => {
  await loadData()

  try {
    const response = await fetch('/data/annotations.json')
    const data: MixAnnotation[] = await response.json()
    annotations.value = data
  } catch {
    annotations.value = []
  }

  await nextTick()
  initializeChart()
})

// =========================================================================
// Auf Daten-, Modus- oder Highlight-Änderungen reagieren
// =========================================================================

watch(monthRows, (updatedMonthRows) => {
  chart?.setData(updatedMonthRows)
})

watch(mode, (updatedMode) => {
  chart?.setMode(updatedMode)
})

watch(highlightedSources, (updatedSources) => {
  chart?.setHighlightedSources(updatedSources)
})

watch(annotations, (updatedAnnotations) => {
  chart?.setAnnotations(updatedAnnotations)
})

watch(selectedAnnotation, (updatedId) => {
  chart?.setSelectedAnnotation(updatedId)
})

watch(colorMode, (updatedMode) => {
  chart?.setColors(updatedMode)
})

// =========================================================================
// Aufräumen
// =========================================================================

onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
  hoverPayload.value = null
  annotations.value = []
})
</script>

<template>
  <div class="stacked-area-content">
    <div class="stacked-area-main">
      <ChartTemplate
        ref="chartTemplate"
        title=""
        wrapper-class="stacked-area-chart"
      >
        <template #controls>
          <div class="mode-toggle" aria-label="Darstellungsmodus">
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--active': mode === 'absolute' }"
              :aria-pressed="mode === 'absolute'"
              @click="handleModeChange('absolute')"
            >
              TWh
            </button>
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--active': mode === 'share' }"
              :aria-pressed="mode === 'share'"
              @click="handleModeChange('share')"
            >
              Prozent
            </button>
          </div>
        </template>

        <template #overlay>
          <MixTooltip
            v-if="hoverPayload"
            :month-row="hoverPayload.monthRow"
            :chart-x="hoverPayload.chartX"
            :chart-y="hoverPayload.chartY"
            :highlighted-source="highlighted"
          />
        </template>

        <StackedAreaLegend
          :highlighted="highlighted"
          :color-mode="colorMode"
          @select="handleSourceSelect"
          @toggle-color-mode="toggleColorMode"
        />

        <p v-if="pending" class="chart-note">Daten werden geladen …</p>
        <p v-else-if="error" class="chart-note chart-note-error">
          Daten konnten nicht geladen werden: {{ error }}
        </p>
      </ChartTemplate>

      <p
        v-if="dataStatusLabel"
        class="data-status-line"
      >
        {{ dataStatusLabel }}
      </p>
    </div>

    <MixSidebar
      :overview-metrics="overviewMetrics"
      :source-metrics="sourceMetrics"
      :annotation-context="annotationContext"
      :highlighted="highlighted"
      :annotations="annotations"
      :selected-annotation="selectedAnnotation"
      @select-annotation="handleAnnotationSelect"
    />
  </div>
</template>

<style scoped>
.stacked-area-content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 24px;
  align-items: start;
}

.stacked-area-main {
  min-width: 0;
}

.chart-note {
  margin: 0;
}

.chart-note-error {
  color: var(--accent);
}

.mode-toggle {
  display: inline-flex;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  overflow: hidden;
  /* Rechte Kante an der Plotfläche ausrichten */
  padding-right: 2.3%;
}

.mode-button {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 400;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  min-width: 60px;
}

.mode-button + .mode-button {
  border-left: 1px solid var(--hairline);
}

.mode-button:hover {
  background: rgba(0, 0, 0, 0.03);
}

.mode-button--active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.mode-button--active:hover {
  background: var(--accent);
}

.mode-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

@media (max-width: 900px) {
  .stacked-area-content {
    grid-template-columns: 1fr;
  }
}

.data-status-line {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
  margin: 0;
  line-height: 1.6;
}
</style>
