# Die Klimabilanz des deutschen Stroms

**Interaktive Datenvisualisierung des deutschen Strommarkts 2015–2024**

Vue 3 / Nuxt 4 · D3.js v7 · TypeScript · Daten: SMARD & ENTSO-E

Hochschule Harz, Medieninformatik, Modul Visualisierung, Frühjahr 2026  
Prof. Jürgen Singer

---

## Projektziel

Eine interaktive Webanwendung zur Analyse der CO₂-Bilanz des deutschen Strommarkts von 2015 bis 2024. Die Visualisierung soll zeigen, wie sich der Strommix verändert hat, welche Faktoren die CO₂-Intensität beeinflussen und wie sich Preise und Erzeugung im Tagesverlauf verhalten.

## Datenquellen

| Quelle | Daten | Bezug |
|--------|-------|-------|
| **SMARD** (smard.de) | Stündliche Erzeugungsdaten nach Energieträger, Netzlast | Realisierte Erzeugung, Deutschland, 2015–2024 |
| **ENTSO-E Transparency Platform** | Stündliche Day-Ahead-Preise | Marktgebiet DE-LU (ab 10/2018), davor DE-AT-LU |
| **Umweltbundesamt** | CO₂-Emissionsfaktoren pro Energieträger | Referenzwerte in g/kWh |

Die Rohdaten wurden einmalig heruntergeladen und liegen als JSON im Projekt (`public/data/`).

## Setup

### Voraussetzungen

- [Bun](https://bun.sh/) (empfohlen) oder Node.js 20+
- Kein API-Key nötig — alle Daten sind im Repository

### Installation und Start

```bash
# Abhängigkeiten installieren
bun install

# Entwicklungsserver starten
bun run dev

# Produktions-Build
bun run build

# Vorschau des Builds
bun run preview
```

Die Anwendung läuft unter `http://localhost:3000`.

## Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `bun run dev` | Entwicklungsserver mit Hot-Reload |
| `bun run build` | Produktions-Build |
| `bun run preview` | Vorschau des Builds |
| `bun run typecheck` | TypeScript-Prüfung |
| `bun run test` | Unit-Tests ausführen (Vitest) |
| `bun run validate` | Datenqualitäts-Prüfung |
| `bun run audit` | Alle Qualitätschecks (Level 1–3) |
| `bun run check:data` | Dashboard-Kennzahlen gegen Rohdaten prüfen |
| `bun run pipeline` | Datenpipeline neu bauen (nach Daten-Update) |
| `bun run check` | TypeScript + Tests + Build |

## Projektstruktur

```
data-vis/
├── pages/
│   ├── index.vue              # Landing-Page mit Barbell-Chart
│   └── dashboard.vue          # Dashboard mit 4 Tabs
├── components/
│   ├── dashboard/             # KPI-Karten, Filter
│   │   ├── KpiCard.vue        # Sparkline-Kachel
│   │   └── FilterBar.vue      # Jahr-Auswahl
│   ├── viz/                   # Visualisierungen
│   │   ├── StackedArea.vue    # Strommix-Entwicklung
│   │   ├── ScatterAnalysis.vue# Einflussfaktoren
│   │   ├── HeatmapCO2.vue     # Tagesmuster
│   │   └── HourlyProfile.vue      # Tagesprofil-Vergleich
│   └── intro/                 # Landingpage-Komponenten
├── composables/               # Geteilte Logik
│   ├── useData.ts             # Daten-Loader mit Cache
│   └── useFilters.ts          # KPI-Jahrfilter
├── scripts/                   # Daten-Pipeline
│   ├── build_hourly.mjs       # Stundenwerte berechnen
│   ├── build_yearly.mjs       # Jahresaggregation
│   ├── download-prices.js     # ENTSO-E-Download
│   ├── download-smard.js      # SMARD-Download
│   └── validate-data.mjs      # Datenvalidierung
├── audit/                     # Qualitätschecks
│   ├── level1-integrity.mjs   # Rohdaten-Integrität
│   └── level3-consistency.mjs # Konsistenz zwischen Ansichten
├── tests/
│   └── calculations.test.ts   # 30 Unit-Tests
└── public/data/
    ├── hourly_2015_2024.json   # Stundenwerte (~85k Zeilen)
    ├── yearly_mix.json         # Jahreswerte (2015–2024)
    └── emission_factors.json   # CO₂-Emissionsfaktoren
```

## Visualisierungen

### Landing-Page: Barbell-Chart

Vergleicht den Strommix 2015 vs. 2024. Jeder Energieträger wird als Kapsel dargestellt, sortiert nach Veränderungsstärke. Animation startet beim Hineinscrollen.

### Dashboard (4 Tabs)

| Tab | Komponente | Beschreibung |
|-----|-----------|-------------|
| **Strommix** | `StackedArea.vue` | Gestapelte Fläche des Erzeugungsmix 2015–2024, absolut oder in Prozent. Annotationen für Atomausstieg (2023) und Kohleausstiegsbeschluss (2020). |
| **Einflussfaktoren** | `ScatterAnalysis.vue` | Scatterplot: CO₂-Intensität vs. EE-Anteil, Preis, Last oder konventionellem Anteil. Mit Zeitraum-Slider, Regressionslinie und Erklärzonen. |
| **Tagesmuster** | `HeatmapCO2.vue` | 24h × 365-Tage-Heatmap. Metriken: CO₂, EE-Anteil, Konventioneller Anteil, Preis. Perzentil-Clipping für Ausreißer. |
| **Markt & Preise** | `HourlyProfile.vue` | Tagesprofile mit Zeitregler. 4 KPI-Karten (PV, Residuallast, Preis, CO₂). Vergleichsmodus mit zwei unabhängigen Timelines. |

### KPI-Kacheln

Vier Kennzahlen mit Sparklines: EE-Anteil, CO₂-Intensität, Day-Ahead-Preis, Negativpreis-Stunden. Filterbar nach Gesamtzeitraum oder Einzeljahren.

## Datenpipeline

Die Datenpipeline läuft als Node.js-Skripte im `scripts/`-Verzeichnis:

```
smard.json ──┐
             ├──→ build_hourly.mjs ──→ hourly_2015_2024.json
preise.json ─┘                            │
                                           └──→ build_yearly.mjs ──→ yearly_mix.json
```

`build_hourly.mjs` führt einen Inner Join auf den Timestamp durch und berechnet:
- CO₂-Intensität (gewichteter Durchschnitt über Emissionsfaktoren)
- EE-Anteil und konventioneller Anteil
- generation_by_source (auf Englisch gemappt)

Die jährliche CO₂-Intensität (`yearly_mix.json`) ist das arithmetische Mittel aller stündlichen CO₂-Intensitäten eines Jahres. Die stündlichen Werte selbst werden anhand des jeweiligen Erzeugungsmixes (erzeugungsgewichtet über die Emissionsfaktoren der einzelnen Energieträger) berechnet.

Nach einem Download neuer Rohdaten wird die Pipeline mit `bun run pipeline` neu durchlaufen.

## Qualitätssicherung

Das Projekt hat drei automatisierte Qualitätsstufen:

1. **Level 1 — Datenintegrität**: Prüft Rohdaten auf Lücken, Wertebereiche, DST-Umstellungen und Summenkonsistenz
2. **Level 2 — Unit-Tests**: 30 Tests für EE-Anteil, Residuallast, CO₂, Korrelation, Regression, Delta-Formatierung
3. **Level 3 — Konsistenz**: Vergleicht Dashboard-Werte mit Rohdaten-Aggregation

Alle Checks: `bun run audit`

## Bekannte Grenzen

- **2015 beginnt am 4. Januar**: Die SMARD-API liefert erst ab diesem Datum, ~95 Stunden fehlen
- **2018-Datenlücke (Okt–Dez)**: Durch ENTSO-E-Marktgebietswechsel fehlen die Preisdaten. Ein Fix im Download-Skript ist implementiert, aber ein erneuter Download mit ENTSO-E-Token nötig
- **Keine Importe/Exporte**: Die Residuallast ignoriert den grenzüberschreitenden Stromhandel
- **Durchschnittswerte**: Der Zeitregler zeigt gemittelte Tagesprofile, keine Einzeltage

## Abweichungen vom Lehrskript

Das Lehrskript (Singer, „Visualisierung mit Type-/JavaScript und D3", 2026) schlägt einige Patterns vor, die hier bewusst anders umgesetzt wurden:

### Anders gemacht

| Skript | Dieses Projekt | Begründung |
|--------|---------------|-----------|
| `d3.create("svg")` + `onMounted`-Append | Gleiches Pattern in `KpiCard.vue` | Übernommen, da es die saubere Trennung von Vue- und D3-DOM gewährleistet |
| Klassenbasierte Charts (`BaseChart`, Vererbung) | Funktionale Komponenten mit `computed`/`watch` | Vue 3 idiomatischer. Klassen sind nicht nötig, solange keine wiederverwendbare Chart-Familie entsteht |
| `d3.csv()` zum Datenladen | Composables (`useData`) mit `fetch` + Cache | `shallowRef` und geteilte Promises sind für 85k Zeilen performanter; `d3.csv` blockt den Hauptthread |
| Enter/Update/Exit mit Key-Accessor | Nur in `ScatterAnalysis.vue` (Punkte-Join) | Bei Aggregatswechsel (HourlyProfile, Heatmap) ist komplettes Neuzeichnen nötig und schneller als diff |
| Animation mit `.transition()` | Nur auf der Landing-Page | Dashboard-Charts zeigen statische Zustände; Animation würde beim Slider-Ziehen stören |
| SFC-Reihenfolge `<template> → <style> → <script>` | Nur in `KpiCard.vue` | Der Rest folgt Vite-Default. Konsistent innerhalb des Projekts |

### Nachgenutzt

- TypeScript mit expliziten Interfaces (`HourlyRow`, `YearlyRow`, `Point`)
- D3 als `import * as d3 from "d3"`
- `d3.scaleLinear()`, `.domain()`, `.range()`, Achsen mit `.call()`
- Nullish Coalescing (`??`) und Optional Chaining
- `scoped`-Styles
- Nuxt mit `pages/`, `components/`, `composables/`
- Kein Tailwind, keine Component-Library
