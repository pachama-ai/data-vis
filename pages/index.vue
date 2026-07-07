<script setup lang="ts">
/**
 * pages/index.vue — Landing-Seite
 * ================================
 * Einstiegsseite der App mit animiertem Streamgraph (Stacked-Area-Chart)
 * als narrativem Story-Hook. Zeigt den Wandel des deutschen Strommix
 * 2015–2024 und lädt Dashboard-Daten im Hintergrund vor.
 */

import { useDashboardPreload } from '~/composables/useDashboardPreload'

// Dashboard-Daten im Hintergrund vorladen (blockiert die Landing Page nicht)
useDashboardPreload()
</script>

<template>
  <div class="landing">
    <!-- Headline -->
    <h1 class="landing-headline">Wovon hängt die Klimabilanz des deutschen Stroms ab?</h1>

    <!-- Subtitle -->
    <p class="landing-subtitle">
      Eine interaktive Analyse auf Basis von SMARD-, UBA- und ENTSO-E-Daten, 2015–2024.
    </p>

    <!-- Leitsatz -->
    <p class="landing-leitsatz">
      Zwischen 2015 und 2024 verschiebt sich der deutsche Strommix sichtbar:
      Kernenergie endet, Kohle verliert an Gewicht, Wind und Photovoltaik wachsen.
    </p>

    <!-- AnimatedStreamgraph -->
    <ClientOnly>
      <LandingAnimatedStreamgraph />
      <template #fallback>
        <div class="stream-fallback">Diagramm wird geladen …</div>
      </template>
    </ClientOnly>

    <!-- Projektbeschreibung -->
    <div class="landing-description">
      <p>
        Der deutsche Strommix hat sich zwischen 2015 und 2024 deutlich verändert.
        Dieses Projekt untersucht, wie sich diese Verschiebungen auf CO₂-Intensität,
        erneuerbaren Anteil und Strompreise auswirken. Im Dashboard lassen sich
        Erzeugungsmix, stündliche Muster, Preise und Klimawirkung interaktiv vergleichen.
      </p>
    </div>

    <!-- Dashboard-Button -->
    <NuxtLink to="/dashboard" class="dashboard-link">
      Zum Dashboard &rarr;
    </NuxtLink>

    <!-- Footer -->
    <footer class="landing-footer">
      <span>Datenquellen: SMARD, Umweltbundesamt, ENTSO-E · Zeitraum: vollständige Jahre 2015–2024</span>
    </footer>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   Landing-Container: zentriert, großzügiger Weißraum
   ---------------------------------------------------------------- */
.landing {
  max-width: 1100px;
  margin: 0 auto;
  padding: 60px 32px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* ----------------------------------------------------------------
   Headline
   ---------------------------------------------------------------- */
.landing-headline {
  font-size: clamp(2rem, 4vw, 2.8rem);
  font-weight: 800;
  color: var(--fg);
  text-align: center;
  line-height: 1.15;
  max-width: 800px;
  margin-bottom: 4px;
}

/* ----------------------------------------------------------------
   Subtitle
   ---------------------------------------------------------------- */
.landing-subtitle {
  font-size: 1.05rem;
  color: var(--fg-muted);
  text-align: center;
  max-width: 650px;
  margin-bottom: 4px;
}

/* ----------------------------------------------------------------
   Leitsatz
   ---------------------------------------------------------------- */
.landing-leitsatz {
  font-size: 0.95rem;
  color: var(--fg);
  text-align: center;
  max-width: 700px;
  line-height: 1.6;
  font-style: italic;
  margin-bottom: 12px;
}

/* ----------------------------------------------------------------
   Streamgraph-Fallback (während SSR/ClientOnly)
   ---------------------------------------------------------------- */
.stream-fallback {
  width: 100%;
  max-width: 900px;
  height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  font-size: 0.9rem;
  background: #f9fafb;
  border-radius: 16px;
  border: 1px solid var(--border);
}

/* ----------------------------------------------------------------
   Projektbeschreibung
   ---------------------------------------------------------------- */
.landing-description {
  max-width: 700px;
  text-align: center;
  line-height: 1.7;
  margin-top: 8px;
}

.landing-description p {
  font-size: 0.95rem;
  color: var(--fg-muted);
  margin-bottom: 0;
}

/* ----------------------------------------------------------------
   Dashboard-Button
   ---------------------------------------------------------------- */
.dashboard-link {
  display: inline-block;
  margin-top: 18px;
  padding: 14px 42px;
  font-family: var(--font);
  font-size: 1.05rem;
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

