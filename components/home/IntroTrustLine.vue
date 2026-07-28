<script setup lang="ts">
/**
 * components/home/IntroTrustLine.vue
 *
 * Schmale Trust-Zeile: Datenquellen · Zeitraum · Auflösung.
 * Oben/unten durch Hairline getrennt, drei Spalten.
 *
 * @author Selina Schneider
 */
</script>

<template>
  <div class="trust-line">
    <div class="trust-col">
      <span class="trust-label">Datenquelle</span>
      <span class="trust-value">SMARD-Strommarktdaten der Bundesnetzagentur</span>
    </div>
    <div class="trust-col">
      <span class="trust-label">Vergleichszeitraum</span>
      <span class="trust-value">Jahreswerte 2015 und 2024</span>
    </div>
    <div class="trust-col">
      <span class="trust-label">Datengrundlage</span>
      <span class="trust-value">Stündliche Erzeugungsdaten, zu Jahreswerten summiert</span>
    </div>
  </div>
</template>

<style scoped>
.trust-line {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 32px;
  padding: 24px 0;
  border-top: 1px solid var(--line-color);
  border-bottom: 1px solid var(--line-color);
  margin-bottom: 64px;
}

.trust-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trust-label {
  font-family: var(--sans-font);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-text-color);
}

.trust-value {
  font-family: var(--sans-font);
  font-size: 13px;
  color: var(--text-color);
  line-height: 1.45;
}
</style>
