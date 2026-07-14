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
      <span class="trust-label">Datenquellen</span>
      <span class="trust-value">SMARD (Bundesnetzagentur) · ENTSO-E Transparency Platform</span>
    </div>
    <div class="trust-col">
      <span class="trust-label">Zeitraum</span>
      <span class="trust-value">01.01.2015 bis 31.12.2024</span>
    </div>
    <div class="trust-col">
      <span class="trust-label">Auflösung</span>
      <span class="trust-value">Stündliche Daten, zu Jahreswerten zusammengefasst</span>
    </div>
  </div>
</template>

<style scoped>
.trust-line {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  padding: 20px 0;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 96px;
}

.trust-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trust-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.trust-col:first-child .trust-label {
  font-size: 14px;
  color: var(--fg);
  letter-spacing: 0.02em;
}

.trust-value {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .trust-line {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
