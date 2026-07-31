<script setup lang="ts">
/**
 * Slider zur Auswahl eines Jahres.
 *
 * Der Slider zeigt alle verfügbaren Jahre und gibt
 * das ausgewählte Jahr an die übergeordnete Komponente weiter.
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'

/**
 * Werte für die Jahresauswahl.
 */
interface YearSliderProps {
  years: number[]
  selectedYear: number
}

const props = defineProps<YearSliderProps>()

const emit = defineEmits<{
  change: [year: number]
}>()

/**
 * Ermittelt das erste verfügbare Jahr.
 *
 * Falls keine Jahre vorhanden sind, wird das aktuell
 * ausgewählte Jahr verwendet.
 *
 * @returns Erstes verfügbares oder ausgewähltes Jahr
 */
const firstYear = computed(function (): number {
  return props.years[0] ?? props.selectedYear
})

/**
 * Ermittelt das letzte verfügbare Jahr.
 *
 * @returns Letztes verfügbares oder ausgewähltes Jahr
 */
const lastYear = computed(function (): number {
  const lastIndex = props.years.length - 1

  return props.years[lastIndex] ?? props.selectedYear
})

/**
 * Berechnet die Füllung des Sliders in Prozent.
 *
 * @returns Füllung des Sliders in Prozent
 */
const fillPercent = computed(function (): number {
  const distance =
    lastYear.value - firstYear.value

  if (distance <= 0) {
    return 100
  }

  const selectedDistance =
    props.selectedYear - firstYear.value

  const percent =
    selectedDistance / distance * 100

  return percent
})

/**
 * Gibt das ausgewählte Jahr an die übergeordnete Komponente weiter.
 *
 * @param event Eingabeereignis des Sliders
 */
function handleInput(event: Event): void {
  const input =
    event.currentTarget as HTMLInputElement

  const year = Number(input.value)

  emit('change', year)
}
</script>

<template>
  <div class="year-slider">
    <!-- Beschriftung und aktuell ausgewähltes Jahr. -->
    <div class="year-slider-header">
      <span class="title-label">
        Jahr der Darstellung
      </span>

      <output class="year-slider-value">
        {{ selectedYear }}
      </output>
    </div>

    <!-- Linie mit Füllung und darüberliegendem Slider. -->
    <div class="year-slider-track">
      <div class="year-slider-background"></div>

      <div
        class="year-slider-fill"
        :style="{
          width: fillPercent + '%',
        }"
      ></div>

      <input
        type="range"
        class="year-slider-input"
        :min="firstYear"
        :max="lastYear"
        step="1"
        :value="selectedYear"
        aria-label="Jahr der Darstellung"
        @input="handleInput"
      >
    </div>

    <!-- Erstes und letztes verfügbares Jahr unter dem Slider. -->
    <div
      class="year-slider-range"
      aria-hidden="true"
    >
      <span>{{ firstYear }}</span>
      <span>{{ lastYear }}</span>
    </div>
  </div>
</template>

<style scoped>
/*
 * Abstand unter dem Jahresregler.
 */
.year-slider {
  padding-bottom: 20px;
}

/*
 * Beschriftung und ausgewähltes Jahr stehen
 * nebeneinander am oberen Rand des Sliders.
 */
.year-slider-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

/*
 * Das ausgewählte Jahr wird etwas stärker hervorgehoben.
 */
.year-slider-value {
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

/*
 * Bereich für Hintergrundlinie, Füllung und Range-Input.
 */
.year-slider-track {
  position: relative;
  display: flex;
  align-items: center;
  height: 24px;
}

/*
 * Gemeinsame Form für die Hintergrundlinie und den gefüllten Bereich.
 */
.year-slider-background,
.year-slider-fill {
  position: absolute;
  top: 50%;
  height: 2px;
  pointer-events: none;
  transform: translateY(-50%);
}

/* Hintergrundlinie über die gesamte Breite des Sliders. */
.year-slider-background {
  right: 0;
  left: 0;
  background: var(--line-color);
}

/* Gefüllter Bereich bis zum aktuell ausgewählten Jahr. */
.year-slider-fill {
  left: 0;
  background: var(--accent-color);
}

/*
 * Der eigentliche Range-Input liegt über der selbst gezeichneten Linie.
 */
.year-slider-input {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 24px;
  margin: 0;
  background: none;
  appearance: none;
  -webkit-appearance: none;
}

/* Für Chrome, Edge und Safari. */
.year-slider-input::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--accent-color);
  appearance: none;
  -webkit-appearance: none;
}

.year-slider-input:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Für Firefox. */
.year-slider-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  background: var(--accent-color);
}

.year-slider-input:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.year-slider-input::-webkit-slider-runnable-track {
  height: 24px;
  border: none;
  background: none;
}

.year-slider-input::-moz-range-track {
  height: 24px;
  border: none;
  background: none;
}

/*
 * Erstes und letztes verfügbares Jahr werden unter dem Slider angezeigt.
 */
.year-slider-range {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 10px;
  user-select: none;
}
</style>