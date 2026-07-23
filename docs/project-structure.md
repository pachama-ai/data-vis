# Projektstruktur

Dieses Dokument beschreibt die Dateistruktur des Datenvisualisierungsprojekts.

## Routen

| Pfad | Datei | Inhalt |
|------|-------|--------|
| `/` | `pages/index.vue` | Startseite: Grouped-Bar-Chart (Strommix 2015 vs 2024) |
| `/dashboard` | `pages/dashboard.vue` | Dashboard mit zwei Tabs: Erzeugung und CO₂-Vergleich |
| `/dashboard?tab=emissions` | `pages/dashboard.vue` | CO₂-Vergleichsansicht (Abweichungsdiagramm) |

## Hauptordner

### `components/home/`
Komponenten der Startseite:
- `GroupedBarChart.vue` – Grouped-Bar-Chart, Vue + D3
- `groupedBarUtils.ts` – Hilfsfunktionen (Formatierung, Filter)
- `IntroHero.vue`, `IntroTrustLine.vue`, `IntroMethodology.vue` – Textblöcke

### `components/generation/`
Komponenten der Erzeugungsansicht (Stacked-Area-Chart):
- `GenerationPanel.vue` – Rahmen mit Titel/Beschreibung
- `StackedAreaChart.vue` – Stacked-Area-Chart (Vue-Adapter für D3-Klasse)
- `StackedAreaLegend.vue` – Klickbare Legende
- `MixTooltip.vue` – Tooltip beim Hovern
- `MixSidebar.vue` – Seitenleiste mit Kontext
- `AnnotationMarkers.vue` – Ereignis-Markierungen (1–5)
- `mixConfig.ts` – Farben, Reihenfolgen, Labels, Gruppen
- `mixData.ts` – Datenaufbereitung (normalize, Jahr berechnen)
- `mixMetrics.ts` – Berechnungen (Übersicht, Quelle, Annotation)
- `mixSelection.ts` – Gemeinsamer Zustand (Modus, Highlight, Jahr)

### `components/emissions/`
Komponenten der CO₂-Vergleichsansicht (Abweichungsdiagramm):
- `EmissionsPanel.vue` – Rahmen mit Titel/Beschreibung
- `DeviationChart.vue` – Abweichungsdiagramm (Vue-Adapter für D3-Klasse)
- `DeviationSidebar.vue` – Seitenleiste mit Jahresüberblick und Quellendetails
- `DeviationTooltip.vue` – Tooltip beim Hovern
- `YearSlider.vue` – Jahresauswahl-Schieberegler
- `deviationData.ts` – Berechnungen (Abweichung, erneuerbarer Anteil)
- `emissionsData.ts` – Emissionsfaktoren und -berechnungen

### `components/common/`
Gemeinsam genutzte Komponenten:
- `SiteNav.vue` – Globale Navigation (3 Tabs + Zoom + Kontrast)
- `ChartTemplate.vue` – Rahmen für D3-Charts (Steuerung, Overlay, Footer)

### `composables/`
Composables mit echter Vue-Reaktivität:
- `useHighContrast.ts` – Globaler Kontrastmodus
- `usePageZoom.ts` – Seiten-Zoom 100/105/110 %

### `data/`
- `loadVisualizationData.ts` – Lädt und cached die Visualisierungsdaten

### `types/`
- `mix.ts` – Typen für Stacked-Area- und Abweichungsdiagramm
- `visualization-data.ts` – Typen für die Rohdaten (SMARD)

### `public/data/`
- `visualization-data.json` – Hauptdatensatz
- `emission-factors.json` – CO₂-Emissionsfaktoren (UBA)
- `annotations.json` – 5 Ereignisse (Paris 2015, Kohleausstieg, etc.)
- `yearly_mix.json`, `hourly_2015_2024.json`, `smard.json`, `preise.json` – Rohdaten

### `scripts/`
Datenskripte (aufgerufen über `npm run data:*`):
- `build-data.ts` – Baut `visualization-data.json`
- `check-data.ts` – Validiert die Daten
- `download-smard.ts` – Lädt SMARD-Rohdaten herunter
- `download-fonts.ts` – Lädt Schriftarten lokal (einmalig)

### `assets/css/`
- `main.css` – Globale Styles, Design-Tokens, Kontrastmodus
- `chart-styles.css` – D3-Chart-Styles (Achsen, Labels, Overrides)

## Tests

| Ordner | Getestete Komponenten |
|--------|----------------------|
| `tests/home/` | GroupedBarChart, groupedBarUtils, homeDataTransform |
| `tests/generation/` | StackedAreaChart, Legend, Sidebar, Tooltip, AnnotationMarkers, mixConfig, mixData, mixMetrics, mixSelection, GenerationPanel |
| `tests/emissions/` | DeviationChart, Sidebar, Tooltip, YearSlider, deviationData, emissionsData, EmissionsPanel |
| `tests/dashboard/` | DashboardPage |
| `tests/common/` | SiteNav |
| `tests/composables/` | useHighContrast |
| `tests/data/` | nuclearData |

## Namensregeln

- **Komponenten:** PascalCase, z. B. `StackedAreaChart.vue`
- **Hilfsfunktionen:** camelCase, z. B. `groupedBarUtils.ts`
- **Daten:** camelCase, z. B. `mixData.ts`, `emissionsData.ts`
- **Composables:** `use`-Präfix nur bei echter Vue-Reaktivität
- **Sichtbare Texte:** Deutsch (im Template)
- **Interne Namen:** Englisch (im Code)

Neue Dateien gehören in den fachlich passenden Ordner. Shared Code in den kleinstmöglichen gemeinsamen Ordner, niemals globale `utils/`.
