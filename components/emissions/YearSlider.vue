<script setup lang="ts">
/**
 * YearSlider.vue – Slider zur Auswahl des dargestellten Jahres.
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'

interface YearSliderProps {
  /** Verfügbare Jahre */
  years: number[]

  /** Aktuell ausgewähltes Jahr */
  selectedYear: number
}

const props = defineProps<YearSliderProps>()

const emit = defineEmits<{
  change: [year: number]
}>()

/** Erstes verfügbares Jahr */
const firstYear = computed(function (): number {
  return props.years[0] ?? props.selectedYear
})

/** Letztes verfügbares Jahr */
const lastYear = computed(function (): number {
  const lastIndex = props.years.length - 1
  return props.years[lastIndex] ?? props.selectedYear
})

/** Gefüllter Anteil des Sliders */
const fillPercent = computed(function (): number {
  const distance = lastYear.value - firstYear.value

  if (distance <= 0) {
    return 100
  }

  return (
    (props.selectedYear - firstYear.value)
    / distance
    * 100
  )
})

/**
 * Sendet das ausgewählte Jahr weiter
 *
 * @param event Eingabeereignis des Sliders
 */
function handleInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  emit('change', Number(input.value))
}
</script>

<template>
  <div class="year-slider">
    <div class="year-slider-header">
      <span class="title-label">
        Jahr der Darstellung
      </span>

      <output class="year-slider-value">
        {{ selectedYear }}
      </output>
    </div>

    <!-- Slider mit eigener Hintergrundlinie -->
    <!-- Eigene Linie unter dem transparenten Range-Input -->
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
.year-slider {
  padding-bottom: 20px;
}


.year-slider-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.year-slider-value {
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

/* Legt Linie, Füllung und Range-Input übereinander */
.year-slider-track {
  position: relative;
  display: flex;
  align-items: center;
  height: 24px;
}

/* Gemeinsame Form der beiden sichtbaren Linien. */
.year-slider-background,
.year-slider-fill {
  position: absolute;
  top: 50%;
  height: 2px;
  pointer-events: none;
  transform: translateY(-50%);
}

/* Vollständiger Hintergrund des Sliders. */
.year-slider-background {
  right: 0;
  left: 0;
  background: var(--line-color);
}

/* Gefüllter Bereich bis zum ausgewählten Jahr. */
.year-slider-fill {
  left: 0;
  background: var(--accent-color);
}

/* Unsichtbarer Browser-Slider über der eigenen Linie. */
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

/* Reglergriff in Chrome, Edge und Safari. */
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

/* Reglergriff in Firefox. */
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

/* Blendet den normalen Track in WebKit-Browsern aus. */
.year-slider-input::-webkit-slider-runnable-track {
  height: 24px;
  border: none;
  background: none;
}

/* Blendet den normalen Track in Firefox aus. */
.year-slider-input::-moz-range-track {
  height: 24px;
  border: none;
  background: none;
}

/* Zeigt das erste und letzte Jahr unter dem Slider. */
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