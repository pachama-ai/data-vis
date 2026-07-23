<script setup lang="ts">
/**
 * EmissionPanel.vue – Rahmen für die Emissions-Visualisierung.
 *
 * Enthält keine eigene Daten- oder Chartlogik.
 * Verwendet ausschließlich die fertige DeviationChartView-Komponente.
 */

import DeviationChart from '~/components/emissions/DeviationChart.vue'
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
          Das Diagramm zeigt den Unterschied zwischen dem Anteil
          eines Energieträgers an der Stromerzeugung und seinem
          Anteil an den direkten CO₂-Emissionen.
        </p>
      </div>
    </header>

    <div class="emission-panel-visualization">
      <DeviationChart />
    </div>

    <footer class="emission-panel-footer">
      <div class="emission-panel-sources">
        <div class="emission-source-block">
          <p class="source-label">Datenquelle</p>
          <p class="source-text">
            SMARD-Strommarktdaten der Bundesnetzagentur; Emissionsfaktoren
            des Umweltbundesamtes (Climate Change 16/2026)
          </p>
        </div>
      </div>
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
  margin-top: 32px;
  border-top: 1px solid var(--hairline);
  padding-top: 20px;
}

.emission-panel-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.emission-source-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin: 0;
}

.source-text {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg);
  line-height: 1.45;
  margin: 0;
}



@media (max-width: 700px) {
  .emission-panel-header {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
