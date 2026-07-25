<script setup lang="ts">
/**
 * Ermöglicht die Auswahl eines Jahres.
 *
 * Der Slider zeigt alle verfügbaren Jahre zwischen dem
 * ersten und dem letzten Eintrag. Bei einer Änderung wird
 * das ausgewählte Jahr an die übergeordnete Komponente gesendet.
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'

/**
 * Werte, die der Jahresregler braucht.
 */
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

/**
 * Bestimmt das erste verfügbare Jahr.
 *
 * Ohne Einträge wird das ausgewählte Jahr verwendet.
 *
 * @returns Kleinstes Jahr des Sliders
 */
function findMinimumYear(): number {
  const firstYear = props.years[0]

  return firstYear ?? props.selectedYear
}

const minimumYear = computed(findMinimumYear)

/**
 * Bestimmt das letzte verfügbare Jahr.
 *
 * Ohne Einträge wird das ausgewählte Jahr verwendet.
 *
 * @returns Größtes Jahr des Sliders
 */
function findMaximumYear(): number {
  const lastIndex = props.years.length - 1
  const lastYear = props.years[lastIndex]

  return lastYear ?? props.selectedYear
}

const maximumYear = computed(findMaximumYear)

/**
 * Berechnet die gefüllte Breite der Slider-Leiste.
 *
 * Hier wurde KI bei der Berechnung genutzt. Die erste Version
 * teilte durch 0, wenn nur ein Jahr vorhanden war. Dadurch
 * entstand für die Breite der Wert NaN. Der Sonderfall setzt
 * die Füllung deshalb auf 100 Prozent.
 *
 * @returns Fortschritt zwischen 0 und 100 Prozent
 */
function calculateFillPercent(): number {
  const minimum = minimumYear.value
  const maximum = maximumYear.value

  if (maximum <= minimum) {
    return 100
  }

  const selectedDistance =
    props.selectedYear - minimum

  const completeDistance =
    maximum - minimum

  return selectedDistance / completeDistance * 100
}

const fillPercent = computed(calculateFillPercent)

/**
 * Liest das Jahr aus dem Range-Input und sendet es weiter.
 *
 * Hier wurde KI bei der Typisierung des Events genutzt.
 * event.target hat zuerst keinen sicheren value-Zugriff.
 * Die Umwandlung zu HTMLInputElement behebt den Typfehler.
 *
 * @param event Eingabeereignis des Sliders
 */
function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const year = Number(input.value)

  emit('change', year)
}
</script>

<template>
  <div class="year-slider">
    <!-- Beschriftung und ausgewähltes Jahr -->
    <div class="year-slider-header">
      <span class="title-label">
        Jahr der Darstellung
      </span>

      <output class="year-slider-value">
        {{ selectedYear }}
      </output>
    </div>

    <!-- Slider mit eigener Hintergrundlinie -->
    <div class="year-slider-track">
      <div class="year-slider-background"></div>

      <div
        class="year-slider-fill"
        :style="{
          width: `${fillPercent}%`,
        }"
      ></div>

      <input
        type="range"
        class="year-slider-input"
        :min="minimumYear"
        :max="maximumYear"
        step="1"
        :value="selectedYear"
        aria-label="Jahr der Darstellung"
        :aria-valuenow="selectedYear"
        :aria-valuemin="minimumYear"
        :aria-valuemax="maximumYear"
        :aria-valuetext="String(selectedYear)"
        @input="handleInput"
      >
    </div>

    <!-- Erstes und letztes verfügbares Jahr -->
    <div
      class="year-slider-range"
      aria-hidden="true"
    >
      <span>{{ minimumYear }}</span>
      <span>{{ maximumYear }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Gesamter Bereich des Jahresreglers. */
.year-slider {
  padding-bottom: 20px;
}

/* Beschriftung und aktuelles Jahr. */
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

/*
 * Legt Hintergrund, Füllung und Eingabefeld übereinander.
 *
 * Hier wurde KI beim Aufbau mit position: absolute genutzt.
 * Die erste Version zeigte neben der eigenen Linie zusätzlich
 * den normalen Browser-Track. Alle sichtbaren Linien liegen
 * deshalb unter dem transparenten Range-Input.
 */
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
  border-radius: 1px;
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
  cursor: pointer;
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
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition:
    width 150ms ease-out,
    height 150ms ease-out,
    margin-top 150ms ease-out;
}

.year-slider-input::-webkit-slider-thumb:hover {
  width: 14px;
  height: 14px;
  margin-top: -6px;
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
  cursor: pointer;
  transition:
    width 150ms ease-out,
    height 150ms ease-out;
}

.year-slider-input::-moz-range-thumb:hover {
  width: 14px;
  height: 14px;
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