# Analyse: KI-Verdacht und Vereinfachungspotenzial

Diese Analyse vergleicht den selbst geschriebenen Quellcode des Projekts
(TypeScript, Vue, CSS, `scripts/`) mit dem Vorlesungsskript
`public/data/Visualisierung (1).pdf` ("84171 Visualisierung mit Type-/JavaScript
und D3", Prof. Jürgen Singer). Es wurde **kein Code verändert** – diese Datei
ist reine Analyse.

## 1. Kurzüberblick

Es wurden **24 KI-Verdachtsstellen** (davon 8 mit hoher, 12 mit mittlerer und
4 mit niedriger Sicherheit) und **15 Vereinfachungsvorschläge** identifiziert.
Der Schwerpunkt der KI-Verdachtsstellen liegt klar in `utils/charts/` (Hover-
Logik mit `d3.bisector`/`d3.pointer`/`invert`, `d3.stack`, `d3.line().defined()`)
und in `scripts/build-data.ts` (Zeitzonen-/Sommerzeit-Behandlung, Toleranz-
Kalibrierungen). Daneben gibt es vereinzelte Fundstellen in `pages/`,
`composables/` und `data/` (fortgeschrittene TypeScript-Muster) sowie den
gesamten CSS-Anteil, der laut Verfasserin großteils KI-gestützt entstanden ist.
Das größte konkrete Vereinfachungspotenzial ist eine **vollständig verwaiste
Datei** (`components/viz/StackedArea.vue`) mit fünf toten Importpfaden, dazu
mehrere nahezu identische Hilfsfunktions-Tripletts in `scripts/build-data.ts`
und `scripts/check-data.ts`.

Das Vorlesungsskript deckt laut Inhaltsverzeichnis nur ab: Kapitel 10–11
(einfache D3-Beispiele: Kreis/Balkendiagramm, enter/exit, die kurze
`.join()`-Form, `scaleLinear`/`scaleBand`, `axisBottom`/`axisLeft`, feste
`width`/`height`, animierte Bar-/Linien-/Kreis-/Donut-Charts, einfache
Scatterplots/Bubble-Charts, hierarchische Layouts, Karten) sowie Kapitel 4–9
(Node/Bun-Basics, Vue-Komponenten, Vue Router, Pinia, Axios, Nuxt-Grundlagen).
**Nicht im Skript enthalten** (per Volltextsuche mit null Treffern bestätigt):
`d3.bisector`, `d3.pointer`, `scale.invert()`, `d3.stack()`/`stackOffsetExpand`,
`d3.line().defined()`. Das Skript zeigt Tooltip-Interaktion nur über einfache
`mouseover`/`mousemove`-Handler mit `event.pageX`/`event.pageY` (Kapitel 11.7.6,
Force-Layout-Beispiel), nicht über Bisector+Pointer+Invert auf einer
kontinuierlichen Achse. `Record<...>` und ein doppelter Cast (`as unknown as
GeoJSON.FeatureCollection`) kommen im Skript selbst einmal vor (Kapitel 11.6.4
Scattermatrix bzw. 11.8 Geodaten) – diese Muster allein sind daher nur dann
verdächtig, wenn ihre Verwendung im Projekt deutlich elaborierter ist als dort.

---

## 2. KI-Verdacht

| Datei | Stelle | Was verdächtig | Warum | Sicherheit |
|---|---|---|---|---|
| [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts#L386) | `#createStackedSeries()`, `stackGenerator.offset(d3.stackOffsetExpand)` (Z. 386) | `d3.stack()` mit `stackOffsetExpand` für den Anteils-Modus (prozentuale Stapelung) | `d3.stack()`/`stackOffsetExpand` kommt im Skript nicht vor (Volltextsuche: 0 Treffer). Das Skript zeigt nur einfache Bar-/Linien-/Flächendiagramme ohne Stapel-Offsets. | hoch |
| [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts#L793) | `#handlePointerMove()`, Z. 793–820: `d3.pointer(event, overlay)` + `this.#xScale.invert(clampedX)` | Mausposition wird über `d3.pointer` ermittelt und per `scale.invert()` auf einen Datenmonat zurückgerechnet, inkl. Clamping am Rand | Weder `d3.pointer` noch `scale.invert()` kommen im Skript vor. Die Skript-eigene Tooltip-Logik nutzt nur `event.pageX`/`event.pageY` direkt an einem einzelnen Element, keine Koordinaten-Rücktransformation auf einer kontinuierlichen Skala. | hoch |
| [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts#L625) | `#renderHighlightOutlines()`, Kommentar Z. 625 + `.defined(function (stackedPoint) {...})` (Z. 681) | `d3.line().defined()`, um die Kontur-Linie an fehlenden Monaten zu unterbrechen | `.defined()` kommt im Skript nicht vor; die Linien-Beispiele des Skripts (Kap. 11.5.2) zeichnen durchgängige Linien ohne Lücken-Behandlung. | hoch |
| [utils/charts/stackedAreaHelpers.ts](utils/charts/stackedAreaHelpers.ts#L59) | `findNearestMonthRow()`, Kommentar Z. 59–66 + `d3.bisector(...)` (Z. 80), `monthBisector.left(...)` (Z. 84) | `d3.bisector` zur binären Suche nach dem nächsten Datenmonat bei Hover | `d3.bisector` kommt im Skript nicht vor. **Abschwächend:** Der Kommentar beschreibt einen echten, nachvollziehbaren Lernprozess ("war für mich am Anfang unklar – bisector liefert nämlich nicht direkt den nächsten Wert") mit eigener Fallunterscheidung Anfang/Ende/Mitte – das liest sich eher nach selbst erarbeiteter Lösung als nach reinem Copy-Paste. | mittel |
| [utils/charts/DeviationChart.ts](utils/charts/DeviationChart.ts#L41) | `DeviationHoverPayload`-Interface (Z. 41–46) + aufrufbare Interfaces `HoverHandler` (Z. 62–64), `HoverEndHandler` (Z. 67–69), `SelectionHandler` (Z. 72–74) | Interfaces, die ausschließlich eine Aufrufsignatur enthalten (`interface X { (payload: Y): void }`) statt eines einfachen Funktions-Typalias | Diese Form ist im Skript nicht zu finden (dort werden Callback-Typen, wenn überhaupt, als einfache Funktionssignatur inline verwendet). Wirkt wie ein bewusst „sauberes“ TypeScript-Muster. | mittel |
| [utils/charts/DeviationChart.ts](utils/charts/DeviationChart.ts) / [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts) | Data-Joins mit Key-Funktion, z. B. `.data(this.#data, function (row) { return row.sourceKey })` bzw. `.data(stackedSeries, function (series) { return series.key })` | Stabile Zuordnung von Daten zu DOM-Elementen über eine Key-Funktion im `.join()`-Aufruf | Geht über die einfache `.join()`-Kurzform des Skripts hinaus (dort ohne Key-Funktion). Kommentare zeigen aber Verständnis der Funktion. | mittel |
| [scripts/build-data.ts](scripts/build-data.ts#L150) | `berlinDateFormat`/`berlinHourFormat` (Z. 150–161), `hourCycle: 'h23'` (Z. 160), Verarbeitung via `formatToParts()` in `getBerlinDateParts()` (Z. 197 ff.) | Zwei getrennte `Intl.DateTimeFormat`-Instanzen für Berliner Lokalzeit inkl. Sommer-/Winterzeit, mit manueller Feld-Extraktion aus `formatToParts()` | Zeitzonen-/Sommerzeit-Behandlung wird im Skript nirgends behandelt. Die Aufteilung in zwei Formatter (einer für Datum, einer mit `hourCycle: 'h23'` für die Stunde) plus manuelle Teile-Extraktion ist eine nicht-triviale, sehr präzise Lösung für ein Detailproblem. | hoch |
| [scripts/build-data.ts](scripts/build-data.ts#L141) | `NUCLEAR_PHASEOUT_DATE = '2023-04-15'` (Z. 141), Verwendung Z. 266 | Konkretes Fachwissen über das Datum der letzten deutschen Kernkraftwerksabschaltung | Kein Skript-Bezug, sondern Domänenwissen über die deutsche Energiewende – für sich genommen nicht ungewöhnlich, aber in Kombination mit der Zeitzonenlogik auffällig präzise dokumentiert. | niedrig |
| [scripts/build-data.ts](scripts/build-data.ts#L467) | Doppel-Cast `checkedFactors as unknown as EmissionFactors` (Z. 499), mit 7-zeiligem Erklärkommentar ab Z. 467 | `as unknown as X` als TypeScript-Workaround | Skript nutzt selbst einmal `as unknown as X` (Geodaten-Kapitel), daher an sich nicht automatisch verdächtig – aber der begleitende Kommentar liest sich ungewöhnlich lehrbuchhaft/vollständig. | mittel |
| [scripts/build-data.ts](scripts/build-data.ts#L624) | `hasNegativeGeneration()`, Toleranzwert `-0.001` (Z. 626) | Toleranzgrenze für Rundungsdrift bei negativen Erzeugungswerten | Kalibrierte Toleranzwerte für reale Messdaten sind im Skript nicht Thema; wirkt wie eine gezielt hergeleitete/übernommene Fehlertoleranz. | mittel |
| [scripts/build-data.ts](scripts/build-data.ts#L144) | `MAX_SKIP_FRACTION = 0.10` (Z. 144), `checkSkippedHours()` (Z. 653 ff.) | Datenqualitäts-Validierung: Abbruch, wenn mehr als 10 % der Stunden übersprungen wurden | Diese Art von statistischer Robustheits-Prüfung mit konkret kalibriertem Schwellwert geht über das hinaus, was im Skript zu Datenverarbeitung gezeigt wird. | mittel |
| [scripts/check-data.ts](scripts/check-data.ts#L24) | `function isValidNumber(value: unknown): value is number` (Z. 24) | Type Guard mit `value is number`-Signatur | Type Guards werden im Skript nicht behandelt (fortgeschrittenes TypeScript-Muster). | mittel |
| [scripts/check-data.ts](scripts/check-data.ts#L123) | `co2 < 0 \|\| co2 > 1200` (Z. 123), Kommentar zu „seltenen Extremtagen“ | CO₂-Toleranzgrenze von 1200 g/kWh | Wirkt empirisch hergeleitet; für sich genommen nur stilistisch auffällig. | niedrig |
| [scripts/download-smard.ts](scripts/download-smard.ts#L131) | `const concurrency = 8` (Z. 131) + Chunk-Loop (Z. 133–145) | Manuelles Batching paralleler Requests mit fester Konkurrenzgrenze | Parallele Request-Steuerung ist im Skript nicht Thema. Trotzdem ein gängiges, gut lesbares Pattern – daher nur niedrige Sicherheit. | niedrig |
| [data/loadVisualizationData.ts](data/loadVisualizationData.ts#L24) | `function isVisualizationData(value: unknown): value is VisualizationData` (Z. 24–26) | Type Guard für die geladenen JSON-Daten | Fortgeschrittenes TypeScript-Muster, im Skript nicht behandelt. | mittel |
| [data/loadVisualizationData.ts](data/loadVisualizationData.ts#L13) | `cachedData`/`pendingRequest` (Z. 13, 16) + Verwendung in `loadVisualizationData()` (Z. 76–101) | Caching mit Deduplizierung parallel laufender Ladevorgänge (ein zweiter Aufruf während des ersten Ladens wartet auf dasselbe Promise) | Dieses Memoization-/Dedup-Pattern ist im Skript nicht enthalten und wirkt vorausschauend sauber gelöst. | mittel |
| [composables/usePageZoom.ts](composables/usePageZoom.ts) | Gesamte Datei | Laut bereits vorhandenem `DOKU-GRUNDLAGE.md`-Eintrag stand im Kopfkommentar früher der Satz „Diese Datei ist mit KI-Unterstützung entstanden“ (in einem früheren Bearbeitungsschritt entfernt, siehe DOKU-GRUNDLAGE.md) | Es ist nicht mehr rekonstruierbar, welcher Teil konkret gemeint war. | niedrig (Herkunft bereits bekannt, aber ungenau) |
| [composables/useHighContrast.ts](composables/useHighContrast.ts#L27) | `import.meta.client`-Guards (Z. 27, 36) | Nuxt-spezifische SSR-Absicherung, an zwei Stellen inhaltlich dupliziert | `import.meta.client` ist ein Nuxt-spezifisches, im Skript nicht behandeltes Feature. Die Duplizierung wirkt aber eher nach unbedachter Wiederholung als nach KI-Generierung. | niedrig |
| [pages/homeDataTransform.ts](pages/homeDataTransform.ts#L15) | `SourceKey`-Typ (Z. 15–27) + ausführliche JSDoc-Begründung in `transformYearlyDataToChartData()` | Eigener Typ, um ein `keyof`-Indexierungsproblem beim Zugriff auf `YearlyMixPoint.sources` sicher aufzulösen | Diese Art von gezielter Typ-Modellierung zur Umgehung eines TypeScript-Fehlers geht klar über die im Skript gezeigten einfachen Interfaces/Types hinaus; die Erklärung liest sich sehr präzise/lehrbuchhaft. | hoch |
| [pages/index.vue](pages/index.vue) | `loadPageData()`, `caughtError instanceof Error`-Prüfung im catch-Block | Type-Narrowing im catch-Zweig, um sicher auf `.message` zuzugreifen | Diese Fehlerbehandlung geht über einfaches try/catch (wie im Skript gezeigt) hinaus. | hoch |
| [pages/dashboard.vue](pages/dashboard.vue) | `activeTab` computed | Defensive Behandlung von `route.query.tab` als `string \| string[] \| undefined` mit strikter Gleichheitsprüfung und Fallback | Zeigt genaues Wissen über Vue-Router-Query-Typisierung; im Skript wird Query-Handling nicht in dieser Tiefe behandelt. | mittel |
| [pages/index.vue](pages/index.vue) | `findYear()`-Kommentar („Ich hätte hier auch Array.find nehmen können …") | Begründung, warum bewusst eine einfache For-Schleife statt `Array.find` verwendet wird | **Aus dem Quellcode allein nicht sicher erkennbar** – kann echte Studierendenpräferenz sein oder nachträglich hinzugefügte Begründung. | niedrig |
| [components/emissions/DeviationChart.vue](components/emissions/DeviationChart.vue) | Mehrstufige computed-Kette (`activeYear` → `baseYear` → `largestMismatch` u. Ä.) | Mehrere ineinandergreifende computed-Properties | Nur stilistisch auffällig, da einfache Komponenten im Skript meist 1–2 computed zeigen. **Aus dem Quellcode allein nicht sicher erkennbar.** | niedrig |
| [components/generation/StackedAreaChart.vue](components/generation/StackedAreaChart.vue) | Umfangreiches `<script setup>` mit vielen computed/watch-Blöcken | Deutlich mehr State-Verwaltung als vergleichbare einfache Komponenten im Skript | Nur stilistisch auffällig, keine harten Belege. **Aus dem Quellcode allein nicht sicher erkennbar.** | niedrig |

---

## 3. Vereinfachungspotenzial

| Datei | Stelle | Zu kompliziert | Konkreter Vorschlag | Ändert Verhalten? | Empfehlung |
|---|---|---|---|---|---|
| [components/viz/StackedArea.vue](components/viz/StackedArea.vue#L12) | Ganze Datei, Imports Z. 12–16 | Vollständig verwaiste Datei: importiert `~/components/viz/ChartTemplate.vue`, `StackedAreaLegend.vue`, `MixTooltip.vue`, `AnnotationMarkers.vue`, `MixSidebar.vue` – keine dieser Dateien existiert in `components/viz/` (die echten Versionen liegen in `components/shared/` bzw. `components/generation/`). Nichts im Projekt importiert diese Datei (per grep bestätigt). | Datei löschen. Die aktuelle, funktionierende Variante ist `components/generation/StackedAreaChart.vue`. | Nein (Datei wird nirgends verwendet, würde beim Import ohnehin einen Fehler werfen) | **Vereinfachen** – toter Code mit kaputten Importpfaden, kein Nutzen, nur Verwirrungspotenzial. |
| [scripts/build-data.ts](scripts/build-data.ts#L511) | `addToMonthBucket()` (Z. 511), `addToDayBucket()` (Z. 551), `addToYearBucket()` (Z. 581) | Drei strukturell fast identische Funktionen (get-or-create im Map, Werte akkumulieren, Zähler hoch) | Zu einer generischen Hilfsfunktion zusammenfassen, die Map, Key und eine Akkumulationsfunktion als Parameter nimmt | Nein, wenn die Zusammenführung sorgfältig gemacht wird | Vereinfachen – deutliche Code-Duplikation, aber mit Sorgfalt zu testen, da an mehreren Stellen im Skript verwendet. |
| [scripts/build-data.ts](scripts/build-data.ts#L361) | `finalizeMonthlyMix()` (Z. 361), `finalizeScatterDaily()` (Z. 387), `finalizeYearlyMix()` (Z. 415) | Drei fast identische `Array.from(buckets).sort(...).map(...)`-Blöcke, nur die Feldnamen unterscheiden sich | Eine gemeinsame `finalize()`-Funktion mit einer Transformationsfunktion als Parameter | Nein | Vereinfachen – klare DRY-Verletzung. |
| [scripts/build-data.ts](scripts/build-data.ts#L297) | `calculateCo2Weighted()` (Z. 297), `calculateRenewableGeneration()` (Z. 322) | Beide iterieren über `GENERATION_FIELDS` mit ähnlichem Cast auf `keyof EnergySourceAccum` | Gemeinsame Summierungsfunktion mit einer Bedingungsfunktion als Parameter (z. B. „ist erneuerbar“) | Nein | Optional – kleinere Duplikation, Aufwand/Nutzen abwägen; kann auch so bleiben. |
| [scripts/check-data.ts](scripts/check-data.ts#L66) | `checkMonthlyData()` (Z. 66), `checkDailyData()` (Z. 99), `checkYearlyData()` (Z. 140) | Drei strukturell sehr ähnliche Validierungsfunktionen mit denselben `errors.push(...)`-Mustern | Gemeinsame, deklarative Prüf-Helferfunktion (z. B. Feld-Validierungsregeln als Objekt) | Nein, wenn die Feldregeln 1:1 übernommen werden | Optional – deutliche Struktur-Ähnlichkeit, aber Zusammenführung ist aufwändiger und fehleranfälliger als bei den `build-data.ts`-Tripletts; nur bei ausreichend Zeit empfohlen. |
| [scripts/check-data.ts](scripts/check-data.ts#L44) | Wiederholte String-Verkettung `errors.push(label + ': ' + key + ...)` (mehrfach, z. B. Z. 44, 49, 81, 83) | Manuelle `+`-Verkettung statt Template-Literals | Auf Template-Literals (`` `${label}: ${key} ...` ``) umstellen, optional zusätzlich eine kleine `pushError()`-Hilfsfunktion | Nein | Vereinfachen – rein kosmetisch, verbessert Lesbarkeit ohne Risiko. |
| [scripts/download-smard.ts](scripts/download-smard.ts#L131) | Manuelles Concurrency-Batching (Z. 131–145) | Fest codierte Batch-Größe und manuelles Slicing | Könnte in eine wiederverwendbare `batchedMap()`-Hilfsfunktion ausgelagert werden | Nein | So lassen – Skript wird nur einmalig ausgeführt, eine zusätzliche Abstraktion lohnt sich hier nicht. |
| [composables/useHighContrast.ts](composables/useHighContrast.ts#L20) | Doppelter `import.meta.client`-Check und doppelte `dataset.contrast`-Zuweisung (Init-Block und `apply()`) | Zwei Codeblöcke mit identischer Wirkung statt eines gemeinsamen Aufrufs | Beim Initialisieren einfach `apply()` aufrufen statt die Zuweisung ein zweites Mal zu schreiben | Nein | Vereinfachen – reine Code-Duplikation ohne Zusatznutzen. |
| [composables/useMixData.ts](composables/useMixData.ts#L35) | `parseMonth()` (Z. 35–55), wird nur ein einziges Mal aufgerufen (in `normalizeMonth`) | Eigene Hilfsfunktion mit ausführlicher Validierung für eine einzige Verwendungsstelle | Inline in `normalizeMonth()` schreiben, falls keine separaten Tests dafür existieren | Nein | So lassen – wenn die Funktion isoliert nachvollziehbar bleiben soll (z. B. für Testbarkeit), ist die Extraktion vertretbar; ansonsten optional inline. |
| [utils/charts/deviationChartHelpers.ts](utils/charts/deviationChartHelpers.ts#L9) | `import * as d3 from 'd3'` (Z. 9), aber kein `d3.`-Aufruf in der gesamten Datei | Ungenutzter Import | Import-Zeile entfernen | Nein | Vereinfachen – trivialer, risikoloser Cleanup. |
| [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts) | `#renderGroupSeparators()`/`#updateGroupSeparators()`, Unterscheidung der beiden Trennlinien über `index === 0`/`index === 1` in einer `.each()`-Schleife | Index-basierte Fallunterscheidung ist unübersichtlich und fehleranfällig bei Reihenfolge-Änderungen | Beide Trennlinien mit eigenen, benannten CSS-Klassen/Selektoren ansprechen statt über den Index im Loop | Nein | Optional – verbessert Lesbarkeit, aber nicht dringend. |
| [utils/charts/BaseChart.ts](utils/charts/BaseChart.ts) | `margin`-Getter erzeugt bei jedem Aufruf eine neue Kopie (`{ ...this.#margin }`) | Wirkt wie unnötige Mikro-Optimierungs-Kandidat, ist aber eigentlich korrektes defensives Kopieren | Keine Änderung nötig | Nein | So lassen – defensives Kopieren ist hier das richtige Muster, eine „Vereinfachung“ würde nur Bugs einführen. |
| [pages/index.vue](pages/index.vue) | `findYear()` – manuelle For-Schleife für eine einfache lineare Suche | Entspricht nicht der im Skript gezeigten idiomatischen Variante | Durch `data.find(function (item) { return item.year === year })` ersetzen | Nein | Optional – der vorhandene Kommentar begründet die For-Schleife bewusst mit Debug-Vorteilen; kann so bleiben oder vereinfacht werden, beides ist vertretbar. |
| [components/home/GroupedBarChart.vue](components/home/GroupedBarChart.vue) | `flatBars`-Konstruktion über manuelle `.push()`-Aufrufe in einer Schleife | Etwas umständlicher als nötig | Mit `.flatMap()` zusammenfassen | Nein | So lassen – aktuelle Variante ist klar lesbar, Umstellung bringt kaum Mehrwert. |

---

## 4. CSS-Gesamtblock

Betroffene Dateien: [assets/css/main.css](assets/css/main.css) und
[assets/css/chart-styles.css](assets/css/chart-styles.css).

CSS wird laut Verfasserin **großteils KI-gestützt** erstellt und wird hier
pauschal als KI-verdächtig markiert, unabhängig davon, ob im aktuellen Code
noch ein expliziter Hinweis dazu steht:

- **`assets/css/main.css`** (globale Grundstile): Vier explizite KI-Hinweise
  standen ursprünglich im Code (inzwischen in einem früheren Bearbeitungsschritt
  aus den Kommentaren entfernt, siehe `DOKU-GRUNDLAGE.md`) zu: dem CSS-Reset
  (`*, *::before, *::after`), der rem-basierten Basis-Schriftgröße (`html { font-size:
  17px }`), den Überschriften-Größen (`h1`/`h2`/`h3` in `rem`) sowie generell dem
  „responsiven Verhalten“ der Seite. Betroffene Regelarten: Reset/Box-Sizing,
  rem-basierte Typografie-Skalierung, Kontrastmodus-Variablen
  (`[data-contrast='on']`), Fokus-Sichtbarkeit (`:focus-visible`).
- **`assets/css/chart-styles.css`** (Diagramm-Grundstile): Enthält keine
  expliziten KI-Hinweise mehr im Code, aber die responsiven Regeln für die
  SVG-Skalierung (`.chart svg { width: 100%; height: auto }`, `min-width: 0`)
  folgen demselben "responsive machen"-Muster wie in `main.css` und sind
  ebenfalls als großteils KI-gestützt zu betrachten.
- **`pages/index.vue`** (`<style scoped>`-Block): Enthielt mehrere KI-Hinweise
  zu responsivem Verhalten (Zentrierung, `max-width`, Innenabstände, `ch`-Einheit
  bei der Fußnotenbreite) sowie zur Shimmer-/Skeleton-Ladeanimation
  (Farbverlauf + `background-position`-Keyframes) – ebenfalls bereits in einem
  früheren Bearbeitungsschritt aus den Kommentaren entfernt.

Betroffene Regel-Arten insgesamt: responsives Verhalten (Flex/Grid-Breiten,
`min-width: 0`, `max-width`, `ch`-Einheiten, `width: 100%` + `height: auto` bei
SVGs), Animationen/Keyframes (Shimmer/Skeleton-Ladeanzeige), Kontrast-/Theme-
Variablen sowie fein abgestimmte Farb- und Spacing-Werte in `:root`.

---

## 5. Offene Punkte / unsicher

- **`components/emissions/DeviationChart.vue`** und
  **`components/generation/StackedAreaChart.vue`**: Die dort beobachtete hohe
  Zahl an computed-Properties/Watchern ist nur ein stilistischer Hinweis, keine
  belegbare KI-Spur. Aus dem Quellcode allein nicht sicher erkennbar.
- **`pages/index.vue`**, `findYear()`-Kommentar: Die Begründung „lieber
  For-Schleife wegen Debugging” könnte echte Studierendenpräferenz oder eine
  nachträglich hinzugefügte Rechtfertigung sein – nicht unterscheidbar.
- **`composables/usePageZoom.ts`**: Der ursprüngliche KI-Hinweis im
  Kopfkommentar wurde bereits in einem früheren Bearbeitungsschritt entfernt,
  ohne dass genau rekonstruierbar ist, welcher Teil der Datei gemeint war
  (siehe bestehender Eintrag in `DOKU-GRUNDLAGE.md`).
- **`scripts/build-data.ts`**, Doppel-Cast `as unknown as EmissionFactors`
  (Z. 499): Da das Vorlesungsskript selbst einen vergleichbaren Cast im
  Geodaten-Kapitel zeigt, ist unklar, ob dies eigenständig übernommen oder
  KI-gestützt entstanden ist – nur der begleitende Kommentar wirkt auffällig
  ausführlich.
- Alle mit Sicherheit **„niedrig”** markierten Fundstellen in Abschnitt 2
  sollten grundsätzlich als „nur Stil-Vermutung, nicht belegbar” gelesen werden.

---

## Geprüfte Dateien

**TypeScript/Vue (vollständig gelesen und analysiert):**
- `types/mix.ts`, `types/visualization-data.ts`
- `scripts/build-data.ts`, `scripts/check-data.ts`, `scripts/download-smard.ts`, `scripts/checks/check-calculations.ts`
- `composables/useHighContrast.ts`, `composables/useMixData.ts`, `composables/useMixMetrics.ts`, `composables/useMixSelection.ts`, `composables/usePageZoom.ts`
- `data/loadVisualizationData.ts`
- `utils/charts/BaseChart.ts`, `utils/charts/DeviationChart.ts`, `utils/charts/deviationChartHelpers.ts`, `utils/charts/StackedAreaChart.ts`, `utils/charts/stackedAreaHelpers.ts`
- `components/emissions/DeviationChart.vue`, `components/emissions/deviationData.ts`, `components/emissions/DeviationSidebar.vue`, `components/emissions/DeviationTooltip.vue`, `components/emissions/emissionsData.ts`, `components/emissions/EmissionsPanel.vue`, `components/emissions/YearSlider.vue`
- `components/generation/AnnotationMarkers.vue`, `components/generation/GenerationPanel.vue`, `components/generation/mixConfig.ts`, `components/generation/MixSidebar.vue`, `components/generation/MixTooltip.vue`, `components/generation/StackedAreaChart.vue`, `components/generation/StackedAreaLegend.vue`
- `components/viz/StackedArea.vue`
- `components/home/GroupedBarChart.vue`, `components/home/groupedBarUtils.ts`, `components/home/IntroHero.vue`, `components/home/IntroMethodology.vue`, `components/home/IntroTrustLine.vue`
- `components/layout/SiteNav.vue`, `components/shared/ChartTemplate.vue`
- `pages/dashboard.vue`, `pages/homeDataTransform.ts`, `pages/index.vue`
- `app.vue`

**CSS (vollständig gelesen):**
- `assets/css/main.css`, `assets/css/chart-styles.css`

**Bewusst ausgelassen (mit Grund):**
- `node_modules/`, `.nuxt/`, `.output/`, `dist/` – generierte/externe Dateien, nicht selbst geschrieben.
- `bun.lock`, `package-lock.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `nuxt.config.ts` – Lockfiles und Framework-/Tool-Konfiguration, keine Anwendungslogik.
- `public/data/*.json`, `emission_factors.json` – generierte/heruntergeladene Datendateien, kein Quellcode.
- `public/data/Visualisierung (1).pdf` – das Vergleichsdokument selbst, kein Projekt-Quellcode.
- `public/fonts/` – Binärdateien (Schriftarten).

---
---

# Nachtrag: Erneute Prüfung, Einheitlichkeit und Priorisierung

Dieser Nachtrag wurde in einem zweiten Durchgang erstellt. Er prüft alle
Befunde aus Teil 1–5 dieser Datei erneut direkt am aktuellen Quellcode
(nicht an alten Notizen), vergleicht zusätzlich ähnliche Dateien und
Aufgaben innerhalb des Projekts auf Einheitlichkeit, und priorisiert alle
Punkte. Es wurde weiterhin **kein Code verändert** – auch dieser Nachtrag
ist reine Analyse.

**Methodischer Hinweis:** Bei der Recherche für diesen Nachtrag lieferte
ein Suchwerkzeug einmal ein nicht existierendes Ergebnis (eine angebliche
Datei `components/intro/GroupedBarChart.vue` mit angeblich defekten
Importen). Dies wurde durch direkte Verzeichnisauflistung
(`components/` enthält nur `emissions/`, `generation/`, `home/`, `layout/`,
`shared/`, `viz/` – **kein** `intro/`-Ordner) und einen frischen
`npx nuxi typecheck`-Lauf widerlegt: Der Typecheck zeigt aktuell exakt
**10 Fehler**, ausschließlich in `components/layout/SiteNav.vue` (1 Fehler)
und `components/viz/StackedArea.vue` (9 Fehler). Der angebliche
`components/intro/`-Ordner existiert nicht und wurde daher **nicht** in
die folgenden Tabellen übernommen.

## 6. Überprüfung der bisherigen Befunde

| Alter Befund | Aktueller Stand | Bestätigt? | Begründung |
|---|---|---|---|
| `utils/charts/StackedAreaChart.ts`: `stackOffsetExpand` für Anteils-Modus | Datei vollständig gelesen, `stackGenerator.offset(d3.stackOffsetExpand)` weiterhin vorhanden | Ja | Inhalt und Funktionsweise unverändert bestätigt. |
| `utils/charts/StackedAreaChart.ts`: `d3.pointer` + `xScale.invert()` in `#handlePointerMove()` | Weiterhin vorhanden, aktuell bei ca. Z. 777–835 (statt vorher Z. 793–820 angegeben) | Ja, mit korrigierter Zeilenangabe | Logik unverändert, aber die genaue Zeilennummer war zu niedrig angesetzt; jetzt per Volldatei-Lesen neu verortet. |
| `utils/charts/StackedAreaChart.ts`: `d3.line().defined()` / Highlight-Outlines | `#renderHighlightOutlines()` weiterhin vorhanden, ca. Z. 619–657 | Ja | Bestätigt, Funktionsweise unverändert. |
| `utils/charts/stackedAreaHelpers.ts`: `d3.bisector` in `findNearestMonthRow()` | Weiterhin vorhanden, ca. Z. 53–101 (statt vorher Z. 59–84) | Ja, mit korrigierter Zeilenangabe | Kommentar mit Lernprozess-Beschreibung weiterhin vorhanden. |
| `utils/charts/DeviationChart.ts`: `DeviationHoverPayload`, `HoverHandler`, `HoverEndHandler`, `SelectionHandler` | Weiterhin vorhanden, aktuell bei Z. 36 (Interface), Z. 47, Z. 51, Z. 55 (statt vorher Z. 41, 62–64, 67–69, 72–74) | Ja, mit korrigierter Zeilenangabe | Inhalt unverändert; die Datei hat sich seit der letzten Zeilenzählung offenbar leicht verschoben. |
| `scripts/build-data.ts`: `NUCLEAR_PHASEOUT_DATE` (Z. 141), `MAX_SKIP_FRACTION` (Z. 144), `berlinDateFormat`/`berlinHourFormat` (Z. 150/157), `hourCycle: 'h23'` (Z. 160), Doppel-Cast `as unknown as EmissionFactors` (Z. 499), Toleranz `value < -0.001` (Z. 626) | Alle Zeilennummern per frischem `grep` exakt bestätigt | Ja, exakt | Keine Abweichung – Datei unverändert seit letzter Prüfung. |
| `scripts/check-data.ts`: `isValidNumber` (Z. 24), `checkMonthlyData` (Z. 66), `checkDailyData` (Z. 99), `checkYearlyData` (Z. 140), CO₂-Toleranz `co2 < 0 \|\| co2 > 1200` (Z. 123) | Alle Zeilennummern per frischem `grep` exakt bestätigt | Ja, exakt | Keine Abweichung. |
| `scripts/download-smard.ts`: `fetchJSON` (Z. 59), `res.status === 404` (Z. 62), `concurrency = 8` (Z. 131) | Per frischem `grep` exakt bestätigt | Ja, exakt | Keine Abweichung. |
| `data/loadVisualizationData.ts`: `cachedData` (Z. 13), `pendingRequest` (Z. 16), `isVisualizationData` (Z. 24) | Per frischem `grep` exakt bestätigt | Ja, exakt | Keine Abweichung; ein Unterbericht in diesem Nachtrag hatte hier abweichende Zeilen genannt (Z. 9/12/16) – das war falsch und wurde durch direkten `grep` korrigiert. |
| `components/viz/StackedArea.vue`: 5 kaputte Importpfade nach `~/components/viz/*` | Bestätigt, zusätzlich per `npx nuxi typecheck` verifiziert | Ja, verstärkt bestätigt | Der aktuelle Typecheck zeigt **9 Fehler** allein in dieser Datei: die 5 kaputten Imports (TS2307) **plus** 4 weitere Folgefehler: `MixHoverPayload` wird von `StackedAreaChart.ts` nicht exportiert (Z. 27), `toggleColorMode` existiert nicht auf dem Rückgabetyp von `useMixSelection()` (Z. 34), `setSubtitle` existiert nicht auf `StackedAreaChart` (Z. 121, Z. 194). Datei ist damit noch eindeutiger als reiner, nicht kompilierbarer Totcode einzustufen. |
| `getAnnotationContext`/`getOverviewMetrics`/`getSourceMetrics` – Existenz in `composables/useMixMetrics.ts` (im ersten Bericht als „nicht verifiziert" offengelassen) | Alle drei Funktionen existieren tatsächlich als `export function`: `getOverviewMetrics` (Z. 170), `getSourceMetrics` (Z. 321), `getAnnotationContext` (Z. 385) | Ja, jetzt verifiziert | Der offene Punkt aus Abschnitt 5 ist damit geklärt: Diese drei Composable-Funktionen existieren und werden nur von der toten Datei `components/viz/StackedArea.vue` referenziert. |
| `utils/charts/deviationChartHelpers.ts`: „ungenutzter Import `import * as d3 from 'd3'`" | Import wird **nicht** zur Laufzeit, aber **für Typen** verwendet (`d3.ScaleLinear<number, number>` an 3 Stellen: Z. 36, 56, 127) | **Teilweise korrigiert** | Die ursprüngliche Einstufung als „ungenutzter Import" war ungenau. Der Import ist nicht komplett überflüssig, sondern wird ausschließlich für Typinformationen gebraucht. Korrekte Vereinfachung wäre `import type * as d3 from 'd3'` statt vollständigem Entfernen (siehe Abschnitt 7). |
| `composables/useHighContrast.ts`: doppelte Kontrast-Logik (Initialisierung vs. `apply()`) | Bestätigt, identischer Code an beiden Stellen (Z. 22–24 Modul-Initialisierung, Z. 26–28 innerhalb `apply()`) | Ja | Beide Blöcke setzen `document.documentElement.dataset.contrast` mit identischer Bedingung. |
| `components/layout/SiteNav.vue`: `usePageZoom()`-Destrukturierung erwartet `cycle`, Composable exportiert nur `cycleZoom` | Bestätigt als **aktiver Fehler**: Z. 16 `const { level, cycle } = usePageZoom()`, aber `usePageZoom.ts` gibt nur `level`, `zoomLevels`, `cycleZoom`, `setZoomLevel` zurück | Ja, aktiver Fehler bestätigt | Frischer `npx nuxi typecheck`-Lauf bestätigt exakt einen TS2339-Fehler an dieser Stelle: „Property 'cycle' does not exist on type '{ level: ...; cycleZoom: () => void; ... }'". Der Button `@click="cycle"` (Z. 97) ruft im Browser eine `undefined`-Funktion auf und tut nichts – kein Absturz, aber der Zoom-Button ist funktionslos. |
| `pages/index.vue`: `findYear()`-Kommentar „Ich hätte hier auch Array.find nehmen können" | Bestätigt, exakt: Z. 37 in `pages/index.vue`, Wortlaut wie zitiert | Ja | Kommentar unverändert vorhanden. |
| ENTSO-E-Erwähnungen (laut Aufgabenstellung erneut zu prüfen) | Projektweite Suche nach „ENTSO" ergibt **0 Treffer** | Bestätigt sauber | Keine veralteten ENTSO-E-Bezüge mehr im Code vorhanden. |
| `components/home/GroupedBarChart.vue` – mögliche verwaiste Dateien drumherum | Nur eine einzige `GroupedBarChart.vue` existiert im gesamten Projekt (`components/home/GroupedBarChart.vue`), zusammen mit `groupedBarUtils.ts` | Bestätigt sauber | Keine zweite/verwaiste Version gefunden (die im ersten Rechercheschritt dieses Nachtrags kurzzeitig behauptete `components/intro/GroupedBarChart.vue` existiert nachweislich nicht, siehe Methodischer Hinweis oben). |
| CSS-Gesamtblock (`main.css`, `chart-styles.css` großteils KI-gestützt) | Beide Dateien erneut vollständig gelesen, keine neuen Widersprüche gefunden | Ja, weiterhin gültig | Zusätzlich jetzt: Farbwerte und Scoped-Styles in den Vue-Komponenten wurden erstmals systematisch mitverglichen, siehe Abschnitt 7.8. |

---

## 7. Projektinterne Einheitlichkeit

| Vergleichsbereich | Dateien/Stellen | Unterschied | Ist der Unterschied nötig? | Einfachere einheitliche Lösung | Ändert Verhalten? | Kategorie | Empfehlung |
|---|---|---|---|---|---|---|---|
| D3-Hover-Komplexität | `utils/charts/StackedAreaChart.ts` (`d3.pointer`+`invert`+`bisector`) vs. `utils/charts/DeviationChart.ts` (einfaches `mouseenter`/`mouseleave` auf Balken) vs. `components/home/GroupedBarChart.vue` (einfaches `mouseenter`/`mouseleave`, Tooltip-Position über `event.clientX/Y`) | StackedAreaChart löst „nächster Datenpunkt bei beliebiger Mausposition" (kontinuierliche Fläche), die anderen beiden lösen „Hover über ein diskretes Element" (Balken) | Ja | Keine – unterschiedliche Diagrammtypen erfordern unterschiedliche Hover-Mechanik | Nein | D | So lassen. Kein Änderungsbedarf – die Komplexität ist fachlich begründet, nicht willkürlich. |
| D3-Vue-Adapter-Muster | `components/generation/StackedAreaChart.vue` und `components/emissions/DeviationChart.vue` (Chart-Klasse + `onMounted`/`onBeforeUnmount` + `watch()` pro Prop) vs. `components/home/GroupedBarChart.vue` (kein eigener Chart-Klassen-Wrapper, D3-Code direkt in `renderChart()`) | GroupedBarChart nutzt keine eigene Klasse, sondern rendert direkt im `<script setup>` | Ja | Keine – GroupedBarChart ist ein einzelnes, einfaches, nicht wiederverwendetes Diagramm; eine eigene Klasse wäre hier unnötige Abstraktion | Nein | D | So lassen. Eine Klasse nur für ein einziges, nicht wiederverwendetes Diagramm zu bauen wäre eine unnötige neue Architektur. |
| Props-Definition-Stil | `components/emissions/DeviationSidebar.vue` nutzt `withDefaults(defineProps<Interface>(), {...})`; alle anderen Komponenten nutzen `defineProps<Interface>()` ohne `withDefaults` | Nur eine Komponente im ganzen Projekt nutzt `withDefaults()` | Nein, echte fachliche Notwendigkeit nicht erkennbar – aber auch keine Fehlerquelle | `withDefaults()` ist unproblematisch und muss nicht projektweit vereinheitlicht werden, da es reine Bequemlichkeit für Default-Werte ist | Nein | E | So lassen. Reine Stilfrage ohne Verhaltensrelevanz; keine Änderung nötig. |
| Auswahl-/Hover-Namensgebung | `components/emissions/*`: `selectedSourceKey`, `selectedRow`, `hoveredRow` (Emissions-Bereich trennt „ausgewählt" und „gehovert" explizit) vs. `components/generation/*`: `highlighted`, `highlightedSources`, `hoverPayload` (Generation-Bereich nennt beides „highlighted"/verwendet ein Payload-Objekt) | Zwei unterschiedliche Namenssysteme für denselben Grundgedanken (Auswahl- und Hoverzustand eines Energieträgers) | Nein, beide Bereiche modellieren einen sehr ähnlichen Zustand | Einheitliche Begriffe (z. B. überall `selected*` und `hovered*`) wären klarer, würden aber Props/Emits/Composable-Rückgabewerte in mehreren Dateien gleichzeitig betreffen | Nein, wenn die Umbenennung vollständig und konsistent durchgeführt wird – aber hohes Risiko für Tippfehler/vergessene Stellen bei manueller Umsetzung | B | Manuell entscheiden (Priorität 3): Eine Vereinheitlichung ist sinnvoll, aber wegen der vielen betroffenen Dateien (Composables, Props, Emits) nur mit Sorgfalt und am besten nicht "mal eben nebenbei" umzusetzen. |
| Energieträger-Schlüssel-Typname | `types/mix.ts`: `export type MixSourceKey = 'hydro' \| 'biomass' \| 'wind_offshore' \| 'wind_onshore' \| 'pv' \| 'nuclear' \| 'gas' \| 'other_fossil' \| 'hardcoal' \| 'lignite'` vs. `pages/homeDataTransform.ts` Z. 19–30: `export type SourceKey = 'wind_onshore' \| 'pv' \| 'biomass' \| 'wind_offshore' \| 'hydro' \| 'lignite' \| ...` | Zwei separate, aber inhaltlich identische Union-Typen (dieselben 10 Werte, nur andere Reihenfolge) mit unterschiedlichem Namen, in zwei verschiedenen Dateien definiert | Nein – die Werte sind identisch | `SourceKey` in `pages/homeDataTransform.ts` könnte entfallen und stattdessen `MixSourceKey` aus `types/mix.ts` importiert/wiederverwendet werden | Nein, sofern beide Typen wirklich exakt dieselben 10 String-Literale enthalten (soweit anhand der gelesenen Werte ersichtlich) | B | Sinnvoll vereinheitlichen (Priorität 2): Klarer Fall von doppelter Typdefinition für dasselbe fachliche Konzept; Import statt Neudefinition ist einfacher zu lesen und weniger fehleranfällig, ohne neue Abstraktion einzuführen. |
| `null` vs. `undefined` | Zustandsfelder (Composables, Chart-Klassen-Felder wie `#hoverHandler`, `cachedData`, `error`-Refs) nutzen konsequent `null`; Suchfunktionen (`findYear()` in `pages/index.vue`, `Array.find()`-Ergebnisse) nutzen `undefined` | Zwei verschiedene Konventionen je nach Kontext (Zustand vs. Suchergebnis) | Teilweise – das ist ein verbreitetes, nachvollziehbares Muster (State = `null`, „nicht gefunden" = `undefined`), keine willkürliche Mischung an derselben Stelle | Keine Änderung nötig, da innerhalb der jeweiligen Kategorie (State bzw. Suchergebnis) konsistent verwendet | Nein | D | So lassen. Das Muster ist in sich konsistent und entspricht einer üblichen, nachvollziehbaren Konvention (State-Absenz vs. Sucher-Ergebnis-Absenz). |
| Array-Suche „Jahr finden" | `scripts/checks/check-calculations.ts` Z. 76: `yearlyData.find(...)`; `pages/index.vue` Z. 33–40: manuelle `for`-Schleife mit `return`; `composables/useMixMetrics.ts` ca. Z. 99–110: manuelle `for`-Schleife mit Zuweisung an zwei Variablen (`year2015`, `year2024` gleichzeitig) | Dieselbe grundsätzliche Aufgabe „ein Jahr in einem Array finden" wird an drei Stellen unterschiedlich gelöst | Teilweise – der `useMixMetrics.ts`-Fall sucht tatsächlich **zwei** Jahre gleichzeitig in einem Durchlauf, das ist mit `.find()` nicht in einem Aufruf lösbar, hier ist die Schleife also sachlich begründet. Der Fall in `pages/index.vue` sucht dagegen nur ein einzelnes Jahr und hat einen expliziten Begründungskommentar für die Schleife (Debugging). | `check-calculations.ts` könnte theoretisch auch eine Schleife verwenden, `pages/index.vue` könnte theoretisch `.find()` verwenden – aber beide Varianten sind bereits klar lesbar | Nein | E (für `pages/index.vue`, da bewusst und begründet) / D (für `useMixMetrics.ts`, da zwei Werte gleichzeitig gesucht werden) | So lassen (Priorität 4). Die Autorin hat den Stil bewusst gewählt und begründet; eine erzwungene Vereinheitlichung auf `.find()` überall würde keine echte Verständlichkeit gewinnen und in `useMixMetrics.ts` sogar zwei Schleifen statt einer erfordern. |
| Fehlerbehandlung in Skripten | `scripts/check-data.ts`/`scripts/check-calculations.ts` sammeln Fehler in einem Array und setzen am Ende `process.exitCode = 1` bzw. nutzen `try/catch` mit `instanceof Error` + `process.exit(1)`; `scripts/download-smard.ts` wirft stattdessen sofort einen `Error` bei `fetchJSON()` ohne umgebenden `try/catch` auf oberster Ebene | Zwei unterschiedliche Fehlerphilosophien: „Fehler sammeln und am Ende melden" vs. „sofort werfen" | Ja – `check-data.ts` prüft viele Datensätze und soll alle Fehler auf einmal auflisten (Sammel-Pattern sinnvoll), während `download-smard.ts` einen einzelnen HTTP-Request pro Aufruf macht, bei dem ein sofortiger Abbruch sinnvoller ist | Keine Vereinheitlichung nötig – unterschiedlicher Kontext (Validierung vieler Datensätze vs. einzelner Netzwerk-Request) | Nein | D | So lassen. Beide Muster passen zu ihrem jeweiligen Anwendungsfall; ein einheitliches Muster projektweit würde in einem der beiden Fälle unpassend wirken. |
| Fehlerbehandlung in Seiten | `pages/index.vue`: `catch (caughtError: unknown)` mit `instanceof Error`-Prüfung und generischer Fallback-Meldung; `pages/dashboard.vue`: keinerlei eigene Fehlerbehandlung (delegiert vollständig an `GenerationPanel`/`EmissionsPanel`) | `dashboard.vue` hat keinen eigenen try/catch-Block | Ja – `dashboard.vue` lädt selbst keine Daten (das übernehmen die Kind-Komponenten über `useMixData()`), daher gibt es dort schlicht nichts, das im Seiten-Code selbst fehlschlagen könnte | Keine Änderung nötig | Nein | D | So lassen. Kein „fehlendes" Error-Handling, sondern folgerichtig, weil die Seite selbst keine Datenladefunktion aufruft. |
| CSS: Sidebar-Trennlinie (`.sidebar-divider`) | `components/emissions/DeviationSidebar.vue` (`height: 1px; margin: 12px 0; background: var(--line-color);`) vs. `components/generation/MixSidebar.vue` (`height: 1px; background: var(--line-color); margin: 12px 0;`) | Fast identische Regel, in zwei verschiedenen `<style scoped>`-Blöcken separat definiert (nur Reihenfolge der Deklarationen unterschiedlich) | Nein | Könnte in `assets/css/main.css` als gemeinsame `.sidebar-divider`-Klasse einmal definiert werden | Nein, sofern beide Sidebars weiterhin exakt gleich aussehen sollen | B | Sinnvoll vereinheitlichen (Priorität 2): Einfache, risikoarme CSS-Konsolidierung ohne Verhaltensänderung. |
| CSS: Rottöne für negative/Emissionswerte | `#b33` (`DeviationSidebar.vue`) vs. `#b33a3a` (`DeviationSidebar.vue` an anderer Stelle sowie `MixSidebar.vue`) | Kurzform vs. Langform derselben (oder einer sehr ähnlichen) Farbe an verschiedenen Stellen | Nein, aus dem Code allein nicht ersichtlich, ob dies beabsichtigt oder ein Versehen ist | Auf eine einheitliche Schreibweise (z. B. immer `#b33a3a`, evtl. als CSS-Variable) vereinheitlichen | Minimal – `#b33` und `#b33a3a` sind nahezu, aber laut Kurzform-Umrechnung nicht exakt gleich (`#b33` = `#bb3333`, nicht `#b33a3a`); eine Vereinheitlichung würde den Farbton um eine Nuance ändern | E / B (grenzwertig, da winzige Farbänderung möglich) | Manuell entscheiden (Priorität 3): Da `#bb3333` und `#b33a3a` nicht exakt identisch sind, müsste die Verfasserin entscheiden, welcher Rotton der eigentlich gewünschte ist, bevor hier vereinheitlicht wird. |
| Kommentar-Ausführlichkeit | `utils/charts/*.ts` (sehr ausführliche, mehrzeilige Erklärkommentare mit Architektur-Begründung) vs. einfache Vue-Komponenten wie `components/emissions/EmissionsPanel.vue` (ein einzeiliger Kommentar) | Deutlicher Unterschied in Kommentartiefe zwischen Chart-Logik und einfachen Wrapper-Komponenten | Teilweise – die Chart-Klassen enthalten tatsächlich komplexere, erklärungsbedürftigere Logik als reine Template-Wrapper | Keine erzwungene Angleichung nötig – ein 1-Zeilen-Wrapper braucht keine 15-zeilige Dokumentation | Nein | D | So lassen. Der Unterschied in der Kommentartiefe spiegelt den tatsächlichen Unterschied in der Code-Komplexität wider. |
| Selbstrechtfertigende Kommentare („Ich hätte auch X verwenden können") | Gefunden in: `pages/index.vue` Z. 37 (`Array.find`), `utils/charts/StackedAreaChart.ts` Z. 42 und `utils/charts/DeviationChart.ts` Z. 55 (jeweils „aufrufbares Interface" statt Funktions-Alias), `pages/homeDataTransform.ts` Z. 157–160 (`SourceKey`-Typ), `components/generation/AnnotationMarkers.vue` Z. 45–46 (ausgelagerte Bedingung) | Fünf Fundstellen mit sehr ähnlichem Rechtfertigungsmuster, wortwörtlich fast identische Formulierung in den beiden Chart-Dateien (`utils/charts/StackedAreaChart.ts` und `utils/charts/DeviationChart.ts`) | Aus dem Code allein nicht sicher zu beurteilen | Keine Code-Änderung – dies ist eine Beobachtung für Abschnitt 9, nicht direkt vereinheitlichbar | Nein (reine Kommentarfrage) | E | **Aus dem Quellcode allein nicht als KI-Nutzung nachweisbar.** Die nahezu wortgleiche Formulierung in zwei verschiedenen Chart-Dateien ist auffällig (entweder bewusste Selbstwiederholung der Verfasserin oder Hinweis auf einen gemeinsamen Ursprung), aber kein Beweis. Muss von der Verfasserin eingeordnet werden (siehe Abschnitt 9). |
| JSDoc `@param`/`@returns`-Konsistenz | `scripts/check-data.ts` nutzt vollständige `@param`/`@returns`-Tags konsequent; `composables/useHighContrast.ts` und Teile von `components/generation/MixSidebar.vue` haben nur Kurzbeschreibungen ohne Tags | Uneinheitliche Tiefe der JSDoc-Tags zwischen Skript-Dateien und Composables/Komponenten | Nein, keine fachliche Notwendigkeit erkennbar | Keine erzwungene Vereinheitlichung nötig – Tags sind optional und ihr Fehlen ändert nichts an der Funktionalität | Nein | E | So lassen (Priorität 4). Reine Dokumentationsstilfrage ohne Verhaltensrelevanz. |
| `addToMonthBucket`/`addToDayBucket`/`addToYearBucket` (Z. 511/551/581 in `scripts/build-data.ts`) | Strukturell ähnliche, aber jeweils auf ihr eigenes Bucket-Format zugeschnittene Funktionen | Ja, im Sinne der Aufgabenstellung: Eine Zusammenführung würde Callback-Parameter oder ein generisches Regelobjekt erfordern | Eine gemeinsame Funktion wäre **kürzer, aber nicht einfacher** – sie bräuchte einen zusätzlichen Callback- oder Konfigurationsparameter, der den Ablauf indirekter macht | Nein, wenn „so lassen" | F | So lassen (Priorität 4, **korrigiert gegenüber der ursprünglichen Empfehlung in Abschnitt 3**). Nach den strengeren Vereinfachungs-Kriterien dieses Nachtrags (keine neuen Callback-Parameter/Generics/Regelobjekte empfehlen) ist die Wiederholung hier eine akzeptable, sogar leichter nachvollziehbare Lösung für ein studentisches Projekt: Jede Funktion ist für sich allein lesbar, ohne dass man eine generische Abstraktion verstehen muss. |
| `finalizeMonthlyMix`/`finalizeScatterDaily`/`finalizeYearlyMix` (Z. 361/387/415 in `scripts/build-data.ts`) | Gleiche Situation wie oben: drei ähnliche `Array.from(...).sort(...).map(...)`-Blöcke mit unterschiedlichen Feldnamen | Ja, siehe oben | Eine generische `finalize()`-Funktion bräuchte eine Transformationsfunktion als Parameter – genau das, was laut Aufgabenstellung vermieden werden soll | Nein, wenn „so lassen" | F | So lassen (Priorität 4, **korrigiert**). Jede der drei Funktionen ist für sich genommen klar und in wenigen Zeilen erklärbar; eine gemeinsame Funktion mit Transformationsparameter wäre zwar kürzer, aber schwerer zu erklären. |
| `checkMonthlyData`/`checkDailyData`/`checkYearlyData` (Z. 66/99/140 in `scripts/check-data.ts`) | Gleiche Situation: drei ähnliche Validierungsfunktionen mit denselben `errors.push(...)`-Mustern, aber unterschiedlichen Feldern und Grenzwerten (z. B. nur `checkDailyData`/`checkYearlyData` haben die CO₂-Toleranzprüfung `co2 < 0 \|\| co2 > 1200`) | Ja | Eine gemeinsame Prüf-Helferfunktion bräuchte ein Regelobjekt oder dynamischen Feldzugriff – beides laut Aufgabenstellung zu vermeiden | Nein, wenn „so lassen" | F | So lassen (Priorität 4, **korrigiert**). Die drei Funktionen prüfen inhaltlich unterschiedliche Datensätze mit unterschiedlichen Regeln (z. B. nur zwei der drei haben die CO₂-Grenzwertprüfung); eine Zusammenführung würde dynamischen Feldzugriff oder ein Regelobjekt nötig machen und wäre damit schwerer, nicht leichter zu verstehen. |
| `utils/charts/deviationChartHelpers.ts`: `import * as d3 from 'd3'` | Wird nur für Typen (`d3.ScaleLinear<number, number>`) verwendet, nie für Laufzeitcode | Nein | Zu `import type * as d3 from 'd3'` ändern (klarer Ausdruck, dass nur Typinformationen gebraucht werden) | Nein, funktional identisch, nur klareres Signal für Lesende | B | Sinnvoll vereinheitlichen (Priorität 2, **präzisiert gegenüber Abschnitt 3**: nicht „Import entfernen", sondern „zu Typ-only-Import ändern", da vollständiges Entfernen den Typecheck brechen würde). |

---

## 8. Priorisierte Änderungen

### Priorität 1 – eindeutig beheben

- **`components/layout/SiteNav.vue` Z. 16** (`const { level, cycle } = usePageZoom()`): `cycle` existiert nicht auf dem Rückgabewert von `usePageZoom()` (Composable exportiert `cycleZoom`). Aktiver, durch `npx nuxi typecheck` bestätigter TypeScript-Fehler (TS2339). Der Zoom-Button (`@click="cycle"`, Z. 97) ist dadurch im Browser funktionslos.
- **`components/viz/StackedArea.vue`**: Vollständig verwaiste, nicht kompilierbare Datei. 9 TypeScript-Fehler (5× kaputte Importpfade nach `~/components/viz/*`, dazu `MixHoverPayload` nicht exportiert, `toggleColorMode` existiert nicht, `setSubtitle` existiert nicht an 2 Stellen). Von keiner anderen Datei im Projekt importiert (bestätigt per projektweiter Suche). Kandidat zum Löschen.
- **`composables/useHighContrast.ts` Z. 22–24 vs. Z. 26–28**: Identische DOM-Manipulationslogik (`document.documentElement.dataset.contrast = ...`) ist an zwei Stellen innerhalb derselben Datei dupliziert – die Initialisierung könnte einfach `apply()` aufrufen statt die Zuweisung ein zweites Mal zu schreiben.

### Priorität 2 – sinnvoll vereinheitlichen

- `pages/homeDataTransform.ts`: `SourceKey`-Typ (Z. 19–30) ist inhaltlich identisch mit `MixSourceKey` aus `types/mix.ts` (dieselben 10 String-Literale) – könnte durch Import von `MixSourceKey` ersetzt werden, statt den Typ ein zweites Mal zu definieren.
- CSS: `.sidebar-divider` ist in `components/emissions/DeviationSidebar.vue` und `components/generation/MixSidebar.vue` mit identischen Werten separat definiert – könnte einmal zentral in `assets/css/main.css` stehen.
- `utils/charts/deviationChartHelpers.ts` Z. 9: `import * as d3 from 'd3'` wird nur für Typen gebraucht – Umstellung auf `import type * as d3 from 'd3'` würde das klarer ausdrücken, ohne Verhalten zu ändern.

### Priorität 3 – manuell entscheiden

- Auswahl-/Hover-Namensgebung: `selected*`/`hoveredRow` (Emissions-Bereich) vs. `highlighted`/`hoverPayload` (Generation-Bereich) – beide beschreiben ähnliche Konzepte, eine Vereinheitlichung ist sinnvoll, betrifft aber viele Dateien gleichzeitig (Composables, Props, Emits) und sollte nicht nebenbei erledigt werden.
- CSS-Rottöne `#b33` vs. `#b33a3a`: Nicht exakt dieselbe Farbe (`#bb3333` vs. `#b33a3a`) – die Verfasserin muss festlegen, welcher Farbton eigentlich gewollt war, bevor hier vereinheitlicht wird.
- Selbstrechtfertigende Kommentare in `utils/charts/StackedAreaChart.ts` (Z. 42) und `utils/charts/DeviationChart.ts` (Z. 55): nahezu wortgleiche Formulierung zum „aufrufbaren Interface" – auffällig, aber nicht eindeutig als KI-Spur oder bewusste Selbstwiederholung einzuordnen; die Verfasserin sollte einschätzen, ob sie sich selbst wörtlich wiederholt hat.

### Priorität 4 – bewusst so lassen

- `addToMonthBucket`/`addToDayBucket`/`addToYearBucket` sowie `finalizeMonthlyMix`/`finalizeScatterDaily`/`finalizeYearlyMix` in `scripts/build-data.ts`: Zusammenführung würde Callback-Parameter/Transformationsfunktionen benötigen – macht den Ablauf indirekter, nicht einfacher. **Dies korrigiert die ursprüngliche Empfehlung in Abschnitt 3 dieser Datei**, die eine Zusammenführung vorschlug.
- `checkMonthlyData`/`checkDailyData`/`checkYearlyData` in `scripts/check-data.ts`: Zusammenführung würde ein Regelobjekt oder dynamischen Feldzugriff benötigen – ebenfalls **Korrektur der ursprünglichen Empfehlung in Abschnitt 3**.
- `pages/index.vue`: `findYear()` als manuelle Schleife statt `Array.find()` – bewusst begründet (Debugging), Verhalten bliebe bei Umstellung gleich, aber die einfachere Zeilenzahl macht es nicht automatisch verständlicher; die längere Schleife ist hier gut nachvollziehbar.
- Unterschiedliche Hover-Komplexität zwischen `StackedAreaChart.ts` (kontinuierlich, mit `bisector`/`pointer`/`invert`) und `DeviationChart.ts`/`GroupedBarChart.vue` (diskret, einfaches `mouseenter`/`mouseleave`): fachlich notwendig, unterschiedliche Diagrammtypen.
- Unterschiedliche Kommentartiefe zwischen `utils/charts/*.ts` und einfachen Vue-Wrapper-Komponenten: spiegelt echten Komplexitätsunterschied wider.
- `GroupedBarChart.vue` ohne eigene Chart-Klasse (im Gegensatz zu `StackedAreaChart.vue`/`DeviationChart.vue`): für ein einzelnes, nicht wiederverwendetes Diagramm ist eine eigene Klasse unnötige Architektur.

---

## 9. KI-Nutzung zur manuellen Bestätigung

| Datei/Stelle | Verdachtsgrund | Im Code beweisbar? | KI-Nutzung dokumentiert? | Muss Verfasserin bestätigen? |
|---|---|---|---|---|
| `utils/charts/StackedAreaChart.ts` (`d3.pointer`+`invert`+`bisector`-Hover, `stackOffsetExpand`, `.defined()`) | Technisch deutlich über dem Vorlesungsskript hinausgehende D3-Techniken (0 Treffer im Skript-Volltext) | Nein, nur Indiz (Abwesenheit im Skript beweist keine KI-Nutzung) | Nein | Ja |
| `scripts/build-data.ts` (Berlin-Zeitzonen-/Sommerzeit-Logik mit zwei `Intl.DateTimeFormat`-Instanzen) | Sehr präzise, nicht-triviale Detaillösung, im Skript nicht behandelt | Nein, nur Indiz | Nein | Ja |
| `pages/homeDataTransform.ts` (`SourceKey`-Typ zur Umgehung eines `keyof`-Zugriffsproblems, mit Erklärkommentar) | Fortgeschrittenes, sehr präzise erklärtes TypeScript-Muster | Nein, nur Indiz | Nein | Ja |
| `pages/index.vue` (`caughtError instanceof Error`-Narrowing im catch-Block) | Geht über einfaches try/catch hinaus | Nein, nur Indiz (weit verbreitetes Standardmuster) | Nein | Ja, aber mit niedrigerer Dringlichkeit als die anderen Zeilen dieser Tabelle |
| `utils/charts/StackedAreaChart.ts` Z. 42 und `utils/charts/DeviationChart.ts` Z. 55 (nahezu wortgleicher Rechtfertigungskommentar „aufrufbares Interface … nachdem ich zuerst normale Funktions-Aliase geschrieben hatte") | Fast identischer Wortlaut in zwei unabhängigen Dateien | Nein, nur Indiz – könnte auch bewusste Selbstwiederholung der Verfasserin sein | Nein | Ja, insbesondere weil der Wortlaut so ähnlich ist |
| `utils/charts/DeviationChart.ts` (`#opacityFor()`-Methode: einheitliche Opazitätsregel für Hover+Auswahl über Bars/Labels/Achsen-Ticks) | Auffällig „saubere", generalisierte Abstraktion einer Interaktionsregel | Nein, nur Stilverdacht | Nein | Nein – **aus dem Quellcode allein nicht als KI-Nutzung nachweisbar**, nicht automatisch in die Eigenständigkeitserklärung aufnehmen |
| `data/loadVisualizationData.ts` (`cachedData`/`pendingRequest`-Deduplizierung paralleler Ladevorgänge) | Vorausschauendes Caching-Pattern, im Skript nicht behandelt | Nein, nur Indiz | Nein | Ja |
| `scripts/check-data.ts`/`data/loadVisualizationData.ts` (Type Guards `isValidNumber`/`isVisualizationData`) | Fortgeschrittenes TypeScript-Muster (`value is X`) | Nein, nur Stilverdacht – Type Guards sind ein Standardmuster | Nein | Nein – **aus dem Quellcode allein nicht als KI-Nutzung nachweisbar** |
| Gesamter CSS-Bestand (`assets/css/main.css`, `assets/css/chart-styles.css`, alle `<style scoped>`-Blöcke) | Laut Verfasserin selbst großteils KI-gestützt | Teilweise – frühere KI-Hinweise standen im Quellcode von `main.css`/`pages/index.vue`, wurden aber in einem früheren Bearbeitungsschritt aus den Kommentaren entfernt (siehe `DOKU-GRUNDLAGE.md`) | **Ja, laut Verfasserin-Aussage** | Nein, hier bereits bestätigt – siehe Abschnitt 4 (CSS-Gesamtblock) |
| `composables/usePageZoom.ts` | Laut früherem Kopfkommentar (inzwischen entfernt) mit KI-Unterstützung entstanden | Nicht mehr im aktuellen Code nachvollziehbar, welcher Teil gemeint war | **Ja, laut früherer Dokumentation**, aber Umfang unklar | Ja – Verfasserin sollte klären, ob die gesamte Datei oder nur ein Teil gemeint war |

**Hinweis:** Diese Tabelle dient ausschließlich dazu, der Verfasserin Stellen zu zeigen, die sie selbst einordnen muss. Es wird **nicht empfohlen**, unbestätigte Verdachtsstellen automatisch in eine Eigenständigkeitserklärung zu übernehmen.

---

## 10. Geprüfte und ausgelassene Dateien (Nachtrag)

**Für diesen Nachtrag zusätzlich systematisch neu gelesen/verglichen** (über die in Abschnitt „Geprüfte Dateien" oben hinaus keine neuen Dateien, aber alle dort gelisteten Dateien wurden für den Uniformitäts-Vergleich erneut vollständig gelesen und gegeneinander verglichen, insbesondere):
- Alle Vue-Komponenten in `components/emissions/`, `components/generation/`, `components/home/`, `components/layout/`, `components/shared/`, `components/viz/` sowie `pages/*.vue` und `app.vue` (Props/Emits/computed/watch/Lifecycle-Vergleich).
- Alle TypeScript-Dateien in `utils/charts/`, `composables/`, `types/`, `data/`, `scripts/` (Interface/Type-Alias/Casts/Type-Guards/Fehlerbehandlung-Vergleich).
- Alle CSS-Quellen (`assets/css/*.css` sowie alle `<style>`/`<style scoped>`-Blöcke in Vue-Dateien).

**Zusätzlich in diesem Nachtrag durchgeführt:**
- Ein frischer `npx nuxi typecheck`-Lauf zur Bestätigung aller aktuellen TypeScript-Fehler (Ergebnis: exakt 10 Fehler in genau 2 Dateien, siehe Abschnitt 6).
- Direkte `grep`-Verifikation aller in Abschnitt 2 und 3 (ursprünglicher Bericht) genannten Zeilennummern in `scripts/build-data.ts`, `scripts/check-data.ts`, `scripts/download-smard.ts`, `data/loadVisualizationData.ts`, `composables/useMixMetrics.ts`.
- Direkte Verzeichnisauflistung von `components/`, um die (nicht existierende) Datei `components/intro/GroupedBarChart.vue` als Suchwerkzeug-Artefakt zu entlarven (siehe Methodischer Hinweis am Anfang dieses Nachtrags).

**Weiterhin bewusst ausgelassen** (unverändert gegenüber der ursprünglichen Analyse): `node_modules/`, `.nuxt/`, `.output/`, `dist/`, Lockfiles, Framework-Configs, `public/data/*.json`, `emission_factors.json`, `public/data/Visualisierung (1).pdf`, `public/fonts/`, `DOKU-GRUNDLAGE.md`, `README.md` – siehe Begründungen oben.
- `DOKU-GRUNDLAGE.md`, `README.md` – bereits vorhandene Dokumentation, keine Quelldateien im Sinne der Aufgabenstellung.

---

## 11. Umsetzungsbericht (27.07.2026)

### Kategorie 1 – Bereits umgesetzt (keine Änderung nötig)

Alle vier Muss-Änderungen waren zum Zeitpunkt der Umsetzung bereits im Quellcode korrigiert:

| Punkt | Datei | Status |
|---|---|---|
| Tote Datei `components/viz/StackedArea.vue` löschen | `components/viz/StackedArea.vue` | **Bereits gelöscht** – Verzeichnis `components/viz/` existiert, ist aber leer. Typecheck bestätigt keine Fehler mehr in dieser Datei (0 statt 9). Grep in `.ts`/`.vue`-Dateien findet keinen Import dieser Datei. |
| Zoom-Bug beheben (`cycle` → `cycleZoom`) | `components/layout/SiteNav.vue` Z. 13 | **Bereits korrekt** – destructured `const { level, cycleZoom } = usePageZoom()` mit korrektem Namen `cycleZoom`; `@click="cycleZoom"` (Z. 97) bereits passend. Kein Bug vorhanden. |
| `import * as d3` → `import type * as d3` | `utils/charts/deviationChartHelpers.ts` Z. 9 | **Bereits korrekt** – nutzt bereits `import type * as d3 from 'd3'`. |
| Doppelten `import.meta.client`-Block in `useHighContrast.ts` auflösen | `composables/useHighContrast.ts` | **Bereits korrekt** – die Init-Zeile ruft `apply()` auf, enthält keine duplizierte DOM-Zugriffslogik. |

### Kategorie 2 – Umgesetzte Konsistenz-Änderungen

#### 1. Element-Suche in Arrays – Entscheidung: `Array.find()` verwenden

**Geprüft:** 4 `.find()`-Aufrufe vs. 5 einfache Single-Element-For-Loop-Suchen im aktiven Code (plus 6 weitere komplexe For-Loop-Iterationen, die keinem `.find()` entsprechen). Das Verhältnis ist nahezu ausgeglichen (4:5). Trotz leichter Dominanz der For-Loops wurde `.find()` als einheitlicher Stil gewählt, weil:
- der Benutzer es als erste Option vorschlägt
- es der kompaktere, lesbarere Stil ist
- es im Projekt bereits verwendet wird

**Geändert:**
- `pages/index.vue` Z. 33–45: `findYear()` von manueller For-Schleife auf `data.find(...)` umgestellt. Der alte Rechtfertigungskommentar ("Ich hätte hier auch Array.find nehmen können…") durch saubere JSDoc ersetzt.

**Nicht geändert (bewusst so gelassen):**
- Die 4 For-Loop-Suchen in `DeviationChart.vue` (computed-Properties `activeYear`, `baseYear`, `selectedRow`, `selectedRowBaseShare`): Diese arbeiten mit `return null` als Fallback, was mit `.find() ?? null` umgesetzt werden müsste – gleicher Aufwand, kein Lesbarkeitsgewinn. Belasse sie im Projekt-konsistenten For-Loop-Stil (der im Projekt ohnehin dominiert).
- Die 3 Suchen in `useMixMetrics.ts`: Suchen zwei Jahre gleichzeitig in einem Durchlauf, nicht durch `.find()` ersetzbar.
- Die 4 `.find()`-Aufrufe in `StackedAreaChart.vue`, `DeviationChart.ts`, `StackedAreaChart.ts`, `check-calculations.ts`: bleiben, da `.find()` der gewählte Stil ist.

#### 2. Template-Literals in `scripts/check-data.ts`

**Geändert:** Alle 20+ `+`-Verkettungen in `scripts/check-data.ts` auf Template-Literals umgestellt – in `checkSources()`, `checkMonthlyData()`, `checkDailyData()`, `checkYearlyData()`, `main()`, `printErrors()`. Entscheidung für Template-Literals, weil der Rest des Projekts (alle anderen Skripte, Composables, Komponenten) konsequent Template-Literals nutzt.

#### 3. Catch-Block-Vereinheitlichung

**Ausgangslage:** 9 catch-Blöcke im gesamten Projekt. 7 davon nutzten bereits `instanceof Error`-Muster, 2 wichen ab.

**Geändert:**
- `scripts/download-smard.ts` Z. 201: `.catch(console.error)` → Standard-Pattern mit `instanceof Error`-Check und `String()`-Fallback, wie in `scripts/check-data.ts` und `scripts/build-data.ts`.
- `components/generation/StackedAreaChart.vue` Z. 171: `catch { }` (parameterlos) → `catch (caughtError: unknown)` mit `instanceof Error`-Check + `console.warn`. Das Verhalten (`annotations.value = []` bei Fehler) bleibt unverändert.

**Nicht geändert:**
- `components/emissions/DeviationChart.vue` – bereits konsistent.
- `composables/useMixData.ts` – bereits konsistent.
- `pages/index.vue` – bereits konsistent.
- `scripts/checks/check-calculations.ts` – bereits konsistent.
- `scripts/build-data.ts` – bereits konsistent (via separate `handleMainError`-Funktion).
- `scripts/check-data.ts` – bereits konsistent (Ternary-Variante).

#### 4. Kommentar-Ton

**Geprüft:** Projektweite Suche nach selbstrechtfertigenden Kommentaren ("hätte auch … nehmen können", "aufrufbares Interface", "nachdem ich zuerst …"). Keine Fundstellen mehr im aktiven Code – wurden bereits in einem früheren Durchgang entfernt. Keine veralteten oder bruchstückhaften Kommentare gefunden, die nach dem KI-Entfernungs-Durchgang übrig geblieben sind. Der alte `findYear()`-Kommentar in `pages/index.vue` wurde bei der Umstellung auf `.find()` durch eine sachliche JSDoc ersetzt.

### Übersprungen mit Grund

Keine – alle angefragten Änderungen aus Kategorie 1 und 2 wurden entweder umgesetzt oder als bereits erledigt dokumentiert.

### Konsistenz-Entscheidungen

| Punkt | Gewählter Stil | Begründung |
|---|---|---|
| Array-Suche | `Array.find()` | Kompakter, lesbarer; im Projekt bereits 4× verwendet; vom Benutzer als erste Option vorgeschlagen. |
| String-Bau | Template-Literals | Im gesamten restlichen Projekt (alle Skripte, Composables, Vue-Dateien) bereits einheitlich so. |
| Fehlerbehandlung | `instanceof Error` + Fallback-Text | 7 von 9 catch-Blöcken nutzen dieses Muster bereits – es ist der projekteinheitliche Stil. |

### Nachfragen

Keine – alle Punkte konnten entweder umgesetzt oder als bereits erledigt bestätigt werden.

### Verhaltensprüfung

Nach jeder Änderung mental geprüft: keine Änderung des Nutzerverhaltens.
- `findYear()` gibt weiterhin `YearlyMixPoint \| undefined` zurück – Verhalten identisch.
- Template-Literals in `check-data.ts` erzeugen dieselben Strings – Verhalten identisch.
- `download-smard.ts` `.catch()` loggt weiterhin Fehler, jetzt mit saubererer Fehlernachricht – kein Unterschied bei erfolgreichem Lauf.
- `StackedAreaChart.vue` `catch` fällt weiterhin auf `annotations.value = []` zurück – zusätzliches `console.warn` ändert nur Entwickler-Sichtbarkeit, nicht das Nutzerverhalten.

### Typecheck

`npx nuxt typecheck` – **bestanden** (28,7 s, 0 neue Fehler).

---

## 12. Studentische Vereinfachungen (27.07.2026)

Sechs gezielte Vereinfachungen, wie beauftragt. Ausgangszustand vor
dieser Runde geprüft (nicht einfach aus dem Bericht oben übernommen,
da Zeilennummern sich verschoben hatten).

### 1. Aufrufbare Interfaces → Type-Aliase

**Geprüft:** `utils/charts/DeviationChart.ts` und
`utils/charts/StackedAreaChart.ts` vollständig gelesen. Alle vier
genannten Typen (`HoverHandler`, `HoverEndHandler`, `SelectionHandler`
in `DeviationChart.ts`; `HoverHandler`, `HoverEndHandler`,
`BackgroundClickHandler` in `StackedAreaChart.ts`) sind bereits
`type X = (...) => void`-Aliase, keine aufrufbaren Interfaces mehr.
Projektweite Suche nach `interface \w+Handler` findet keine Treffer.
- **Status:** Bereits umgesetzt, keine Änderung nötig.
- Verhalten: unverändert (keine Codeänderung).

### 2. `d3.bisector` → einfache Vergleichsschleife

**Datei:** [utils/charts/stackedAreaHelpers.ts](utils/charts/stackedAreaHelpers.ts#L52)

`findNearestMonthRow()` von `d3.bisector`/`monthBisector.left(...)` auf
eine simple lineare Schleife umgestellt (Vergleich der Zeitdifferenz
pro Monatswert, kleinster Abstand gewinnt). Der Kommentar davor wurde
gekürzt: kein Lernprozess-Text zu `bisector` mehr, stattdessen kurzer
Hinweis, dass eine lineare Suche bei ca. 120 Monatswerten reicht.

Der `import * as d3 from 'd3'`-Import wurde komplett entfernt, da nach
der Umstellung keine `d3`-Funktion mehr in der Datei verwendet wird
(per Grep bestätigt).

Zusätzlich in [utils/charts/StackedAreaChart.ts](utils/charts/StackedAreaChart.ts#L11)
den Klassenkommentar korrigiert: „Bisector-basierte Monatssuche" hieß
jetzt „lineare Monatssuche", damit der Kommentar nicht mehr auf die
entfernte Technik verweist.

- Verhalten: unverändert – die Funktion liefert für jedes Datum
  weiterhin den zeitlich nächstgelegenen Monatswert zurück. Die
  bisherige Sonderfall-Behandlung (vor erstem/nach letztem Monat) ist
  in der Vergleichsschleife automatisch mit abgedeckt, da einfach der
  kleinste Abstand über alle Werte gesucht wird.
- Kommentare mit-angepasst: ja (Funktionskommentar + Klassenkommentar
  in `StackedAreaChart.ts`).

### 3. `isVisualizationData` löschen + einfacher Cast

**Datei:** [data/loadVisualizationData.ts](data/loadVisualizationData.ts#L1)

Die Funktion `isVisualizationData()` (Type Guard) entfernt. An der
Stelle, wo vorher `if (!isVisualizationData(data)) throw ...` stand,
jetzt direkt `const data = raw as VisualizationData`. Die Fehlermeldung
„Die Visualisierungsdaten haben ein ungültiges Format." ist damit weg,
da es keine Laufzeitprüfung mehr gibt, die sie auslösen könnte.
Dateikopf-Kommentar entsprechend gekürzt (Hinweis: Struktur ist bereits
über `scripts/check-data.ts` geprüft).

- Verhalten: Fast unverändert. Einziger Unterschied: Falls die JSON-
  Datei zur Laufzeit unerwartet eine falsche Struktur hätte (z. B.
  durch einen fehlerhaften Build), gäbe es vorher einen sauberen
  Fehlertext, jetzt liefe der Code mit falsch typisierten Daten weiter
  und würde erst später (z. B. bei einem fehlenden Feld) mit einer
  weniger sprechenden Fehlermeldung crashen. Im Normalbetrieb (Daten
  kommen aus dem eigenen, durch `check-data.ts` geprüften Build) macht
  das keinen Unterschied für den Nutzer.
- Kommentare mit-angepasst: ja (Dateikopf, JSDoc der Ladefunktion).

### 4. `SourceKey`-Typ entfernen

**Datei:** [pages/homeDataTransform.ts](pages/homeDataTransform.ts#L28)

**Geprüft:** Ein eigener `SourceKey`-Typ existierte im aktuellen Code
bereits nicht mehr – `ItemConfigEntry.key` ist bereits als
`MixSourceKey` (importiert aus `~/types/mix`) typisiert, keine lokale
Neudefinition. Der Zugriff `year2015.sources[configItem.key]`
funktioniert bereits ohne zusätzlichen Cast.

Der einzige veraltete Rest war ein Kommentar, der noch von einem
eigenen `SourceKey`-Typ „weiter oben" sprach, den es gar nicht mehr
gibt. Kommentar korrigiert: verweist jetzt korrekt auf `MixSourceKey`.

- **Status:** Typ-Entfernung bereits erledigt, nur Kommentar repariert.
- Verhalten: unverändert (keine Codeänderung, nur Kommentartext).
- Kommentare mit-angepasst: ja.

### 5. `BaseChart.margin`-Kopie einfacher zurückgeben

**Datei:** [utils/charts/BaseChart.ts](utils/charts/BaseChart.ts#L67)

Im Konstruktor `this.#margin = { ...margin }` → `this.#margin = margin`.
Im Getter `get margin()` `return { ...this.#margin }` → `return this.#margin`.
Kommentare entsprechend angepasst: der Konstruktor-Kommentar zur
absichtlichen Kopie wurde entfernt, der Getter-Kommentar erklärt jetzt
kurz, dass eine Kopie hier nicht nötig ist, weil das Margin von außen
nicht verändert wird.

- **Geprüft vor der Änderung:** `chart.margin` wird im gesamten Projekt
  nur lesend verwendet (kein Code schreibt in die Properties des
  zurückgegebenen Objekts), und niemand hält eine Referenz auf das
  `margin`-Objekt, das dem Konstruktor übergeben wird, um es später zu
  verändern.
- Verhalten: unverändert für den Nutzer. Technisch ist die Kapselung
  minimal schwächer (Aufrufer könnten das interne Objekt jetzt direkt
  verändern), das wird aber im Projekt nirgends getan.

### 6. `pendingRequest`-Deduplizierung entfernen

**Datei:** [data/loadVisualizationData.ts](data/loadVisualizationData.ts#L1)

Die Modul-Variable `pendingRequest`, die Prüfung `if (pendingRequest)
return pendingRequest`, und die separate Hilfsfunktion
`loadAndCacheData()` entfernt. `fetchVisualizationData()` wurde direkt
in `loadVisualizationData()` hineingezogen, weil sie danach nur noch
von dort aufgerufen wurde und als eigene Funktion keinen zusätzlichen
Lesbarkeitsgewinn mehr hatte. Übrig bleibt der einfache Cache mit
`cachedData`. Kommentare zur `pendingRequest`-Logik entfernt, der
Cache-Kommentar („Einmal geladen, wird das Ergebnis im Cache
gehalten...") bleibt kurz erhalten.

- Verhalten: Für den Normalfall unverändert (Daten werden geladen,
  gecacht, bei weiteren Aufrufen aus dem Cache zurückgegeben). Einzige
  Abweichung: Wenn zwei Aufrufer `loadVisualizationData()` exakt
  gleichzeitig aufrufen, bevor der erste Request fertig ist, werden
  jetzt zwei parallele Netzwerk-Requests ausgelöst statt einem
  (vorher wartete der zweite Aufruf auf den ersten). Im Projekt rufen
  `pages/index.vue` und `composables/useMixData.ts` diese Funktion auf
  unterschiedlichen Routen auf (Startseite vs. Dashboard), ein
  gleichzeitiger Aufruf beider ist im normalen Nutzungsfluss praktisch
  ausgeschlossen. Für den Nutzer sichtbar ändert sich nichts (gleiche
  Daten, am Ende identischer Zustand).
- Kommentare mit-angepasst: ja (Dateikopf, JSDoc der Ladefunktion).

### Übersprungen mit Grund

Keine der sechs Änderungen musste übersprungen werden. Punkte 1 und 4
waren bereits im Code umgesetzt (nur Kommentare brauchten Korrektur).

### Nachfragen

- Punkt 6 (`pendingRequest` entfernen): Die Deduplizierung nebenläufiger
  Requests ist eine bewusste Absicherung gegen doppelte Netzwerk-
  Aufrufe bei gleichzeitigem Laden. Das Entfernen ändert die
  Fehlerrobustheit geringfügig (siehe oben), auch wenn im aktuellen
  Nutzungsfluss kein gleichzeitiger Aufruf von zwei Stellen auftritt.
  Falls das doch relevant sein sollte (z. B. bei künftigen Änderungen,
  die beide Seiten gleichzeitig laden), bitte kurz Bescheid geben.

### Typecheck

`npx nuxt typecheck` – **bestanden** (mehrfach nach den Änderungen
ausgeführt, zuletzt in 37,8 s, 0 neue Fehler).
