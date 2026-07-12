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

## 18. ScatterAnalysis-Komponente (components/viz/ScatterAnalysis.vue)

### Konzept

Die Zusammenhaenge zwischen verschiedenen Metriken werden in einem Scatterplot dargestellt. Der Nutzer kann X-Achse, Y-Achse und Farbkodierung aus sechs Metriken frei waehlen. Eine OLS-Regressionslinie mit Pearson-Korrelation und R² zeigt den linearen Zusammenhang.

### Achsen-Optionen

| Metrik | Einheit | Verwendung |
|---|---|---|
| EE-Anteil | % | X, Y, Farbe |
| CO2-Intensitaet | g/kWh | X, Y, Farbe |
| Day-Ahead-Preis | EUR/MWh | X, Y, Farbe |
| Fossiler Anteil | % | X, Y, Farbe |
| Last | GW | X, Y, Farbe |
| Stunde des Tages | (0-23) | X, Y |

### Rendering-Strategie (Performance)

**Canvas statt SVG** fuer die Punktwolke, weil bis zu 84.987 Punkte noetig sind. Ein SVG mit fast 85k Kreisen wuerde den DOM-Baum aufblahen und das Reflowing verlangsamen. Canvas zeichnet die Punkte direkt auf eine Bitmap und beansprucht den Haupt-Thread nur beim Zeichnen, nicht danach.

**SVG-Overlay** fuer Achsen, Regressionslinie und Labels, weil D3-Achsen und Text in Canvas deutlich aufwaendiger zu implementieren waeren und hier kaum Performance-Last erzeugen (weniger als 50 DOM-Elemente).

**Alpha-Skalierung:** Bei < 5.000 Punkten alpha=0.35, bei > 20.000 alpha=0.15. Das verhindert, dass dichte Regionen komplett schwarz erscheinen, und erhaelt die Farbinformation auch bei hoher Punktdichte.

**Ausreisser:** Punkte, deren X- oder Y-Wert mehr als zwei Standardabweichungen vom Mittelwert entfernt liegen, werden mit einem schwarzen Rand markiert. Nicht-Ausreisser werden blasser dargestellt, um den Kontrast zu erhoehen.

### Statistik

- **Pearson-Korrelation r:** Misst den linearen Zusammenhang zwischen X und Y. Werte von -1 bis 1. -0.76 bei EE vs CO2 bedeutet einen starken negativen linearen Zusammenhang.
- **R²:** Gibt an, wieviel der Varianz in Y durch X erklaert wird (0-1).
- **OLS-Regression:** `y = a*x + b`. Einfachste lineare Regression, minimiert die quadrierten Abstaende.

**Warum Pearson, nicht Spearman?** Die Achsen sind frei waehlbar, aber die typischen Zusammenhaenge (EE-Anteil vs CO2, CO2 vs Preis) sind erwartungsgemaess linear oder zumindest monoton. Pearson ist der Standard fuer lineare Zusammenhaenge und ermoeglicht die Interpretation von R² (erklaerte Varianz). Spearman waere besser bei rein monotonen, nicht-linearen Zusammenhaengen, aber dafuer gibt es hier keine Anwendungsfaelle.

**Kein d3-hexbin:** Der Benutzer hatte hexbin fuer > 20.000 Punkte vorgeschlagen. Das Canvas-Rendering mit reduziertem Alpha (0.15) erzeugt bei 85k Punkten bereits eine visuelle Dichtekarte ohne zusaetzliche Abhaengigkeit. Ein Hexbin-Overlay koennte spaeter als Verstaerkung hinzugefuegt werden, indem `d3-hexbin` installiert wird (`bun add d3-hexbin`).

---

## 19. Dashboard: KPI-Karten + Seiten-Komposition

### KpiCard (components/dashboard/KpiCard.vue)

Wiederverwendbare Karte fuer eine Kennzahl. Props:
- `title` – Bezeichnung
- `value` – formatierter Wert (z.B. "53,3")
- `unit` – Einheit (z.B. "%")
- `sparklineData` – Array von Zahlen fuer den Mini-Liniendiagramm (10 Jahre)
- `deltaLabel` – Vergleichstext (z.B. "+27,8 PP vs. 2015")
- `deltaPositive` – true = Anstieg ist positiv (gruen), false = Abfall ist positiv (gruen)

Der Sparkline-Chart wird mit D3 gerendert: Linie in Akzent-gruen, leichter Verlaufsfuellung darunter, letzter Punkt als Kreis hervorgehoben.

### pages/dashboard.vue (Dashboard-Seite)

Die Seite wurde vom Platzhalter zu einer vollstaendigen Dashboard-Komposition ausgebaut:

```
┌─────────────────────────────────────────────────┐
│  DashboardFilterBar                              │
├─────────────────────────────────────────────────┤
│  KPI 1  │  KPI 2  │  KPI 3  │  KPI 4           │
├─────────────────────────────────────────────────┤
│  VizStackedArea (Erzeugungsmix)                  │
├─────────────────────────────────────────────────┤
│  VizHeatmapCO2 (CO2-Heatmap)                     │
├─────────────────────────────────────────────────┤
│  VizScatterAnalysis (Zusammenhaenge)              │
├─────────────────────────────────────────────────┤
│  VizDuckCurve (Tagesprofile)                     │
└─────────────────────────────────────────────────┘
```

**Datenfluss:**
1. `useData().loadHourly()` + `loadYearly()` werden beim Mount aufgerufen
2. `useFilters().filteredHours(hourly)` erzeugt reaktiven Computed
3. KPIs werden aus den Rohdaten berechnet (Mittelwerte, Summen, Sparklines)
4. Jede Viz-Komponente bekommt `:data="filtered"` (ausser DuckCurve, die alle Daten bekommt)
5. Die FilterBar schreibt direkt in `useFilters().state`

### Vier KPIs im Dashboard

| KPI | Wert (2015-2024) | Sparkline-Quelle | Delta-Bewertung |
|---|---|---|---|
| EE-Anteil (Durchschnitt) | yearly_mix.avg_ee_share | yearly_mix (10 Jahre) | Anstieg = gruen |
| CO2-Intensitaet (Durchschnitt) | yearly_mix.avg_co2 | yearly_mix (10 Jahre) | Rueckgang = gruen |
| Day-Ahead-Preis (Durchschnitt) | hourly gemittelt | aus hourly (10 Jahre) | immer grau |
| Negativ-Stunden | hourly summiert | aus hourly aggregiert | Rueckgang = gruen |

---

## 20. Dashboard-Layout (Finale Komposition)

### Layout-Struktur

Das Dashboard ist als vertikaler Stack mit CSS Grid realisiert:

```
┌──────────────────────────────────────────────────────────┐
│  Wovon haengt die Klimabilanz des deutschen Stroms ab?   │
│  Eine interaktive Analyse ...              [FilterBar]   │
├──────────────────────────────┬───────────────────────────┤
│  Viz 1: StackedArea          │  Viz 2: HeatmapCO2        │
│  (Erzeugungsmix ueber Zeit)  │  (CO2-Heatmap)            │
├──────────────────────────────┼───────────────────────────┤
│  Viz 3: ScatterAnalysis      │  Viz 4: DuckCurve         │
│  (Zusammenhaenge)            │  (Tagesprofile)           │
├──────────┬──────────┬────────┼──────────┬────────────────┤
│  KPI 1   │  KPI 2   │  KPI 3 │  KPI 4                   │
├──────────┴──────────┴────────┴──────────────────────────┤
│  Footer: Quellenangaben                                  │
└──────────────────────────────────────────────────────────┘
```

### Cross-Viz-Verdrahtung

HeatmapCO2 und DuckCurve sind miteinander verbunden:
1. Nutzer klickt in der Heatmap auf eine Zelle (ein bestimmter Tag)
2. HeatmapCO2 emittiert `@day-selected` mit ISO-Datum
3. Dashboard setzt `selectedDay`-Ref
4. DuckCurve schaltet in den "Konkreter Tag"-Modus und zeigt die Kurven fuer diesen Tag

Die FilterBar schreibt direkt in `useFilters().state`. Alle Viz-Komponenten (ausser DuckCurve) bekommen `:data="filtered"`, das ein Computed auf `filteredHours(hourly)` ist. Aenderungen in der FilterBar wirken sich sofort auf alle Charts aus.

### Datenfluss

```
useData().loadHourly() ──→ hourly (ref)
                              │
                              ├──→ filteredHours(hourly) ──→ filtered (computed)
                              │       │                        │
                              │       └── useFilters().state   ├──→ StackedArea
                              │                                ├──→ HeatmapCO2
                              │                                └──→ ScatterAnalysis
                              │
                              └──→ hourly (direkt) ────────────→ DuckCurve
```

### Entwurfsbegruendung

**Warum CSS Grid statt Flexbox?** Das Layout hat zwei Achsen: horizontal (zwei Viz-Spalten, vier KPI-Spalten) und vertikal (vier Zeilen). Grid erlaubt es, beide Achsen in einem Container zu definieren, ohne verschachtelte Flex-Container. Die `gap: 16px` sorgt fuer einheitliche Abstaende zwischen allen Karten. Bei Flexbox haette man die vier KPI-Karten in eine eigene Reihe packen muessen, was zusaetzliche Container bedeutet haette.

**Warum die KPIs unter den Charts?** Der Screenshot zeigt die KPIs unten. Das ist bewusst so gewaehlt: der Nutzer sieht zuerst die vier interaktiven Charts (die Hauptinformation), dann die Zusammenfassung als KPI-Zahlen. Waeren die KPIs oben, wuerden sie die Charts nach unten druecken und der Nutzer muesste scrollen, um die Charts zu sehen.

**Warum selectedDay als Prop statt Event-Bus?** Die Verbindung zwischen HeatmapCO2 und DuckCurve ist eine 1:1-Beziehung innerhalb derselben Seite. Ein Prop + Callback dafuer ist der einfachste und TypeScript-sicherste Weg. Ein Event-Bus oder zentraler Store waere hier Overkill, weil kein anderer Teil der App diesen Zustand braucht.

---

## 21. Landing-Seite + RacingBarChart

### RacingBarChart (components/landing/RacingBarChart.vue)

Animierter Balken-Chart auf der Landing-Seite, der den deutschen Strommix von 2015 bis 2024 durchlaeuft.

**Datenbasis:** `public/data/yearly_mix.json` (wird via fetch im Browser geladen).

**Datenaufbereitung:**
- Die neun Quell-Definitionen aus SOURCE_DEFS (Wind, PV, Braunkohle, etc.) werden auf die Keys in yearly_mix.sources gemappt
- Wind = wind_onshore + wind_offshore, Sonstige = other_renewables + other_fossil + pumped_storage
- MWh werden in TWh umgerechnet (Division durch 1.000.000)
- Pro Jahr werden die Top 8 nach TWh sortiert angezeigt

**Animation:**
- Startet automatisch 1s nach dem Seitenaufbau
- Durchlaeuft die Jahre 2015 bis 2024
- 1s pro Jahr (800ms Transition + 200ms Pause)
- D3-Key-Join: Jeder Balken hat einen fixen Key (z.B. "lignite"), sodass D3 verfolgen kann, wohin der Balken bei einem Rangwechsel wandern muss
- Bars wechseln Position durch die Band-Scale: wenn sich die Sortierung aendert, bekommt ein Balken einen neuen y-Wert und gleitet dorthin
- Grosse Jahreszahl (64px, hellgrau) unten rechts wechselt mit
- Nach Durchlauf: "Zuruecksetzen"-Button erscheint

**Animations-Strategie:**
D3s Key-Data-Join ist der zentrale Mechanismus: `data(bars, (d) => d.key)`. Dadurch erkennt D3, welcher Balken aus dem Vorjahr noch existiert (update), welcher neu ist (enter) und welcher verschwunden ist (exit). Die `easeCubicOut`-Easing-Funktion sorgt fuer ein natuerliches Abbremsen am Ende jeder Bewegung, was angenehmer aussieht als lineare Transition. Die Jahreszahl wird separat eingeblendet (opacity-Transition), sodass sie sich von Jahr zu Jahr sanft ueberblendet.

### pages/index.vue

Die Landing-Seite wurde vom Platzhalter zu einer vollstaendigen Einstiegsseite ausgebaut:

- **Headline** (2.8rem / ~45px): "Wovon haengt die Klimabilanz des deutschen Stroms ab?"
- **Subtitle** (1.1rem / ~18px): Quellenangabe
- **RacingBarChart** zentriert (700px breit, ~500px hoch)
- **Projektbeschreibung**: 2 Absaetze als FliessText
- **Dashboard-Button**: Gruener Button mit Hover-Effekt, NuxtLink zu /dashboard
- **Footer**: Quellenangaben

---

## 22. Layout-Refactoring: Responsives Dashboard

### Problem

Das Dashboard hatte auf 1920px, 1440px und 1366px Breite horizontalen Scroll, weil jede Viz-Komponente eine feste SVG-Breite hatte (700px oder 900px). Die Cards waren breiter als der Viewport, sobald zwei Spalten nebeneinander standen (2 x 700px + 16px Gap = 1416px).

Betroffene Komponenten:

| Komponente | Feste Breite | viewBox | overflow-x |
|---|---|---|---|
| StackedArea | WIDTH = 900 | vorhanden | auto |
| HeatmapCO2 | SVG_W = ~4925px (365 Zellen) | fehlte | auto |
| ScatterAnalysis | WIDTH = 700 | fehlte | auto |
| DuckCurve | WIDTH = 700 | vorhanden | auto |

### Massnahmen

**1. Dashboard-Container (pages/dashboard.vue):**
- `max-width` von 1400px auf 1600px erhoeht
- `overflow-x: hidden` hinzugefuegt
- Responsive Media Queries:
  - Bei < 1200px: Header (Titel + Filter) untereinander
  - Bei < 1100px: 2x2 Grid -> 1 Spalte, KPI 4->2 Spalten
  - Bei < 600px: KPI 2->1 Spalte, Padding reduziert

**2. SVGs responsiv gemacht:**
- Allen SVGs `viewBox` hinzugefuegt (fehlte in HeatmapCO2 und ScatterAnalysis)
- CSS `width: 100%; height: auto` auf allen Chart-SVGs
- Dadurch skalieren SVGs auf Containerbreite, aspect ratio bleibt via viewBox erhalten

**3. Horizontal-Scroll reduziert:**
- `overflow-x: auto` von `display: block` auf Media-Query-Bedingungen verschoben
- StackedArea, ScatterAnalysis, DuckCurve: Scroll nur < 900px
- HeatmapCO2: Scroll nur < 1400px (weil 365 Zellen x 13px = 4745px natuerlich breit ist)

**4. ScatterAnalysis Canvas korrigiert:**
- Absolute Position von `top: 70px; left: 50px` auf `top: 20px; left: 65px` korrigiert
- Passt jetzt zu MARGIN.top (20) und MARGIN.left (65)
- Das Canvas lag vorher neben dem Chart statt darueber

**5. FilterBar responsiv:**
- `flex-wrap: wrap` (war bereits vorhanden, funktioniert jetzt durch Container-Breite)
- Date-Inputs: `max-width: 45%` statt fixen 140px
- Padding bei < 1200px reduziert

### Ergebnis

- Kein horizontaler Page-Scroll auf 1920px, 1440px, 1366px
- Dashboard wirkt wie eine Karten-Komposition (2 Spalten, gleichhoehe Cards)
- Charts skalieren mit dem Viewport mit
- Bei Tablet/Mobil klappt das Layout in 1 Spalte um
- Canvas-Position im Scatter ist korrigiert

### Nachbesserung: Header + FilterBar (06.07.2026)

Nach dem ersten Refactoring war die Ueberschrift links extrem schmal und brach Wort fuer Wort um, weil der Header per Flexbox mit `flex: 1; min-width: 0` auf der Intro-Seite zu stark schrumpfen konnte.

**Fix Header (pages/dashboard.vue):**
- Flexbox durch CSS Grid ersetzt: `grid-template-columns: minmax(420px, 0.9fr) minmax(720px, 1.6fr)`
- Linke Spalte (Titel) hat jetzt mindestens 420px Breite, der Titel bricht nicht mehr Wort fuer Wort um
- Unter 1200px: Grid auf 1 Spalte, Filter unter dem Titel

**Fix FilterBar (FilterBar.vue):**
- Filterbar visual trennen: `background: transparent`, `border-bottom: none`, `padding: 10px 0`
- Einheitliche Control-Hoehe von 36px fuer: date-Inputs, Dropdown-Header, Segmented-Toggle, Year-Buttons, More-Button
- Date-Inputs auf 145px feste Breite (kein `max-width: 45%` mehr)
- Gap zwischen Filtergruppen von 24px auf 16px reduziert
- Schriftgroessen einheitlich auf 0.78-0.8rem

---

## 23. Layout-Umbau nach Mockup (06.07.2026)

### Neues Dashboard-Layout

Komplette Neustrukturierung des Dashboards nach dem Mockup-Screenshot:

**Neue Seitenstruktur (von oben nach unten):**

1. **Full-width Header** - Titel gross (clamp 28-44px), Untertitel, Aktualisierungs-Datum rechts. Header steht allein (keine FilterBar daneben).
2. **FilterCard** - Die FilterBar ist jetzt eine eigene weisse Card mit border-radius: 16px, padding: 16px 20px. Controls alle auf 36px Hoehe vereinheitlicht.
3. **KPI-Reihe** - Vier KPI-Karten in einer Grid-Zeile. 4 Spalten auf Desktop, 2 unter 900px, 1 unter 600px.
4. **Viz-Reihe 1** - 2-Spalten-Grid: links StackedArea, rechts ScatterAnalysis. Beide Cards gleich hoch.
5. **Full-width Heatmap** - HeatmapCO2 als Hero-Visualisierung ueber die volle Breite. ResizeObserver fuer responsive Zellgroessen. Lokaler Saison-Fokus (Ganzes Jahr, Winter, Fruehling, Sommer, Herbst). Monats-Trennlinien.
6. **Full-width DuckCurve** - DuckCurve ueber volle Breite. WIDTH auf 900 erhoeht, HEIGHT auf 360.
7. **Footer** - Quellen links, Stack rechts, geteilter Footer.

### Geaenderte Dateien (7)

| Datei | Aenderung |
|---|---|
| `assets/css/main.css` | body background auf `#f8fafc` |
| `pages/dashboard.vue` | Komplett neues Layout (Header full-width, FilterCard, KPI oben, 2-Spalten-Grid, Heatmap full-width, DuckCurve full-width) |
| `components/dashboard/FilterBar.vue` | Vereinfachtes Card-Layout, 36px Controls, border-radius 8px, #fff Hintergrund |
| `components/viz/HeatmapCO2.vue` | ResizeObserver fuer responsive Zellgroessen, Saison-Fokus-Buttons, Monats-Trennlinien, dynamische Chart-Hoehe 260px |
| `components/viz/DuckCurve.vue` | WIDTH 900, HEIGHT 360, border-radius 16px |
| `components/viz/StackedArea.vue` | HEIGHT 370, border-radius 16px |
| `components/viz/ScatterAnalysis.vue` | border-radius 16px |
| `components/dashboard/KpiCard.vue` | border-radius 16px, #fff Hintergrund |

### Heatmap-Aenderungen im Detail

- **ResizeObserver** auf containerRef -> `containerWidth` wird bei Fenster-Aenderung aktualisiert
- **Zellgroessen dynamisch**: `cellWidth = plotWidth / visibleDays`, `cellHeight = 260 / 24`
- **Saison-Fokus**: 5 Buttons (Ganzes Jahr, Winter, Fruehling, Sommer, Herbst). Nur lokal fuer die Heatmap. Filtert sichtbare Tage, Skala bleibt gleich.
- **Monats-Trennlinien**: Senkrechte Linien in #cbd5e1 zwischen Monaten
- **Stundenlabels**: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (alle 4h)

### Einheitlicher Card-Stil

Alle Cards im Dashboard: `background: #fff`, `border: 1px solid #e5e7eb`, `border-radius: 16px`, `box-shadow: none`. Dadurch wirkt das Dashboard wie eine saubere Karten-Komposition auf hellgrauem Hintergrund.

---

## 24. Dashboard-Validierungsskript (scripts/check-dashboard-data.mjs)

### Erstellung (06.07.2026)

Ein unabhaengiges Node.js-Skript, das saemtliche Dashboard-Kennzahlen aus den JSON-Daten berechnet und im Terminal ausgibt. Ermoeglicht den direkten Vergleich mit den Werten im Browser-Dashboard.

**Aufruf:** `bun run check:data`

**Gepruefte Bereiche:**
1. Grunddaten (Stundenanzahl, Zeitraum, 2025-Pruefung, Stunden pro Jahr mit Soll/Ist)
2. Preise (Min, Max, Durchschnitt, negative Stunden gesamt + pro Jahr)
3. CO2 (Min, Max, Durchschnitt, null/NaN/unrealistische Werte)
4. EE-Anteil (Min, Max, Durchschnitt, Bereich 0-100)
5. Jahresvergleich hourly vs yearly_mix (EE, CO2, Negativ-Stunden, Abweichung > 0,5% = WARN)
6. Korrelationen (Pearson r fuer EE/CO2, EE/Preis, CO2/Preis)
7. Duck-Curve-Check (24h-Profile fuer Sommer und Winter: PV, Residuallast, Preis)
8. Dashboard-KPI-Vergleich (Zusammenfassung aller Kennzahlen)

### Pruefbericht: Korrelationsabweichung (06.07.2026)

Nachdem der Scatterplot im Dashboard abweichende r-Werte zeigte (vermutet r ≈ -0.62 statt -0.94), wurde der Code analysiert.

**Ergebnis:**
- Die Pearson-Formel in ScatterAnalysis.vue ist identisch zum check-Skript
- Die Datenmenge ist korrekt (84.964 von 84.987 Zeilen, 23 Randstunden durch dateRange-Ende 00:00 UTC)
- r ≈ -0.62 kommt in keiner getesteten Achsen-Kombination vor (naechste: EE vs Stunde = -0.06)
- Die Korrelation bleibt bei allen Filter-Kombinationen nahe -0.94

**Gefundener Bug in ScatterAnalysis.vue:**
```js
// VORHER (falsch):
const vals = rows.map((r) => ({ x: xFn(r), y: yFn(r) }))
  .filter((v) => !isNaN(v.x) && !isNaN(v.y))
return vals.map((v, i) => ({
  x: v.x,
  y: v.y,
  colorVal: cFn(rows[i]),  // rows[i] zeigt nach filter auf falsche Zeile
}))
```

Nach dem `filter` waren die Indizes von `vals` und `rows` nicht mehr synchron. Die Farbe eines Punktes konnte von einer anderen Datenzeile stammen. Die Korrelation selbst war nicht betroffen (x/y bleiben korrekt).

### Fix: Farbzuordnung (06.07.2026)

Der Bug wurde behoben, indem x, y und Farbe vor dem Filter gemeinsam berechnet werden:

```js
// NACHHER (korrekt):
const all = rows
  .map((r) => ({
    x: xFn(r),
    y: yFn(r),
    colorVal: cFn(r),       // Farbe aus derselben Zeile wie x/y
  }))
  .filter((p) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.colorVal)
  )
```

`Number.isFinite` ersetzt `!isNaN` und filtert auch null/undefined/Infinity zuverlaessiger.

---

## 25. Enddatum-Fix (useFilters.ts + FilterBar.vue)

### Problem

Der Default-Filter in `useFilters.ts` setzte `end` auf `Date.UTC(2024, 11, 31)`, was 2024-12-31 00:00 UTC entspricht. Die Stunden 01:00 bis 23:00 des 31.12. wurden dadurch aus dem Filter ausgeschlossen (23 von 84.987 Zeilen).

### Fix

- `useFilters.ts`: Default `end` und `reset()` auf `Date.UTC(2024, 11, 31, 23, 59, 59, 999)` geaendert
- `FilterBar.vue`: Neue Funktion `stringToDateEnd()` erzeugt Enddatum mit 23:59:59.999 UTC. `stringToDate()` bleibt fuer Startdatum bei 00:00 UTC.

### Ergebnis

- Default-Filter laesst jetzt alle 84.987 Zeilen durch
- Dashboard-KPIs stimmen exakt mit `check-dashboard-data.mjs` ueberein

---

## 26. Fehlende Stunden: 2.685 vs 2.590 (klaerung)

### Diskrepanz

| Quelle | Fehlende Stunden | Bezug |
|---|---|---|
| docs/log.md (alt) | 2.590 | Ab tatsaechlichem Datenstart (2015-01-04) |
| check-dashboard-data.mjs | 2.685 | Ab idealem Soll-Start (2015-01-01) |

### Ursache

Der Datensatz beginnt nicht am 2015-01-01 00:00 UTC, sondern erst am **2015-01-04 23:00 UTC** (erster verfuegbarer Timestamp aus der SMARD-/ENTSO-E-API).

```
2015-01-01 00:00  ────────────────────── 2015-01-04 23:00
                    95 Stunden spaeter
```

- 95 Stunden Differenz = 3 Tage + 23 Stunden = exakt die Zeit zwischen 01.01. 00:00 UTC und 04.01. 23:00 UTC
- 2.685 (Soll 01.01.) - 95 (Spaetstart) = 2.590 (ab Datenstart) – Rechnung geht auf

### Fix in check-dashboard-data.mjs

Das Skript gibt jetzt beide Werte aus:
1. **Fehlend (Soll 01.01.)** = 2.685 – bezogen auf den idealen 10-Jahres-Zeitraum
2. **Fehlend (ab Datenstart)** = 2.590 – bezogen auf den tatsaechlichen ersten Datenpunkt

Zusaetzlich: Ausgabe der Soll-Stunden 2015-2024 (87.672), des genauen Datenstarts und der API-Spaetstart-Differenz (95h).

---

## 27. DuckCurve: Negative Residuallast sichtbar gemacht

### Problem

Die linke Y-Achse der DuckCurve startete bei 0 (`gwMin = 0`). 810 Stunden mit negativer Residuallast (Minimum -13,71 GW) wurden unterhalb des sichtbaren Bereichs gezeichnet und waren unsichtbar. Das ist fachlich relevant, weil der Duck-Curve-Effekt gerade den mittaglichen Einbruch der Residuallast durch PV-Einspeisung zeigt – teilweise bis unter Null (EE-UEberschuss).

### Fix

```js
// VORHER:
const gwMin = 0
const gwMax = d3.max(allGW) ?? 100

// NACHHER:
const rawMin = d3.min(allGW) ?? 0
const rawMax = d3.max(allGW) ?? 100
const gwMin = rawMin < 0 ? rawMin * 1.1 : 0
const gwMax = rawMax * 1.1
```

1. `gwMin` wird auf den minimalen GW-Wert (oder 0, falls alle Werte positiv sind) gesetzt
2. 10% Padding nach oben und unten
3. Nulllinie (gestrichelt, grau) wird eingezeichnet, wenn der Bereich negativ ist
4. Y-Achsen-Beschriftung bleibt unveraendert (zeigt GW)
5. Rechte Preisachse bleibt unveraendert

---

## 28. Fachliche Pruefung: HeatmapCO2.vue (06.07.2026)

Die Heatmap-Komponente wurde auf fachliche Korrektheit geprueft. Das Ergebnis war:

| Kriterium | Status | Begruendung |
|---|---|---|
| Vollstaendiges 0-23-Stundenraster | OK | `for (const doy of visibleDays) { for (let h = 0; h < 24; h++) }` |
| Fehlende Stunden als grau | OK | `if (d.value === undefined) return '#f1f5f9'` |
| Kein 0-Fallback | OK | `lookup.get()` gibt `undefined` fuer fehlende Werte |
| X-Achse = Tag des Jahres | OK | `d.doy - dayOffset` |
| Y-Achse = Stunde 0-23 | OK | `d.hour * cellHeight` |
| CO2 aus `co2_g_per_kwh` | OK | Metric `value: (r) => r.co2_g_per_kwh` |
| EE aus `ee_share` | OK | Metric `value: (r) => r.ee_share` |
| Fossil aus `fossil_share` | OK | Metric `value: (r) => r.fossil_share` |
| Preis aus `price_eur_mwh` | OK | Metric `value: (r) => r.price_eur_mwh` |
| Negative Preise korrekt | OK | `interpolateViridis` mit auto-domain inkludiert negative Werte |
| Saison-Fokus nur lokal | OK | Separates `seasonFocus`-Ref, keine Verbindung zu useFilters |
| Farbskala bleibt bei Fokus-Wechsel gleich | OK | `yearData` bleibt ungefiltert, nur `visibleDays` aendert sich |
| Klick sendet ISO-Datum in UTC | OK | `new Date(Date.UTC(jahr, 0, d.doy))` |
| Full-width, kein Page-Scroll | OK | ResizeObserver + `cellWidth = Math.max(3, plotWidth / days)` |
| Chart-Hoehe ausreichend | OK | 260px + Margins = ~320px |

**Keine kritischen Fehler gefunden.** Ein kosmetischer Hinweis: Die Monats-Trennlinie wird auch am ersten Tag (Januar 1) gezeichnet, was eine unnötige Linie am linken Rand erzeugt.

---

## 28b. StackedArea-Fix: 2018-Annotation + Default Prozentmodus (06.07.2026)

### Aenderungen in StackedArea.vue

**1. 2018-Datenluecken-Annotation hinzugefuegt**
```js
{ date: new Date(2018, 9, 1), label: 'Datenluecke 2018\n(ENTSO-E-Wechsel)', color: '#94a3b8' }
```
- Position: 1. Oktober 2018 (Beginn der Luecke durch Marktgebietswechsel)
- Farbe: dezentes Slate-Grau (#94a3b8), gestrichelt wie die anderen Annotationen
- Text: "Datenluecke 2018" und "ENTSO-E-Wechsel" in zwei Zeilen

**2. Default-Modus auf Prozent geaendert**
```js
const mode = ref<'absolute' | 'percent'>('percent')
```
Begruendung: Prozentmodus ist robuster gegenueber fehlenden Stunden. Die 2018-Luecke (Okt-Dez ohne Preisdaten) verfaelscht im Absolutmodus die Jahressumme, im Prozentmodus sind die relativen Anteile korrekt. Der Nutzer kann jederzeit auf Absolut umschalten.

**3. Hinweistext im Absolutmodus**
Nur sichtbar wenn `mode === 'absolute'`:
> Hinweis: 2018 enthaelt ab Oktober Datenluecken durch den ENTSO-E-Marktgebietswechsel. Prozentwerte und Durchschnittswerte sind dadurch besser vergleichbar als Jahressummen.

---

## 29. Fachliche Pruefung: DuckCurve.vue (06.07.2026)

Die DuckCurve-Komponente wurde auf fachliche Korrektheit geprueft:

| Kriterium | Status | Begruendung |
|---|---|---|
| PV aus `generation_by_source.pv` | OK | `pvGW()` liest `gen.pv` |
| PV-Umrechnung MWh -> GW | OK | `/1000` in `pvGW()` |
| Preis in EUR/MWh | OK | `r.price_eur_mwh` ohne Umrechnung |
| Residuallast: nur EE in Summe | OK | `wind_onshore + wind_offshore + pv + biomass + hydro + other_renewables` |
| Kein nuclear in EE-Summe | OK | Nicht enthalten |
| Kein pumped_storage in EE-Summe | OK | Nicht enthalten |
| Keine fossilen in EE-Summe | OK | Nicht enthalten |
| Residuallast /1000 fuer GW | OK | `(load_mwh - ee) / 1000` |
| Sommer = Jun-Aug | OK | `m >= 5 && m <= 7` |
| Winter = Dez-Feb | OK | `m === 11 \|\| m <= 1` |
| 2015 vs 2024 korrekt | OK | `getUTCFullYear() === 2015/2024` |
| Werktag = Mon-Fri | OK | `getUTCDay() >= 1 && <= 5` |
| Wochenende = Sat-Sun | OK | `getUTCDay() === 0 \|\| === 6` |
| Konkreter Tag in UTC | OK | `selectedDay + 'T00:00:00Z'` |
| Exakt 24h-Fenster | OK | `dayEnd = dayStart + 86400000` |
| Keine Zeitzonenprobleme | OK | Beide Seiten UTC |
| DuckCurve bekommt alle Daten | OK (bewusst) | `:data="hourly"`, wegen eigener Vergleichsmodi |

**Kritischer Fehler gefunden und gefixt:** Negative Residuallast war unsichtbar (siehe Abschnitt 27).

---

## 30. KPI-Fix: Filter-Reaktionsfaehigkeit (06.07.2026)

### Problem

Die fachliche Prufung ergab, dass KPIs aus `hourly.value` (ungefiltert) statt `filtered.value` berechnet wurden. Aenderungen an Zeitraum-, Saison- oder Tagtyp-Filtern aktualisierten alle Charts, aber die KPI-Zahlen blieben auf den 10-Jahres-Gesamtwerten stehen.

Zudem sagten Delta-Labels pauschal "vs. 2015", auch wenn 2015 gar nicht mehr im aktiven Filter enthalten war.

### Fix in pages/dashboard.vue

**1. KPI-Werte aus `filtered.value`:**
```js
// VORHER: const data = hourly.value
// NACHHER: const data = filtered.value
```
Damit reagieren die vier Haupt-KPIs (EE, CO2, Preis, Negativ-Stunden) auf alle Filter.

**2. Delta-Labels dynamisch:**
Die Jahresmittelwerte werden jetzt aus dem gefilterten Datensatz ermittelt:
```js
const eeByYear = {}
for (const r of data) {
  const y = new Date(r.timestamp).getUTCFullYear()
  eeByYear[y] = (eeByYear[y] || []).push(r.ee_share)
}
// erstes vs. letztes Jahr im gefilterten Bereich
const deltaLabel = (firstY, lastY, prefix) => {
  if (firstY && lastY && lastY > firstY) return `${prefix} vs. ${firstY}`
  return 'im aktuellen Filter'
}
```

Wenn nur ein Jahr im Filter enthalten ist (z.B. nur 2024), heisst das Label "im aktuellen Filter" statt irrefuehrend "vs. 2015".

**3. Sparklines bleiben als 10-Jahres-Kontext:**
Die Sparkline-Daten kommen weiterhin aus `yearly_mix` (EE, CO2) bzw. `hourly` (Preis, Negativ). Sie zeigen den Gesamttrend 2015-2024 unabhaengig vom aktiven Filter. Das ist bewusst so gewaehlt: der Trend-Vergleich (z.B. "EE-Anteil steigt seit 2015") ist als Kontext wertvoll, auch wenn der Nutzer nur 2020-2024 filtert.

### Ergebnis

| Aspekt | Vorher | Nachher |
|---|---|---|
| KPIs bei Filter 2015-2024 | 42,8% EE, 402 g/kWh CO2 | 42,8% EE, 402 g/kWh CO2 (unveraendert) |
| KPIs bei Filter 2024 nur | 42,8% EE, 402 g/kWh CO2 | 56,7% EE, 342 g/kWh CO2 (korrekt aktualisiert) |
| Delta-Label bei Filter 2020-2024 | "vs. 2015" | "vs. 2020" |
| Delta-Label bei Filter 2024 nur | "vs. 2015" | "im aktuellen Filter" |
| Sparklines (alle Filter) | 10-Jahres-Trend | 10-Jahres-Trend (unveraendert) |

---

## 32. Vor-Abgabe-Fixes (06.07.2026)

Fünf gezielte Fixes basierend auf systematischem Code-Review, vor dem Bau der Landing-Page.

| # | Fix | Datei(en) | Beschreibung |
|---|---|---|---|
| 1 | **Scatter: Redundanz Farbe=X verhindert** | `ScatterAnalysis.vue` | Watch erkennt wenn `colorAxis.key === xAxis.key` und setzt Farbe automatisch auf eine sinnvolle Alternative (Preis oder CO₂). Guard `_adjustingColor` mit `setTimeout` verhindert Endlosschleife. Hinweistext "Farbe wurde angepasst, um redundante Kodierung zu vermeiden." |
| 2 | **Heatmap: Dynamischer Titel** | `HeatmapCO2.vue` | Titel `heatmapTitle` computed wechselt mit Metrik: "Stündliche CO₂-Heatmap", "Stündliche EE-Anteil-Heatmap", "Stündliche Fossil-Anteil-Heatmap", "Stündliche Preis-Heatmap". METRICS-Labels auf "CO₂-Intensität", "Dunkelgrün" mit echten Umlauten korrigiert. |
| 3 | **Heatmap: Preis-Perzentil-Clipping** | `HeatmapCO2.vue` | Für `metric.key === 'price'` wird die Farbskala nicht mehr mit min/max, sondern mit 1./99. Perzentil belegt (`d3.quantile(sorted, 0.01/0.99)`). Werte ausserhalb werden visuell geklemmt, Tooltip zeigt echten Preis. Legende zeigt "Skala: 1.–99. Perzentil". |
| 4 | **FilterBar: Leeres Panel entfernt** | `FilterBar.vue` | "Weitere Filter"-Button + Platzhalter-Panel "(Folgt in einem spaeteren Baustein)" komplett entfernt. Nur "Filter zuruecksetzen" bleibt rechts aussen. CSS `.more-wrapper`, `.more-btn`, `.more-panel`, `.more-placeholder` gelöscht. |
| 5 | **DuckCurve: Auto-Switch bei Heatmap-Klick** | `DuckCurve.vue` | `watch(() => props.selectedDay)` schaltet `mode` automatisch auf `'concrete'`, sobald ein Tag aus der Heatmap ausgewählt wird. Button "Konkreter Tag" wird aktiv, Preset-Dropdown deaktiviert. |

---

## 33. Feinschliff: Scatter + StackedArea (06.07.2026)

Weitere Detailverbesserungen vor dem Bau der Landing-Page.

| # | Fix | Datei(en) | Beschreibung |
|---|---|---|---|
| 1 | **Scatter: Stundeneinheit korrigiert** | `ScatterAnalysis.vue` | `unit: ''` → `unit: 'h'` für "Stunde des Tages". Kein leeres `()` mehr im Dropdown. |
| 2 | **Scatter: Regression bei Stunde ausgeblendet** | `ScatterAnalysis.vue` | Wenn `xAxis.key === 'hour'` wird die Regressionslinie nicht gezeichnet. Statistikbox zeigt "Stunde ist zyklisch; lineare Regression ausgeblendet" statt der Regressionsformel. |
| 3 | **Scatter: R²-Hinweis bei schwachem Zusammenhang** | `ScatterAnalysis.vue` | Wenn `r2 < 0.1` und X ≠ Stunde wird "Kein starker linearer Zusammenhang" in der Statistikbox angezeigt. Box-Höhe (`boxH`) dynamisch basierend auf Zeilenanzahl. |
| 4 | **StackedArea: Brush-Platzhalter entfernt** | `StackedArea.vue` | D3-Text `[Zeitraum im unteren Bereich auswaehlen]` vollständig entfernt. Kein non-funktionaler UI-Hinweis mehr. |
| 5 | **StackedArea: Kohleannotation präzisiert** | `StackedArea.vue` | "Kohleausstiegspfad bis 2038" → "Kohleausstiegsbeschluss 2020 / Ziel: 2038". Erklärt warum die Markierung 2020 liegt. |

---

## 34. Filterleiste radikal verschlankt (06.07.2026)

Globale Filter auf Minimum reduziert, Panel-Eigenkontrollen gestärkt.

### Änderungen im Überblick

| Änderung | Betroffene Dateien | Beschreibung |
|---|---|---|
| **useFilters.ts entschlackt** | `useFilters.ts` | `Season`-Typ, `seasons`-Set, `compareYears`-Array, `getSeason()`-Funktion entfernt. Nur `dateRange` und `dayType` bleiben global. `filteredHours()` filtert nur noch nach Zeitraum und Wochentag. |
| **FilterBar vereinfacht** | `FilterBar.vue` | Komplett neues Script/Template/CSS. Saison-Dropdown und Vergleichsjahre-Toggles entfernt. Drei Zeitraum-Preset-Chips ergänzt: "Gesamter Zeitraum", "Seit Atomausstieg", "Letztes vollständiges Jahr". Preset als runde Chips (border-radius: 20px), aktiv = grün gefüllt. |
| **Status-Zeile** | `dashboard.vue` | Neue Zeile unter der Filterleiste: "Aktive Auswahl: 01.01.2015–31.12.2024 · Alle Tage → 84.987 Stunden". Dynamisch via `statusLine`-computed. |
| **Per-KPI-Baseline-Dropdown** | `dashboard.vue`, `KpiCard.vue` | Jede KPI-Karte hat rechts oben ein Dropdown "vs. 2015 ▼" mit Optionen 2015/2020/2023. Steuert die Delta-Anzeige pro Karte unabhängig. Baseline-Werte aus `yearly_mix` (EE, CO₂) bzw. aus hourly aggregiert (Preis, Negativstunden). |
| **KPI-Titel kosmetisch** | `dashboard.vue` | "EE-Anteil (Durchschnitt)" → "EE-Anteil", "CO2-Intensitaet (Durchschnitt)" → "CO₂-Intensität", "Stunden mit negativen Preisen" → "Negative Preisstunden". |
| **TypeScript-Korrekturen** | `useFilters.ts` | Export `Season` entfernt (nicht mehr nötig). Import `computed` entfernt (nicht mehr verwendet). |

---

## 35. Scatter-Fokussierung + Umlaute + KPI-Farben + Nummerierung (06.07.2026)

Systematische Umsetzung der offenen Kritikpunkte aus dem Review.

| Änderung | Betroffene Dateien | Beschreibung |
|---|---|---|
| **Scatter: Y-Achse fix auf CO₂** | `ScatterAnalysis.vue` | Y-Dropdown entfernt, durch fixe Anzeige "CO₂-Intensität (g/kWh) `fix`" ersetzt. `yAxis` bleibt als `ref` aber wird nie geändert. |
| **Scatter: Farbe default Stunde** | `ScatterAnalysis.vue` | `colorAxis` default von `price` auf `hour` (Stunde des Tages) geändert. Zeigt Tag/Nacht-Struktur als dritte Dimension. |
| **Scatter: Umlaute im Panel** | `ScatterAnalysis.vue` | "CO2-Intensitaet" → "CO₂-Intensität", "Zusammenhaenge" → "Zusammenhänge", "Ausreisser" → "Ausreißer", "ueber" → "über", "waehlen" → "wählen". |
| **Umlaute gesamte UI** | `dashboard.vue`, `FilterBar.vue`, `StackedArea.vue`, `HeatmapCO2.vue` | "haengt" → "hängt", "zuruecksetzen" → "zurücksetzen", "Erzeugungsmix ueber die Zeit" → "über die Zeit", "Datenluecke" → "Datenlücke", "Fruehling" → "Frühling". |
| **Aktualisierungsdatum dynamisch** | `dashboard.vue` | "Letzte Aktualisierung: 06.07.2025, 11:36" → `Aktualisiert: {{ new Date().toLocaleDateString(...) }}`. Zeigt aktuelles Datum/Uhrzeit. |
| **KPI-Sparkline-Farben semantisch** | `dashboard.vue`, `KpiCard.vue` | Neue Prop `sparkColor` in KpiCard. EE = grün (`--accent`), CO₂ = grün bei Fall / rot bei Anstieg, Preis = neutralgrau (`#6b7280`), Negativstunden = neutralgrau. Sparkline-Gradient passt sich an. |
| **Panel-Nummerierung korrigiert** | `ScatterAnalysis.vue`, `HeatmapCO2.vue` | Lesereihenfolge 1→2→3→4: StackedArea=1 (unverändert), ScatterAnalysis=3→2, HeatmapCO2=2→3, DuckCurve=4 (unverändert). |

### Datenfluss

```
useFilters.ts (reactive state)
  ├── dateRange (start/end)
  ├── dayType (all/weekday/weekend)
  └── filteredHours() → filtered (computed in dashboard.vue)

Panel-Eigenkontrollen (nicht global):
  ├── HeatmapCO2: seasonFocus, activeMetric (lokal)
  ├── DuckCurve: activePreset, mode (lokal)
  └── ScatterAnalysis: xAxis, yAxis, colorAxis (lokal)
```

---

## 36. Landing Page mit animiertem Streamgraph (06.07.2026)

### Neues Konzept

Die Landing Page (`pages/index.vue`) wurde von Racing-Bar-Chart auf animierten **Streamgraph/Stacked-Area-Chart** umgestellt. Der vollständige Verlauf 2015–2024 bleibt immer sichtbar, ein vertikaler Zeitcursor macht den Wandel als Animation erlebbar.

### AnimatedStreamgraph.vue (`components/landing/AnimatedStreamgraph.vue`)

| Aspekt | Umsetzung |
|---|---|
| **Daten** | `yearly_mix.json` (MWh → TWh), 9 Energieträger, Mapping identisch zum Dashboard |
| **Stapelreihenfolge** (unten→oben) | Sonstige → Wasserkraft → Biomasse → PV → Wind → Gas → Steinkohle → Braunkohle → Kernenergie |
| **Farben** | Konsistent zum Dashboard (Wind blau, PV gelb, Braunkohle braun, etc.) |
| **Animation** | Cursor läuft über 6 Sekunden (easeInOut) von 2015–2024. Start 1s nach Sichtbarkeit. `requestAnimationFrame`-basiert. |
| **Ereignisse** | Gestrichelte Linien + Labels: "2020 · Kohleausstiegsgesetz", "2022 · Energiekrise", "2023 · Atomausstieg", "2024 · Vergleichsjahr" |
| **Tooltip** | Bei Hover/Scrub: Werte in TWh + Prozent pro Energieträger + Gesamtsumme |
| **Erkenntniszeile** | Wechselt mit Cursor-Jahr (10 verschiedene Texte von 2015–2024) |
| **Steuerung** | Button "Animation starten" / "Animation überspringen" / "Nochmal ansehen" |
| **reduced-motion** | `prefers-reduced-motion: reduce` → keine Animation, Cursor sofort bei 2024 |
| **Technik** | D3 stack + area mit curveMonotoneX, SVG viewBox, responsive |
| **SSR** | In `pages/index.vue` mit `<ClientOnly>` umschlossen |

### pages/index.vue

Komplett neu geschrieben:
- Headline, Subtitle, Leitsatz (neu)
- AnimatedStreamgraph als zentrales visuelles Element
- Projektbeschreibung (aktualisiert)
- Großer grüner "Zum Dashboard →" Button (NuxtLink)
- Footer mit Quellenangabe
- `max-width: 1100px`, viel Weißraum, responsive

### useDashboardPreload.ts (neuer Composable)

Lädt Dashboard-Daten im Hintergrund, während die Landing Page angezeigt wird:
1. **Sofort**: `yearly_mix.json` (klein, ~4 kB)
2. **Nach requestIdleCallback**: `hourly_2015_2024.json` (groß, ~32 MB)
3. Nutzt `useData()`-Cache wieder – Dashboard sieht keine Ladezeit
4. Fehler werden leise geschluckt (nur `console.warn` in dev)

---

## 37. Panel 4: Interaktive Duck-Curve-Analyse mit Story-Modus (06.07.2026)

Komplette Neuentwicklung von `components/viz/DuckCurve.vue`. Ersetzt den alten Dual-Axis-Chart durch Small Multiples mit geführtem Story-Modus.

### Architektur

| Aspekt | Alt | Neu |
|---|---|---|
| **Visualisierung** | Ein Chart, doppelte Y-Achse (GW links, EUR/MWh rechts) | Drei gekoppelte Small Multiples, gleiche X-Achse, keine doppelte Y-Achse |
| **Metriken** | PV, Residuallast, Preis | PV + Residuallast (GW), Day-Ahead-Preis (EUR/MWh, Step-Line), CO₂-Intensität (g/kWh) |
| **Hauptinteraktion** | Preset-Dropdown (Sommer/Winter, etc.) | Story-Modus mit 5 geführten Schritten |
| **Vergleiche** | Presets als Hauptfeature | Presets als sekundäre Option "Vergleich" |
| **Legende** | Im Chart (überdeckte Kurven) | Keine Legende im Plot nötig (separate Panels) |
| **Preis-Darstellung** | CatmullRom-Spline | `curveStepAfter` (stündliches Marktprodukt) |

### Story-Modus

Fünf Schritte, die die kausale Kette erklären:

| Schritt | Fokus | Highlight | Text |
|---|---|---|---|
| 1 PV-Mittag | PV-Erzeugung | 10–15 Uhr | PV erreicht Tageshöchstwert |
| 2 Residuallast-Tal | Residuallast | 10–15 Uhr | Residuallast sinkt durch PV |
| 3 Preisreaktion | Day-Ahead-Preis | 10–15 Uhr | Markt reagiert auf Knappheit |
| 4 CO₂-Effekt | CO₂-Intensität | 10–15 Uhr | CO₂ sinkt bei hohem EE-Anteil |
| 5 Abendrampe | Residuallast-Anstieg | 17–21 Uhr | Flexibilitätsbedarf am Abend |

### Weitere Features

- **Analyse-Box**: Zeigt Ø-Werte für den hervorgehobenen Zeitraum (PV, RL, Preis, CO₂)
- **Mittag-vs-Abend-Vergleich**: Automatisch bei Schritt 5, mit Differenzen in GW, EUR/MWh, g/kWh
- **Manuelle Auswahl**: Klick in Chart setzt eigenen Highlight-Bereich, "Zur Story zurückkehren"-Button
- **Tooltip**: Hover zeigt stündliche Werte aller vier Metriken
- **Methodische Hinweise**: Als ausklappbares `<details>` unter dem Panel
- **Vergleichs-Presets**: Durchschnitt, Sommer/Winter, Werktag/Wochenende, 2015/2024 (sekundär)
- **Konkreter Tag**: per `selectedDay`-Prop (von Heatmap-Klick)
- **CO₂-Chart**: Neue Metrik mit roter Linie (`#dc2626`), `curveMonotoneX`

---

## 31. Naechste Schritte / Ausstehende Aufgaben

- [ ] **2018-Datenluecke schliessen** durch Fix der Domain-Logik in `download-prices.js`
- [ ] **Vollstaendigen Stundenindex aufspannen** (left join) in `build_hourly.mjs`
- [ ] App final testen und ggf. Feinschliff

---

## 38. Farben + Header-Korrektur (06.07.2026)

| Änderung | Datei | Beschreibung |
|---|---|---|
| **Lignite-Farbe dunkler** | `StackedArea.vue` | `#78350f` → `#451a03`. Braunkohle ist jetzt deutlich von Gas (Orange) unterscheidbar. |
| **Hardcoal-Farbe dunkler** | `StackedArea.vue` | `#6b7280` → `#374151`. Entspricht IEA/Ember-Konvention für Steinkohle. |
| **Header ehrlicher** | `dashboard.vue` | Dynamisches "Aktualisiert: 06.07.2026, 14:06" → statisches "Datenstand: 31.12.2024". Kein Echtzeit-Suggestiv mehr, Daten enden tatsächlich 12/2024. |

---

## 39. Scatterplot: Erklärmodul für Einflussfaktoren der CO₂-Intensität (06.07.2026)

Komplette Überarbeitung von `components/viz/ScatterAnalysis.vue` – vom Statistik-Tool zum verständlichen Erklärmodul.

### Achsen und Labels

| Alt | Neu |
|---|---|
| Panel-Titel "Zusammenhänge" | "Einflussfaktoren der CO₂-Intensität" + Untertitel |
| "EE-Anteil (%)" | "Anteil erneuerbarer Energien (%)" |
| "CO₂-Intensität (g/kWh)" | "CO₂ pro Kilowattstunde Strom (g/kWh)" |
| "Day-Ahead-Preis (EUR/MWh)" | "Strombörsenpreis (€/MWh)" |
| "Last (GW)" | "Stromnachfrage / Last (GW)" |
| "Stunde des Tages (h)" | "Uhrzeit des Tages" |
| "Fossiler Anteil (%)" | "Anteil fossiler Energien (%)" |
| Badge "fix" | Badge "Zielgröße" |

### Neue Achsen-Optionen

- **Jahr** – aus Timestamp abgeleitet
- **Monat** – 1–12, aus Timestamp
- **Jahreszeit** – 0=Winter, 1=Frühling, 2=Sommer, 3=Herbst

### Intelligente Farbsteuerung

- `colorOptions` computed filtert dynamisch alle Optionen, die X oder Y bereits verwenden
- CO₂ ist als Farboption gesperrt (weil Y-Achse)
- Bei Konflikt automatischer Fallback: Uhrzeit → Jahr → Jahreszeit → Monat → Last
- Farb-Legende zeigt benutzerfreundliche Labels (`00:00` statt `0.0`, Monatsnamen, Jahreszeiten)

---

## 40. Scatterplot-Vereinfachung: X-Optionen reduziert, Auswertung laienfreundlich (07.07.2026)

Weitere Vereinfachung von `components/viz/ScatterAnalysis.vue` basierend auf Feedback.

### X-Achse reduziert

Auf 6 Optionen gekürzt: Anteil erneuerbarer/fossiler Energien, Stromnachfrage, Strompreis, Tageszeit, Jahreszeit. Entfernt wurden "Jahr", "Monat", "CO₂ pro Kilowattstunde" (Y) und "Uhrzeit des Tages" (redundant zu Tageszeit). Neue interne Struktur: `X_OPTIONS` (für X) und `ALL_OPTIONS` (für Y+Farbe).

### Intelligente Farbsteuerung

- `colorOptions` filtert dynamisch CO₂ (Y) und die aktuelle X-Variable
- Bei X-Wechsel: Farbe wird automatisch gesetzt (Standard: fossiler Anteil bei X=erneuerbar, sonst erneuerbarer Anteil)
- Farb-Legende ohne Jahr/Monat (entfernte Optionen)

### Auswertungsbox (neu)

- Titel "Auswertung" mit dynamischem Hauptsatz (z.B. "Starker negativer Zusammenhang")
- Erklärungstext: "Wenn X größer wird, sinkt/steigt die CO₂-Intensität tendenziell."
- Stärke-Zusatz: beschreibt Streuung und Erklärkraft
- "Zusammenhang einfach erklärt"-Toggle mit Korrelationserklärung in Klartext
- Erklärter Anteil: ca. X % (statt R²)
- Regressionsgleichung nur unter "Für Interessierte"

### Labels und UI

- "X = möglicher Einfluss", "Y = CO₂-Intensität", "Farbe = Zusatzinfo"
- Y-Einheit: "g CO₂ pro kWh Strom"
- "So liest du die Grafik": kompakte Kurzform
- "Bitte beachten": ersetzt "Wissenschaftlicher Hinweis"
- "Statistische Details anzeigen" → "Zusammenhang einfach erklärt"
- Datenpunkte + "≈ 10 Jahre"
- Rohe Regressionsformel und R² unter "Statistische Details anzeigen" (Details-Toggle)

---

## 41. Scatterplot: Ansichts-Auswahl statt Farbe, dynamischer Zeitraum (07.07.2026)

### Zeitraum-Anzeige
- Dynamisch aus globalem `useFilters().state.dateRange`
- "Zeitraum: 2015–2024 · Jeder Punkt = eine Stunde" (bei Jahresgenauigkeit)
- "Zeitraum: 01.01.2022–31.12.2024 · Jeder Punkt = eine Stunde" (bei genauerem Filter)

### Farb-Dropdown entfernt
- Farb-Dropdown "Farbe = Zusatzinfo" komplett entfernt
- Punkte jetzt einfarbig blau (`#2563eb`) – Fokus auf X-Y-Zusammenhang
- Keine Farblegende mehr im SVG

### Ansichts-Auswahl (neu)
Vier Buttons ersetzen das Farb-Dropdown:
- **Alle Stunden** (Default) – keine Filterung
- **Nach Jahreszeit** – Chips: Alle / Winter / Frühling / Sommer / Herbst
- **Nach Tageszeit** – Chips: Alle / Nacht / Morgen / Mittag / Abend
- **Nach Jahr** – Chips: Alle + verfügbare Jahre aus dem aktuellen Filter
- Beschreibungstext: "Aktuell angezeigt: ..."

### Lesebeispiel (neu)
- Dynamischer Text je nach X-Auswahl
- "Punkte rechts unten zeigen Stunden mit viel erneuerbarem Strom..."
- "Hier sieht man, zu welchen Tageszeiten der Strom eher CO₂-arm ist..."

### Datenbereinigung
- `colorAxis`, `colorOptions`, `colorAutoFixed`, `_adjustingColor` entfernt
- `interpretationText` computed entfernt (durch lesebeispiel + auswertung ersetzt)
- `showDetails` ref entfernt
- `yAxis` ref entfernt (Y ist fix CO₂, hartcodiert im Rendering)
- Doppelte `stats` und `auswertung`-Definitionen entfernt
- `colorVal` aus Point-Interface entfernt (Punkte einfarbig)

---

## 42. Scatterplot: X reduziert, Statistik-Box entfernt, Badge entfernt (07.07.2026)

### X-Dropdown auf 4 Optionen reduziert
- Entfernt: Tageszeit, Jahreszeit
- Verblieben: Anteil erneuerbarer Energien, Anteil fossiler Energien, Stromnachfrage, Strompreis
- Tageszeit und Jahreszeit nur noch unter "Ansicht" als Filter verfügbar

### Statistik-Box im Chart entfernt
- Die dauerhaft eingeblendete Box ("Starker Zusammenhang (r = -0.94)", "84.987 Stunden") aus dem SVG entfernt
- Auswertung bleibt nur in der separaten Box unter dem Chart

### "Zielgröße"-Badge entfernt
- Y-Achse zeigt jetzt nur "g CO₂ pro kWh Strom" ohne grünen Badge

### "Aktuell angezeigt:"-Texte entfernt
- Alle redundanten Beschreibungstexte unter den Filter-Chips entfernt

### CSS aufgeräumt
- `.y-fixed-badge`, `.view-description` entfernt

---

## 43. Scatterplot: Zeitraum-Slider + Ansicht ohne "Nach Jahr" (07.07.2026)

### Zeitraum-Slider (neu)
- Range-Slider mit zwei Griffen für Start- und Endjahr
- Deckt immer 2015–2024 ab (unabhängig vom globalen Filter)
- Startwerte: 2015 (links) und 2024 (rechts)
- Schrittweite: 1 Jahr
- Anzeige: "Zeitraum im Diagramm: 2015–2024 · Jeder Punkt = eine Stunde"
- Slider unter der Ansichts-Auswahl, über dem Chart

### Datenfilter aktualisiert
- `points` computed filtert zuerst nach Slider-Jahren, dann nach Ansichts-Filter
- Korrelation, Trendlinie und Auswertung basieren auf den sichtbaren Punkten

### "Nach Jahr" aus Ansicht entfernt
- Nur noch 3 Optionen: Alle Stunden / Nach Jahreszeit / Nach Tageszeit
- Jahresauswahl übernimmt der Zeitraum-Slider

### Sonstiges
- `useFilters`-Import entfernt (nicht mehr benötigt)
- `yearFilter`, `availableYears` entfernt
- `ViewMode` auf `'none' | 'season' | 'time'` reduziert
- `periodLabel` nutzt jetzt sliderStart/sliderEnd statt globalem Filter

### Geänderte Dateien
- Nur `components/viz/ScatterAnalysis.vue`

---

## 44. Scatterplot radikal verschlankt (07.07.2026)

Aufräumaktion: Entfernt wurden alle nicht mehr benötigten UI-Elemente und deren zugehörige Logik.

| Entfernt | Begründung |
|---|---|
| **Ansichts-Auswahl** (Alle Stunden / Nach Jahreszeit / Nach Tageszeit) | Zu viele Optionen, lenkt von der Kernfrage ab |
| **Auswertungsbox** (Korrelations-Bewertung + "Zusammenhang einfach erklärt") | Zu technisch, nicht mehr zeitgemäß für das Dashboard |
| **Lesebeispiel** | Redundant zur Achsenbeschriftung |
| **"So liest du die Grafik"** | Hilfetext nicht mehr nötig |
| **"Bitte beachten"** | Wissenschaftlicher Hinweis entfernt |

### Code-Bereinigung
- `viewMode`, `seasonFilter`, `timeFilter`, `SEASONS`, `TIMES` entfernt
- `seasonMap`, `matchesView()` entfernt
- `auswertung` computed entfernt
- `lesebeispielText` computed entfernt
- Punkte-Filterung nur noch über Zeitraum-Slider (Jahre)
- Unnötige CSS-Klassen entfernt

### Verblieben im Scatterplot
- X-Dropdown (4 Optionen) + Y = CO₂-Intensität (fix)
- Zeitraum-Slider (2015–2024, zwei Griffe)
- Canvas-Scatterplot + Regressionslinie
- "Besondere Stunden hervorheben"-Checkbox
- Hover-Tooltip

---

## 45. KPI-Filter + Scatterplot-Zeitsteuerung (Refactoring) (08.07.2026)

### Ziel

Globale Filterleiste entfernt, KPI-Jahrfilter nur für KPIs, Scatterplot mit eigener Play/Pause-Zeitsteuerung über 3-Monats-Phasen, KPI-Sparkline-Hover-Sync.

### Änderungen

| Datei | Änderung |
|---|---|
| `composables/useFilters.ts` | Radikal vereinfacht: nur noch KPI-Jahrfilter (`year: number \| null`). `filteredKpiData()` filtert hourly nach Jahr. Kein `dateRange`/`dayType` mehr. |
| `components/dashboard/FilterBar.vue` | Komplett neu: KPI-Jahr-Chips (Gesamtzeitraum, 2015-2024). Custom-Style, nur für KPIs sichtbar. |
| `pages/dashboard.vue` | Script auf `kpiFiltered` umgestellt. Template: FilterBar + KPI-Reihe in `kpi-section`. Vizes bekommen `hourly` (ungefiltert) statt `filtered`. `hoveredIndex`-Ref für Sparkline-Sync. Statuszeile entfernt. |
| `components/dashboard/KpiCard.vue` | Hover-Sync: `hoveredIndex`-Prop, `hover`/`leave`-Emits. Tooltip-Div mit Jahr + Wert bei Hover. Fadenkreuz + Punkt auf gehoverter Position. Baseline-Select entfernt. |
| `components/viz/ScatterAnalysis.vue` | Play/Pause-Steuerung: 40 Phasen (10 Jahre × 4 Quartale), `setInterval` alle 1,5s. Timeline-Slider. Auswertungsbox: Korrelation + Richtung + Stärke pro Phase. Trendlinie dynamisch. |

### Neue Konzepte

**KPI-Jahrfilter**: Nur vier Chips (Gesamtzeitraum, 2015, 2020, 2024). Beeinflusst nur KPI-Werte und Sparklines. Alle Charts (StackedArea, Scatter, Heatmap, DuckCurve) bekommen ungefilterte `hourly`-Daten.

**Scatterplot-Zeitsteuerung**: 3-Monats-Phasen von Jan–Mrz 2015 bis Okt–Dez 2024. Play/Pause-Button startet automatischen Durchlauf. Timeline-Slider für manuelle Navigation. Pro Phase: separate Punktewolke, Trendlinie, Korrelations-Auswertung.

**KPI-Hover-Sync**: `hoveredIndex` wird von dashboard.vue zentral verwaltet. Bei Mausbewegung über eine Sparkline sendet KpiCard `hover(index)`-Event → dashboard aktualisiert `hoveredIndex` → alle KpiCards rendern Fadenkreuz + Tooltip an derselben Position.

---

## 46. Dashboard-Redesign: Tab-Navigation, KPI-Verbesserungen + Editorial Style (07.07.2026)

### Dashboard neu strukturiert

Kompletter Umbau des Dashboard-Layouts mit Tab-Navigation:

| Tab | Inhalt |
|---|---|
| **Überblick** | StackedArea (links) + Kontext-Panel mit Kernaussagen (rechts) |
| **Zusammenhänge** | ScatterAnalysis mit Play/Pause + 3-Monats-Phasen |
| **Tagesmuster** | HeatmapCO2 |
| **Preise** | DuckCurve |

### KPI-Verbesserungen (07.07.2026)

**Adaptive Delta-Zeilen:**
- Gesamtzeitraum: `"Trend 2015→2024: +23,6 PP"` (Endwert − Startwert der Sparkline)
- Einzeljahr = 2015: Kein Delta (kein Vergleich mit sich selbst)
- Einzeljahr > 2015: `"+X,X PP vs. 2015"`

**Aggregations-Label pro Kachel:**
- EE-Anteil, CO₂, Preis: `Ø 2015–2024` (Durchschnitt)
- Negativpreis-Stunden: `Σ 2015–2024` (Summe)

**KPI-Gruppierung:** Zwei Gruppen mit Überschriften (Klima-Kennzahlen / Markt-Kontext) – später auf Wunsch entfernt.

**Sparkline-Verbesserungen:**
- Bei Einzeljahr-Auswahl dauerhafte Markierung des Jahres-Punkts
- Min/Max-Hinweise unter jeder Sparkline
- PP-Erklärung (ⓘ-Icon mit Tooltip)

### Editorial Design (Print-Data-Journalism-Ästhetik)

**Erste Iteration (warme Papieroptik):**
- Hintergrund: `#F5F1E8` (Cremeweiß)
- Text: `#1F1B16` (warmes Anthrazit)
- Akzent: `#6B7A3F` (Olivgrün)
- Überschriften: Playfair Display (Serif)
- Keine Cards mehr (border-radius, box-shadow entfernt)
- Tabs: Unterstreichungs-Stil statt Pill-Buttons
- Filter-Chips: Text-only mit Unterstrich

**Zweite Iteration (kühles, journalistisches Design):**
- Hintergrund: `#F2F3F5` (helles Kühlgrau)
- Text: `#111318` (kühles Tiefgrau)
- Primärakzent: `#2563EB` (Blau) statt Terracotta
- Teal: `#0D9488`
- Überschriften: Source Serif 4 (klare, kühle Serif)
- KPIs wieder in 4-Spalten-Reihe ohne Gruppenlabels

### Geänderte Dateien (07.07.2026)

| Datei | Änderung |
|---|---|
| `pages/dashboard.vue` | Tab-Navigation, Überblick-Layout, Kontext-Panel, adaptive Deltas, Aggregations-Label, KPI-Gruppierung, neues CSS |
| `components/dashboard/KpiCard.vue` | Hover-Sync, Tooltip, Min/Max, PP-Hilfe, neuer Print-Style |
| `components/dashboard/FilterBar.vue` | Neuer Print-Style (Text-only Chips, Unterstrich) |
| `components/viz/StackedArea.vue` | Card-Style entfernt, Serif-Überschrift |
| `components/viz/ScatterAnalysis.vue` | Card-Style entfernt, Print-Style für Controls, Auswertungsbox |
| `components/viz/HeatmapCO2.vue` | Card-Style entfernt, Serif-Überschrift |
| `components/viz/DuckCurve.vue` | Card-Style entfernt, Serif-Überschrift |
| `assets/css/main.css` | Neue Farbpalette (kühl), Source Serif 4, neue Tokens |
| `nuxt.config.ts` | Source Serif 4 Font hinzugefügt |

---

## 47. Scatterplot-Zoom: Skalen-Synchronisations-Bug behoben (09.07.2026)

### Problembeschreibung

Beim Zoomen und Verschieben im Scatterplot (`Zusammenhänge`-Tab) gerieten die Achsen-Skalen aus dem Takt mit den Datenpunkten. Konkret:

- **Nach Zoom + Re-Render** (z.B. Timeline-Phasenwechsel): Punkte wurden mit gezoomten Skalen positioniert, Achsen fielen auf ungezoomte Skalen zurück.
- **Grid-Linien** zeigten immer die ungezoomten Tick-Positionen.
- **Trendlinie** wurde während des Zoomens nie aktualisiert.
- **Erklär-Zonen** (wenig EE / viel EE) verwendeten im Zoom-Handler andere Domains als im watchEffect.

### Root-Cause-Analyse

Fünf unabhängige Bugs, die zusammen den Effekt verstärkten:

#### Bug 1: `useX`/`useY` nach Achsen-Rendering definiert (TDZ)

```typescript
// Zeile 339 — greift auf useX zu, ABER:
axisGroup.select('.x-axis').call(d3.axisBottom(useX).ticks(6) as any)

// Zeile 370 — useX wird erst hier definiert:
const useX = currentZoom.value ? currentZoom.value.rescaleX(xScale) : xScale
```

`useX`/`useY` wurden **nach** der Achsen- und Grid-Renderlogik definiert (Temporal Dead Zone). Das heisst: Die Variablen existierten noch gar nicht, als die Achsen sie verwenden sollten. Die App lief trotzdem — vermutlich weil der Vue-SFC-Compiler die Funktion als Ganzes betrachtet und die Werte durch Closure-Capture aus vorherigen Runs weitergereicht wurden — aber die Semantik war undefiniert.

#### Bug 2: Grid-Linien nutzten ungezoomte `xScale`/`yScale`

```typescript
const xAxisGen = d3.axisBottom(xScale).ticks(6) // ← xScale statt useX
```

Grid-Linien wurden immer mit der **Original-Skala** berechnet. Nach einem Zoom zeigten die Grids also Ticks an den falschen Positionen (nicht synchron mit den gezoomten Achsen).

#### Bug 3: Zoom-Handler duplizierte die gesamte Renderlogik

Der `.on('zoom', ...)`-Handler hatte eine **separate, eigenständige** Implementierung für:
- Punkte neu positionieren (`.attr('cx', ...)`)
- Achsen neu zeichnen (`.call(d3.axisBottom(zx))`)
- Grid-Linien entfernen + neu erstellen
- Erklär-Zonen entfernen + neu erstellen

Diese Duplikation war eine klassische Wartungsfalle: Jede Änderung an der watchEffect-Renderlogik musste **manuell synchron** im Zoom-Handler nachgezogen werden — sonst gab es Inkonsistenzen. Die Trendlinie wurde z.B. im Zoom-Handler **komplett vergessen**.

#### Bug 4: Trendlinie blieb beim Zoomen statisch

Der Zoom-Handler aktualisierte die Trendlinie nie. Nach einem Zoom blieb sie in der alten Position — bis zum nächsten watchEffect-Durchlauf. Bei schnellem Scrollen war das deutlich sichtbar.

#### Bug 5: Erklär-Zonen nutzten unterschiedliche Domains

- **watchEffect**: `useX.domain()` (gezoomte Domain)
- **Zoom-Handler**: `bx.domain()` (Basis-Domain)

Das führte zu unterschiedlichen Mittelpunkt-Berechnungen und damit zu Zonen, die beim Zoom + Re-Render sprangen.

### Lösung: `updateVisuals(ux, uy)` — Eine Funktion für alle Skalen

#### Änderung 1: `useX`/`useY` nach ganz oben verschoben

Direkt nach der Skalen-Erzeugung, **vor** aller Renderlogik:

```typescript
baseXScale.value = xScale
baseYScale.value = yScale

// Jetzt gleich hier — für alle nachfolgenden Render-Schritte
const useX = currentZoom.value ? currentZoom.value.rescaleX(xScale) : xScale
const useY = currentZoom.value ? currentZoom.value.rescaleY(yScale) : yScale
```

#### Änderung 2: Grid-Linien auf `useX`/`useY` umgestellt

```typescript
const xAxisGen = d3.axisBottom(useX).ticks(6).tickSize(INNER_H).tickFormat(() => '')
const yAxisGen = d3.axisLeft(useY).ticks(5).tickSize(-INNER_W).tickFormat(() => '')
```

#### Änderung 3: Gemeinsame `updateVisuals(ux, uy)`-Funktion

```typescript
function updateVisuals(ux: d3.ScaleLinear<number, number>, uy: d3.ScaleLinear<number, number>) {
  // Punkte (direkte attr-Updates, keine Data-Joins)
  pg.selectAll('circle.point')
    .attr('cx', (d: any) => ux(d.x))
    .attr('cy', (d: any) => uy(d.y))

  // Achsen (mit Tick-Formatierung)
  axisGroup.select('.x-axis').call(d3.axisBottom(ux).ticks(6)...)
  axisGroup.select('.y-axis').call(d3.axisLeft(uy).ticks(5)...)

  // Grid-Linien (komplett neu)
  gridGroup.selectAll('*').remove()
  // ... neu mit ux.ticks(6) / uy.ticks(5)

  // Trendlinie (komplett neu)
  chart.selectAll('g.reg-group').remove()
  if (showTrendline.value) { /* ... mit ux/uy */ }

  // Erklär-Zonen (komplett neu)
  chart.selectAll('g.explain-zone').remove()
  if (explainMode.value) { /* ... mit ux.domain() */ }
}
```

#### Änderung 4: Zoom-Handler auf `updateVisuals` reduziert

Der Zoom-Handler berechnet nur noch `zx`/`zy` aus den Basis-Skalen und ruft dann `updateVisuals(zx, zy)` auf:

```typescript
.on('zoom', (event) => {
  if (!zoomEnabled.value) return
  currentZoom.value = event.transform
  const bx = baseXScale.value, by = baseYScale.value
  if (!bx || !by) return
  const zx = event.transform.rescaleX(bx)
  const zy = event.transform.rescaleY(by)
  updateVisuals(zx, zy) // ← EIN AUFRUF für alles
})
```

### Validierung

- ✅ Build erfolgreich (`nuxt build`)
- ✅ Server läuft, Dashboard lädt
- ✅ Scatterplot rendert mit allen Features
- ✅ Zoom + Pan: Punkte, Achsen, Grids, Trendlinie, Erklär-Zonen bleiben synchron
- ✅ Timeline-Phasenwechsel nach Zoom: Alles bleibt korrekt skaliert
- ✅ Reset-Zoom: `currentZoom.value = null` + `d3.zoomIdentity` → saubere Rückkehr
- ✅ X-Achsen-Wechsel (EE-Anteil → Fossil-Anteil → etc.): Zoom wird zurückgesetzt, Skalen neu berechnet

### Geänderte Dateien (09.07.2026)

| Datei | Änderung |
|---|---|
| `components/viz/ScatterAnalysis.vue` | `useX`/`useY` nach oben verschoben, Grids auf `useX`/`useY`, `updateVisuals()`-Funktion eingeführt, Zoom-Handler vereinfacht, Trendlinie in updateVisuals integriert, doppelte `useX`/`useY`-Definition entfernt |

---

## 48. Scatterplot-Redesign: Breiter, farblich semantisch, Range-Slider, Presets (09.07.2026)

### Überblick

Mehrere Iterationen mit Fokus auf visuelle Qualität, Bedienbarkeit und Farbkodierung:

1. **Chart-Breite erhöht** — WIDTH 700 → 860 → 960 (mehr horizontale Lesefläche, Skalierung korrekt)
2. **Hintergrund + Raster** — Plot-Hintergrund `#F0F0F0`, nur horizontale Gridlines (`#DCDCDC`), Basislinie unten (`#AAAAAA`, 1.5px), kein Box-Rahmen
3. **Punkt-Rendering Zwei-Schichtig** — Outline (`#2D6A4F`, stroke 1.2px, r=4) + Fill (`#52B788`, opacity 0.25) → Dichte durch Überlagerung sichtbar. Später verkleinert auf `r=2.5`
4. **Achsen ohne Rahmen** — `.domain` entfernt, `tickSize(0)`, Labels in `#888888`
5. **Erklär-Zonen mit Callout-Labels** — Fachliche Schwellen (Wenig EE < 30%, Übergang 30–55%, Viel EE > 55%). Hintergrundflächen (rot/grün/beige), weiße Callout-Boxen
6. **Semantische Punktfarben pro X-Achse**:
   - EE-Anteil: Grün `#4A8A5F` / `#2D5A38`
   - Fossil-Anteil: Anthrazit `#4A4A4A` / `#2A2A2A`
   - Stromnachfrage: Petrol-Blau `#3E7A9E` / `#2A5870`
   - Strompreis: Ocker `#B8935A` / `#8A6A35`
7. **Button-Farbe matched Punktfarbe** — Aktiver Pill-Button in jeweiliger `btnBg`
8. **Trendlinie in Farbfamilie** — Dunklere Variante der Punktfarbe (nicht schwarz)
9. **Timeline-Player entfernt → Range-Slider** — Play/Pause/rAF-Animation durch Dual-Handle-Slider ersetzt. Monatsauflösung (120 Monate). Keine Timer/Intervalle.
10. **Preset-Buttons** — `Alles`, `2015/16`, `2017/18`, `2019/20`, `2021/22`, `2023/24`. Default: 2015/16
11. **`Besondere Stunden`-Erklärung** — Infobox bei Aktivierung mit Erläuterung (2 Standardabweichungen)
12. **Titel + Subtitle aktualisiert** — "Die Klimabilanz des deutschen Stroms", Subtitle gestrafft

### Technische Details

- **Zoom-State bleibt erhalten** beim Wechsel des Zeitraums (Slider und X-Achse)
- **`updateVisuals(ux, uy)`** als gemeinsame Render-Funktion für watchEffect + Zoom-Handler
- **`rangePoints`** ersetzt `phasePoints` (filtert nach `selectedStartDate`/`selectedEndDate`)
- **`rangeStats`** ersetzt `phaseStats` (identische Regression)
- **`AXIS_COLORS`**-Map mit `fill`, `outline`, `trend`, `label`, `btnBg`, `opacity` pro X-Achse
- **Keine Play/Pause-Animation, kein rAF, keine PHASES, kein currentPhase** mehr

### Section 48b: Tageszeit-Färbung + Performance (09.07.2026)

**Tageszeit-Färbung:**
- Punkte im Scatterplot werden nach **Tageszeit (4 Gruppen)** eingefärbt
- Nacht (0–5h): `#34495E` — Winddominant, niedrige Nachfrage
- Morgen (6–9h): `#E67E22` — Lastanstieg, PV beginnt
- Tag (10–17h): `#F4D03F` — PV-Spitze, sauberster Strom
- Abend (18–23h): `#8E44AD` — PV weg, fossile Reserve
- Legende unterhalb der Toggle-Chips (farbige Swatches + Labels)

**Performance (erste Iteration):**
- `TRANS_DURATION` 300 → 80ms
- Zwei Circle-Layer (`circle.outline` + `circle.fill`) zu einem einzigen `circle.point` zusammengelegt → DOM-Elemente halbiert
- Bestehende Punkte werden direkt per `.attr()` ohne Transition aktualisiert (nur Enter/Exit haben Transitions)

### Section 48c: Performance-Optimierung (09.07.2026)

**Problem:** Trotz 80ms TRANS_DURATION und Single-Circle-Layer war der Scatterplot bei Slider-Änderungen langsam, weil `watchEffect` bei **jeder** Änderung einen kompletten Re-Render auslöste:
- Kompletter D3-Data-Join aller Punkte (Enter/Exit/Update)
- Trendlinie + R²-Neuberechnung
- Voronoi/Delaunay-Neuaufbau
- Achsen + Labels + Overlays neu gerendert

**Lösung:**
1. `watchEffect` → gezielte `watch()`-Aufrufe + `scheduleRender(reason)`
2. `RenderReason`-Typ: `'init' | 'metricChanged' | 'timeRangeChanged' | 'trendToggleChanged' | 'explainToggleChanged' | 'zoom'`
3. `requestAnimationFrame`-Scheduler für Slider-Bündelung
4. **Slider: keine Data-Joins** — Punkte werden einmal gerendert, dann per `style.display` ein-/ausgeblendet
5. **Trendlinie debounced** — nur nach Slider-Stopp neu berechnet
6. **Voronoi debounced** — nur nach Slider-Stopp neu aufgebaut
7. `updateChart(reason)` strukturiert nach Update-Grund

**Geänderte Dateien (09.07.2026):**
| `components/viz/ScatterAnalysis.vue` | Tageszeit-Färbung, Legende, Single-Circle-Layer, TRANS_DURATION, watch→watch+scheduleRender, RenderReasons, Slider-Debounce |

### Section 48d: Erklärmodus für alle X-Achsen + SQLite-Evaluierung (09.07.2026)

**Erklärmodus erweitert:**
- Bisher nur für EE-Anteil. Jetzt für alle 4 X-Achsen:
  - **Fossil-Anteil**: "Viel Fossil ↗ hohe CO₂" (oben rechts), "Wenig Fossil ↘ niedrige CO₂" (unten links)
  - **Stromnachfrage**: "Hohe Last + wenig EE ↗ schmutzig" (oben rechts), "Niedrige Last ↘ EE-Anteil steigt" (unten links), "Schwache Korrelation — Mix entscheidet" (oben Mitte)
  - **Strompreis**: "Negativpreise → EE-Überschuss" (links mitte), "Spitzenlast → Gas als Puffer" (oben rechts), "Günstig & sauber → EE-Hochphase" (unten links), vertikale Linie bei 0 EUR/MWh
- Labels ohne Hintergrund-Boxen, mit `<tspan>` (erste Zeile bold, zweite mit Pfeil)
- `xAxis.value.key === 'ee_share'`-Guards entfernt → Erklärmodus funktioniert bei jeder X-Achse

### Section 48f: UI-Redesign — Layout, Tabs, Whitespace, Labels (09.07.2026)

**Layout-Verbesserungen:**
- Titel vergrößert: `clamp(32px, 4vw, 52px)` — mehr Hero-Wirkung
- "Datenstand" aus Header entfernt (redundant zu "2015–2024" im Subtitle)
- Großzügigere Abstände: Header→KPIs 56px, KPIs→Tabs 48px, Tabs→Content 40px, Content→Footer 64px

**Tab-Umbenennung:**
- Überblick → **Strommix**
- Zusammenhänge → **Einflussfaktoren**
- Tagesmuster → bleibt
- Preise → **Markt & Preise**

**Scatterplot:**
- "Erklärmodus" → **"Einordnung"** (verständlicher für Nutzer)

**Geänderte Dateien:**
| Datei | Änderung |
|---|---|
| `pages/dashboard.vue` | Titel größer, Header-Meta entfernt, Abstände vergrößert, Tab-Labels geändert |
| `components/viz/ScatterAnalysis.vue` | "Erklärmodus" → "Einordnung" |

### Geänderte Dateien (09.07.2026)

| Datei | Änderung |
|---|---|
| `components/viz/ScatterAnalysis.vue` | Komplett überarbeitet: Skalen-Sync, Grids, Punkte, Erklär-Zonen, semantische Farben, Range-Slider statt Timeline, Presets, Button-Farben, Trendlinien-Farben |

### Section 48e: Letzte Performance-Optimierung — Keine Transitions, kein Voronoi (09.07.2026)

**Problem:** Trotz aller vorherigen Optimierungen war der Scatterplot noch spürbar langsam.

**Letzte Bottlenecks gefunden und behoben:**

1. **D3-Transitions (Enter/Exit)** — Auch bei `TRANS_DURATION=80ms` plante D3 weiterhin Animation-Frames für Enter/Exit. Entfernt: `TRANS_DURATION=0`, alle `.transition()`-Aufrufe entfernt. Punkte erscheinen/verschwinden jetzt sofort.

2. **Voronoi/Delaunay** — `d3.Delaunay.from()` hatte O(n log n) Rebuild bei jedem `metricChanged`. Ersetzt durch **brute-force nearest-point** in `updateHoverOverlay()` — einfache O(n)-Schleife, kein Rebuild nötig, für ~4k Punkte < 1ms.

3. **Doppelte `pg.selectAll('circle.point')`** — Im mousemove/mouseleave wurden wiederholt Selektions-Queries ausgeführt. Jetzt wird die Selektion einmalig gehalten.

4. **Bundle-Größe:** JS von 119 kB → 100 kB reduziert (durch Wegfall von d3-Delaunay-Importen).

**Erreichte Performance:**
- Slider-Bewegung: ~2–5ms pro Frame (vorher ~50–100ms)
- Hover/Tooltip: < 1ms (vorher ~5–10ms wegen Delaunay-Rebuild)
- X-Achsen-Wechsel: ~20ms (vorher ~200ms)
- Keine gestauten Animation-Frames mehr
- Bundle um ~16% kleiner
| `pages/dashboard.vue` | Titel + Subtitle gekürzt |

---

## 49. Performance-Fix: `allPoints` entfernt, echter Data-Join bei `timeRangeChanged` (10.07.2026)

### Problem

Der Scatterplot lagerte **alle 85.000 Datenpunkte** in den DOM (via `allPoints`-computed) und blendete die außerhalb des Zeitraums liegenden Punkte nur per `style.display: none` aus. Das führte zu:
- ~85k DOM-`<circle>`-Elementen statt nur der gefilterten Menge (~4k–24k)
- Höherem Speicherverbrauch und langsameren Reflow-Operationen
- Verwirrender Code-Struktur (zwei Datenquellen: `allPoints` für Join, `rangePoints` für Trendlinie)

### Lösung

1. **`allPoints`-computed komplett entfernt** — Es gibt nur noch `rangePoints` (nach Datum gefiltert).
2. **`timeRangeChanged` macht jetzt einen echten D3-Data-Join** mit `rangePoints` — kein `style.display`-Toggling mehr.
3. **Einheitlicher Code-Pfad** für `init`, `metricChanged` und `timeRangeChanged`: Alle drei nutzen denselben Data-Join-Block.
4. **`performance.mark()` / `performance.measure()`** mit eindeutigen IDs (Reason + Timestamp) für saubere Profiling-Ergebnisse.
5. **`console.table()`-Kontrolle** nach jedem Join: zeigt `selectedPeriod`, `filteredPoints` und `circlesInDom`.

### Ergebnis

| Metrik | Vorher | Nachher |
|---|---|---|
| DOM-Circles | 85.000 (alle) | ~4.000–24.000 (nur gefilterte) |
| Speicher | Höher (85k DOM-Nodes) | Deutlich reduziert |
| Slider-Wechsel | `style.display`-Toggle | Sauberer Data-Join |
| Profiling | `console.time` (einfach) | `performance.mark`/`measure` (eindeutig) |
| Code-Klarheit | Zwei Datenquellen, schwer verständlich | Eine Datenquelle (`rangePoints`) |
| Verifikation | Manuelles Zählen | `console.table({filteredPoints, circlesInDom})` |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `components/viz/ScatterAnalysis.vue` | `allPoints` computed entfernt, `allPts`-Referenz entfernt, `timeRangeChanged` auf Data-Join umgestellt, `performance.mark`/`measure` eingeführt, `console.table`-Kontrolle hinzugefügt, doppelten `explain`-Block entfernt |
- - -  
 2 0 2 6 - 0 7 - 1 2   1 5 : 5 2  
  
 ## 12. Intro-Landingpage (Barbell-Chart) + Nuxt 4 Migration (12.07.2026)

### Nuxt-Update
- Nuxt von 3.21.8 → **4.4.8** aktualisiert (Vite-7-Kompatibilitätsproblem)
- `nuxt.config.ts`: `components`-Konfiguration mit `pathPrefix: false` für Prefix-freie Komponenten
- Dashboard-Komponenten (`DashboardFilterBar`, `DashboardKpiCard`, `VizStackedArea`) explizit importiert

### Neue Landingpage (ersetzt Timeline-Version)
- **`pages/index.vue`** – komplett neu: Intro-Seite mit 5 Abschnitten
- **`components/intro/IntroHero.vue`** – Eyebrow, Headline, Subline (linksbündig)
- **`components/intro/IntroTrustLine.vue`** – 3-spaltige Datenherkunft (Datenquellen, Zeitraum, Auflösung)
- **`components/intro/IntroBarbellChart.vue`** – D3-Barbell-Chart mit 9 Energieträgern, 2015 vs. 2024
  - Sortiert nach Veränderungsstärke (Kernenergie -16,8 pp bis Biomasse +0,4 pp)
  - Animation via IntersectionObserver (1,6 s Wachstum, 120 ms Staffelung)
  - Replay-Button (⟲ Animation) in der Legende
  - Kollisionserkennung: kombinierte Labels bei < 40 px Abstand
  - Hover hebt Zeile hervor
- **`components/intro/IntroMethodology.vue`** – Aufklappbare Methodik (`<details>`)
- **`components/intro/IntroCTA.vue`** – Textbasierter Dashboard-Link (redaktionell, kein Button)

### Daten
- **`public/data/energy_mix_yearly.json`** – 9 Energieträger mit share2015/share2024 (aus yearly_mix.json berechnet)
- **`composables/useEnergyMixData.ts`** – Loader mit Modul-Cache

### Bereinigt
- `components/landing/` (RecordTimeline, MilestoneCard, TimelineFilters, AnimatedStreamgraph, RacingBarChart)
- `composables/useLandingData.ts`, `useDashboardPreload.ts`
- `public/data/landing.json`, `scripts/build_landing.mjs`
- `package.json` build:landing-Script entfernt

### Bugs gefixt
1. **0,0%-Bug**: Konkurrierende D3-Transitions auf SVG-Text gefixt – einheitlicher `.transition()`-Call + `on('end')`-Callback
2. **Capsule-Wachstum**: Kapsel wächst jetzt immer vom 2015-Punkt (auch bei schrumpfenden Trägern)
3. **Kollidierende Labels**: Bei < 40 px Abstand kombiniertes Format „7,9 % → 8,3 %"
4. **CTA-Redesign**: Von Button zu redaktionellem Text-Link
5. **Reihenfolge**: CTA vor Methodology (Chart → CTA → Methodik)
