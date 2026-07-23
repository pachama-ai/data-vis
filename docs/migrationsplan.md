# Migrationsplan: Reduktion des Datenvisualisierungs-Projekts

> Erstellt am 2026-07-17 – Phase 1: Analyse und Planung.
> Dies ist eine Konzeptkorrektur. Es werden ausschließlich Planungsdokumente geändert, kein Quellcode.

---

## 1. Aktueller Datenfluss (IST-Zustand)

```
SMARD-API ──→ download-smard.ts ──→ smard.json (dt. Feldnamen, ~34 MB)
                                           │
ENTSO-E-API ─→ download-prices.ts ──→ preise.json (timestamp + price)
                                           │
UBA ──────────────────────────────────→ emission_factors.json (12 Faktoren)
                                           │
                                           ▼
                                    build_hourly.ts
                                    ┌──────────────────────────────────┐
                                    │ INNER JOIN smard × preise       │
                                    │ Feld-Mapping: Deutsch→Englisch  │
                                    │ CO₂ = Σ(gen × faktor) / total   │
                                    │ ee_share, fossil_share, price   │
                                    └──────────────────────────────────┘
                                           │
                                           ▼
                              hourly_2015_2024.json ←── useData().loadHourly()
                              ~87.600 Zeilen                │
                                           │                ├→ StackedArea
                                           │                ├→ HeatmapCO2
                                           ▼                ├→ ScatterAnalysis
                                    build_yearly.ts          ├→ HourlyProfile
                                    (einfacher Mittelw.)    ├→ dashboard.vue KPI
                                           │                └→ aggregate.ts → monthlyData
                                           ▼
                              yearly_mix.json ←── useData().loadYearly()

energy_mix_yearly.json ←─── useEnergyMixData() ──→ IntroBarbellChart
landing.json ←───────────── useLandingData() ───→ (nirgends importiert – toter Code)
```

### Datenqualität aktuell

| Aspekt | Befund |
|---|---|
| **CO₂-Berechnung** | Build-time, korrekt erzeugungsgewichtet: `Σ(source × faktor) / totalGen` |
| **EE-Anteil** | Build-time, korrekt: `eeSum / totalGen × 100` |
| **fossil_share** | Enthält Kernenergie – fachlich "konventionell", nicht fossil |
| **price_eur_mwh** | INNER JOIN mit preise.json; 2018 nur ~6.600 statt 8.760 Std. |
| **yearly_mix.avg_co2** | Einfacher Mittelwert `Σ(co2_g_per_kwh) / count` – kleinere Ungenauigkeit |
| **Runtime-Aggregation** | `aggregate.ts` berechnet 4 Level aus 87.600 Zeilen – jedes Mal neu |
| **useLandingData** | In `composables/useLandingData.ts` deklariert, von keiner Komponente importiert – toter Code |
| **loadFactors()** | In `useData()` deklariert, von keiner Komponente aufgerufen – toter Code |

---

## 2. Aktuelle Abhängigkeiten der acht Visualisierungen

```
pages/
├── index.vue
│   ├── IntroHero              (keine Props – reines Template)
│   ├── IntroTrustLine         (keine Props – reines Template)
│   ├── IntroBarbellChart      ← energy_mix_yearly.json (useEnergyMixData)
│   ├── IntroCTA               (keine Props – nur Link)
│   └── IntroMethodology       (keine Props – reines Template)
│
└── dashboard.vue
    ├── useData().loadHourly()  ← hourly_2015_2024.json
    ├── useData().loadYearly()  ← yearly_mix.json
    ├── useFilters()
    │
    ├── DashboardFilterBar
    ├── DashboardKpiCard ×4     (Props: title, value, unit, sparklineData, delta, …)
    ├── VizStackedArea          (Prop: hourly; Emits: visibleRangeChange, aggLevelChange, modeChange)
    │   └── utils/aggregate.ts  (im watchEffect)
    ├── ExtremeValuesPanel      (Props: monthlyData, aggLevel, mode)
    │   └── useExtremeValues()
    ├── StartEndComparison      (Prop: monthlyData; Emit: highlightChange)
    │   └── useStartEndComparison()
    ├── VizScatterAnalysis      (Prop: hourly – lazy, "Einflussfaktoren"-Tab)
    ├── VizHeatmapCO2           (Prop: hourly – lazy, "Tagesmuster"-Tab; Emit: day-selected)
    └── VizHourlyProfile        (Props: hourly, selectedDay – lazy, "Preise"-Tab)
```

---

## 3. Tabelle: Behalten / Vereinfachen / Ersetzen / Löschen

| Komponente | Entscheidung | Begründung |
|---|---|---|
| **IntroBarbellChart** | Vereinfachen | 5–6 Energieträger, eine Transition beim Laden. Replay, animationKey, IntersectionObserver, Text-Tweens, Kollisionserkennung entfernen. |
| **StackedArea** | Vereinfachen | Monatlicher Strommix, absolut/prozentual, Legende, Tooltip. Event-Marker, Tag/Woche/Quartal, visibleRangeChange-Emit, Cross-Chart-Sync entfernen. Keine neue Transition für Modus-Wechsel. |
| **HeatmapCO2** | Vereinfachen | Nur CO₂, feste Skala, Jahresauswahl, Tooltip. Andere Metriken, Skalierungsmodi, Sidebar, day-selected-Emit entfernen. viewBox bevorzugen. |
| **ScatterAnalysis (alt)** | Ersetzen durch **ScatterSimple.vue** | ~1.100 Zeilen, contourDensity, Range-Slider, 4 X-Achsen, Render-Queue. Neue Komponente parallel erstellen, alte 1:1 ersetzen. |
| **ScatterSimple (neu)** | Neu erstellen | X: tägl. EE-Anteil, Y: tägl. CO₂, ~3.650 Punkte, Jahres-`<select>`, D3-Data-Join, Tooltip, optionale Trendlinie. |
| **HourlyProfile** | Löschen | Keine Preisdaten mehr, kein Fachwert. |
| **ExtremeValuesPanel** | Löschen | Nicht im Zielumfang. |
| **StartEndComparison** | Löschen | Nicht im Zielumfang. |
| **KpiCard** | Löschen | Sparkline, Hover-Sync, Delta-Logik, Klickzustände entfernen. |
| **FilterBar** | Löschen | Nur für KPI-Filter (gesamt/jahr/vergleich) benötigt. |
| **InfoTooltip** | Behalten | Kleine UI-Hilfe, kein Änderungsaufwand. |
| **IntroHero, IntroTrustLine, IntroCTA, IntroMethodology** | Behalten | Keine Änderung nötig. |

---

## 4. Dateien, die geändert werden müssen

| Datei | Änderung |
|---|---|
| `scripts/build-data.ts` (NEU) | Zentrale Build-Pipeline: liest `smard.json` + `emission_factors.json`, erzeugt `visualization-data.json` mit 4 Arrays (monthlyMix, heatmapCo2, scatterDaily, yearlyMix). Berliner Lokalzeit, erzeugungsgewichtete Berechnungen, keine Preise, kein `fossil_share`. |
| `composables/useData.ts` | Vereinfachen: nur noch ein Loader für `visualization-data.json`. `loadFactors()` entfernen. |
| `utils/validate.ts` | Auf neue Interfaces anpassen. |
| `components/viz/StackedArea.vue` | Event-Marker entfernen, aggLevel auf Monat reduzieren, visibleRangeChange-Emit entfernen, Zoom entkoppeln. |
| `components/viz/HeatmapCO2.vue` | Auf CO₂ reduzieren, METRICS-Array entfernen, scaleMode entfernen, sidebarExtremes entfernen, day-selected-Emit entfernen, viewBox verwenden. |
| `components/viz/ScatterSimple.vue` (NEU) | Kleine Komponente: tägl. EE-Anteil vs CO₂, Jahres-`<select>`, D3-Punkte + Tooltip + optionale Trendlinie. |
| `components/intro/IntroBarbellChart.vue` | Replay, animationKey, IntersectionObserver, Text-Tweens, Kollisionserkennung entfernen. |
| `pages/dashboard.vue` | Tabs auf 2 reduzieren (Strommix + Einflussfaktoren), gelöschte Komponenten entfernen, KPI-Logik ersetzen, monthlyData/visibleRange/highlightedKey entfernen, useFilters entfernen. |
| `pages/index.vue` | useEnergyMixData-Import durch neuen Loader ersetzen. |
| `scripts/check-data.ts` (NEU) | Validierung: ungültige Zahlen, Wertebereiche, fehlende Jahre/Monate, auffällige Buckets. |
| `tests/calculations.test.ts` | Auf neue Interfaces und erzeugungsgewichtete Berechnungen anpassen. |
| `tests/logic.test.ts` | Auf neue Datenstrukturen anpassen. |
| `package.json` | Scripts bereinigen (pipeline, audit, download-prices entfernen). |

---

## 5. Dateien, die erst nach erfolgreicher Migration gelöscht werden dürfen

> Löschreihenfolge: Erst alle Verwendungen prüfen und migrieren, dann löschen.

| Datei | Löschbar wenn |
|---|---|
| `scripts/build_hourly.ts` | `build-data.ts` läuft, alle Visualisierungen nutzen neue Daten |
| `scripts/build_yearly.ts` | s.o. |
| `scripts/download-prices.ts` | Preis aus allen verbleibenden Komponenten entfernt |
| `scripts/checks/` (komplett) | `check-data.ts` + Tests decken Aufgaben ab |
| `scripts/analyze-other-category.mjs` | Pipeline vereinfacht |
| `scripts/analyze-rounding.mjs` | Pipeline vereinfacht |
| `scripts/check-dashboard-data.ts` | Durch `check-data.ts` ersetzt |
| `scripts/validate-data.ts` | Durch `check-data.ts` ersetzt |
| `components/viz/HourlyProfile.vue` | Aus dashboard.vue-Template entfernt |
| `components/viz/ScatterAnalysis.vue` | ScatterSimple.vue eingebunden und getestet |
| `components/dashboard/ExtremeValuesPanel.vue` | Aus dashboard.vue-Template entfernt |
| `components/dashboard/StartEndComparison.vue` | Aus dashboard.vue-Template entfernt |
| `components/dashboard/FilterBar.vue` | Aus dashboard.vue-Template entfernt |
| `components/dashboard/KpiCard.vue` | Durch 3 einfache Zahlenkarten ersetzt |
| `composables/useExtremeValues.ts` | ExtremeValuesPanel + StartEndComparison gelöscht |
| `composables/useStartEndComparison.ts` | StartEndComparison gelöscht |
| `composables/useFilters.ts` | FilterBar gelöscht, dashboard.vue filterfrei |
| `composables/useEnergyMixData.ts` | IntroBarbellChart aus visualization-data.json versorgt |
| `composables/useLandingData.ts` | Bereits toter Code – kann sofort nach Prüfung gelöscht werden |
| `utils/aggregate.ts` | Alle Visualisierungen auf build-time-Daten umgestellt |
| `data/hourly_2015_2024.json` | Alle Visualisierungen nutzen visualization-data.json |
| `data/yearly_mix.json` | s.o. |
| `data/energy_mix_yearly.json` | s.o. |
| `data/landing.json` | Keine Verwendung – kann sofort gelöscht werden |
| `data/preise.json` | build-data.ts ohne Preis-Join |
| `docs/visualisierungsanalyse.md` | Optional (kann als Referenz bleiben) |
| `docs/datenpipeline.md` | Optional (kann als Referenz bleiben) |

---

## 6. Vorgeschlagene endgültige Ordner- und Dateistruktur

```
data-vis-backup/
├── app.vue
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── emission_factors.json
├── README.md
│
├── assets/css/main.css
│
├── public/
│   ├── fonts/
│   └── data/
│       ├── smard.json                  ← Rohdaten (unverändert)
│       ├── emission_factors.json       ← Referenz
│       └── visualization-data.json     ← NEU: zentrale Daten-Datei
│
├── types/
│   └── visualization-data.ts           ← NEU: Interfaces (Phase 2)
│
├── utils/
│   ├── berlin.ts                       ← unverändert
│   └── validate.ts                     ← vereinfacht
│
├── composables/
│   └── useData.ts                      ← vereinfacht (ein Loader)
│
├── components/
│   ├── ui/InfoTooltip.vue
│   ├── intro/
│   │   ├── IntroHero.vue
│   │   ├── IntroTrustLine.vue
│   │   ├── IntroBarbellChart.vue       ← vereinfacht
│   │   ├── IntroCTA.vue
│   │   └── IntroMethodology.vue
│   └── viz/
│       ├── StackedArea.vue             ← vereinfacht
│       ├── HeatmapCO2.vue              ← vereinfacht
│       └── ScatterSimple.vue           ← NEU
│
├── pages/
│   ├── index.vue                       ← Landingpage (Intro-Komponenten)
│   └── dashboard.vue                   ← reduziert (2 Tabs, 3 KPI-Zahlen)
│
├── scripts/
│   ├── download-smard.ts
│   ├── build-data.ts                   ← NEU: zentrale Pipeline
│   └── check-data.ts                   ← NEU: Validierung
│
├── tests/
│   ├── calculations.test.ts            ← angepasst
│   └── logic.test.ts                   ← angepasst
│
└── docs/                               ← optional
```

**Gelöscht werden (nach erfolgreicher Migration):**
- `components/viz/HourlyProfile.vue`
- `components/viz/ScatterAnalysis.vue`
- `components/dashboard/ExtremeValuesPanel.vue`
- `components/dashboard/StartEndComparison.vue`
- `components/dashboard/FilterBar.vue`
- `components/dashboard/KpiCard.vue`
- `composables/useExtremeValues.ts`
- `composables/useStartEndComparison.ts`
- `composables/useFilters.ts`
- `composables/useEnergyMixData.ts`
- `composables/useLandingData.ts`
- `utils/aggregate.ts`
- `scripts/build_hourly.ts`
- `scripts/build_yearly.ts`
- `scripts/download-prices.ts`
- `scripts/checks/` (kompletter Ordner)
- `scripts/analyze-other-category.mjs`
- `scripts/analyze-rounding.mjs`
- `scripts/check-dashboard-data.ts`
- `scripts/validate-data.ts`
- `data/hourly_2015_2024.json`
- `data/yearly_mix.json`
- `data/energy_mix_yearly.json`
- `data/landing.json`
- `data/preise.json`

---

## 7. TypeScript-Interfaces der vier Datenbereiche (Zielstruktur)

> Bereits in `types/visualization-data.ts` angelegt (Phase 2A). Hier die Referenz.

```typescript
// types/visualization-data.ts

export interface EnergySourceValues {
  biomass: number; hydro: number; wind_onshore: number
  wind_offshore: number; pv: number; other_renewables: number
  lignite: number; hardcoal: number; gas: number
  nuclear: number; other_fossil: number; pumped_storage: number
}

export interface MonthlyMixPoint {
  month: string                    // "YYYY-MM" in Berliner Lokalzeit
  sources: EnergySourceValues
  totalGenerationMwh: number
  availableHourCount: number
}

export interface HeatmapCo2Cell {
  year: number
  month: number                    // 1–12, Berliner Lokalzeit
  hour: number                     // 0–23, Berliner Lokalzeit
  co2GramsPerKwh: number
  observationCount: number
}

export interface ScatterDailyPoint {
  date: string                     // "YYYY-MM-DD", Berliner Lokalzeit
  renewableSharePercent: number
  co2GramsPerKwh: number
  availableHourCount: number
}

export interface YearlyMixPoint {
  year: number
  sources: EnergySourceValues
  totalGenerationMwh: number
  renewableSharePercent: number
  co2GramsPerKwh: number
  availableHourCount: number
}

export interface VisualizationData {
  monthlyMix: MonthlyMixPoint[]
  heatmapCo2: HeatmapCo2Cell[]
  scatterDaily: ScatterDailyPoint[]
  yearlyMix: YearlyMixPoint[]
}
```

**Hinweise:**
- `fossil_share`, `conventional_share`, Preis- und Lastfelder kommen nicht vor.
- Alle aggregierten Kennzahlen werden erzeugungsgewichtet berechnet.
- `yearlyMix` ersetzt `yearly_mix.json` (KPIs) und `energy_mix_yearly.json` (IntroBarbellChart). IntroBarbellChart leitet `share2015`/`share2024` aus `sources`-MWh ab.

---

## 8. Fachliche Risiken der neuen Berechnungen

| Risiko | Beschreibung | Schwere |
|---|---|---|
| **Berliner Lokalzeit in build-data.ts** | Bisher clientseitig in `berlin.ts`. Neu build-time via `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'`. In Node.js verfügbar, muss aber explizit gesetzt werden. | Mittel – korrekt implementieren |
| **Erzeugungsgewichtete Jahreswerte** | Neu statt einfachem Mittelwert. Die Umstellung kann zu geringfügig abweichenden Zahlen führen (vorher < 1 % Abweichung durch Stunden-Gewichtung). | Gering – fachlich korrekter |
| **fossil_share komplett entfernt** | Keine verbleibende Visualisierung braucht es. ScatterSimple nutzt nur `ee_share`. Vor Löschung prüfen, ob StackedArea oder Heatmap es referenzieren. | Gering – Suchlauf vor Löschung |
| **2018-Datenlücke verschwindet** | Bisher durch INNER JOIN mit preise.json. Ohne Preis-Join sind alle SMARD-Stunden vorhanden → volle 8.760 h. | **Positiv** |
| **Rundungsfehler** | Bisher in build_hourly.ts via `Math.round(v * 100) / 100`. Neu in build-data.ts konsistent halten. | Gering |

---

## 9. Risiken beim Entfernen einzelner Bestandteile

| Entferntes Feature | Auswirkung | Risiko |
|---|---|---|
| **price_eur_mwh** (alle Felder) | Keine Preisdarstellung. HourlyProfile + Preise-Tab + X-Achse "Preis" in ScatterAnalysis entfallen. | ✅ Kein Risiko – gewünscht |
| **HourlyProfile** | Gesamte Komponente + Preise-Tab entfallen. | ✅ Kein Risiko |
| **ExtremeValuesPanel** | Sidebar im Überblick-Tab entfällt. | ✅ Kein Risiko |
| **StartEndComparison** | highlightChange-Emit entfällt, highlightedKey in dashboard.vue entfällt. | ✅ Kein Risiko |
| **visibleRange (Zoom-Sync)** | StackedArea-Zoom steuert keine Sidebar mehr. Nur visuell. | ✅ Gering – entkoppeln |
| **useFilters / FilterBar** | KPI-Jahr-Filter entfällt. KPIs zeigen Gesamtwerte. | ✅ Gering |
| **KpiCard (Sparklines)** | 4 Karten → 3 einfache Zahlen, kein D3. | ✅ Kein Risiko |
| **energy_mix_yearly.json** | IntroBarbellChart bezieht yearlyMix aus visualization-data.json. Prop-Typ muss angepasst werden. | ⚠️ Mittel |
| **landing.json + useLandingData** | Bereits toter Code. | ✅ Kein Risiko |
| **d3-hexbin (dependency)** | Als dependency deklariert, aber nirgends importiert. | ✅ Kein Risiko |

---

## 10. Schrittweise Migrationsreihenfolge (13 Phasen)

> Nach jedem Schritt: `bun run dev -o` testen. Alte Dateien erst in Phase 11–12 löschen.

### Phase 1: Ausgangszustand sichern und testen
- `git status` aufnehmen
- `bun install && bun run dev -o` testen
- `vitest run` – aktuellen Teststand dokumentieren

**Prüfbedingung:** App läuft, Tests sind dokumentiert.

### Phase 2: TypeScript-Interfaces parallel anlegen
- Neue Datei `types/visualization-data.ts` mit den 5 Interfaces aus Abschnitt 7
- Keine Implementierung, keine Änderung an bestehendem Code

**Prüfbedingung:** `npx nuxi typecheck` ohne Fehler (neue Types dürfen existieren, solange sie nirgends importiert werden).

### Phase 3: `scripts/build-data.ts` parallel implementieren
- Liest `smard.json` + `emission_factors.json`
- Berechnet vier Arrays: monthlyMix, heatmapCo2, scatterDaily, yearlyMix
- Berliner Lokalzeit via `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'`
- Erzeugungsgewichtete Berechnung: `ee_share = Σ(EE) / Σ(total) × 100`, `co2 = Σ(gen × faktor) / Σ(total)`
- `fossil_share` wird nicht berechnet
- Kein Preis-Join, keine preisbezogenen Felder
- Output: `public/data/visualization-data.json`
- Läuft parallel zur alten Pipeline (build_hourly.ts + build_yearly.ts bleiben unverändert)

**Prüfbedingung:** `bun run scripts/build-data.ts` erzeugt gültiges JSON. `node -e "const d=require('./public/data/visualization-data.json'); console.log(d.monthlyMix.length, d.heatmapCo2.length, d.scatterDaily.length, d.yearlyMix.length)"` zeigt vier positive Zahlen.

### Phase 4: Daten mit `scripts/check-data.ts` prüfen
- Validiert: ungültige Zahlen, Wertebereiche, fehlende Jahre/Monate, auffällig kleine Buckets
- Prüft `hours`-Felder auf Plausibilität

**Prüfbedingung:** `bun run scripts/check-data.ts` endet ohne Fehler.

### Phase 5: IntroBarbellChart auf yearlyMix migrieren
- useEnergyMixData durch neuen einfachen Loader ersetzen
- Prop `rows` aus `yearlyMix` ableiten: `share2015 = sources[key] / total_2015`, `share2024 = sources[key] / total_2024`
- Replay-Button, animationKey, IntersectionObserver, Text-Tweens, Kollisionserkennung entfernen
- Einfache `onMounted`-Transition behalten

**Prüfbedingung:** Landingpage zeigt Barbell-Chart, einmalige Transition beim Laden.

### Phase 6: StackedArea auf monthlyMix migrieren
- Event-Marker entfernen
- `aggLevel` auf Monat reduzieren (tag/woche/quartal entfernen)
- `visibleRangeChange`-Emit entfernen
- Zoom lokal halten (keine Sidebar-Synchronisation)
- `d3.stack()` auf monthlyMix.sources anwenden

**Prüfbedingung:** StackedArea zeigt monatlichen Strommix, Zoom + Legende + Tooltip funktionieren.

### Phase 7: HeatmapCO2 auf heatmapCo2 migrieren
- METRICS-Array aufheizen (nur noch `co2`)
- `scaleMode` entfernen (feste, jahresvergleichbare Skala)
- `sidebarExtremes` entfernen
- `day-selected`-Emit entfernen
- SVG mit `viewBox` statt ResizeObserver (es sei denn, das konkrete Layout erzwingt eine Ausnahme – dann mit Begründung im Code)

**Prüfbedingung:** Heatmap zeigt CO₂-Kacheln, Jahresauswahl + Tooltip funktionieren.

### Phase 8: ScatterSimple.vue mit scatterDaily erstellen
- Neue Komponente `components/viz/ScatterSimple.vue`
- X-Achse: täglicher EE-Anteil, Y-Achse: tägliche CO₂-Intensität
- ~3.650 Datenpunkte statt 87.600
- Jahresauswahl via `<select>` (Alle / einzelnes Jahr)
- D3-Skalen, Achsen, Data-Join für Kreise
- Tooltip
- Optionale Trendlinie (wenn als kleine verständliche Funktion realisierbar, < 15 Zeilen)
- Kein contourDensity, kein Range-Slider, kein Zeitraumvergleich, keine Tageszeit-Filter
- Titel/Achsen/Doku verdeutlichen: Tageswerte

**Prüfbedingung:** Dashboard zeigt ScatterSimple im "Einflussfaktoren"-Tab, Tooltip + Jahresfilter funktionieren.

### Phase 9: Einfache KPI-Zahlen auf yearlyMix migrieren
- Drei Zahlen im Dashboard (EE-Anteil, CO₂-Intensität, Gesamterzeugung)
- Normale Vue-Templates, keine D3-Sparklines
- Werte aus `yearlyMix` (Gesamtdurchschnitt 2015–2024 oder festes Jahr)
- Keine Hover-Synchronisierung, keine Klickzustände, keine Deltas
- Kein `useFilters`, keine `FilterBar`

**Prüfbedingung:** Dashboard zeigt drei korrekte Kennzahlen.

### Phase 10: Alte Visualisierungen und Composables entfernen
- `HourlyProfile`, `ExtremeValuesPanel`, `StartEndComparison` aus Template entfernen
- `FilterBar`, `KpiCard` aus Template entfernen
- `useExtremeValues`, `useStartEndComparison`, `useFilters`, `useEnergyMixData` nicht mehr importieren
- `ScatterAnalysis` durch `ScatterSimple` ersetzen (Imports tauschen)
- `aggregate.ts` nicht mehr verwenden
- `monthlyData`-computed, `visibleRange`, `highlightedKey` aus dashboard.vue entfernen
- Tabs auf 2 reduzieren (Strommix + Einflussfaktoren)

**Prüfbedingung:** `bun run dev -o` startet ohne Import-Fehler. Dashboard hat 2 Tabs. Keine Broken Imports.

### Phase 11: Alte Pipeline, Preisdateien, redundante JSONs entfernen
Dateien löschen (Liste aus Abschnitt 5):
- Alte Build-Scripts, Audit-Scripts, Preis-Scripts
- Alte Komponenten (HourlyProfile, ScatterAnalysis, ExtremeValuesPanel, StartEndComparison, FilterBar, KpiCard)
- Alte Composables (useExtremeValues, useStartEndComparison, useFilters, useEnergyMixData, useLandingData)
- `utils/aggregate.ts`
- Alte JSON-Daten
- `package.json`-Scripts bereinigen (pipeline, audit, download-prices, validate, check-dashboard-data)

**Prüfbedingung:** `bun run dev -o` startet sauber. Alle 4 Visualisierungen laden korrekt.

### Phase 12: Typecheck, Tests, Offlinebetrieb, Seiten prüfen
- `npx nuxi typecheck` → 0 Fehler
- `vitest run` → alle Tests grün
- `bun run generate` → dist/-Ordner wird gebaut
- `bun run preview` → Offlinebetrieb testen (ohne dev-Server)
- Beide Seiten (Landingpage + Dashboard) durchklicken

**Prüfbedingung:** Alle Prüfungen grün, keine Laufzeitfehler.

### Phase 13: Dokumentation aktualisieren
- `README.md` auf neue Projektstruktur anpassen
- `docs/`-Dateien aktualisieren oder als veraltet markieren

**Prüfbedingung:** README beschreibt Setup (`bun install && bun run dev -o`) und Projektstruktur korrekt.

---

## 11. Prüfbedingungen pro Phase

| Phase | Prüfbedingung |
|---|---|
| 1 | App läuft, Tests dokumentiert |
| 2 | `npx nuxi typecheck` ohne Fehler |
| 3 | `build-data.ts` erzeugt gültiges JSON mit 4 Arrays |
| 4 | `check-data.ts` ohne Fehler |
| 5 | Landingpage zeigt Barbell-Chart |
| 6 | StackedArea zeigt monatlichen Mix, Zoom/Legende/Tooltip funktionieren |
| 7 | Heatmap zeigt CO₂-Kacheln, Jahreswechsel + Tooltip funktionieren |
| 8 | ScatterSimple zeigt Punkte, Tooltip + Jahresfilter funktionieren |
| 9 | Dashboard zeigt 3 korrekte KPI-Zahlen |
| 10 | App startet ohne Import-Fehler, 2 Tabs |
| 11 | `bun run dev -o` startet, 4 Visualisierungen laden |
| 12 | typecheck, vitest, generate, preview alle grün |
| 13 | README aktuell |

---

## 12. Empfehlung: ScatterAnalysis ersetzen?

**Empfehlung: Neue Komponente `ScatterSimple.vue`**

- `ScatterAnalysis.vue` ist ~1.100 Zeilen mit contourDensity, Range-Slider, 4 X-Achsen, Tageszeitfilter, Render-Scheduler, Sidebar-Metriken
- Ziel: ~150–200 Zeilen, eine X-Achse (EE-Anteil), Jahres-`<select>`, Punkte + optionale Trendlinie
- Neue Datei parallel erstellen, alte in Phase 10 ersetzen
- Keine Änderung an `dashboard.vue` bis Phase 10

---

## 13. Offene Fragen

1. **Berliner Lokalzeit:** `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'` in `build-data.ts` verwenden (wie in `berlin.ts`). Keine zusätzliche Dependency.

2. **StackedArea-Zoom:** Lokal behalten, da fachlich nützlich, aber ohne visibleRangeChange-Emit (keine Kopplung an Sidebar).

3. **IntroBarbellChart-Daten:** Komponente berechnet `share = sources[key] / total` selbst aus YearlyMixRow. Keine zusätzlichen Felder nötig.

4. **ScatterSimple-Trendlinie:** Optional – nur wenn als kleine lineare Regression (< 15 Zeilen) realisierbar.

5. **HeatmapCO2: viewBox vs ResizeObserver:** `viewBox` bevorzugen. Nur falls das Layout keine proportionale Skalierung zulässt: ResizeObserver mit Code-Kommentar.

6. **d3-hexbin in package.json:** Kann in Phase 11 entfernt werden. Kein Code importiert es.

7. **`fossil_share` entfernen, nicht umbenennen:** Keine verbleibende Visualisierung benötigt es. ScatterSimple nutzt nur `ee_share`. Vor Löschung prüfen, ob StackedArea oder Heatmap-Kommentare darauf verweisen.

---

## 14. Minimaler Phase-2-Umfang

Phase 2 umfasst vier aufeinander aufbauende Schritte:

1. **Phase 2A – TypeScript-Interfaces anlegen** (`types/visualization-data.ts`) ✅
2. **Phase 2B – `scripts/build-data.ts` implementieren** (zentrale Pipeline ohne Preise, ohne `fossil_share`)
3. **Phase 2C – `scripts/check-data.ts` implementieren** (Validierung der neuen Daten)
4. **Phase 2D – `composables/useData.ts` vereinfachen** (ein Loader für `visualization-data.json`)

**Wichtig:** Der Loader (Phase 2D) darf erst umgestellt werden, nachdem `build-data.ts` erfolgreich `visualization-data.json` erzeugt hat und `check-data.ts` die Daten bestätigt hat. Alte Loader (`loadHourly`, `loadYearly`) bleiben parallel bestehen, bis alle Visualisierungen migriert sind.
