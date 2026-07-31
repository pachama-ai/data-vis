<script setup lang="ts">
/**
 * Steuert das Dashboard für den Strommix-Verlauf:
 * lädt Monatsdaten und Annotationen, erstellt die StackedAreaChart-
 * Instanz und leitet Hover, Klick und Farbmodus weiter.
 * Die Seitenleiste zeigt je nach Zustand Übersicht, Energieträger
 * oder Annotation.
 *
 * @author Selina Schneider
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ChartTemplate from '~/components/shared/ChartTemplate.vue'
import StackedAreaLegend from '~/components/generation/StackedAreaLegend.vue'
import MixTooltip from '~/components/generation/MixTooltip.vue'
import MixSidebar from '~/components/generation/MixSidebar.vue'
import { useMixData } from '~/composables/useMixData'
import { useMixSelection } from '~/composables/useMixSelection'
import { StackedAreaChart } from '~/utils/charts/StackedAreaChart'
import {
  getAnnotationContext,
  getOverviewMetrics,
  getSourceMetrics,
} from '~/composables/useMixMetrics'

import type { MixAnnotation, MixSourceKey } from '~/types/energy-mix'
import type { MixHoverPayload } from '~/utils/charts/stackedAreaHelpers'

type ChartTemplateInstance = InstanceType<typeof ChartTemplate>

const chartTemplate = ref<ChartTemplateInstance | null>(null)

const {
  monthRows,
  yearRows,
  pending,
  error,
  loadData,
} = useMixData()

const {
  mode,
  colorMode,
  highlighted,
  selectedAnnotation,
  setMode,
  setHighlighted,
  setSelectedAnnotation,
  setSelectedYear,
  toggleHighlighted,
  toggleAnnotation,
} = useMixSelection()

const hoverPayload = ref<MixHoverPayload | null>(null)
const annotations = ref<MixAnnotation[]>([])

let chart: StackedAreaChart | null = null

// Sidebar-Daten: alle drei Zustände werden als computed berechnet,
// damit die Sidebar reaktiv auf Änderungen in den Monatsdaten reagiert.

// Sucht die Annotation, deren ID der aktuellen Auswahl entspricht.
const activeAnnotation = computed(function () {
  if (selectedAnnotation.value === null) {
    return null
  }

  return annotations.value.find(function (annotation) {
    return annotation.id === selectedAnnotation.value
  }) ?? null
})

// Kennzahlen für die Übersichtsansicht (kein Hover, keine Auswahl).
const overviewMetrics = computed(function () {
  return getOverviewMetrics(yearRows.value)
})

// Kennzahlen für den ausgewählten Energieträger, null wenn keiner aktiv.
const sourceMetrics = computed(function () {
  if (highlighted.value === null) {
    return null
  }

  return getSourceMetrics(
    yearRows.value,
    monthRows.value,
    highlighted.value,
  )
})

// Kontext für die ausgewählte Annotation, null wenn keine aktiv.
const annotationContext = computed(function () {
  if (activeAnnotation.value === null) {
    return null
  }

  return getAnnotationContext(
    monthRows.value,
    activeAnnotation.value,
  )
})

// Bestimmt, welche Flächen hervorgehoben werden. Eine Annotation kann
// mehrere Energieträger hervorheben, die Legende wählt genau einen aus.
const highlightedSources = computed<MixSourceKey[] | null>(function () {
  if (activeAnnotation.value) {
    return activeAnnotation.value.highlight
  }

  if (highlighted.value) {
    return [highlighted.value]
  }

  return null
})

/**
 * Erstellt die StackedAreaChart-Instanz und registriert alle Handler.
 */
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
  chart.setMode(mode.value)
  chart.setData(monthRows.value)
  chart.setAnnotations(annotations.value)
}

/**
 * Speichert den Hover-Payload, damit MixTooltip ihn anzeigen kann.
 *
 * @param payload Hover-Informationen mit Monat und optionalem Quellschlüssel
 */
function handleChartHover(payload: MixHoverPayload): void {
  hoverPayload.value = payload
}

/**
 * Blendet den Tooltip aus, wenn der Cursor die Zeichenfläche verlässt.
 */
function handleChartLeave(): void {
  hoverPayload.value = null
}

/**
 * Setzt alle aktiven Auswahlen zurück, wenn ins Leere geklickt wird.
 */
function handleChartBackgroundClick(): void {
  setHighlighted(null)
  setSelectedAnnotation(null)
  setSelectedYear(null)
}

/**
 * Schaltet die Hervorhebung eines Energieträgers um.
 * Wird null übergeben, wird die Hervorhebung zurückgesetzt.
 *
 * @param sourceKey Hervorzuhebender Energieträger oder null zum Zurücksetzen
 */
function handleSourceSelect(sourceKey: MixSourceKey | null): void {
  if (sourceKey === null) {
    setHighlighted(null)
  } else {
    toggleHighlighted(sourceKey)
  }
}

/**
 * Wählt eine Annotation aus und setzt eine vorherige Hervorhebung zurück.
 *
 * @param annotation Ausgewählte Annotation
 */
function handleAnnotationSelect(annotation: MixAnnotation): void {
  const parts = annotation.date.split('-')
  const year = Number.parseInt(parts[0] ?? '0', 10)

  setHighlighted(null)
  toggleAnnotation(annotation.id, year)
}

// Daten laden und Diagramm danach initialisieren.
onMounted(async function () {
  await loadData()

  try {
    const response = await fetch('/data/annotations.json')
    const data: MixAnnotation[] = await response.json()
    annotations.value = data
  } catch (caughtError: unknown) {
    if (caughtError instanceof Error) {
      console.warn('Annotationen konnten nicht geladen werden:', caughtError.message)
    }
    annotations.value = []
  }

  await nextTick()
  initializeChart()
})

// Jeder Watcher leitet genau eine Änderung an die Chart-Instanz weiter.
watch(monthRows, function (updatedMonthRows) {
  chart?.setData(updatedMonthRows)
})

watch(mode, function (updatedMode) {
  chart?.setMode(updatedMode)
  hoverPayload.value = null
})

watch(highlightedSources, function (updatedSources) {
  chart?.setHighlightedSources(updatedSources)
})

watch(annotations, function (updatedAnnotations) {
  chart?.setAnnotations(updatedAnnotations)
})

watch(selectedAnnotation, function (updatedId) {
  chart?.setSelectedAnnotation(updatedId)
})

watch(colorMode, function (updatedMode) {
  chart?.setColors(updatedMode)
})

// Aufräumen: Diagramm zerstören und Refs leeren.
onBeforeUnmount(function () {
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
      >
        <template #controls>
          <div
            class="mode-toggle"
            aria-label="Darstellungsmodus"
          >
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--active': mode === 'absolute' }"
              :aria-pressed="mode === 'absolute'"
              @click="setMode('absolute')"
            >
              TWh
            </button>
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--active': mode === 'share' }"
              :aria-pressed="mode === 'share'"
              @click="setMode('share')"
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
          :highlighted-sources="highlightedSources"
          :color-mode="colorMode"
          :has-active-annotation="selectedAnnotation !== null"
          @select="handleSourceSelect"
        />

        <p
          v-if="pending"
          class="chart-note"
        >
          Daten werden geladen …
        </p>

        <p
          v-else-if="error"
          class="chart-note chart-note-error"
        >
          Daten konnten nicht geladen werden: {{ error }}
        </p>
      </ChartTemplate>
    </div>

    <MixSidebar
      :overview-metrics="overviewMetrics"
      :source-metrics="sourceMetrics"
      :annotation-context="annotationContext"
      :annotations="annotations"
      :selected-annotation="selectedAnnotation"
      @select-annotation="handleAnnotationSelect"
    />
  </div>
</template>

<style scoped>
/*
 * Zweigeteiltes Layout
 */
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
  color: var(--accent-color);
}

.mode-toggle {
  display: inline-flex;
  border: 1px solid var(--line-color);
  border-radius: 6px;
  overflow: hidden;
}

.mode-button {
  font-family: var(--sans-font);
  font-size: 12px;
  font-weight: 400;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--muted-text-color);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  min-width: 60px;
}

.mode-button + .mode-button {
  border-left: 1px solid var(--line-color);
}

.mode-button:hover {
  background: rgba(0, 0, 0, 0.03);
}

.mode-button--active {
  background: var(--accent-color);
  color: #fff;
  font-weight: 500;
}

.mode-button--active:hover {
  background: var(--accent-color);
}

.mode-button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}
</style>