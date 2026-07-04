// nuxt.config.ts — Zentrale Nuxt-Konfiguration
//
// ssr: false schaltet Server-Side-Rendering aus.
// Die App läuft als reiner Static-SPA-Mode (Client-Side-Rendering).
// Dadurch kann sie offline aus dem `dist/`-Ordner oder via `bun run dev -o` starten.
//
// css: lädt globales CSS aus assets/css/main.css
//
// app.head: hier wird der Inter-Font von Google Fonts eingebunden.
// Die Design-Tokens stehen in :root in main.css, nicht hier.
export default defineNuxtConfig({
  ssr: false,

  css: [
    '~/assets/css/main.css'
  ],

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Stromdaten-Visualisierung',
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
        }
      ]
    }
  },

  compatibilityDate: '2026-07-04'
})
