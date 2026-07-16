<script setup lang="ts">
/**
 * components/intro/IntroMethodology.vue
 * ======================================
 * Aufklappbarer Methodik-Bereich (<details>).
 */
</script>

<template>
  <details class="intro-methodology">
    <summary class="method-summary">
      <span class="method-chevron">▶</span>
      Methodische Hinweise
    </summary>
    <div class="method-content">
      <p>
        <strong>Datenverarbeitung.</strong>
        Die stündlichen Daten zur Stromerzeugung stammen von SMARD und sind nach Energieträgern aufgeteilt.
        Die Day-Ahead-Preise wurden über die ENTSO-E API ergänzt.
        Für die Landingpage wurden die Stundenwerte zu Jahreswerten zusammengefasst und in prozentuale Anteile umgerechnet.
        Im Dashboard werden die Daten je nach Ansicht täglich, wöchentlich, monatlich oder quartalsweise ausgewertet.
      </p>
      <p>
        <strong>Marktgebietswechsel 2018.</strong>
        Im Oktober 2018 wurde das gemeinsame Marktgebiet Deutschland–Österreich–Luxemburg neu zugeschnitten.
        Dieser Wechsel wurde bei der Aufbereitung der Preisdaten berücksichtigt.
        Die SMARD-Erzeugungsdaten sind vollständig; im zusammengeführten Datensatz mit ENTSO-E-Preisen
        fehlen ab Oktober jedoch rund 25 % der Stunden.
      </p>
    </div>
  </details>

  <details class="intro-methodology">
    <summary class="method-summary">
      <span class="method-chevron">▶</span>
      Begriffe &amp; Definitionen
    </summary>
    <div class="method-content">
      <p><strong>CO₂-Intensität</strong> – Gramm CO₂ pro erzeugter Kilowattstunde Strom. Berechnet aus dem stündlichen Erzeugungsmix und den Emissionsfaktoren des Umweltbundesamts.</p>
      <p><strong>EE-Anteil (Erneuerbare Energien)</strong> – Anteil aus Wind (Onshore + Offshore), Photovoltaik, Wasserkraft und Biomasse an der Gesamterzeugung.</p>
      <p><strong>Konventioneller Anteil</strong> – Alle nicht-erneuerbaren Erzeugungsarten: Braunkohle, Steinkohle, Erdgas, Kernkraft und Sonstige Konventionelle. <em>Nicht identisch mit „fossil" – Kernkraft ist enthalten.</em></p>
      <p><strong>Fossiler Anteil</strong> – Nur Braunkohle, Steinkohle, Erdgas und Öl. Ohne Kernkraft.</p>
      <p><strong>Stromnachfrage</strong> – Netzlast in Gigawatt (GW), gemittelt über die Stunde.</p>
      <p><strong>Day-Ahead-Preis</strong> – Großhandelspreis für Strom, festgestellt am Vortag am EPEX-Spotmarkt. Kann negativ werden bei EE-Überschuss.</p>
      <p><strong>Stunden im Perzentil (Top/Bottom 10 %)</strong> – Die 10 % der Stunden im Zeitraum mit den höchsten bzw. niedrigsten Werten der jeweiligen Kennzahl.</p>
    </div>
  </details>
</template>

<style scoped>
.intro-methodology {
  margin-bottom: 96px;
  border-top: 1px solid var(--hairline);
  padding-top: 24px;
}

.method-summary {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-muted);
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.method-summary:hover {
  color: var(--fg);
}

.method-summary::-webkit-details-marker {
  display: none;
}

.method-chevron {
  font-size: 10px;
  transition: transform 0.2s;
  display: inline-block;
}

details[open] .method-chevron {
  transform: rotate(90deg);
}

.method-content {
  max-width: 720px;
  margin-top: 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg-muted);
  line-height: 1.7;
}

.method-content p {
  margin-bottom: 12px;
}

.method-content strong {
  color: var(--fg);
  font-weight: 600;
}

.method-content code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  background: #e8e8e8;
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
