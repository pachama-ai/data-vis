<!--
  IntroMethodology.vue – Aufklappbare Begriffserklärungen auf der Startseite.
  @author Selina Schneider
-->
<template>
  <details class="intro-methodology">
    <summary class="method-summary">
      <span class="method-chevron">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      Begriffe &amp; Definitionen
    </summary>
    <div class="method-content">
      <p><strong>Prozentpunkte (pp)</strong> – Absolute Differenz zwischen den Anteilen von 2015 und 2024. Beispiel: Steigt ein Anteil von 20 % auf 25 %, ist das ein Zuwachs von 5 Prozentpunkten (nicht 25 %).</p>
      <p><strong>Sonstige konventionelle Energieträger</strong> – Nicht-erneuerbare Energieträger außerhalb von Kohle, Erdgas und Kernenergie. Umfasst insbesondere Mineralöl, Grubengas und nicht erneuerbare Abfälle. Zusammen tragen sie in Deutschland typischerweise unter 5 % zur öffentlichen Nettostromerzeugung bei.</p>
      <p><strong>Öffentliche Nettostromerzeugung</strong> – In das öffentliche Stromnetz eingespeister Strom. Der industrielle Eigenverbrauch (zum Beispiel werkseigene Kraftwerke, Photovoltaik-Eigenverbrauch privater Haushalte) ist nicht enthalten.</p>
    </div>
  </details>
</template>

<style scoped>
.intro-methodology {
  margin-bottom: 48px;
  border-top: 1px solid var(--line-color);
  padding-top: 24px;
}

.method-summary {
  font-family: var(--sans-font);
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-text-color);
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  padding: 8px 0;
  border-radius: 4px;
  transition: color 200ms ease-out, background 200ms ease-out;
}

.method-summary:hover {
  color: var(--text-color);
  background: rgba(0,0,0,0.03);
}

.method-summary::-webkit-details-marker {
  display: none;
}

.method-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  transition: transform 200ms ease-out;
  flex-shrink: 0;
}

details[open] .method-chevron {
  transform: rotate(90deg);
}

.method-content {
  max-width: 720px;
  margin-top: 20px;
  padding-bottom: 12px;
  font-family: var(--sans-font);
  font-size: 14px;
  color: var(--muted-text-color);
  line-height: 1.7;
}

.method-content p {
  margin-bottom: 12px;
}

.method-content strong {
  color: var(--text-color);
  font-weight: 600;
}
</style>
