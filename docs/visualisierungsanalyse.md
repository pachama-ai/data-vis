# Visualisierungs- / Dashboard-Analyse

> Erstellt am 2026-07-17 – alle Angaben basieren auf dem Code-Stand im Workspace.

---

## Übersichtstabelle

| Name | Datei (Component) | Zweck | Komplexität | Datenquelle |
|---|---|---|---|---|
| **StackedArea** | `components/viz/StackedArea.vue` | Gestapelte Fläche: Entwicklung der Stromerzeugung nach Energieträgern | ⭐⭐⭐⭐⭐ | `useData().loadHourly()` → JSON-Fetch aus `/data/hourly_2015_2024.json` |
| **HeatmapCO2** | `components/viz/HeatmapCO2.vue` | Monatliche Heatmap 24h×12 Mo. der CO₂-Intensität u. a. Metriken | ⭐⭐⭐⭐⭐ | gleiche `hourly`-Prop wie StackedArea |
| **ScatterAnalysis** | `components/viz/ScatterAnalysis.vue` | Streudiagramm CO₂-Einflussfaktoren (EE-Anteil, Nachfrage, Preis) | ⭐⭐⭐⭐⭐ | gleiche `hourly`-Prop |
| **HourlyProfile** | `components/viz/HourlyProfile.vue` | Tagesprofile PV, Residuallast, Preis, CO₂ nach Modus | ⭐⭐⭐⭐⭐ | gleiche `hourly`-Prop |
| **ExtremeValuesPanel** | `components/dashboard/ExtremeValuesPanel.vue` | Drei Extremwert-Kacheln mit D3-Animation | ⭐⭐⭐ | aggregierte `monthlyData` (via `useExtremeValues`) |
| **StartEndComparison** | `components/dashboard/StartEndComparison.vue` | Barbell-Vergleich: Top-3-Veränderungen im Zeitraum | ⭐⭐⭐⭐ | aggregierte `monthlyData` (via `useStartEndComparison`) |
| **KpiCard** | `components/dashboard/KpiCard.vue` | KPI-Karte mit Sparkline + Hover-Sync | ⭐⭐⭐ | berechnet in `dashboard.vue` (computed `kpis`) |
| **IntroBarbellChart** | `components/intro/IntroBarbellChart.vue` | Barbell-Chart Strommix 2015 vs. 2024 auf Landingpage | ⭐⭐⭐⭐ | `useEnergyMixData().load()` → `/data/energy_mix_yearly.json` |

---

## Detail-Abschnitte

---

### 1. StackedArea — Gestapelte Fläche

**Datei:** `components/viz/StackedArea.vue`  
**Component-Name:** `VizStackedArea` (in `dashboard.vue` als `VizStackedArea` registriert via explizitem Import)

#### Zweck
Zeigt die zeitliche Entwicklung der deutschen Stromerzeugung nach Energieträgern als gestapelte Fläche. Der User kann zwischen absoluter (MWh) und prozentualer Darstellung umschalten sowie die Aggregation (Tag/Woche/Monat/Quartal) wählen. Interaktiver Zoom auf Zeiträume und Anklickbare Legende zum Ein-/Ausblenden von Energieträgern.

#### Datenquelle
- **Prop:** `data: HourlyRow[]` – wird von `dashboard.vue` via `useData().loadHourly()` geladen
- **Rohdaten:** `/data/hourly_2015_2024.json` (SMARD-Erzeugungsdaten + Preise)
- **Aggregation:** über die zentrale `aggregate()` aus `utils/aggregate.ts` (clientseitig)

#### Datenverarbeitung
1. Stunden-Daten werden via `aggregate(rows, { level, trackCo2: true })` in Tag/Woche/Monat/Quartal-Buckets gefasst
2. `d3.stack()` erzeugt die gestapelten Serien
3. Bei Prozent-Modus: `d3.stackOffsetExpand`
4. Datenlücken werden als `_gap` markiert und im Stack als `NaN` gesetzt
5. Zoom über `zoomDomain`-Ref (wird über `d3.zoom` oder Reset-Button gesteuert)

#### Umsetzung / Tech-Stack
- **D3.js** (`d3-scale`, `d3-shape`, `d3-array`, `d3-selection`, `d3-zoom`)
- SVG-basiert (kein Chart-Wrapper)
- Eigener Tooltip (D3-Selection auf `div`)
- 8 historische Event-Marker unter der X-Achse (Pariser Abkommen, Ukraine-Krieg, AKW-Abschaltung etc.)
- Gap-Detection via `aggregate()` (Bucket mit <10% erwarteter Stunden gilt als Lücke)

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek (kein Tree-Shaking) |
| **Daten-Aggregation** | `d3.stack().keys(…).value(…)` | Erzeugt gestapelte Serien aus den Energieträger-Spalten |
| **Stack-Offset** | `d3.stackOffsetExpand` | Normalisiert auf 100 % für Prozent-Modus |
| **Zeit-Skala** | `d3.scaleTime().domain(…).range(…)` | X-Achse: Datum → Pixel |
| **Linear-Skala** | `d3.scaleLinear().domain([0, yMax]).range([H, 0])` | Y-Achse: Wert → Pixel |
| **D3-Area** | `d3.area().x().y0().y1().curve(d3.curveMonotoneX)` | Zeichnet die gestapelten Flächen mit Glättung |
| **DOM-Selection** | `d3.select(svgRef.value)` | Bindet an das `<svg>`-Element |
| **Achsen** | `d3.axisBottom(xScale)`, `d3.axisLeft(yScale)` | X- und Y-Achsen mit `tickFormat()` |
| **Zeit-Formatierung** | `d3.timeFormat('%Y')`, `d3.timeYear.every(1)` | Jahreszahlen auf X-Achse |
| **Zoom** | `d3.zoom().scaleExtent([0.3,30]).on('zoom', …)` | Interaktives Scroll-Zoomen auf Zeitachse |
| **Bisector (Tooltip)** | `d3.bisector((d) => d.date).left` | Binäre Suche für Tooltip-Position |
| **Pointer** | `d3.pointer(event)` | Mausposition im SVG-Koordinatensystem |
| **Extent** | `d3.extent(data, (d) => d.date)` | Min/Max des Datumsbereichs |
| **Max** | `d3.max(stacked, (s) => d3.max(s, (d: any) => d[1]))` | Maximaler Y-Wert über alle Stacks |
| **Number-Format** | `d3.format('.1f')` | Ein Nachkommastelle für Y-Achsen-Beschriftung |
| **Selektionen** | `.attr()`, `.style()`, `.call()`, `.append()`, `.remove()`, `.selectAll()` | DOM-Manipulation für SVG-Elemente |
| **Event-Marker** | `.on('mouseenter', …)`, `.on('mouseleave', …)` | Hover-Interaktionen auf Markern |
| **Tooltip** | `d3.select('body').append('div').style(…)` | Eigenes Tooltip-`<div>` (kein HTML-Tooltip) |

#### Abhängigkeiten
- **Verwendet:** `~/utils/aggregate` (aggregate), `~/composables/useData` (HourlyRow-Typ)
- **Verwendet von:** `dashboard.vue` (Überblick-Tab)
- **Emits:** `visibleRangeChange`, `aggLevelChange`, `modeChange`

#### Auffälligkeiten
- Die `COLORS`/`LABELS`/`ALL_KEYS`-Konstanten sind **3-fach dupliziert**: in `StackedArea.vue`, `useExtremeValues.ts` und `useStartEndComparison.ts`. Ein TODO-Kommentar weist darauf hin ("irgendwann in shared file").
- Die Event-Marker sind hartkodiert. Bei Datenaktualisierung über 2024 hinaus müssten sie ergänzt werden.
- `ALL_MONTHS`-Konstante in Zeile 53 existiert auch redundant in `HeatmapCO2.vue`.
- `aggregate()` wird direkt im `watchEffect` verwendet – bei jedem Rendering neu berechnet. Potenziell Performance-Problem bei großen Datenmengen.

---

### 2. HeatmapCO2 — Monatliche Heatmap

**Datei:** `components/viz/HeatmapCO2.vue`  
**Component-Name:** `VizHeatmapCO2` (lazy via `defineAsyncComponent` in `dashboard.vue`)

#### Zweck
Zeigt eine 24×12-Matrix (Stunde × Monat) farbcodiert für wählbare Metriken: CO₂-Intensität, EE-Anteil, konventioneller Anteil, Day-Ahead-Preis. Der User kann das Jahr und den Skalierungsmodus (Jahresvergleich vs. Muster im Jahr) wählen. Klick auf eine Zelle wählt einen Tag aus und gibt ihn an `HourlyProfile` weiter.

#### Datenquelle
- **Prop:** `data: HourlyRow[]` (gleicher Datensatz wie StackedArea)
- **Rohdaten:** `/data/hourly_2015_2024.json`

#### Datenverarbeitung
1. `computeMonthlyHeatmap()` mittelt alle Stunden pro (Monat, Stunde) über D3
2. Berliner Lokalzeit via `getBerlinHour`, `getBerlinMonth`, `getBerlinYear`
3. Vier Metriken mit eigener Farbskala (einfarbig oder divergierend für Preis)
4. Zwei Scale-Modi: `einheitlich` (feste Domäne für Jahresvergleich) und `jaehrlich` (dynamisch pro Jahr)
5. Sidebar zeigt Extremwerte + Monat mit größter Spannweite

#### Umsetzung / Tech-Stack
- **D3.js** (`d3-scale`, `d3-selection`, `d3-interpolate`)
- SVG-basiert mit ResizeObserver
- Tooltip beim Hovern über Zellen
- Container-Resize-Listener
- Umfangreiche Farbskalen-Logik mit Sonderfällen für divergierende Metriken

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` (implizit, da global) | Gesamte D3-Bibliothek |
| **Lineare Skala (einfarbig)** | `d3.scaleLinear<string>().domain([0, dataMax]).range(['#F5F5F0', '#B85C3A']).clamp(true)` | Farbskala für EE/Fossil-Metriken |
| **Lineare Skala (divergierend)** | `d3.scaleLinear<string>().domain([dataMin, 0, dataMax]).range(['#4A90A4', '#F5F5F0', '#D97742']).clamp(true)` | Preis-Metrik mit Nullpunkt als Bedeutungsschwelle |
| **Sequenzielle Skala** | `d3.scaleSequential(d3.interpolateRgb(colorLo, colorHi)).domain([dataMin, dataMax])` | Alternative einfarbige Skala (z. B. CO₂) |
| **DOM-Selection** | `d3.select(svgEl)`, `.selectAll('rect')` | SVG-Elemente binden und manipulieren |
| **Data-Join** | `.data(flat).join('rect')` | Erzeugt `<rect>`-Zellen für jede Stunde×Monat-Kombination |
| **Attribute setzen** | `.attr('x',…)`, `.attr('y',…)`, `.attr('fill', (d) => colorScale(d.value))` | Position und Farbe der Heatmap-Zellen |
| **Mouse-Events** | `.on('mouseenter', …)`, `.on('mousemove', …)`, `.on('mouseleave', …)` | Zellen-Hover mit Tooltip und Hervorhebung |
| **Gradient (Legende)** | `linearGradient` mit `<stop>`-Elementen | Verlaufsbalken in der Farblegende |
| **D3-Min/Max** | `d3.min(allVals)`, `d3.max(allVals)` | Datenbereich für Farbskala |
| **Text-Elemente** | `svg.append('text').attr(…).text(…)` | Stunden-Labels (Y-Achse) und Monats-Labels (X-Achse) |
| **Linien** | `svg.append('line').attr(…)` | Gitterlinien zwischen Monaten und Stunden |
| **Tooltip (eigenes div)** | `d3.select('body').append('div').style(…)` | Positioniertes Tooltip-`<div>` |

#### Abhängigkeiten
- **Verwendet:** `~/utils/berlin` (getBerlinYear, getBerlinMonth, getBerlinHour), `~/composables/useData` (HourlyRow-Typ)
- **Verwendet von:** `dashboard.vue` (Tagesmuster-Tab, lazy loaded)
- **Emits:** `day-selected`

#### Auffälligkeiten
- Die vier Metriken sind als Array definiert, aber die Sidebar (`sidebarExtremes`) hat noch hartkodierte Sonderbehandlungen pro Metrik.
- `ALL_MONTHS` (Zeile 53) wird auch in `StackedArea.vue` benötigt – doppelt.
- `getFlatData` und `computeMonthlyHeatmap` werden in `sidebarExtremes` zweimal aufgerufen (für Daten und für Extremwerte) – Performance-Optimierung möglich.
- Tooltip-Logik ist teilweise in `onMounted` + `watch`, teilweise in der Sidebar (uneinheitliches Pattern).

---

### 3. ScatterAnalysis — Streudiagramm

**Datei:** `components/viz/ScatterAnalysis.vue`  
**Component-Name:** `VizScatterAnalysis` (lazy via `defineAsyncComponent`)

#### Zweck
Untersucht den Zusammenhang zwischen wählbaren Einflussfaktoren (EE-Anteil, Stromnachfrage, Preis, konventioneller Anteil) und der CO₂-Intensität. Unterstützt zwei Darstellungsmodi: Punkte (nach Tageszeit eingefärbt) und Kontur-Dichteplot. Vergleichsmodus zwischen zwei Zeiträumen via Range-Slider.

#### Datenquelle
- **Prop:** `data: HourlyRow[]`
- **Rohdaten:** `/data/hourly_2015_2024.json`

#### Datenverarbeitung
1. Feste X/Y-Domains über den gesamten Datensatz (damit Achsen bei Zeitraumwechsel nicht springen)
2. Filter auf sichtbaren Zeitraum (Range-Slider)
3. Tageszeit-Färbung (Nacht/Morgen/Tag/Abend) mit Multi- (Punkte) / Single-Select (Kontur)
4. Kontur-Dichteplot via D3 (vermutlich `d3-contour`, nicht vollständig gelesen)
5. Trendlinie (vermutlich `d3-regression` oder selbst berechnet)

#### Umsetzung / Tech-Stack
- **D3.js** (Scales, Shapes, Contour, Selection, Geo-Path)
- SVG-basiert
- Benutzerdefinierter Range-Slider (kein natives `<input type="range">`)
- Toggle-Legende für Tageszeiten
- Preset-Buttons für Zeiträume (Alles, 2015/16, 2017/18, …)

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek |
| **Lineare Skalen** | `d3.scaleLinear().domain(xDomain).range([0, INNER_W])` | X- und Y-Achsen-Skalierung |
| **Min/Max** | `d3.min(all, (p) => p.x)`, `d3.max(all, (p) => p.y)` | Datenbereich für fixe Domänen |
| **Achsen (entfernt)** | `d3.axisBottom(ux).ticks(6).tickSize(0)` | X-Achse ohne Ticks |
| **Achsen (links)** | `d3.axisLeft(uy).ticks(5).tickSize(0)` | Y-Achse ohne Ticks |
| **Grid-Linien** | `d3.axisLeft(uy).ticks(5).tickSize(-INNER_W)` | Horizontale Gitterlinien über die ganze Breite |
| **D3-Selection** | `d3.select(svgEl)`, `.selectChild()`, `.selectAll()` | SVG-Struktur aufbauen und manipulieren |
| **Enter/Merge** | `circles.enter().append('circle').merge(circles)` | Data-Join für Scatter-Punkte (Update-Pattern) |
| **Exit** | `circles.exit().remove()` | Entfernt nicht mehr benötigte Punkte |
| **Kontur-Dichte** | `d3.contourDensity().x().y().size([w,h]).bandwidth(20).thresholds(6)` | 2D-Kernel-Density-Estimation für Kontur-Modus |
| **Geo-Path** | `d3.geoPath()` | Konvertiert Kontur-Polygone in SVG-Pfade |
| **DOM-Gruppen** | `.append('g').attr('class', '…')` | Strukturierte Gruppen (point-group, axis-group, contour-group, etc.) |
| **requestAnimationFrame** | `requestAnimationFrame(…)` (kein D3, aber Render-Scheduler) | Batched Rendering (Debounce über mehrere Watches) |
| **Mouse-Events** | `.on('mousemove', …)` (über Vue `@mousemove` auf SVG) | Tooltip bei Mouse-Bewegung |
| **Transitions** | Keine (TRANS_DURATION = 0) | Keine Animation – harte Updates |

#### Abhängigkeiten
- **Verwendet:** `~/utils/berlin` (getBerlinHour, getBerlinYear, getBerlinMonth, getBerlinDay), `~/composables/useData` (HourlyRow-Typ)
- **Verwendet von:** `dashboard.vue` (Einflussfaktoren-Tab, lazy loaded)
- **Keine eigenen Emits**

#### Auffälligkeiten
- Sehr komplexe Komponente mit vielen Features (Scatter + Kontur + Range-Slider + Zeitraum-Vergleich + Tageszeit-Filter)
- Die Range-Slider-Logik ist komplett eigenimplementiert (inkl. `clampRange()`)
- `scheduleRender('metricChanged')` deutet auf eine Debounce/Render-Queue hin – unklar ob Throttling implementiert ist
- Feste Chart-Dimensionen (`WIDTH = 960`, `HEIGHT = 412`) – kein Resize-Handling
- HOUR_COLORS und HOUR_LABELS sind doppelt definiert (für Logik und UI)

---

### 4. HourlyProfile — Tagesprofile

**Datei:** `components/viz/HourlyProfile.vue`  
**Component-Name:** `VizHourlyProfile` (lazy via `defineAsyncComponent`)

#### Zweck
Zeigt Durchschnittsprofile für PV-Erzeugung, Residuallast, Preis und CO₂-Intensität über 24 Stunden. Der User kann zwischen Profil-Modi wechseln (Durchschnitt, Sommer, Winter, Werktag, Wochenende, Jahr 2015, Jahr 2024). Ein Zeitraum-Vergleichsmodus erlaubt den Vergleich zweier Stunden.

#### Datenquelle
- **Prop:** `data: HourlyRow[]` + `selectedDay?: string` (von Heatmap)
- **Rohdaten:** `/data/hourly_2015_2024.json`

#### Datenverarbeitung
1. `computeProfile()` filtert Zeilen nach Modus (Sommer/Winter/Werktag etc.)
2. Stündliche Buckets (0–23, Berliner Lokalzeit)
3. Mittelwert pro Bucket
4. Vier KPI-Cards mit Sparklines (gezeichnet in `drawSparklines()`)
5. Hover-Sync über alle vier Sparklines
6. Vergleichsmodus: Differenz zwischen zwei Stunden

#### Umsetzung / Tech-Stack
- **D3.js** (Scales, Lines, Shapes, Selection)
- SVG-basiert (Hauptdiagramm + 4 Sparklines)
- Separate Hilfsfunktionen: `residuallastGW()`, `pvGW()`, `inSummer()`, `inWinter()`
- Deutsche Formatierung via `fmtNum()`, `diffStr()`

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek |
| **Lineare Skala** | `d3.scaleLinear().domain([0, 23]).range([padLeft + 2, width - 2])` | Sparkline-X: 24 Stunden → Pixel |
| **Lineare Skala (Y)** | `d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([height - 2, 2])` | Sparkline-Y: Wertebereich → Pixel |
| **Line-Generator** | `d3.line().x((_d, j) => xScale(j)).y((d) => yScale(d)).curve(d3.curveMonotoneX)` | Sparkline-Linienzug mit Monotonie-Glättung |
| **DOM-Selection** | `d3.select(svg)`, `.selectAll('*').remove()` | Sparkline-SVG leeren und neu befüllen |
| **SVG viewBox** | `.attr('viewBox', '0 0 ${width} ${height}')` | Responsive Skalierung der Sparklines |
| **Linien (Marker)** | `sel.append('line').attr('x1',…).attr('y1',…)` | Vertikale Markierungslinie für ausgewählte Stunde |
| **Kreise (Marker)** | `sel.append('circle').attr('cx',…).attr('cy',…).attr('r', 3)` | Punktmarker auf der Sparkline |
| **Pfad (Sparkline)** | `sel.append('path').datum(data).attr('d', lineGen)` | Die eigentliche Sparkline als SVG-Pfad |
| **Min/Max** | `d3.min(data)`, `d3.max(data)` | Y-Bereich für jede Sparkline einzeln |
| **Kein Haupt-Chart-SVG** | (entfällt) | Das Hauptprofil (24h-Linien) wird vermutlich nicht mit D3 gezeichnet – nur die 4 Sparklines. Der Rest ist Vue-Template. |

#### Abhängigkeiten
- **Verwendet:** `~/utils/berlin` (getBerlinHour, getBerlinYear, getBerlinMonth, isBerlinWeekend), `~/composables/useData` (HourlyRow-Typ)
- **Verwendet von:** `dashboard.vue` (Preise-Tab, lazy loaded)

#### Auffälligkeiten
- `HourPoint[]` als reine Daten-Struktur, kein `ref` – ist das reaktiv?
- Vier Sparklines werden einzeln per `drawSingleSparkline()` gezeichnet – potentiell Performance-Overhead
- Die `sparkRefs` werden über ein `setSparkRef(i)`-Callback gesetzt, aber nur in `drawSparklines()` verwendet
- `cards`-Array-Einträge haben hardcodierte `key`-Strings
- Der Modus `jahr2015` und `jahr2024` sind spezielle Filter – könnten generisch sein

---

### 5. ExtremeValuesPanel — Extremwert-Kacheln

**Datei:** `components/dashboard/ExtremeValuesPanel.vue`  
**Component-Name:** `ExtremeValuesPanel`

#### Zweck
Zeigt drei Kacheln mit den Extremwerten aus dem sichtbaren Zeitraum: Höchster EE-Anteil, Höchste fossile Erzeugung, Größte Veränderung. Werte werden mit D3 bei Datenänderung animiert.

#### Datenquelle
- **Props:** `monthlyData: MonthlyDataPoint[]`, `aggLevel`, `mode`
- **Logik:** `useExtremeValues()` Composable (arbeitet auf aggregierten Daten)

#### Datenverarbeitung
1. `useExtremeValues()` berechnet drei Computed-Properties aus den MonthlyDataPoints
2. Bestimmt EE-Anteil (absolut oder prozentual), konventionellen Anteil und Veränderung
3. D3-Zahleninterpolation bei Datenänderung (400 ms)
4. Skeleton-Loading-Zustand bei leeren Daten

#### Umsetzung / Tech-Stack
- **D3.js** (`d3-interpolate`) – nur für Zahlen-Animation
- Reines Vue-Template (kein SVG/Canvas)
- `requestAnimationFrame`-basierte Animation
- `prefers-reduced-motion` Support

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` (nur `d3-interpolate` genutzt) | Gesamte D3-Bibliothek, obwohl nur `interpolateNumber` gebraucht wird |
| **Zahlen-Interpolation** | `d3.interpolateNumber(oldVal, newVal)` | Erzeugt Interpolator für animierten Zahlenwechsel (400 ms) |
| **Kein SVG/Canvas** | — | Die Komponente ist ein reines Vue-Template ohne D3-DOM-Manipulation. |
| **requestAnimationFrame** | `requestAnimationFrame(animate)` (kein D3) | Animations-Loop für flüssige Werte-Übergänge |
| **Animated Values** | Manuelle Berechnung im `animate()`-Callback | Werden via `animatedValues`-Ref an Vue-Template gebunden |

#### Abhängigkeiten
- **Verwendet:** `useExtremeValues` (Composable), `MonthlyDataPoint`/`ExtremeValueResult`/`ValueType`-Typen
- **Verwendet von:** `dashboard.vue` (Überblick-Tab, rechte Sidebar)

#### Auffälligkeiten
- Die Animations-Logik hat einen Kommentar "keine ahnung ob das threadsafe ist, läuft aber" – potenziell problematisch bei schnellen Datenwechseln
- `isInitial` wird per `watch` gesetzt, das könnte man einfacher mit `immediate: true` lösen
- Drei Kacheln werden im Template hartcodiert – die i-Trennung (index 0 = Prozent, 1 = GWh, 2 = delta) ist extrem fragil

---

### 6. StartEndComparison — Barbell-Vergleich

**Datei:** `components/dashboard/StartEndComparison.vue`  
**Component-Name:** `StartEndComparison`

#### Zweck
Vergleicht den ersten mit dem letzten Monat des sichtbaren Zeitraums und zeigt die drei Energieträger mit der größten Veränderung als horizontales Barbell-Chart. Klick auf eine Zeile hebt den Träger im StackedArea-Chart hervor.

#### Datenquelle
- **Prop:** `monthlyData: MonthlyDataPoint[]`
- **Logik:** `useStartEndComparison()` Composable

#### Datenverarbeitung
1. `useStartEndComparison()` filtert Daten, berechnet Anteile pro Energieträger
2. Sortiert nach absoluter Veränderung → Top 3
3. Zweiphasige Animation: Schrumpfen (300 ms) → Wachsen (500 ms)
4. Hover-Highlighting (Dimmen anderer Zeilen)
5. Klick-Highlighting mit Event-Bubbling an Parent

#### Umsetzung / Tech-Stack
- **D3.js** (Scales, Selections, Transitions)
- SVG-basiert
- Zweiphasige CSS + D3 Transitions
- `prefers-reduced-motion` Support

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek |
| **Lineare Skala** | `d3.scaleLinear().domain([0, maxShare]).range([0, plotW])` | Anteile (0–100 %) → Pixel für Kapsel-Position |
| **DOM-Selection** | `d3.select(svgRef.value)`, `.selectAll('*').remove()` | SVG leeren und neu aufbauen |
| **viewBox** | `.attr('viewBox', '0 0 ${w} ${totalH}')` | Responsive Skalierung |
| **D3-Transition (Phase 1)** | `.transition().duration(300).ease(d3.easeCubicOut)` | Kapseln schrumpfen zur Start-Position |
| **D3-Transition (Phase 2)** | `.transition().delay(300).duration(500).ease(d3.easeCubicOut)` | Kapseln wachsen zur End-Position |
| **Attribute-Animation** | `.attrTween()` / `.attr()` in Transitions | Animiert `x`, `width`, `cx`, `opacity` über Zeit |
| **Gruppen** | `.append('g').attr('class', '…')` | Strukturierte Zeilen (eine pro Energieträger) |
| **Rechtecke (Kapseln)** | `.append('rect').attr('rx', 6).attr('ry', 6)` | Die Barbell-Kapseln |
| **Kreise** | `.append('circle').attr('r', DOT_R)` | Start-Punkt (offen) und End-Punkt (gefüllt) |
| **Text (Labels)** | `.append('text').attr(…).text(…)` | Träger-Name und Delta-Wert |
| **Mouse-Events** | `.on('mouseenter', …)`, `.on('mouseleave', …)`, `.on('click', …)` | Zeilen-Hover und Klick-Highlighting |
| **Opacity-Manipulation** | `.style('opacity', '0.4')` | Hover-Dimmen anderer Zeilen |

#### Abhängigkeiten
- **Verwendet:** `useStartEndComparison` (Composable), `MonthlyDataPoint`/`BarbellRow`-Typen
- **Verwendet von:** `dashboard.vue` (Überblick-Tab, rechte Sidebar)
- **Emits:** `highlightChange`

#### Auffälligkeiten
- `highlighted`-State wird sowohl in der Component als auch per `highlightChange`-Event gemangelt – zwei konkurrierende Quellen
- Die `COLORS`/`LABELS`/`ALL_KEYS` sind **zum dritten Mal** dupliziert (hier im Composable)
- `deltaColor` für negative Veränderungen nutzt `var(--fg-muted)` – das kann bei verschiedenen Themes schlecht lesbar sein

---

### 7. KpiCard — KPI-Karte mit Sparkline

**Datei:** `components/dashboard/KpiCard.vue`  
**Component-Name:** `DashboardKpiCard` (in dashboard.vue via explizitem Import)

#### Zweck
Anzeige einer einzelnen Kennzahl (EE-Anteil, CO₂, Preis, Negativstunden) mit Zahlenwert, Sparkline, Hover-Sync und Delta-Indikator. Dient als Dashboard-Header.

#### Datenquelle
- **Props:** alle berechneten Werte von `dashboard.vue` (computed `kpis`)
- **Kein eigener Daten-Fetch**

#### Datenverarbeitung
1. Sparkline wird in `onMounted` via D3 offline (`d3.create()`) gebaut und in den Container gehängt
2. Hover-Fadenkreuz wird bei hoveredIndex != null gezeichnet
3. Tooltip-Position wird via CSS `left`-Prozentwert gesteuert

#### Umsetzung / Tech-Stack
- **D3.js** (nur für Sparkline: `d3-scale`, `d3-shape`, `d3-selection`)
- SVG (Sparkline) + Vue-Template (Zahlen, Delta)
- `d3.create()` (offline SVG – D3 bleibt vom Vue-DOM getrennt)

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek (genutzt: scaleLinear, line, select, create) |
| **Offline SVG** | `d3.create('svg')` | Erzeugt SVG außerhalb des Vue-DOMs; wird nach Fertigstellung in den Container gehängt |
| **Lineare Skala (X)** | `d3.scaleLinear().domain([0, data.length - 1]).range([pad.left, pad.left + innerW])` | Daten-Index → Pixel |
| **Lineare Skala (Y)** | `d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([pad.top + innerH, pad.top])` | Datenwert → Pixel mit 10% Padding |
| **Min/Max** | `d3.min(data)`, `d3.max(data)` | Y-Bereich der Sparkline |
| **Line-Generator** | `d3.line().x((_d, i) => xScale(i)).y((d) => yScale(d)).curve(d3.curveMonotoneX)` | Sparkline-Pfad mit Monotonie-Glättung |
| **Path zeichnen** | `svg.append('path').datum(data).attr('d', line)` | Die eigentliche Sparkline-Linie |
| **Hover-Fadenkreuz** | `svg.append('line').attr('x1',…).attr('y1',…).attr('stroke-dasharray', '2,2')` | Vertikale Linie beim Hovern |
| **Hover-Punkt** | `svg.append('circle').attr('cx',…).attr('cy',…).attr('r', 3)` | Punkt auf der Linie an Hover-Position |
| **Attribute setzen** | `.attr('width',…).attr('height',…).attr('viewBox',…)` | SVG-Dimensionen |

#### Abhängigkeiten
- **Verwendet von:** `dashboard.vue` (KPI-Sektion, 4 Instanzen)
- **Emits:** `hover`, `leave`, `click`
- **Keine eigenen Imports** außer D3

#### Auffälligkeiten
- Sparkline wird nur bei `onMounted` gezeichnet – **kein Watch auf `sparklineData`**. Wenn sich die Daten ändern (Jahr-Wechsel), wird die Sparkline nicht aktualisiert.
- Hover-Fadenkreuz und Tooltip werden direkt im `drawSparkline()`-Aufruf gezeichnet (statisch) – müssten bei jedem Hover-Event neu gerendert werden. Wie funktioniert das? Vermutlich wird die ganze Karte neu gerendert via `kpis`-computed.
- `d3.create()` ist gut für Isolierung, aber erschwert Updates

---

### 8. IntroBarbellChart — Landingpage Barbell-Chart

**Datei:** `components/intro/IntroBarbellChart.vue`  
**Component-Name:** `IntroBarbellChart`

#### Zweck
Auf der Landingpage: Horizontaler Barbell-Vergleich des Strommix 2015 vs. 2024 für 9 Energieträger-Kategorien. Sortiert nach Veränderungsstärke. Animation startet beim ersten Sichtbarwerden (IntersectionObserver).

#### Datenquelle
- **Prop:** `rows: EnergyMixRow[]` (geladen von `useEnergyMixData().load()`)
- **Rohdaten:** `/data/energy_mix_yearly.json` (vorberechnete Jahresdaten)

#### Datenverarbeitung
1. Energie-Mix-Daten werden serverseitig/build-time vorberechnet in `useEnergyMixData`
2. Clientseitig: Skalierung, Kollisionserkennung für Labels (< 40 px Abstand → kombiniertes Label)
3. IntersectionObserver löst Animation aus
4. Replay-Button

#### Umsetzung / Tech-Stack
- **D3.js** (Scales, Selections, Transitions, Tweens)
- SVG-basiert
- IntersectionObserver für "start when visible"
- `d3.tween('text', …)` für Zahlen-Animation in Labels
- Kollisionserkennung zwischen Prozent-Labels

#### D3-Verwendung im Detail
| Kategorie | D3-Befehl / Pattern | Zweck |
|---|---|---|
| **Import** | `import * as d3 from 'd3'` | Gesamte D3-Bibliothek |
| **Lineare Skala** | `d3.scaleLinear().domain([0, 30]).range([0, plotW])` | Prozentwerte 0–30 % → Pixel für Kapsel-Position |
| **DOM-Selection** | `d3.select(svgRef.value)`, `.selectAll('*').remove()` | SVG leeren und komplett neu zeichnen |
| **viewBox** | `.attr('viewBox', '0 0 ${w} ${totalH}')` | Responsive Skalierung |
| **D3-Transition (Fade-In)** | `.transition().delay(delay).duration(ANIM_FADE).ease(d3.easeCubicOut).attr('opacity', 1)` | Zeilen erscheinen nacheinander |
| **D3-Transition (Kapsel)** | `.transition().delay(delay + ANIM_FADE).duration(ANIM_GROW).ease(d3.easeCubicOut).attr('x', xMin).attr('width', capsuleW)` | Kapsel wächst von 2015 nach rechts/links |
| **D3-Tween (Text)** | `.tween('text', function() { const i = d3.interpolateNumber(0, value); return (t) => { text.text(fmt(i(t))) } })` | Zahlen zählen hoch während der Animation |
| **Kreise (offen/gefüllt)** | `.append('circle').attr('r', DOT_R).attr('fill', 'none').attr('stroke', color)` | 2015-Punkt (offen) und 2024-Punkt (gefüllt) |
| **Rechtecke (Kapseln)** | `.append('rect').attr('rx', 12).attr('ry', 12)` | Die Barbell-Kapsel zwischen den Punkten |
| **Text** | `.append('text').attr(…).text(…)` | Kategorie-Name, Prozent-Labels, Delta-Wert, Legende |
| **Legende** | `.append('circle')` + `.append('text')` | 2015/2024-Legende oben rechts |
| **Replay-Button** | `.on('click', () => replay())` | SVG-interner Button mit D3-Event |
| **Hover-Effekte (Label)** | `.on('mouseenter', …).on('mouseleave', …)` | Replay-Button Hover |
| **Selektionen** | `.attr()`, `.style()`, `.call()`, `.append()`, `.remove()` | SVG-DOM-Manipulation |

#### Abhängigkeiten
- **Verwendet:** `EnergyMixRow`-Typ
- **Verwendet von:** `pages/index.vue` (Landingpage)
- **Keine Emits**

#### Auffälligkeiten
- `animationKey` wird über einen Watch + IntersectionObserver + sofortigen Check gesteuert – das ist ein komplexes Konstrukt, könnte einfacher sein
- Die `draw()`-Funktion löscht jedes Mal das gesamte SVG und zeichnet neu – bei Replay vollständig neu
- Legende + Replay-Button sind im SVG hartcodiert
- Die `replay()`-Funktion erhöht nur `animationKey` und triggert den Watch
- Die Kollisionserkennung (`MIN_LABEL_DIST = 40 px`) ist ein bekannter Bugfix laut Kommentar

---

## Kandidaten für Zusammenlegung, Vereinfachung oder Löschung

### 1. 🔴 `COLORS` / `LABELS` / `ALL_KEYS` — 3-fach dupliziert
**Dateien:**
- `components/viz/StackedArea.vue` (Zeilen 27–48, 51)
- `composables/useExtremeValues.ts` (Zeilen 32–56)
- `composables/useStartEndComparison.ts` (Zeilen 17–33)

**Problem:** Identische Konstanten (12 Energieträger mit Farbe + Label + Reihenfolge) sind in drei Dateien redundant definiert. Ein TODO-Kommentar in allen drei Dateien fordert "irgendwann in shared file".

**Lösung:** Eigene Datei `utils/constants.ts` oder `utils/energySources.ts` anlegen.

### 2. 🟡 `ALL_MONTHS` — doppelt
**Dateien:** `components/viz/HeatmapCO2.vue` (Zeile 53), müsste auch in StackedArea (via `getAggregated`)

**Problem:** Kleine Duplikation, geringe Wartungslast.

### 3. 🟠 `aggregate()` — Performance
**Datei:** `components/viz/StackedArea.vue` (im `watchEffect`)

**Problem:** Die Aggregationsfunktion wird bei jedem Rerender des `watchEffect` neu aufgerufen, auch wenn sich nur der Zoom geändert hat. Bei großen Datenmengen (87.600+ Stunden) könnte das merklich sein.

**Lösung:** Memoisierung oder Aufteilung in `computed` + separate Watch für zoom-abhängige Rendering-Schritte.

### 4. 🔴 `ExtremeValuesPanel` — Animations-Logik fragil
**Datei:** `components/dashboard/ExtremeValuesPanel.vue`

**Problem:** Die Animation unterscheidet `i === 0`, `i === 1`, `i === 2` für verschiedene Metrik-Typen. Das ist extrem fragil bei Hinzufügen/Entfernen von Kacheln. Zudem der Kommentar "keine ahnung ob das threadsafe ist".

**Lösung:** Die Metrik-Typ-Information (`valueType`) aus `ExtremeValueResult` nutzen statt auf Array-Index zu hoffen.

### 5. 🟡 `KpiCard` — keine Watch-Updates
**Datei:** `components/dashboard/KpiCard.vue`

**Problem:** Die Sparkline wird nur in `onMounted` gezeichnet. Wenn sich `sparklineData`-Props ändern (z. B. durch Wechsel von Gesamt → Einzeljahr), wird die Sparkline nicht neu gezeichnet. Aktuell funktioniert es nur, weil die gesamte KPI-Sektion via `kpis`-computed neu gerendert wird (Vue zerstört und erstellt die Komponente neu).

**Lösung:** `watch(sparklineData, …)` oder `watchEffect` für saubere Updates ohne Component-Destruction.

### 6. 🟠 `HourlyProfile` — vier separate Sparkline-SVGs
**Datei:** `components/viz/HourlyProfile.vue`

**Problem:** Vier einzelne `drawSingleSparkline()`-Aufrufe. Jede Sparkline hat eigene Watches auf `profile`, `currentHour`, `rangeStart`, `rangeEnd`. Bei Datenänderung wird viermal neu gezeichnet.

**Lösung:** Ein gemeinsamer Watch + Batch-Update.

### 7. 🟢 `ScatterAnalysis` — feste Dimensionen
**Datei:** `components/viz/ScatterAnalysis.vue`

**Problem:** `WIDTH = 960`, `HEIGHT = 412` – kein Resize-Handling. Auf mobilen Geräten oder schmalen Viewports wird der Chart abgeschnitten.

**Lösung:** ResizeObserver oder `viewBox`-basierte Skalierung wie in `HeatmapCO2`.

### 8. 🟢 `StartEndComparison` — doppelter Highlight-State
**Datei:** `components/dashboard/StartEndComparison.vue`

**Problem:** Der `highlighted`-State wird lokal und per Emit (`highlightChange`) an den Parent gesendet. Zwei konkurrierende Quellen für den gleichen State. Wer ist die "Source of Truth"?

**Lösung:**
- Entweder komplett lokaler State (Parent fragt nichts ab)
- Oder komplett gesteuert durch Parent (controlled component)

### 9. 🟡 `dashboard.vue` — `kpis`-computed ist riesig
**Datei:** `pages/dashboard.vue`

**Problem:** Der `kpis`-computed ist über 150 Zeilen lang und enthält drei parallele Berechnungslogiken (Gesamt, Jahr, Vergleich). Die Helper `yearlyValues`, `monthlyValues`, `singleYearValue` sind inline definiert.

**Lösung:** Auslagerung in eigenes Composable `useKpiData(hourly, yearly, filterState)`.

### 10. 🟢 Loader-Duplikation
**Mehrere Dateien**

**Problem:** `useData()`, `useEnergyMixData()` und `useLandingData()` haben alle das gleiche Cache-/Promise-Pattern (module-level cache + shared promise). Das ist konsistent, aber viel Boilerplate.

**Lösung:** Ein generischer `useJsonCache<T>(url: string)`-Wrapper wäre eleganter – aber aktuell nicht kritisch.

---

## Legende Komplexität

| Skala | Bedeutung |
|---|---|
| ⭐ | Einfach: < 50 LOC, keine D3, reines Template |
| ⭐⭐ | Einfach-mittel: < 100 LOC, einfache D3-Nutzung |
| ⭐⭐⭐ | Mittel: 100–200 LOC, mehrere D3-Features, Props/Emits |
| ⭐⭐⭐⭐ | Komplex: 200–400 LOC, viele D3-Interaktionen, Animationen, States |
| ⭐⭐⭐⭐⭐ | Sehr komplex: > 400 LOC, umfangreiche D3-Nutzung, viele States und Interaktionen, mehrere Chart-Typen |
