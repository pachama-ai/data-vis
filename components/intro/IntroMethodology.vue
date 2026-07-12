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
        SMARD liefert die realisierte Erzeugung in stündlicher Auflösung nach Energieträger.
        ENTSO-E ergänzt die grenzüberschreitenden physischen Flüsse und Day-Ahead-Preise,
        in dieser Grafik nicht dargestellt, aber im Dashboard nutzbar.
        Aus den Stundenwerten wurden Jahressummen gebildet und daraus der prozentuale Anteil
        an der gesamten Nettostromerzeugung berechnet.
      </p>
      <p>
        <strong>Datenlücken.</strong>
        Für 2018 fehlen im ENTSO-E-Datensatz einige Wochen. Da für die Jahresaggregate
        in dieser Grafik nur SMARD verwendet wird, ist die Lücke hier nicht sichtbar.
        Im Dashboard wird sie markiert.
      </p>
      <p>
        <strong>Reproduzierbarkeit.</strong>
        Der Berechnungscode liegt in <code>composables/useEnergyMixData.ts</code>.
        Rohdaten und Aggregate sind unter <code>/public/data/</code> versioniert.
      </p>
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
