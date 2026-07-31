// Nuxt-Konfiguration.
//
// ssr: false schaltet Server-Side-Rendering ab. Die Anwendung läuft als
// reine SPA im Browser. Das erfüllt die Aufgabenanforderung, dass die
// Anwendung nach der Bereitstellung der Daten offline nutzbar sein soll,
// und macht das Deployment einfacher — der Ausgabeordner nach
// `nuxt generate` ist ein statisch auslieferbares Bündel.
export default defineNuxtConfig({
  ssr: false,

  // Globales Stylesheet mit den CSS-Variablen für Farben und Schriften
  // sowie den @font-face-Definitionen für Inter und Source Serif 4.
  // Die Schriften liegen lokal in public/fonts/, damit die Anwendung
  // auch ohne CDN-Verbindung vollständig ist.
  css: [
    '~/assets/css/main.css',
  ],

  // Komponenten aus components/ rekursiv einlesen, aber ohne den
  // üblichen Ordnernamen als Prefix. Die Komponente
  // components/generation/StackedAreaLegend.vue heißt so im Template
  // <StackedAreaLegend />, nicht <GenerationStackedAreaLegend />.
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Stromdaten-Visualisierung',
    },
  },

  compatibilityDate: '2026-07-04',
})
