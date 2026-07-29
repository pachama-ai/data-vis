<script setup lang="ts">
/**
 * Gemeinsamer Rahmen für die beiden Dashboard-Diagramme.
 *
 * Stellt den Bereich bereit, in den D3 das SVG hängt, plus Slots für
 * Bedienelemente über und Fußnoten unter dem Diagramm. Das Zeichnen
 * selbst passiert in der jeweiligen Chart-Klasse.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'

interface ChartTemplateProps {
}

defineProps<ChartTemplateProps>()

// Diesen Ref reiche ich per defineExpose nach außen, damit die
// Chart-Klasse das SVG direkt in dieses div hängen kann.
const chartContainer = ref<HTMLElement | null>(null)

defineExpose({
  chartContainer,
})
</script>

<template>
  <section class="chart-wrapper">
    <header
      v-if="$slots.controls"
      class="chart-header"
    >
      <div class="chart-controls">
        <slot name="controls" />
      </div>
    </header>

    <div class="chart-stage">
      <div
        ref="chartContainer"
        class="chart"
      ></div>
      <slot name="overlay" />
    </div>

    <div
      v-if="$slots.default"
      class="chart-footer"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
@import '~/assets/css/chart-styles.css';

.chart-wrapper {
  width: 100%;
}

.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}

/* Bezugspunkt für den Overlay-Slot (Tooltips werden absolut positioniert). */
/* min-width: 0 verhindert, dass das SVG den Flex-Container sprengt. */
.chart-stage {
  position: relative;
  min-width: 0;
}

.chart-footer {
  margin-top: 12px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 11px;
}
</style>