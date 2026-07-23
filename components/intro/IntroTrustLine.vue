<script setup lang="ts">
/**
 * components/intro/IntroTrustLine.vue
 * ====================================
 * Schmale Trust-Zeile: Datenquellen · Zeitraum · Auflösung.
 * Oben/unten durch Hairline getrennt, drei Spalten.
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
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 64px;
}

.trust-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trust-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.trust-value {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg);
  line-height: 1.45;
}

@media (max-width: 768px) {
  .trust-line {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
