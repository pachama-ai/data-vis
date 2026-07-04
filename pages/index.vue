<script setup lang="ts">
/**
 * pages/index.vue — Landing-Seite
 * ================================
 * Einstiegsseite der App mit Racing-Bar-Chart und Projektbeschreibung.
 * Der Nutzer sieht die Entwicklung des Strommixes von 2015 bis 2024
 * als animierte Balken und kann von hier zum Dashboard navigieren.
 */
</script>

<template>
  <div class="landing">
    <!-- Headline -->
    <h1 class="landing-headline">Wovon haengt die Klimabilanz des deutschen Stroms ab?</h1>

    <!-- Subtitle -->
    <p class="landing-subtitle">
      Eine interaktive Analyse auf Basis von SMARD- und ENTSO-E-Daten, 2015-2024.
    </p>

    <!-- Racing Bar Chart -->
    <LandingRacingBarChart />

    <!-- Projektbeschreibung -->
    <div class="landing-description">
      <p>
        Diese Arbeit untersucht, welche Faktoren die CO2-Intensitaet des deutschen
        Strommixes bestimmen. Datenbasis sind stuendliche Erzeugungsdaten der
        Bundesnetzagentur (SMARD), Preis- und Handelsdaten von ENTSO-E sowie
        Emissionsfaktoren des Umweltbundesamts, jeweils fuer den Zeitraum 2015 bis 2024.
      </p>
      <p>
        Das Dashboard erlaubt es, den Zusammenhang zwischen Erzeugungsmix, Tageszeit,
        Jahreszeit und resultierender Klimabilanz interaktiv zu explorieren.
      </p>
    </div>

    <!-- Dashboard-Button -->
    <NuxtLink to="/dashboard" class="dashboard-link">
      Zum Dashboard &rarr;
    </NuxtLink>

    <!-- Footer -->
    <footer class="landing-footer">
      Quelle: SMARD (Erzeugung, installierte Leistung), ENTSO-E (Stromfluesse, Preise),
      UBA-Emissionsfaktoren  &bull;
      Technologiestack: Vue / D3 / Nuxt  &bull;
      Datenstand: Mai 2025
    </footer>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Landing-Container: zentriert, grosszuegiger Weiszraum
   ---------------------------------------------------------------- */
.landing {
  max-width: 780px;
  margin: 0 auto;
  padding: 60px 32px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* ----------------------------------------------------------------
   Headline (48-56px)
   ---------------------------------------------------------------- */
.landing-headline {
  font-size: 2.8rem;
  font-weight: 800;
  color: var(--fg);
  text-align: center;
  line-height: 1.15;
  max-width: 720px;
  margin-bottom: 8px;
}

/* ----------------------------------------------------------------
   Subtitle (18px)
   ---------------------------------------------------------------- */
.landing-subtitle {
  font-size: 1.1rem;
  color: var(--fg-muted);
  text-align: center;
  margin-bottom: 24px;
  max-width: 600px;
}

/* ----------------------------------------------------------------
   Projektbeschreibung
   ---------------------------------------------------------------- */
.landing-description {
  max-width: 640px;
  text-align: center;
  line-height: 1.7;
  margin-top: 8px;
}

.landing-description p {
  font-size: 0.95rem;
  color: var(--fg-muted);
  margin-bottom: 12px;
}

/* ----------------------------------------------------------------
   Dashboard-Button
   ---------------------------------------------------------------- */
.dashboard-link {
  display: inline-block;
  margin-top: 12px;
  padding: 14px 36px;
  font-family: var(--font);
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border-radius: 10px;
  text-decoration: none;
  transition: box-shadow 0.15s, transform 0.1s;
}

.dashboard-link:hover {
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
  transform: translateY(-1px);
  text-decoration: none;
}

/* ----------------------------------------------------------------
   Footer
   ---------------------------------------------------------------- */
.landing-footer {
  margin-top: 48px;
  font-size: 0.7rem;
  color: var(--fg-muted);
  text-align: center;
  line-height: 1.6;
}
</style>

