# Entwicklungslog – Stromdaten-Visualisierung

> Hochschule Harz, Medieninformatik, Modul Visualisierung, Frühjahr 2026
> Stack: Nuxt 3 · Vue 3 (Composition API, `<script setup lang="ts">`) · D3.js v7 · Bun

---

## 1. Projekt-Setup

### Vorgehen

1. `bun create nuxt@latest . --force` im bestehenden Workspace `data-vis/`
2. Dabei versehentlich Nuxt **4 Module Template** gewählt (minimal template)
3. Das Template erzeugte eine **Modul-Struktur** (`src/module.ts`, `playground/`), keine App
4. **Korrektur:** Modul-Template-Dateien gelöscht, `package.json` auf reine App umgeschrieben
5. `bun add nuxt@3 d3` → Nuxt **3.21.8**, D3 **7.9.0**
6. `bun add -D @types/d3` → TypeScript-Typen für D3
7. `bun x nuxi prepare` → Nuxt-interne Typen generieren
8. `bun run build` → Build-Test erfolgreich

### Erstellte Dateien

| Datei | Zweck |
|---|---|
| `nuxt.config.ts` | `ssr: false`, CSS-Pfad, Inter-Font via Google Fonts |
| `assets/css/main.css` | CSS-Reset, Design-Tokens als `:root`-Custom-Properties, Basis-Typografie |
| `app.vue` | Root-Komponente mit `<NuxtPage />` |
| `pages/index.vue` | Landing-Platzhalter `<h1>Landing</h1>` |
| `pages/dashboard.vue` | Dashboard-Platzhalter `<h1>Dashboard</h1>` |

### Design-Entscheidungen

- **`ssr: false`** (kein SSR): App visualisiert lokale JSON-Daten, kein Backend, keine SEO-Anforderungen. Reine SPA für Offline-Betrieb.
- **Keine UI-Libraries** (laut Vorgabe): Eigenes CSS mit `:root`-Custom-Properties als zentrales Farbsystem. Scoped Styles in Komponenten verhindern Seiteneffekte.
- **Inter-Font** via Google Fonts im `<head>` (nicht per `@import` im CSS), da Nuxt `app.head` optimiert laden kann.
- **`@types/d3`** als Dev-Dependency: D3 v7 liefert keine eigenen TypeScript-Typen mit.

---

## 2. Datenpipeline (Skripte)

### Datenquellen

| Quelle | API | Daten | Format |
|---|---|---|---|
| **ENTSO-E** | `web-api.tp.entsoe.eu/api` (Dokumenttyp A44) | Strompreise stündlich | XML → JSON |
| **SMARD** | `www.smard.de/app/chart_data` | Erzeugung stündlich | JSON |

### Erstellte Dateien

| Datei | Zweck |
|---|---|
| `emission_factors.json` | UBA-CO₂-Faktoren (g/kWh) als Referenz |
| `scripts/build_hourly.mjs` | Datenpipeline: Rohdaten → Stundenwerte mit CO₂/EE/Fossil-Berechnung |
| `scripts/build_yearly.mjs` | Stundenwerte → Jahresaggregation |

### Datenfluss

```
smard.json ──┐
             ├──→ scripts/build_hourly.mjs ──→ hourly_2015_2024.json
preise.json ─┘                                    │
                                                   └──→ scripts/build_yearly.mjs ──→ yearly_mix.json
```

### Schema `hourly_2015_2024.json`

```ts
{
  timestamp: number          // Unix ms (UTC)
  co2_g_per_kwh: number     // gewichteter CO₂-Durchschnitt
  ee_share: number           // Anteil Erneuerbare (%)
  fossil_share: number       // Anteil Fossil (%)
  price_eur_mwh: number      // Strompreis
  load_mwh: number           // Gesamtlast
  generation_by_source: {
    lignite: number
    nuclear: number
    wind_offshore: number
    hydro: number
    other_fossil: number
    other_renewables: number
    biomass: number
    wind_onshore: number
    pv: number
    hardcoal: number
    pumped_storage: number
    gas: number
  }
}
```

### Design-Entscheidungen Pipeline

- **Feldmapping `FIELD_MAP` (Deutsch→Englisch)**: Rohdaten aus `smard.json` haben deutsche Feldnamen (braunkohle, windOnshore, …). Output verwendet englische Bezeichner. Ein explizites Mapping-Objekt macht die Übersetzung wartbar.
- **`preisMap = new Map()` statt `Array.find()`**: O(1)-Lookup für 89k Einträge statt O(n²).
- **`fossil_share` ohne Pumpspeicher**: Pumpspeicher ist weder EE noch fossil. UBA-Faktor = 0.
- **`JSON.stringify(obj, null, 2)` nur für Jahresdaten**: Kleine Dateien (~4 KB) menschenlesbar. Stunden-Dateien (32 MB) ohne Pretty-Print.
- **Inner Join**: Nur Stunden mit Preis- **und** Erzeugungsdaten werden übernommen. Fehlende Preise → Stunde fällt raus.

---

## 3. Datenvalidierung

### Validierungsskript

`validate (1).mjs` prüft `combined-hour.json` auf:
1. Grundzahlen (Gesamtanzahl, Start-/Enddatum)
2. Stunden pro Jahr (mit Schaltjahr-Check: 2016/2020/2024 → 8784h)
3. Lücken in der Zeitreihe
4. Null/NaN/0-Werte pro Schlüsselfeld
5. Wertebereich (min/max/avg für CO₂, Preis, EE-Anteil)
6. Heatmap-Strategie-Entscheidungshinweis
7. Dateigröße

### Erster Validierungslauf (vor Negativpreis-Fix)

```
Stunden:         89.068
Lücken:          846
Fehlende Std.:   5.059
Negative Preise: 0  ← Alarm!
CO₂:            116–707 g/kWh
Preise:           0–936 €/MWh
```

### Zweiter Validierungslauf (nach Negativpreis-Fix)

```
Stunden:         85.007  (engerer Zeitraum 2015–2024)
Lücken:          363
Fehlende Std.:   2.593  (ca. 49% weniger)
Negative Preise: 1.929  ← Fix wirkt!
CO₂:            121–707 g/kWh
Preise:        -500–936 €/MWh
```

---

## 4. Fehleranalyse & Fixes

### P1: Negative Preise wurden nicht geparst (download-prices.js)

**Ursache:** Der Regex in `parseXML()` war:

```js
/<price\.amount>([\d.]+)<\/price\.amount>/
```

`[\d.]+` matcht **nur Ziffern und Punkte**, kein Minuszeichen. Negative Preise wie `-50.20` wurden ignoriert → komplette Stunde fiel raus.

**Fix:** Regex geändert zu:

```js
/<price\.amount>\s*([-+]?\d+(?:\.\d+)?)\s*<\/price\.amount>/
```

- `[-+]?` erlaubt optionales Vorzeichen
- `\s*` toleriert Whitespace
- `(?:\d+(?:\.\d+)?)` matcht Integer und Dezimalzahlen

**Ergebnis:** 1.929 negative Preisstunden tauchen jetzt auf (vorher: 0). Lücken reduziert von 5.059 auf 2.593.

### P2: Zeitraum nicht begrenzt (download-prices.js)

**Ursache:** `const currentYear = new Date().getUTCFullYear()` – bei Datum Juli 2026 wurde auch 2026 angefragt (0 Punkte) und 2025 nur teilweise geladen.

**Fix:** `currentYear` ersetzt durch `endYear = 2024`. Schleife läuft `2015` bis `2024`.

### P3: Token hardcodiert (download-prices.js)

**Ursache:** `const TOKEN = 'bc68db8d-...'` – fest im Quellcode.

**Fix:** `const TOKEN = process.env.ENTSOE_TOKEN` mit Fehlerprüfung:
```js
if (!TOKEN) throw new Error('ENTSOE_TOKEN fehlt. Bitte als Umgebungsvariable setzen.')
```

### P4: Kein vollstaendiger Stundenindex

**Ursache:** Sowohl `merge-data.js` als auch `build_hourly.mjs` machen einen **inner join** über die vorhandenen Timestamps. Es wird kein vollständiger Kalender (2015-01-01 bis 2024-12-31, jede Stunde) aufgespannt. Fehlt eine Stunde in SMARD **oder** Preisen → fehlt sie komplett.

**Status:** Noch nicht gefixt. Sobald ein vollständiger Index aufgespannt wird (left join statt inner join), können die restlichen Lücken geschlossen werden.

### P5: SMARD-Start nach 2015-01-01

Die ersten Daten beginnen am **2015-01-04** statt 2015-01-01. Ca. 3,5 Tage Lücke. Ursache: SMARD-API liefert entweder erst ab diesem Datum, oder der erste Block-Timestamp liegt nach dem 1. Januar.

---

## 5. Datenqualität (aktueller Stand)

| Metrik | Wert |
|---|---|
| Gesamtstunden | 85.007 |
| Zeitraum | 2015-01-04 – 2025-01-01 |
| Lücken | 363 |
| Fehlende Stunden | 2.593 |
| Negative Preisstunden | 1.929 |
| CO₂ min | 121 g/kWh |
| CO₂ max | 707 g/kWh |
| CO₂ Ø | 418 g/kWh |
| Preis Ø | 71,9 €/MWh |
| Kritische Jahre | 2018 (6.523h, fehlen 2.237h) |

### Lücken pro Jahr (nach Fix)

| Jahr | Stunden | Fehlen |
|---|---|---|
| 2015 | 8.637 | 123 |
| 2016 | 8.740 | 44 |
| 2017 | 8.708 | 52 |
| **2018** | **6.523** | **2.237** (!) |
| 2019 | 8.724 | 36 |
| 2020 | 8.739 | 45 |
| 2021 | 8.728 | 32 |
| 2022 | 8.728 | 32 |
| 2023 | 8.727 | 33 |
| 2024 | 8.733 | 51 |

> **2018** fehlen ~25,5% – wird in der Stacked-Area-Chart sichtbar sein.
> Annotation in Viz 1: "Datenlücken 2018 (SMARD-API)"

---

## 6. Pipeline-Neubau nach Negativpreis-Fix

Nachdem `download-prices.js` gefixt war (Negativpreise, Token, 2015–2024) und `preise.json` neu heruntergeladen wurde, musste die Pipeline neu durchlaufen:

```bash
bun run pipeline
```

**Ergebnis `hourly_2015_2024.json` (vor → nach Fix):**

| Metrik | Vor Fix | Nach Fix |
|---|---|---|
| Stunden | 89.068 | 85.007 |
| Zeitraum | bis 2025-09 | bis 2025-01 |
| Lücken | 846 | 363 |
| Fehlende Std. | 5.059 | 2.593 |
| Negative Preise | 0 | 1.929 |
| Preis Ø | 75,50 € | 71,90 € |

Die Jahreszahlen änderten sich leicht durch den engeren Join-Zeitraum und die jetzt korrekt erfassten Negativpreise.

---

## 7. Projektbereinigung (Cleanup)

### Ausgangszustand

Das Root-Verzeichnis enthielt:
- `download-prices.js`, `download-smard.js`, `merge-data.js` (alle lose im Root)
- `validate (1).mjs` und später `validate-data.mjs` (lose im Root)
- `public/data/` mit alten `combined-*.json` aus der ersten Merge-Datenpipeline **und** neuen `hourly_2015_2024.json` / `yearly_mix.json` aus den neuen Skripten

### Bereinigungsschritte

1. **Scripts-Umzug:** `download-prices.js`, `download-smard.js`, `merge-data.js`, `validate-data.mjs` → `scripts/`
2. **Alte Daten gelöscht:** `combined-hour.json`, `combined-day.json`, `combined-week.json`, `combined-year.json` aus `public/data/` entfernt (durch `hourly_2015_2024.json` / `yearly_mix.json` ersetzt)
3. **`validate-data.mjs` aktualisiert:**
   - Pfad auf `hourly_2015_2024.json` umgebogen
   - Feldnamen an neues Schema angepasst (`co2` → `co2_g_per_kwh`, `preis` → `price_eur_mwh`, `eeAnt` → `ee_share`, etc.)
   - `import.meta.url`-basierte Pfadauflösung wie in den anderen Scripts
   - Heatmap-Abschnitt entfernt (gehört in die Viz-Doku, nicht in die Datenvalidierung)
4. **`package.json` erweitert:** Neue Scripts `pipeline`, `pipeline:hourly`, `pipeline:yearly`, `download:prices`, `download:smard`, `validate`

### Finale Verzeichnisstruktur

```
data-vis/
├── app.vue
├── nuxt.config.ts
├── package.json                     # + pipeline/validate/Download-Scripts
├── tsconfig.json
├── emission_factors.json            # UBA-CO₂-Faktoren
├── assets/css/main.css              # Design-Tokens
├── docs/log.md                      # Dieses Log
├── pages/
│   ├── index.vue                    # Landing
│   └── dashboard.vue                # Dashboard
├── public/data/
│   ├── smard.json                   # Rohdaten SMARD
│   ├── preise.json                  # Rohdaten Preise
│   ├── hourly_2015_2024.json        # Pipeline-Output (Stunden)
│   ├── yearly_mix.json              # Pipeline-Output (Jahre)
│   └── emission_factors.json        # Kopie fuer Browser-Fetch
├── composables/
│   ├── useFilters.ts                # Globaler Filter-State
│   └── useData.ts                   # Daten-Loader mit Cache
├── scripts/
│   ├── download-prices.js           # ENTSO-E-Download
│   ├── download-smard.js            # SMARD-Download
│   ├── merge-data.js                # Alter Merge (nicht mehr aktiv)
│   ├── build_hourly.mjs             # Pipeline Stunden
│   ├── build_yearly.mjs             # Pipeline Jahre
│   └── validate-data.mjs            # Validierung
└── .vscode/settings.json
```

---

## 8. Composables: useFilters und useData

### useFilters.ts

Zentraler Filter-State fuer das Dashboard. Enthaelt:
- `dateRange` – Start- und Enddatum als Date-Objekte (Default 2015-01-01 bis 2024-12-31)
- `seasons` – Set mit aktiven Jahreszeiten (spring, summer, autumn, winter)
- `dayType` – all / weekday / weekend
- `compareYears` – Array mit Jahren fuer den Jahresvergleich (Default [2015, 2020, 2024])
- `filteredHours(hours)` – Filter-Funktion, die ein hourly-Array nimmt und nur passende Zeilen zurueckgibt
- `reset()` – Setzt alle Filter auf Standardwerte

### useData.ts

Zentraler Daten-Loader. Enthaelt:
- `loadHourly()` – Fetch + Cache fuer hourly_2015_2024.json
- `loadYearly()` – Fetch + Cache fuer yearly_mix.json
- `loadFactors()` – Fetch + Cache fuer emission_factors.json (aus public/data/)
- TypeScript-Interfaces `HourlyRow`, `YearlyRow`, `Factors` zum Importieren in Charts

### Warum reactive() im Modul-Scope statt Pinia?

Pinia ist der empfohlene State-Manager fuer groessere Vue-Projekte, die mehrere verschachtelte Stores, Plugins oder Server-Side-Rendering benoetigen. Dieses Projekt hat genau einen globalen State (Filter), der von wenigen Dashboard-Komponenten gelesen wird. Ein `reactive()`-Objekt im Modul-Scope ist dafuer die einfachere Loesung: es braucht keine zusaetzliche Library, keine Store-Definition und keine Plugin-Registration. Da das Objekt ausserhalb der setup()-Funktion erzeugt wird, teilen sich alle importierenden Komponenten automatisch dieselbe Instanz – das Verhalten ist identisch zu einem Pinia-Store, aber ohne Boilerplate. Sobald die App wachsen wuerde (mehrere unabhaengige Stores, Middleware, persistente Filter), waere ein Wechsel zu Pinia sinnvoll.

---

## 9. Validierung der Datenpipeline (9-Punkte-Check)

Nach dem Negativpreis-Fix und Pipeline-Neubau wurde `hourly_2015_2024.json` gegen neun Kriterien geprueft.

| # | Frage | Antwort | Status |
|---|---|---|---|
| 1 | Zeitraum 2015-01-01 bis 2024-12-31? | Nein, erster Eintrag ist 2015-01-04. API liefert erst ab diesem Datum. | (!) |
| 2 | Sind noch 2025-Daten drin? | Ja, 20 Datenpunkte. Stammen aus dem API-Call fuer 2024 (Periode endet 2025-01-01 00:00 UTC). | (!) |
| 3 | Startet der Datensatz am 01.01.2015? | Nein. Erster Eintrag: 2015-01-04 23:00 UTC. Die ersten 3,5 Tage fehlen. | (!) |
| 4 | Wie viele Luecken bleiben? | 363 Luecken, 2.593 fehlende Stunden (ca. 3% Lueckenrate). | (!) |
| 5 | Sind alle Jahre vollstaendig? | Kein Jahr vollstaendig. 2018 ist mit 6.523h (statt 8.760h) am schlimmsten. | (!) |
| 6 | Fehlende Werte als null sichtbar? | Nein. Fehlt ein Wert, verschwindet die ganze Stunde (inner join, filter(Boolean)). | (!) |
| 7 | combined-day/week/year aktuell? | Geloescht. `yearly_mix.json` ist der aktuelle Jahres-Output. | OK |
| 8 | negStunden korrekt gezaehlt? | `yearly_mix.json` hat jetzt `neg_stunden` pro Jahr (1918 negative Stunden gesamt, 11 durch 2025-Filter rausgefallen). | OK |
| 9 | combined-hour 0 negative Preise? | Geloescht. `hourly_2015_2024.json` hat 1.918 negative Preisstunden (vorher 0). | OK |

### Negative Preisstunden pro Jahr (in hourly_2015_2024.json)

```
2015:  109    2019:  211    2023:  294
2016:   97    2020:  297    2024:  448
2017:  147    2021:  139
2018:  106    2022:   70
```

Gesamt: **1.918 Stunden** mit negativem Preis (nach 2025-Filter: 11 Negativstunden aus 2025 entfernt). Minimum: -500 Euro/MWh.

### Umgesetzte Massnahmen

1. **2025-Reste rausgefiltert** in `build_hourly.mjs`: `if (ts >= Date.UTC(2025, 0, 1)) return null` – letzter Eintrag jetzt 2024-12-31 23:00 UTC
2. **neg_stunden in yearly_mix.json** aufgenommen: `build_yearly.mjs` zaehlt pro Jahr `entry.price_eur_mwh < 0` und gibt `neg_stunden` im Output aus
3. **Dateiname** `hourly_2015_2024` ist weiterhin irrefuehrend – echter Start ist 2015-01-04

### Aktuelle Datenqualitaet (Stand nach Fix)

| Metrik | Wert |
|---|---|
| Stunden gesamt | 84.987 |
| Zeitraum | 2015-01-04 bis 2024-12-31 |
| Luecken | 360 |
| Fehlende Stunden | 2.590 |
| Negative Preisstunden | 1.918 |
| CO₂ min | 89,8 g/kWh |
| CO₂ max | 694,4 g/kWh |
| Preis Ø | 71,90 Euro/MWh |

---

## 10. Cross-Check: finale Datenkonsistenz

Nach allen Fixes wurden alle Datenquellen gegeneinander geprueft:

| Pruefung | Ergebnis |
|---|---|
| hourly ↔ yearly negSum | 1.918 = 1.918 |
| Keine 2025-Daten in hourly | 0 |
| Letztes Jahr in yearly_mix | 2024 |
| Alle Zeilen haben price_eur_mwh | ja |
| Alle Zeilen haben co2_g_per_kwh | ja |
| preise.json (Rohdaten) | 85.007 Zeilen, 1.929 negative |
| hourly_2015_2024.json | 84.987 Zeilen, 2015-01-04 bis 2024-12-31, 1.918 negative |
| yearly_mix.json | 10 Jahre (2015-2024), neg_stunden summiert auf 1.918 |

Die Differenz von 11 Negativstunden zwischen preise.json (1.929) und hourly (1.918) ist korrekt: diese 11 Stunden lagen im Januar 2025 und wurden durch den 2025-Filter entfernt.

---

## 11. Analyse: Datenluecken 2018 (Marktgebietswechsel)

### Befund

2018 hat nur **6.523 Stunden** statt erwarteter 8.760. Das sind 2.237 fehlende Stunden (~25,5%).

### Monatsaufteilung 2018

```
Jan:  740h  (erw 720)  ✓
Feb:  671h  (erw 648)  ✓
Mrz:  738h  (erw 720)  ✓
Apr:  717h  (erw 696)  ✓
Mai:  743h  (erw 720)  ✓
Jun:  719h  (erw 696)  ✓
Jul:  738h  (erw 720)  ✓
Aug:  741h  (erw 720)  ✓
Sep:  715h  (erw 696)  ✓
Okt:    0h  (erw 744)  ❌
Nov:    0h  (erw 720)  ❌
Dez:    1h  (erw 744)  ❌
```

Januar bis September sind vollstaendig (teilweise ueber 100%). Ab **Oktober 2018** bricht die Reihe komplett ab.

### Ursache

Der ENTSO-E-Download in `download-prices.js` verwendet zwei verschiedene Domain-Codes fuer die API:

```js
const DOMAIN_ALT = '10Y1001A1001A63L'   // alte gemeinsame Gebotszone DE-AT-LU
const DOMAIN_NEU = '10Y1001A1001A82H'   // neue Gebotszone DE (ab 1.10.2018)
const domain = year <= 2018 ? DOMAIN_ALT : DOMAIN_NEU
```

**Der Code verwendet fuer 2018 die alte Domain.** Am **1. Oktober 2018** wurde die deutsch-oesterreichische Gebotszone getrennt (Marktgebietswechsel / bidding zone split). Nach diesem Datum liefert die alte Domain (`10Y1001A1001A63L`) keine Preisdaten mehr fuer die reine deutsche Preiszone. Die Daten ab Oktober 2018 sind nur ueber die neue Domain (`10Y1001A1001A82H`) verfuegbar.

Die SMARD-Rohdaten (`smard.json`) haben diese Luecke nicht – dort ist 2018 vollstaendig. Das Problem liegt ausschliesslich im ENTSO-E-Preis-Download.

### Mögliche Fixes

1. **NEU-Domain fuer alle Jahre verwenden**: Die neue Domain `10Y1001A1001A82H` sollte auch historische Daten ab 2015 enthalten. Einfachster Fix, aber API-seitig nicht garantiert.
2. **2018 aufsplitten**: Januar-September mit ALT, Oktober-Dezember mit NEU abfragen. Robuster, aber mehr API-Calls.
3. **Hybrid**: Fuer alle Jahre zuerst NEU probieren, bei weniger als 8000 Stunden pro Jahr mit ALT wiederholen.

### Konsequenz fuer Visualisierungen

Die 2018-Luecke wird in der Stacked-Area-Chart (Viz 1) sichtbar sein – 2018 wirkt etwa 25% schmaler als die Nachbarjahre. Eine Annotation **"Datenluecke 2018: Marktgebietswechsel ENTSO-E"** erklaert den Effekt.

---

## 13. FilterBar-Komponente (components/dashboard/FilterBar.vue)

### Aufbau

Die FilterBar ist eine horizontale Leiste (weisser Hintergrund, Border unten, ca. 72px Hoehe) am oberen Rand des Dashboards. Sie enthaelt vier Filtergruppen und zwei Action-Buttons:

1. **Zeitraum**: Zwei `<input type="date">`-Felder (Start/Ende), getrennt durch ein "–". Die Werte werden ueber computed-Getters/Setters bidirektional mit `state.dateRange` verbunden, weil der Filter-State `Date`-Objekte speichert, das nativen date-Input aber `YYYY-MM-DD`-Strings braucht.

2. **Saison**: Ein Custom-Dropdown (kein natives `<select>`) mit Checkboxen fuer Fruehling/Sommer/Herbst/Winter. Der Button zeigt "Alle ausgewaehlt (4)" oder "2 ausgewaehlt" an. Da `state.seasons` ein `Set` ist, wird nach jeder Aenderung eine neue Set-Referenz zugewiesen (`new Set(state.seasons)`), damit Vue 3 die Aenderung erkennt.

3. **Wochentag**: Ein Drei-State-Segmented-Toggle (Alle Tage / Wochentag / Wochenende). Aktiver Button bekommt die Akzentfarbe.

4. **Vergleichsjahre**: Drei Toggle-Buttons (2015, 2020, 2024). Koennen einzeln an- und abgewaehlt werden. `state.compareYears` ist ein Array, das via `splice`/`push` mutiert wird.

Rechts aussen:
- **"Weitere Filter"** mit Ausklapp-Panel (aktuell leer, nur Platzhalter)
- **"Filter zuruecksetzen"** als Text-Button, ruft `reset()` aus useFilters auf

### Entwurfsbegruendung

Die FilterBar schreibt direkt in den globalen `state` aus `useFilters()`, ohne eigene lokale Kopie oder Event-Emitter. Das ist moeglich, weil der State via `reactive()` im Modul-Scope ein Singleton ist – jede Komponente, die `useFilters()` importiert, sieht denselben State. Dadurch entfaellt Prop-Drilling oder Event-Bubbling komplett. Die Trennung in vier Filtergruppen folgt dem Dashboard-Layout: jede Gruppe steuert genau einen Aspekt des Filters (Zeit, Saison, Tagestyp, Jahre). Der "Weitere Filter"-Ausklapp ist als Platzhalter vorbereitet, falls spaeter mehr Filter dazu kommen.

---

## 14. HeatmapCO2-Komponente (components/viz/HeatmapCO2.vue)

### Aufbau

Die Komponente rendert eine 365x24-Heatmap fuer ein einzelnes Jahr in einem SVG mit D3.js.

**Kopfzeile:**
- Links: Nummer "2" im Kreis + Titel "Stuendliche CO2-Heatmap"
- Rechts: Vier Metric-Tabs als segmentierte Buttons (CO2, EE-Anteil, Fossiler Anteil, Day-Ahead-Preis) – aktiver Tab in Akzentfarbe

**Heatmap-Grid:**
- X-Achse: Tag des Jahres (1-365/366) mit Monatslabels
- Y-Achse: Stunde (0-23), Labels alle 3 Stunden
- Jede Zelle ist ein 12x12px `<rect>` im SVG (13px inkl. 1px Abstand)
- Fehlende Stunden (keine Daten) werden hellgrau dargestellt
- Horizontal scrollbar bei Ueberbreite

**Interaktion:**
- Hover: Tooltip mit Datum (DD.MM.), Uhrzeit (HH:00), Wert
- Klick auf Zelle: Emittiert `day-selected` mit ISO-Datum (YYYY-MM-DD)

**Jahresauswahl:** Automatisch aus den Daten – das spaeteste Jahr im aktuellen Filter wird angezeigt. Ein Hinweis unter dem Grid zeigt "Jahr: 2024 (84987 Stunden, 365 Tage)".

### Farbskalen

| Metrik | Skala | Domain | Begruendung |
|---|---|---|---|
| CO2-Intensitaet | `interpolateRdYlGn` (invertiert) | [800, 100] g/kWh | Gruen = gut (niedriges CO2), Rot = schlecht (hohes CO2). 100-800 deckt den gesamten Wertebereich ab (min 89, max 694). |
| EE-Anteil | `interpolateGreens` | [0, 100] % | Je hoeher der EE-Anteil, desto dunkler das Gruen. Konsistent zum CO2 (gruen = gut). |
| Fossiler Anteil | `interpolateReds` | [0, 100] % | Je hoeher der fossile Anteil, desto dunkler das Rot. Abgrenzung zu EE klar erkennbar. |
| Day-Ahead-Preis | `interpolateViridis` | [min, max] aus Daten | Eigene Skala, weil Preise keine festen Grenzen haben. Viridis ist farbenblindfreundlich. |

### Entwurfsbegruendung

**Warum SVG statt Canvas?** 8760 Zellen (365 x 24) sind fuer SVG gut handhabbar – das sind weniger als 10.000 DOM-Elemente. Der Browser rendert das in unter 10ms. Canvas waere erst ab ~100.000 Elementen sinnvoll, wo der DOM-Baum zu gross wird. SVG hat den Vorteil, dass D3-Daten-Join, CSS-Hover-Effekte und Event-Handler (click, mouseenter) nativ funktionieren, ohne eigene Hit-Testing-Logik.

**Warum `interpolateRdYlGn` mit invertiertem Domain [800, 100]?** Die Farbskala Rot-Gelb-Gruen ist intuitiv: Rot signalisiert Gefahr (hohe CO2-Werte), Gruen signalisiert Entspannung (niedrige CO2-Werte). Die Invertierung des Domain (800 unten, 100 oben) sorgt dafuer, dass hohe Werte auf den roten Bereich der Skala fallen. Der Wertebereich 100-800 deckt den tatsaechlichen CO2-Bereich (89-694 g/kWh) vollstaendig ab, mit etwas Puffer an den Raendern.

**Warum `interpolateViridis` fuer Preise?** Viridis ist sequentiell, perceptuell uniform und farbenblindfreundlich. Da Preise negativ sein koennen (bis -500 Euro/MWh) und keine intuitive "gut/schlecht"-Assoziation haben, ist eine divergierende oder semantische Skala hier fehl am Platz. Eine sequentielle Farbabstufung reicht aus, um Muster zu erkennen.

**Warum feste Zellgroesse (13px) statt responsiv?** Der horizontale Scroll-Ansatz stellt sicher, dass alle 365 Tage sichtbar bleiben, unabhaengig von der Bildschirmbreite. Ein responsiver Ansatz (Zellen an Containerbreite anpassen) wuerde die Zellen bei schmalen Viewports auf unter 5px schrumpfen lassen, was die Farberkennung unmoeglich macht.

---

## 16. StackedArea-Komponente (components/viz/StackedArea.vue)

### Datenbasis und Aggregation

**Datenquelle:** `hourly_2015_2024.json` (84.987 Stunden, 2015-01-04 bis 2024-12-31).

Die Rohdaten werden durch folgende Pipeline erzeugt:
1. `scripts/download-prices.js` ruft ENTSO-E-API auf (Strompreise, 2015-2024)
2. `scripts/download-smard.js` ruft SMARD-API auf (Erzeugungsdaten)
3. `scripts/build_hourly.mjs` merged beide via inner join auf timestamp und berechnet CO2, EE-Anteil, generation_by_source
4. Output: `public/data/hourly_2015_2024.json`

**Aggregation zu Wochen:** Die StackedArea aggregiert die Stunden-Daten in ISO-Wochen-Buckets. Das sind ca. 520 Datenpunkte fuer 10 Jahre.

**Begruendung Wochen-Aggregation:**
- Taeglich (ca. 3.650 Punkte) waere zu verrauscht fuer den 10-Jahres-Ueberblick
- Monatlich (120 Punkte) wuerde Details wie die Atomausstiegs-Linie im April 2023 verschlucken
- Wochen (520 Punkte) sind der beste Kompromiss: glatte Linien durch `curveMonotoneX`, aber genug Aufloesung fuer Annotationen

### Aufbau

**Kopfzeile:**
- Links: Nummer "1" im Kreis + Titel "Erzeugungsmix ueber die Zeit"
- Rechts: Toggle [Absolut] / [% Anteil] als segmentierte Buttons

**Legende:**
- Horizontal unter der Kopfzeile, 9 Energietraeger mit Farbpunkten
- Jeder Eintrag ist anklickbar: ausgegraut + durchgestrichen bei Ausblendung
- Mindestens ein Traeger bleibt immer sichtbar

**Chart:**
- D3-Stack mit `d3.stack()` und `d3.area()` mit `curveMonotoneX`
- Stapelreihenfolge: Wind, PV, Braunkohle, Steinkohle, Gas, Kernenergie, Biomasse, Wasserkraft, Sonstige
- Absolut-Modus: Y-Achse in GWh/Woche
- Prozent-Modus: Y-Achse 0-100%, offset via `d3.stackOffsetExpand`

### Features

| Feature | Umsetzung |
|---|---|
| Absolut/Prozent | `d3.stackOffsetExpand` bei Prozent, feste Skala bei Absolut |
| Legende togglen | `visibleKeys` als reaktives Set, `d3.stack()` bekommt nur aktive Keys |
| Annotation Kohleausstieg | Vertikale Linie 2020-01-01, Text "Kohleausstiegspfad bis 2038" |
| Annotation Atomausstieg | Vertikale Linie 2023-04-15, Text "Atomausstieg 2023" |
| CO2-Linie | Zweite Y-Achse rechts, schwarze Linie, per Checkbox unten togglebar |
| Tooltip | Vertikale Linie + Overlay mit Werten pro Traeger (GWh + %) |
| Range-Slider | Platzhalter-Text unter dem Chart |

### Entwurfsbegruendung

**Warum Wochen statt Monate oder Tage?** Zehn Jahre Tagesdaten (3.650 Punkte) wuerden eine unruhige, schwer lesbare Flaeche mit vielen Zacken erzeugen. Monatsdaten (120 Punkte) waeren zu glatt und wuerden kurzfristige Ereignisse wie den Atomausstieg im April 2023 zeitlich verschmieren. Wochen (520 Punkte) liefern eine glatte Kurve durch `curveMonotoneX`, behalten aber genug zeitliche Praezision fuer Annotationen.

**Warum `d3.stackOffsetExpand` fuer Prozent?** D3 bietet mit `stackOffsetExpand` eine fertige Funktion, die jeden Datenpunkt auf 1 normiert. Das ist performanter und fehlerresistenter als eine manuelle Nachberechnung der Prozentwerte.

**Warum feste Farben statt D3-Skala?** Jeder Energietraeger hat eine etablierte Farbe in Energie-Visualisierungen (Braunkohle = braun, PV = gelb, Gas = orange). Eine automatische Farbskala wuerde diese Konvention ignorieren und die Lesbarkeit verschlechtern. Die Farben sind als konstantes Objekt `COLORS` definiert, damit sie sowohl vom Chart als auch von der Legende und dem Tooltip gleich referenziert werden.

---

## 17. DuckCurve-Komponente (components/viz/DuckCurve.vue)

### Konzept

Die Duck Curve (Entenkurve) beschreibt den typischen Tagesverlauf der Residuallast in Stromnetzen mit hohem PV-Anteil. Tagsueber sinkt die Residuallast durch Solar-Einspeisung (der "Bauch" der Ente), abends steigt sie steil an, wenn die Sonne weg ist und die Last gleichzeitig hochgeht (der "Hals" der Ente).

Diese Komponente vergleicht zwei Gruppen gegeneinander (Sommer/Winter, frueh/spaet, Werktag/Wochenende) und zeigt jeweils drei Linien: PV, Residuallast und Preis.

### Datenbasis

Wie bei StackedArea: `hourly_2015_2024.json` (84.987 Stunden). Die Residuallast wird berechnet als:

```
residuallast (GW) = (load_mwh - (wind_onshore + wind_offshore + pv + biomass + hydro + other_renewables)) / 1000
```

### Aufbau

**Kopfzeile:**
- Links: Nummer "4" im Kreis + Titel "Duck Curve / Tagesprofil-Vergleicher"
- Rechts: Toggle [Durchschnitt] / [Konkreter Tag] + Dropdown mit drei Presets

**Presets:**

| Preset | Gruppe A | Gruppe B |
|---|---|---|
| Sommer vs Winter | Juni-August | Dezember-Februar |
| 2015 vs 2024 | Nur 2015 | Nur 2024 |
| Werktag vs Wochenende | Montag-Freitag | Samstag-Sonntag |

**Chart:**
- X-Achse: Stunde 0-23
- Y-Achse links: GW (PV + Residuallast)
- Y-Achse rechts: EUR/MWh (Preis)
- Gruppe A = durchgezogene Linien, Gruppe B = gestrichelt
- Drei Linien pro Gruppe: PV (gruen), Residuallast (schwarz), Preis (blau)
- Legende als halbtransparente Box oben links im Chart, Linien togglebar
- Tooltip: vertikale Linie + alle Werte zur Maus-Stunde

**Konkreter-Tag-Modus:**
- Aktiviert wenn `selectedDay`-Prop gesetzt ist (von HeatmapCO2 via emit)
- Zeigt nur einen Tag statt Durchschnitt
- Dropdown deaktiviert, nur durchgezogene Linien

### Entwurfsbegruendung

**Warum zwei Y-Achsen, obwohl das oft kritisiert wird?** Zwei Y-Achsen sind dann problematisch, wenn sie suggestiv skaliert sind und einen falschen Zusammenhang vortaeuschen. Hier sind PV/Residuallast (GW) und Preis (EUR/MWh) physikalisch unterschiedliche Groessen, die keine gemeinsame Skala haben koennen. Der Preis ist keine zweite "GW"-Skala, sondern eine unabhaengige Marktgrosse. Die zweite Achse ist explizit in blau gehalten und als "EUR/MWh" beschriftet, sodass keine Verwechslung mit der GW-Skala moeglich ist. Der Nutzer kann die Preislinie auch per Legend-Klick ausblenden, falls sie storend wirkt.

**Warum `curveCatmullRom` statt `curveMonotoneX`?** Tagesprofile haben nur 24 Datenpunkte und verlaufen oft glatt (keine Zacken wie bei Wochen-Charts). Catmull-Rom-Spline erzeugt eine weichere Kurve, die den typischen Glocken- oder U-Verlauf der PV-Kurve besser darstellt. `curveMonotoneX` wuerde die Kurve an den Uebergaengen zwischen den Stunden weniger elegant machen.

**Warum Residuallast statt Gesamterzeugung?** Die Duck Curve lebt vom Kontrast zwischen Solar-Einspeisung (Mittagsspitze) und dem verbleibenden Bedarf. Die Gesamterzeugung wuerde diesen Effekt verdecken, weil sie die Solar-Einspeisung bereits enthaelt. Die Residuallast isoliert den Effekt: man sieht direkt, wie viel konventionelle Kraftwerke noch fahren muessen.

---

## 18. Naechste Schritte / Ausstehende Aufgaben

- [ ] **2018-Datenluecke schliessen** durch Fix der Domain-Logik in `download-prices.js`
- [ ] **Vollstaendigen Stundenindex aufspannen** (left join) in `build_hourly.mjs`
- [ ] **pages/dashboard.vue** Alle Komponenten einbinden (FilterBar, StackedArea, HeatmapCO2, DuckCurve)
- [ ] **pages/index.vue** Landing-Seite mit Dashboard-Link ausbauen
- [ ] **Viz 3**: Jahresbalken negative Preisstunden
- [ ] **pages/index.vue** Landing-Seite ausbauen
- [ ] **pages/dashboard.vue** Dashboard mit D3-Charts und FilterBar + Heatmap einbinden
