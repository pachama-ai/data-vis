<script setup lang="ts">
/**
 * YearSlider.vue – Slider zur Auswahl des Jahres für das Abweichungsdiagramm.
 *
 * Sendet bei Änderung die ausgewählte Jahreszahl per Event.
 * Unterstützt Tastaturbedienung (nativ über input type="range").
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
      <label
        for="deviation-year"
        class="year-slider-label"
      >
        Jahr der Darstellung
      </label>

      <output
        for="deviation-year"
        class="year-slider-value"
      >
        {{ selectedYear }}
      </output>
    </div>

    <input
      id="deviation-year"
      type="range"
      class="year-slider-input"
      :min="minimumYear"
      :max="maximumYear"
      step="1"
      :value="selectedYear"
      @input="handleInput"
    >

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
.year-slider {
  padding: 12px 0 4px;
}

.year-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.year-slider-label {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-muted);
  font-weight: 500;
}

.year-slider-value {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1;
}

.year-slider-input {
  width: 100%;
  height: 4px;
  appearance: none;
  background: var(--hairline);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.year-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

.year-slider-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

.year-slider-input:focus-visible {
  outline: 2px solid rgba(122, 158, 110, 0.6);
  outline-offset: 2px;
}

.year-slider-range {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
}
</style>
