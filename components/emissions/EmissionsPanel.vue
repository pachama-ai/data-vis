<template>
<!--
    Bereich für das Emissionsdiagramm mit Überschrift und Datenquelle.

    Der Bereich besteht aus einer kurzen Einleitung, dem eigentlichen
    Diagramm und der Quellenangabe darunter.

    @author Selina Schneider
  -->  <section
    class="emission-panel"
    aria-labelledby="emission-panel-title"
  >
    <!-- Überschrift und Erklärung des Diagramms. -->
    <header class="emission-panel-header">
      <p class="emission-panel-eyebrow">
        Strom und Klimaneutralität
      </p>

      <h1
        id="emission-panel-title"
        class="emission-panel-title"
      >
        Stromerzeugung und CO₂-Emissionen<br>im Vergleich
      </h1>

      <p class="emission-panel-subtitle">
        Das Diagramm zeigt den Unterschied zwischen dem Anteil
        eines Energieträgers an der Stromerzeugung und seinem
        Anteil an den direkten CO₂-Emissionen.
      </p>
    </header>

    <!-- Darstellung des Emissionsvergleichs. -->
    <DeviationChart />

    <!-- Datenquellen unterhalb des Diagramms. -->
    <footer class="emission-panel-footer">
      <p class="source-label">
        Datenquelle
      </p>

      <p class="source-text">
        SMARD-Strommarktdaten der Bundesnetzagentur;
        Emissionsfaktoren des Umweltbundesamtes
        (Climate Change 16/2026)
      </p>
    </footer>
  </section>
</template>

<style scoped>
/*
 * Grundaufbau des Bereichs.
 */
.emission-panel {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px 48px;
}

/*
 * Kopfbereich über dem Diagramm.
 */
.emission-panel-header {
  max-width: 760px;
  margin-bottom: 28px;
}

/*
 * Einordnung über der Hauptüberschrift.
 */
.emission-panel-eyebrow {
  margin: 0 0 8px;
  color: var(--muted-text-color);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/*
 * Hauptüberschrift des Bereichs.
 */
.emission-panel-title {
  margin: 0;
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 36px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

/*
 * Erklärung unter der Überschrift.
 */
.emission-panel-subtitle {
  margin: 10px 0 0;
  color: var(--muted-text-color);
  font-size: 15px;
  line-height: 1.6;
}

/*
 * Quellenbereich unter dem Diagramm.
 */
.emission-panel-footer {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--line-color);
}

/*
 * Beschriftung über dem Quellentext.
 */
.source-label {
  margin: 0 0 4px;
  color: var(--muted-text-color);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/*
 * Text mit den verwendeten Datenquellen.
 */
.source-text {
  margin: 0;
  color: var(--text-color);
  font-size: 13px;
  line-height: 1.45;
}
</style>