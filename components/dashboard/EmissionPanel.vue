<script setup lang="ts">
/**
 * EmissionPanel.vue – Rahmen für die Emissions-Visualisierung.
 *
 * Enthält keine eigene Daten- oder Chartlogik.
 * Verwendet ausschließlich die fertige DeviationChartView-Komponente.
 */

import DeviationChartView from '~/components/viz/DeviationChartView.vue'
</script>

<template>
  <section
    class="emission-panel"
    aria-labelledby="emission-panel-title"
  >
    <header class="emission-panel-header">
      <div class="emission-panel-heading">
        <p class="emission-panel-eyebrow">
          Strom und Klimaneutralität
        </p>

        <h1
          id="emission-panel-title"
          class="emission-panel-title"
        >
          Stromerzeugung und CO₂-Emissionen im Vergleich
        </h1>

        <p class="emission-panel-subtitle">
          Das Diagramm zeigt, wie viel Strom die einzelnen
          Energieträger erzeugen und welchen Anteil sie an den
          direkten CO₂-Emissionen haben.
        </p>
      </div>

      <NuxtLink
        to="/"
        class="page-navigation-button"
      >
        <span aria-hidden="true">←</span>
        Zur Übersicht
      </NuxtLink>
    </header>

    <div class="emission-panel-visualization">
      <DeviationChartView />
    </div>

    <footer class="emission-panel-footer">
      <p class="emission-panel-method">
        Die CO₂-Emissionen wurden anhand der SMARD-Erzeugungsdaten
        und direkter Emissionsfaktoren des Umweltbundesamtes
        berechnet. Emissionen aus Herstellung, Transport und
        Entsorgung sind nicht enthalten.
      </p>

      <p class="emission-panel-source">
        Quellen: SMARD, Bundesnetzagentur; Umweltbundesamt, Climate
        Change 16/2026.
      </p>
    </footer>
  </section>
</template>

<style scoped>
.emission-panel {
  width: min(1400px, 100%);
  margin: 0 auto;
  padding: 32px 24px 48px;
}

.emission-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.emission-panel-heading {
  max-width: 760px;
}

.emission-panel-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin: 0 0 8px;
}

.emission-panel-title {
  font-family: var(--font-serif);
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 600;
  line-height: 1.15;
  color: var(--fg);
  margin: 0;
  letter-spacing: -0.01em;
}

.emission-panel-subtitle {
  margin: 10px 0 0;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  color: var(--fg-muted);
}

.emission-panel-visualization {
  margin-top: 0;
}

.emission-panel-footer {
  margin-top: 24px;
  border-top: 1px solid var(--hairline);
  padding-top: 16px;
}

.emission-panel-method {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg-muted);
  margin: 0 0 8px;
}

.emission-panel-source {
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.5;
  color: var(--fg-muted);
  margin: 0;
}

.page-navigation-button {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--fg);
  text-decoration: none;
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.page-navigation-button:hover {
  border-bottom-color: var(--fg);
}

.page-navigation-button:focus-visible {
  outline: 2px solid rgba(122, 158, 110, 0.6);
  outline-offset: 4px;
  border-radius: 2px;
}

@media (max-width: 700px) {
  .emission-panel-header {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
