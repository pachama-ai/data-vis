<script setup lang="ts">
/**
 * ChartTemplate.vue – Wiederverwendbarer Rahmen für D3-Charts.
 *
 * Bietet Titel, optionalen Untertitel, Controls-Slot, Chart-Container
 * und Footer-Slot. Enthält keine Chart-Logik.
 */

import { ref } from 'vue'

interface ChartTemplateProps {
  title?: string
  subtitle?: string
  wrapperClass?: string
}

const props = defineProps<ChartTemplateProps>()

const chartContainer = ref<HTMLElement | null>(null)

defineExpose({
  chartContainer,
})
</script>

<template>
  <section :class="['chart-wrapper', wrapperClass ?? '']">
    <header class="chart-header">
      <div class="chart-heading">
        <h2 v-if="title" class="chart-title">{{ title }}</h2>

        <p v-if="subtitle" class="chart-subtitle">
          {{ subtitle }}
        </p>
      </div>

      <div v-if="$slots.controls" class="chart-controls">
        <slot name="controls" />
      </div>
    </header>

    <div class="chart-stage">
      <div ref="chartContainer" class="chart-container"></div>

      <slot name="overlay" />
    </div>

    <div v-if="$slots.default" class="chart-footer">
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
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.chart-heading {
  flex: 1;
  min-width: 0;
}

.chart-title {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--fg);
  margin: 0 0 4px;
  text-align: left;
}

.chart-subtitle {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg-muted);
  margin: 0;
  line-height: 1.4;
}

.chart-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.chart-footer {
  margin-top: 12px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
}

.chart-stage {
  position: relative;
  min-width: 0;
}
</style>
