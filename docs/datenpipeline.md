# Datenpipeline & Datenberechnungen

> Erstellt am 2026-07-17 – vollständige Analyse des Datenflusses von der Quelle bis zur Visualisierung.

---

## 1. Überblick: Die Pipeline auf einen Blick

```
SMARD (API) ──→ smard.json ──┐
                              ├──→ build_hourly.ts ──→ hourly_2015_2024.json ──→ useData()
ENTSO-E (API) ─→ preise.json ─┘                                                    │
                                                                                   ├──→ Viz-Komponenten (Props)
UBA (CSV) ─────→ emission_factors.json ───────────────────────────────────────────┤
                                                                                   ├──→ build_yearly.ts ──→ yearly_mix.json ──→ useData()
                                                                                   │
                                                      energy_mix_yearly.json ←─────┘ (separat generiert)
                                                      landing.json ←─────────────── (separat generiert)
```

**Drei Datenquellen:**
1. **SMARD** (Bundesnetzagentur) – stündliche Erzeugungsdaten nach Energieträger
2. **ENTSO-E Transparency Platform** – Day-Ahead-Strompreise
3. **UBA** (Umweltbundesamt) – Emissionsfaktoren pro Energieträger

**Gesamtgröße der Pipeline:**
- Rohdaten: `smard.json` (~34 MB) + `preise.json` (~3,4 MB) = ~37 MB
- Verarbeitet: `hourly_2015_2024.json` (~XX MB, ~87.600 Zeilen)
- Jahresdaten: `yearly_mix.json` (10 Zeilen)

---

## 2. Schritt 1: Rohdaten-Beschaffung (Build-Scripts)

### 2.1 SMARD-Erzeugungsdaten — `scripts/download-smard.ts`

**Quelle:** SMARD API (`https://www.smard.de/app/chart_data/`)

**Abfrage:** 12 Energieträger + Last, je als eigener Filter (z. B. `braunkohle=1223`, `solar=4068`)

```
Filters:
  braunkohle: 1223       kernenergie: 1224      windOffshore: 1225
  wasserkraft: 1226       sonstigeKonventionelle: 1227
  sonstigeErneuerbare: 1228  biomasse: 4066      windOnshore: 4067
  solar: 4068             steinkohle: 4069       pumpspeicher: 4070
  erdgas: 4071            last: 410               residuallast: 4359
  pumpspeicherVerbrauch: 4387
```

**Fetch-Logik:**
- Ruft für jeden Filter `index_hour.json` ab → Liste aller verfügbaren Zeitblöcke ab 2015
- Lädt jeden Block mit Concurrency = 8 parallelen Requests
- Merged alle Filter per `timestamp` in ein Objekt pro Zeitpunkt
- Output: `public/data/smard.json` (Array von `{ timestamp, braunkohle, solar, last, … }`)

**Auffälligkeit:** Kein Rate-Limit-Handling, kein Retry bei Fehlern. Bei 12 Filtern × ~120 Blöcken = ~1.440 Requests.

### 2.2 ENTSO-E Preisdaten — `scripts/download-prices.ts`

**Quelle:** ENTSO-E Transparency API (`https://web-api.tp.entsoe.eu/api`)

**Abfrage:** Day-Ahead-Preis (DocumentType A44) für die deutsche Marktzone

**Besonderheit Marktgebietswechsel 2018:**
- Bis Sep 2018: Domain `10Y1001A1001A63L` (DE-AT-LU)
- Ab Okt 2018: Domain `10Y1001A1001A82H` (DE)
- Für 2018 werden zwei separate Abfragen gemacht und die Ergebnisse konkateniert

**Fetch-Logik:**
- Jahresweiser Abruf, monatsweise aufgeteilt (wegen API-Limits)
- XML-Parsing: sucht `<Period>`-Blöcke mit `<resolution>PT60M</resolution>`
- Extrahiert `<price.amount>` pro `<Point>`
- Rate-Limit-Handling bei HTTP 429: 30 Sekunden warten + Retry
- Output: `public/data/preise.json` (Array von `{ timestamp, price }`)

### 2.3 Emissionsfaktoren — `emission_factors.json`

Manuell erstellte Datei mit UBA-Referenzwerten:

```json
{
  "braunkohle": 1075,    "steinkohle": 835,  "erdgas": 411,
  "sonstigeKonventionelle": 750, "biomasse": 230,
  "sonstigeErneuerbare": 100,
  "wasserkraft": 0,      "windOnshore": 0,   "windOffshore": 0,
  "solar": 0,            "kernenergie": 0,   "pumpspeicher": 0
}
```

**Fachliche Anmerkung:** Kernenergie hat Faktor 0 (keine direkten CO₂-Emissionen). Ebenso alle Erneuerbaren außer Biomasse (230 g/kWh) und "sonstige Erneuerbare" (100 g/kWh). Pumpspeicher wird als Verbraucher mit 0 behandelt.

---

## 3. Schritt 2: Daten-Join & Berechnung (Build-Pipeline)

### 3.1 `build_hourly.ts` – Die zentrale Pipeline

**Input:** `smard.json` + `preise.json` + `emission_factors.json`  
**Output:** `hourly_2015_2024.json`  
**Aufruf:** `bun run scripts/build_hourly.ts`

#### Ablauf im Detail:

```
smard.json ──┐
             ├── INNER JOIN auf timestamp ──→ Berechnung ──→ hourly_2015_2024.json
preise.json ─┘
```

#### 1. Join
- INNER JOIN: Nur Zeilen, die in **beiden** Datensätzen existieren, werden übernommen
- Zeilen mit `timestamp >= 2025-01-01` werden gefiltert (API-Randartefakte)
- Preis-Lookup über `Map` für O(1)-Zugriff

#### 2. Feld-Mapping: Deutsch → Englisch
```typescript
FIELD_MAP = {
  braunkohle: 'lignite',           kernenergie: 'nuclear',
  windOffshore: 'wind_offshore',  wasserkraft: 'hydro',
  sonstigeKonventionelle: 'other_fossil',
  sonstigeErneuerbare: 'other_renewables',
  biomasse: 'biomass',             windOnshore: 'wind_onshore',
  solar: 'pv',                     steinkohle: 'hardcoal',
  pumpspeicher: 'pumped_storage',  erdgas: 'gas',
}
```

#### 3. Berechnungen pro Zeile

| Feld | Formel | Rundung |
|---|---|---|
| `generation_by_source.{en}` | `punkt[de] ?? 0` | `Math.round(v * 100) / 100` (2 Dez.) |
| `total_generation` | Σ aller `punkt[deField]` | `Math.round(v * 100) / 100` |
| `ee_share` | `(eeSum / totalGen) * 100` | `Math.round(v * 10) / 10` (1 Dez.) |
| `fossil_share` | `(fossilSum / totalGen) * 100` | `Math.round(v * 10) / 10` (1 Dez.) |
| `co2_g_per_kwh` | `Σ(source * faktor) / totalGen` | `Math.round(v * 10) / 10` (1 Dez.) |
| `price_eur_mwh` | `preisMap.get(ts)` | `Math.round(v * 100) / 100` (2 Dez.) |
| `load_mwh` | `punkt.last ?? 0` | `Math.round(v * 100) / 100` |

#### 4. EE vs. Fossil – Abgrenzung

**Erneuerbare (EE_FIELDS):** biomasse, wasserkraft, windOnshore, windOffshore, solar, sonstigeErneuerbare

**Fossil (implizit):** Alle NICHT-Erneuerbaren außer `pumpspeicher` (pumped_storage wird weder EE noch Fossil zugeordnet)

**Wichtig:** `fossil_share` = Lignite + Hardcoal + Gas + Nuclear + Other_fossil. Kernenergie wird hier als "fossil" gezählt, obwohl sie keine CO₂-Emissionen verursacht. Die Benennung ist irreführend – fachlich korrekt wäre "konventioneller Anteil".

### 3.2 `build_yearly.ts` – Jahres-Aggregation

**Input:** `hourly_2015_2024.json`  
**Output:** `yearly_mix.json`

#### Berechnungen:
```typescript
proJahr = {
  year: number,
  count: number,          // Stunden im Jahr
  negStunden: number,     // Stunden mit price < 0
  co2Sum: number,         // Summe der co2_g_per_kwh
  eeShareSum: number,     // Summe der ee_share
  sourceSums: { ... },    // Σ MWh pro Energieträger
}
```

**Output pro Jahr:**
| Feld | Berechnung |
|---|---|
| `avg_co2` | `Math.round((co2Sum / count) * 10) / 10` |
| `avg_ee_share` | `Math.round((eeShareSum / count) * 10) / 10` |
| `sources` | `Math.round(sum * 100) / 100` pro Träger in MWh |
| `neg_stunden` | absolute Stundenanzahl |

### 3.3 `energy_mix_yearly.json` (für IntroBarbellChart)

**Herkunft:** Unabhängig generiert (Skript nicht im Workspace). Enthält vorberechnete Anteile für 2015 vs. 2024 als Referenzwerte für die Landingpage.

### 3.4 `landing.json` (für Landingpage)

**Herkunft:** Build-Script `scripts/build_landing.mjs`. Enthält vorberechnete Meilensteine, Wochenaggregate und Detaildaten. Spart ~35 MB Ladevolumen.

---

## 4. Schritt 3: Clientseitiges Daten-Loading (Runtime)

### 4.1 Loader-Architektur

Alle drei Loader (`useData`, `useEnergyMixData`, `useLandingData`) folgen dem gleichen Pattern:

```
Module-Level Cache (Variable)
       │
       ├── gecached? ──→ sofort zurück
       │
       └── Promise läuft bereits? ──→ gleiche Promise teilen
                │
                └── fetch('/data/…') → json() → cache setzen → zurück
```

**Vorteil:** Kein doppelter Fetch bei parallelen Aufrufen.  
**Nachteil:** Manuell in jeder Datei implementiert (3× Boilerplate).

### 4.2 Verwendete Datenquellen

| Loader | Datei | Verwendung |
|---|---|---|
| `useData().loadHourly()` | `/data/hourly_2015_2024.json` | **Alle** Viz-Komponenten, KPI-Berechnung, Aggregation |
| `useData().loadYearly()` | `/data/yearly_mix.json` | KPI-Sparklines (Jahresübersicht) |
| `useData().loadFactors()` | `/data/emission_factors.json` | (Deklariert, wird in keiner Komponente direkt verwendet) |
| `useEnergyMixData().load()` | `/data/energy_mix_yearly.json` | `IntroBarbellChart` |
| `useLandingData().load()` | `/data/landing.json` | Landingpage (IntroHero, IntroCTA) |

**Auffälligkeit:** `loadFactors()` ist implementiert, wird aber nirgendwo im Frontend aufgerufen – die CO₂-Berechnung findet bereits in `build_hourly.ts` statt und ist in den Daten enthalten.

---

## 5. Schritt 4: Clientseitige Aggregation

### 5.1 `utils/aggregate.ts` – Die zentrale Aggregationsfunktion

**Verwendet von:** `dashboard.vue` (computed `monthlyData`), `StackedArea.vue` (im `watchEffect`)

**Parameter:**
```typescript
aggregate(rows, {
  level: 'tag' | 'woche' | 'monat' | 'quartal',  // Default: monat
  trackCo2?: boolean,                              // CO₂-Summe mitschreiben
  gapThreshold?: number                            // Default: 0.1 (10%)
})
```

**Ablauf:**

1. **Key-Generierung** (abhängig vom Level):
   - `tag`: `getBerlinDateKey(ts)` → `"2024-06-15"`
   - `woche`: ISO-KW-Berechnung via Berliner Lokalzeit → `"2024-W25"`
   - `monat`: `"2024-06"`
   - `quartal`: `"2024-Q2"`

2. **Bucket-Sammlung** (Map-Array):
   ```
   Pro Bucket: { date, total, hours, co2Sum, co2Count, biomass, hydro, …, pumped_storage }
   ```
   - Alle 12 Energieträger werden als MWh aufsummiert
   - `total` = Σ aller `generation_by_source`-Werte
   - `hours` = Anzahl der enthaltenen Stunden

3. **Lücken-Erkennung:**
   ```typescript
   const expected = { tag: 1, woche: 168, monat: 730, quartal: 2190 }
   const isGap = (bucket.hours / expected) < gapThreshold  // Default: < 10%
   ```
   - Buckets mit zu wenigen Stunden erhalten `_gap: true`
   - Visualizationen können dies auswerten (StackedArea setzt `NaN` für Stacks)

4. **Sortierung** nach Datum (aufsteigend)

### 5.2 Berliner Lokalzeit — `utils/berlin.ts`

Alle Zeitberechnungen nutzen `Europe/Berlin` via `Intl.DateTimeFormat`:
```typescript
const hourFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric' })
const yearFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' })
// …
```

**Wichtig:** Die Rohdaten (`smard.json`) enthalten UTC-Timestamps. Die Umrechnung in Berliner Lokalzeit (inkl. Sommer-/Winterzeit) erfolgt **ausschließlich clientseitig** in `berlin.ts`.

**Verwendete Funktionen:**
| Funktion | Rückgabe | Verwendung |
|---|---|---|
| `getBerlinHour(ts)` | 0–23 | Heatmap, ScatterAnalysis, HourlyProfile |
| `getBerlinYear(ts)` | 2015–2024 | Filter, KPI-Berechnung |
| `getBerlinMonth(ts)` | 1–12 | Heatmap, Aggregation |
| `getBerlinDay(ts)` | 1–31 | ScatterAnalysis |
| `getBerlinWeekday(ts)` | 0–6 | Weekend-Erkennung |
| `isBerlinWeekend(ts)` | boolean | HourlyProfile |
| `getBerlinDateKey(ts)` | "YYYY-MM-DD" | Aggregation (tag) |
| `getBerlinMonthKey(ts)` | "YYYY-MM" | – |

---

## 6. Schritt 5: Dashboard-Berechnungen (Runtime-Composables)

### 6.1 `useFilters.ts` – KPI-Filter

Drei Modi steuern die KPI-Anzeige:

| Modus | Filter-Logik | Sparkline |
|---|---|---|
| `gesamt` | Kein Filter (alle Stunden) | Jahreswerte 2015–2024 |
| `jahr` | `getBerlinYear(ts) === state.year` | Monatswerte des Jahres |
| `vergleich` | Zwei separate Jahr-Filter | Jahreswerte zwischen base und compare |

### 6.2 `dashboard.vue` – computed `kpis` (die KPI-Berechnung)

**Einzige clientseitige KPI-Logik** – hier werden die 4 KPIs berechnet:

| KPI | Wertequelle | Sparkline-Quelle |
|---|---|---|
| `EE-Anteil` | `yearly.avg_ee_share` (oder live) | Jahresmittel oder Monatsmittel |
| `CO₂-Intensität` | `yearly.avg_co2` (oder live) | Jahresmittel oder Monatsmittel |
| `Day-Ahead-Preis` | Live aus `hourly` (Jahresdurchschnitt) | Jahresmittel oder Monatsmittel |
| `Negativpreis-Stunden` | Live aus `hourly` (Zählung) | Absolute Anzahl pro Jahr/Monat |

**Berechnungslogik (pro Feld):**
```typescript
// Jahres-Modus: live aus hourly (weil yearly kein avg_price hat)
yearlyValues('price'):  // ∀ Jahr: Mittelwert aller stündlichen Preise
yearlyValues('neg'):    // ∀ Jahr: Anzahl Stunden mit price < 0
yearlyValues('ee'):     // aus yearly.avg_ee_share
yearlyValues('co2'):    // aus yearly.avg_co2

// Einzeljahr-Modus: live aus hourly (für Sparkline)
monthlyValues(year, field):  // 12 Monats-Mittelwerte
```

**Delta-Berechnung:**
| Modus | Delta |
|---|---|
| `gesamt` | Letztes minus erstes Jahr (z. B. 2024 − 2015) |
| `jahr` | Ausgewähltes Jahr minus Vorjahr |
| `vergleich` | Compare-Jahr minus Base-Jahr |

**Auffälligkeit:** Für `price` und `neg` gibt es keine vorberechneten Jahreswerte in `yearly_mix.json` – sie werden jedes Mal live aus den 87.600 Stunden berechnet. Der `yearlyValues('price')`-Helper iteriert über **alle** Stunden.

### 6.3 `useExtremeValues.ts` – Extremwert-Berechnung

**Input:** `MonthlyDataPoint[]` (aggregierte Buckets)  
**Output:** Drei `ExtremeValueResult`-Objekte

| Ergebnis | Logik |
|---|---|
| `highestRenewableShare` | Bucket mit max. EE-Anteil (Σ 6 EE-Keys / total) |
| `highestFossilGeneration` | Bucket mit max. konventioneller Erzeugung (Σ 5 fossile Keys) |
| `largestChange` | Differenz zwischen erstem und letztem Bucket, prozentual (Anteile) oder absolut (MWh) |

**Berechnungsdetails:**
```typescript
RENEWABLE_KEYS = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro', 'other_renewables']
CONVENTIONAL_KEYS = ['lignite', 'hardcoal', 'gas', 'nuclear', 'other_fossil']
// pumped_storage wird nie mitgezählt

// Absolute Mode (MWh):
largestChange = Δ zwischen erstem und letztem Bucket, je nach Modus

// Percent Mode (Anteile):
largestChange = Δ der prozentualen Anteile am Strommix
```

**Kontext-Berechnung:** Die Kontext-Zeile zeigt, wie weit der Extremwert vom Durchschnitt abweicht (in Prozentpunkten).

### 6.4 `useStartEndComparison.ts` – Barbell-Berechnung

**Input:** `MonthlyDataPoint[]`  
**Output:** Top-3-Veränderungen zwischen erstem und letztem Bucket

```typescript
// Für jeden der 12 Keys:
shareStart = first[key] / first.total
shareEnd   = last[key] / last.total
delta      = shareEnd - shareStart  // in Prozentpunkten

// Sortieren nach |delta|, Top 3 nehmen
```

---

## 7. Datenfluss pro Visualisierung

```
hourly_2015_2024.json
│
├──→ StackedArea: Prop → aggregate() → d3.stack() → Rendering
│
├──→ HeatmapCO2: Prop → computeMonthlyHeatmap() → d3.scaleLinear → Rendering
│
├──→ ScatterAnalysis: Prop → filter + domain → d3.scatter + d3.contourDensity → Rendering
│
├──→ HourlyProfile: Prop → computeProfile() (Modus-Filter) → d3.line → Rendering
│
├──→ Dashboard KPIs: live-Berechnung → 4 × KpiCard (mit Sparkline)
│
├──→ monthlyData (aggregiert in dashboard.vue)
│   ├──→ ExtremeValuesPanel: useExtremeValues() → 3 Kacheln
│   └──→ StartEndComparison: useStartEndComparison() → Barbell-Plot
│
yearly_mix.json
│
└──→ Dashboard KPIs: avg_ee_share + avg_co2 für Sparklines
│
energy_mix_yearly.json
│
└──→ IntroBarbellChart: Prop → d3.scaleLinear → Barbell-Plot
│
landing.json
│
└──→ Landingpage: IntroHero, IntroCTA (Milestones, Weekly Records)
```

---

## 8. Daten-Validierung & Audit

### 8.1 Audit-Levels

Das Projekt hat ein **3-stufiges Audit-System**:

| Level | Skript | Prüfung |
|---|---|---|
| Level 1 | `scripts/checks/level1-integrity.ts` | Rohdaten-Integrität (Stunden/Jahr, Lücken, DST, Null-Werte, Wertebereiche, Summen-Konsistenz) |
| Level 2 | `vitest run` (Tests) | Unit-Tests für Logik-Funktionen |
| Level 3 | `scripts/checks/level3-consistency.ts` | Konsistenz zwischen hourly/yearly (EE-Anteil, CO₂, Preise, Sparklines) |

### 8.2 Level-1-Prüfungen (Integrität)

| Check | Erwartung | Bekannte Abweichung |
|---|---|---|
| Stunden/Jahr (außer 2018) | 8760/8784 | 2018: ~6600 (ENTSO-E-Marktgebietswechsel) |
| Zeitreihen-Kontinuität | Lückenlos | Nur 2018er-Lücke, ~2200 fehlende Stunden |
| DST-Umstellung | 23h/25h-Tage im März/Oktober | Sollte korrekt sein |
| Null-Werte PV | ~50% (nachts) | Normal |
| Wertebereich pro Träger | Plausible GW-Grenzen | - |
| Σ Erzeugung vs. Last | ±15% | pumped_storage + Import/Export fehlen |

### 8.3 Level-3-Prüfungen (Konsistenz)

| Check | Toleranz |
|---|---|
| EE-Anteil 2024: hourly vs. yearly_mix | 0,1% |
| CO₂ 2024: hourly vs. yearly_mix | 0,1% |
| Sparkline-Konsistenz (alle Jahre) | EE: 0,1 PP, CO₂: 0,5 g/kWh, Negativ: 1 h |

### 8.4 Zusätzliche Analyse-Scripts

| Skript | Zweck |
|---|---|
| `scripts/analyze-other-category.mjs` | Analysiert die Zusammensetzung von "other_renewables + other_fossil + pumped_storage" |
| `scripts/analyze-rounding.mjs` | Misst den Rundungsfehler von `Math.round()` in der Pipeline |
| `scripts/validate-data.ts` | Prüft JSON-Struktur und gültige Werte |
| `scripts/check-dashboard-data.ts` | Validiert Dashboard-Daten-Konsistenz |

---

## 9. Kritische Beobachtungen & Verbesserungsvorschläge

### 9.1 🔴 `co2_g_per_kwh` wird in `build_hourly.ts` berechnet, `loadFactors()` im Frontend nie genutzt

Die CO₂-Berechnung findet vollständig build-time statt. Die Methode `loadFactors()` ist im Composable deklariert, wird aber von keiner Komponente aufgerufen. Kann entfernt werden, sofern keine Live-Neuberechnung geplant ist.

### 9.2 🔴 `yearly_mix.json` enthält `avg_co2` (einfacher Mittelwert), nicht `gewichteter` Durchschnitt

`build_yearly.ts` berechnet `avg_co2` als `Σ(co2_g_per_kwh) / count`. Das ist der einfache Mittelwert aller Stunden-CO₂-Werte. Da `co2_g_per_kwh` in `build_hourly.ts` bereits als **erzeugungsgewichteter** Durchschnitt pro Stunde berechnet wurde, ist der jährliche Mittelwert korrekt **nur dann**, wenn alle Stunden gleich viele MWh erzeugen – was nicht stimmt. Fachlich korrekt wäre: `Σ(co2Sum) / Σ(totalGen)` pro Jahr.

**Praktische Auswirkung:** Der Fehler ist vermutlich klein (< 1 %), weil die CO₂-Intensität pro MWh normiert ist – der jährliche Mittelwert über die Stunden ist faktisch der mit der Erzeugung gewichtete Durchschnitt, **wenn man jede Stunde als gleichgewichtig betrachtet** – was fachlich korrekt ist, da `co2_g_per_kwh` bereits pro MWh ist.

### 9.3 🟡 `price` und `neg` werden live berechnet, nicht gecached

`yearly_mix.json` enthält keine `avg_price` oder `neg_stunden`-Felder (obwohl `neg_stunden` im Skript berechnet wird → im Output). Warte: doch, `neg_stunden` ist im Output enthalten. Aber `avg_price` fehlt – der durchschnittliche Jahrespreis wird jedes Mal durch Iteration aller 87.600 Stunden berechnet.

**Lösung:** `avg_price` zu `yearly_mix.json` hinzufügen.

### 9.4 🟡 `utils/aggregate.ts` berechnet `total` neu statt aus vorhandenen Daten

In `aggregate()` wird `total` als Σ aller `generation_by_source`-Werte neu berechnet. Der Wert existiert bereits in `HourlyRow` nicht – fair. Aber die Summe über 12 Quellen pro Stunde × 87.600 Stunden × 12 Aggregationen ist rechenintensiv. Ein vorberechnetes `total_mwh`-Feld in `HourlyRow` würde helfen.

### 9.5 🟡 Drei Loader mit identischem Caching-Pattern

`useData`, `useEnergyMixData`, `useLandingData` – alle haben das gleiche `module-level cache + shared promise`-Pattern. Einmal in einen generischen `useJsonCache<T>(url)`-Wrapper ausgelagert, spart das ~50 Zeilen Boilerplate.

### 9.6 🟢 `fossil_share` inkludiert Kernenergie

Der Name `fossil_share` ist fachlich ungenau, da Kernenergie (Faktor 0) enthalten ist. Im Dashboard wird der Begriff "Konventioneller Anteil" verwendet, was korrekt ist. Die JSON-Daten heißen aber `fossil_share`.

### 9.7 🟢 2018-Datenlücke: Nur ~6.600 statt 8.760 Stunden

Durch den ENTSO-E-Marktgebietswechsel fehlen ab Oktober 2018 rund 25 % der Stundenpreise. Diese Stunden existieren im SMARD-Datensatz, fallen aber durch den INNER JOIN in `build_hourly.ts` heraus. Die Lücke ist dokumentiert und bekannt.

---

## 10. Flussdiagramm: Daten von API → Bildschirm

```mermaid
flowchart TD
    A["SMARD API<br/>(12 Quellen + Last)"] -->|download-smard.ts| B[smard.json<br/>~34 MB]
    C["ENTSO-E API<br/>(Day-Ahead-Preis)"] -->|download-prices.ts| D[preise.json<br/>~3,4 MB]
    E["UBA<br/>(CO₂-Faktoren)"] -->|manuell| F[emission_factors.json]

    B --> G{build_hourly.ts}
    D --> G
    F --> G

    G --> H[hourly_2015_2024.json<br/>~87.600 Zeilen]

    H --> I{build_yearly.ts}
    I --> J[yearly_mix.json<br/>10 Zeilen]

    H --> K["fetch('/data/hourly_2015_2024.json')"]
    J --> L["fetch('/data/yearly_mix.json')"]

    K --> M[useData().loadHourly]

    M --> N[Aggregation<br/>utils/aggregate.ts]
    M --> O[KPI-Berechnung<br/>dashboard.vue]
    M --> P["Props an Viz:<br/>StackedArea, Heatmap,<br/>Scatter, HourlyProfile"]

    N --> Q[monthlyData<br/>computed]
    Q --> R[ExtremeValuesPanel]
    Q --> S[StartEndComparison]

    O --> T["4× KpiCard<br/>(Sparkline + Delta)"]
    O --> L

    P --> U[StackedArea<br/>d3.stack + d3.zoom]
    P --> V[HeatmapCO2<br/>d3.scaleLinear]
    P --> W[ScatterAnalysis<br/>d3.contourDensity]
    P --> X[HourlyProfile<br/>d3.line]
```
