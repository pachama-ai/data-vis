<script setup lang="ts">
/**
 * Gemeinsamer Rahmen für die D3-Diagramme.
 *
 * Die Komponente zeigt Titel, Untertitel, Bedienelemente
 * und zusätzliche Hinweise rund um das Diagramm.
 * Die eigentliche Zeichnung übernimmt die jeweilige
 * Diagramm-Komponente.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'

/**
 * Angaben, die an den Diagrammrahmen übergeben werden können.
 */
interface ChartTemplateProps {
  wrapperClass?: string
}

defineProps<ChartTemplateProps>()

/**
 * Verweist auf den Bereich, in den D3 das Diagramm zeichnet.
 *
 * Bei dieser Stelle wurde kurz KI genutzt, weil mir zuerst
 * nicht klar war, wie eine andere Komponente mit defineExpose
 * auf dieses Element zugreifen kann.
 */
const chartContainer = ref<HTMLElement | null>(null)

defineExpose({
  chartContainer,
})
</script>

<template>
  <section :class="['chart-wrapper', wrapperClass]">
    <header class="chart-header">
      <div
        v-if="$slots.controls"
        class="chart-controls"
      >
        <slot name="controls" />
      </div>
    </header>

    <div class="chart-stage">
      <!-- Hier wird das D3-Diagramm eingefügt. -->
      <div
        ref="chartContainer"
        class="chart"
      ></div>

      <!-- Zusätzliche Elemente über dem Diagramm, zum Beispiel Tooltips. -->
      <slot name="overlay" />
    </div>

    <!-- Platz für Hinweise unter dem Diagramm. -->
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

/*
 * Ordnet Überschrift und Bedienelemente an.
 *
 * Bei den flexiblen Abständen wurde KI genutzt,
 * weil der Bereich auch bei wenig Platz lesbar
 * bleiben und nicht über den Rand laufen sollte.
 */
.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-heading {
  flex: 1;
  min-width: 0;
}

/* Überschrift des Diagramms. */
.chart-title {
  margin: 0 0 4px;
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 1.3rem;
  font-weight: 500;
  text-align: left;
}

/* Kurze Erklärung unter der Überschrift. */
.chart-subtitle {
  margin: 0;
  padding-left: 60px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 13px;
  line-height: 1.4;
}

/* Filter oder Schaltflächen neben der Überschrift. */
.chart-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}

/* Bezugspunkt für Elemente über dem Diagramm. */
.chart-stage {
  position: relative;
  min-width: 0;
}

/* Zusätzliche Hinweise unter dem Diagramm. */
.chart-footer {
  margin-top: 12px;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 11px;
}
</style>
