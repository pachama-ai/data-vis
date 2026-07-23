<script setup lang="ts">
/**
 * YearSlider.vue – Slider zur Auswahl des Jahres für das Abweichungsdiagramm.
 *
 * Sendet bei Änderung die ausgewählte Jahreszahl per Event.
 * Unterstützt Tastaturbedienung (nativ über input type="range").
 *
 * Styles: eyebrow-title für die Beschriftung, custom Range-Styling
 * mit grünem Füllbalken links vom Griff.
 */

import { computed } from 'vue'

// =========================================================================
// Props
// =========================================================================

interface YearSliderProps {
  years: number[]
  selectedYear: number
}

const props = defineProps<YearSliderProps>()

const emit = defineEmits<{
  change: [year: number]
}>()

// =========================================================================
// Hilfswerte
// =========================================================================

const minimumYear = computed(() => {
  const firstYear = props.years[0]

  return firstYear ?? props.selectedYear
})

const maximumYear = computed(() => {
  const years = props.years
  const lastYear = years[years.length - 1]

  return lastYear ?? props.selectedYear
})

/** Fortschritt in Prozent für den Füllbalken */
const fillPercent = computed(() => {
  const min = minimumYear.value
  const max = maximumYear.value
  if (max <= min) return 100
  return ((props.selectedYear - min) / (max - min)) * 100
})

// =========================================================================
// Event-Handler
// =========================================================================

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const year = Number(input.value)
  emit('change', year)
}
</script>

<template>
  <div class="year-slider">
    <div class="year-slider-header">
      <span class="eyebrow-title">Jahr der Darstellung</span>

      <output
        class="year-slider-value"
      >
        {{ selectedYear }}
      </output>
    </div>

    <div class="year-slider-track-wrapper">
      <div class="year-slider-track-bg" />
      <div
        class="year-slider-track-fill"
        :style="{ width: `${fillPercent}%` }"
      />
      <input
        type="range"
        class="year-slider-input"
        :min="minimumYear"
        :max="maximumYear"
        step="1"
        :value="selectedYear"
        :aria-label="'Jahr der Darstellung'"
        :aria-valuenow="selectedYear"
        :aria-valuemin="minimumYear"
        :aria-valuemax="maximumYear"
        :aria-valuetext="`${selectedYear}`"
        @input="handleInput"
      >
    </div>

    <div class="year-slider-range" aria-hidden="true">
      <span>{{ minimumYear }}</span>
      <span>{{ maximumYear }}</span>
    </div>
  </div>
</template>

<style scoped>
.year-slider {
  padding: 0 0 20px;
}

/* Eyebrow-Überschrift (wie SORTIERUNG, DATENQUELLE) */
.eyebrow-title {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  user-select: none;
}

/* ── Header-Zeile ── */
.year-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.year-slider-value {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 700;
  color: var(--fg);
  line-height: 1;
}

/* ── Track-Wrapper (überlagert Hintergrund + Füllung + Input) ── */
.year-slider-track-wrapper {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}

.year-slider-track-bg,
.year-slider-track-fill {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 2px;
  border-radius: 1px;
  pointer-events: none;
}

.year-slider-track-bg {
  left: 0;
  right: 0;
  background: var(--hairline);
}

.year-slider-track-fill {
  left: 0;
  background: var(--accent);
}

/* ── Input (unsichtbar, aber interaktiv) ── */
.year-slider-input {
  position: relative;
  width: 100%;
  height: 24px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: none;
  cursor: pointer;
  z-index: 1;
}

/* WebKit (Chrome, Edge, Safari) – Thumb */
.year-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: width 150ms ease-out, height 150ms ease-out;
}

.year-slider-input::-webkit-slider-thumb:hover {
  width: 14px;
  height: 14px;
}

.year-slider-input:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Firefox – Thumb */
.year-slider-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  cursor: pointer;
  transition: width 150ms ease-out, height 150ms ease-out;
}

.year-slider-input::-moz-range-thumb:hover {
  width: 14px;
  height: 14px;
}

.year-slider-input:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Track unsichtbar machen (wir zeichnen eigene) */
.year-slider-input::-webkit-slider-runnable-track {
  background: none;
  border: none;
  height: 24px;
}

.year-slider-input::-moz-range-track {
  background: none;
  border: none;
  height: 24px;
}

/* ── Endpunkte ── */
.year-slider-range {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--fg-muted);
  user-select: none;
}
</style>
