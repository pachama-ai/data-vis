<script setup lang="ts">
/**
 * GenerationPanel.vue – Rahmen für die Strommix-Visualisierung.
 *
 * Enthält keine eigene Daten- oder Chartlogik.
 * Verwendet ausschließlich die fertige StackedArea-Komponente.
 *
 * @author Selina Schneider
 */

import StackedAreaChart from '~/components/generation/StackedAreaChart.vue'
</script>

<template>
  <section
    class="strommix-panel"
    aria-labelledby="strommix-panel-title"
  >
    <header class="strommix-panel-header">
      <div class="strommix-panel-heading">
        <p class="strommix-panel-eyebrow">
          Strom und Klimaneutralität
        </p>

        <h1
          id="strommix-panel-title"
          class="strommix-panel-title"
        >
          Entwicklung der Stromerzeugung 2015–2024
        </h1>

        <p class="strommix-panel-subtitle">
          Monatliche Entwicklung der öffentlichen Nettostromerzeugung
          in Deutschland auf Basis von SMARD-Daten, in
          Terawattstunden (TWh).
        </p>
      </div>
    </header>

    <div class="strommix-panel-visualization">
      <StackedAreaChart />
    </div>

    <footer class="strommix-panel-footer">
      <div class="strommix-panel-sources">
        <div class="source-block">
          <p class="source-label">Datenquelle</p>
          <p class="source-text">SMARD-Strommarktdaten der Bundesnetzagentur</p>
        </div>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.strommix-panel {
  width: min(1400px, 100%);
  margin: 0 auto;
  padding: 32px 24px 48px;
}

.strommix-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.strommix-panel-heading {
  max-width: 760px;
}

.strommix-panel-eyebrow {
  font-family: var(--sans-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-text-color);
  margin: 0 0 8px;
}

.strommix-panel-title {
  font-family: var(--serif-font);
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 600;
  line-height: 1.15;
  color: var(--text-color);
  margin: 0;
  letter-spacing: -0.01em;
}

.strommix-panel-subtitle {
  margin: 10px 0 0;
  font-family: var(--sans-font);
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted-text-color);
}

.strommix-panel-visualization {
  margin-top: 0;
}

.strommix-panel-footer {
  margin-top: 32px;
  border-top: 1px solid var(--line-color);
  padding-top: 20px;
}

.strommix-panel-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.source-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-label {
  font-family: var(--sans-font);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-text-color);
  margin: 0;
}

.source-text {
  font-family: var(--sans-font);
  font-size: 13px;
  color: var(--text-color);
  line-height: 1.45;
  margin: 0;
}

@media (max-width: 700px) {
  .strommix-panel-header {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
