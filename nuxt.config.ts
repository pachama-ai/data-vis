// nuxt.config.ts — Zentrale Nuxt-Konfiguration
//
// ssr: false schaltet Server-Side-Rendering aus.
// Die App läuft als reiner Static-SPA-Mode (Client-Side-Rendering).
// Dadurch kann sie offline aus dem `dist/`-Ordner oder via `bun run dev -o` starten.
//
// css: lädt globales CSS aus assets/css/main.css (inkl. lokaler @font-face-Definitionen)
//
// Fonts: Inter und Source Serif 4 werden lokal aus public/fonts/ geladen.
// Kein CDN — App ist offline-fähig.
export default defineNuxtConfig({
  ssr: false,

  css: [
    '~/assets/css/main.css'
  ],

  // Komponenten-Scan:
  // Alle Unterordner werden rekursiv gescannt.
  // Kein Directory-Prefix (RecordTimeline statt LandingRecordTimeline).
  // Dashboard/Viz-Komponenten importieren wir explizit via defineAsyncComponent.
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Stromdaten-Visualisierung'
    }
  },

  compatibilityDate: '2026-07-04'
})
