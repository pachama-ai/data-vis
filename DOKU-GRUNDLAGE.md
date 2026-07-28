# Doku-Grundlage

Diese Datei ist die Rohgrundlage für die spätere Projektdokumentation
und das Benutzerhandbuch. Sie wird Datei für Datei beim Durchgehen des
Quellcodes befüllt. Der Abschnitt "KI-Verdacht" dient ausschließlich
der eigenen Nachvollziehbarkeit für die Eigenständigkeitserklärung und
ist nicht Teil der eigentlichen Projektdokumentation.

---

## app.vue

- **Bereich:** Nuxt-Root-Komponente
- **Aufgabe:** Wurzelkomponente der gesamten App; bindet die globale
  Navigation ein und stellt die Nuxt-Seitenauflösung bereit.
- **Aufbau/Logik:** Sehr kurz - ein Kommentar ("app.vue — Root-
  Komponente der Nuxt-App. SiteNav wird global oberhalb von
  `<NuxtPage/>` eingebunden.") gefolgt von
  `<template><SiteNav /><NuxtPage /></template>`. Kein `<script>`-Block.
- **Daten/Zusammenspiel:** `SiteNav` erscheint dadurch auf jeder Seite
  der App; `NuxtPage` rendert die jeweils aktive Seite aus `pages/`.
- **Berechnungen/Techniken:** Keine.
- **Relevanz fürs Handbuch:** Gering direkt, aber erklärt, warum die
  Navigation auf allen Seiten gleich aussieht.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine Kommentare, die auf KI-Nutzung hindeuten).
- **Auffälligkeiten:** Keine Trennlinien, keine KI-Erwähnungen. Diese
  Datei hatte bislang keinen eigenen Eintrag in diesem Dokument -
  am 27.07.2026 ergänzt.

---

## types/mix.ts

- **Bereich:** Typdefinition
- **Aufgabe:** Definiert alle TypeScript-Typen, die für den Strommix-
  (Stacked-Area-)Chart und den Deviation-Chart gebraucht werden:
  Energieträger-Keys, Gruppen, Anzeigemodi, Zeilen- und Jahres-Interfaces.
- **Aufbau/Logik:** Union-Typen `MixSourceKey`, `MixGroup`, `MixMode`,
  `ColorMode`; Interfaces `MixMonthRow`, `MixAnnotation` für den
  Stacked-Area-Chart; `EmissionFactorSource`, `EmissionFactorsFile`,
  `EmissionRow`, `DeviationYear` für den Deviation-Chart.
- **Daten/Zusammenspiel:** Baut auf `EnergySourceValues` und
  `MonthlyMixPoint` aus types/visualization-data.ts auf. Wird von
  praktisch allen Composables und Chart-Klassen importiert
  (useMixData, useMixMetrics, StackedAreaChart.ts, DeviationChart.ts,
  deviationData.ts, emissionsData.ts).
- **Berechnungen/Techniken:** Reine Typdefinitionen, keine Laufzeitlogik.
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar.
- **Auffälligkeiten:** Datei enthielt zwei ASCII-Trennlinien
  (`// ===...===`) vor den Abschnitten "Annotationen" und
  "Deviation-Chart" - entfernt und durch normale Kommentarzeilen ersetzt.

---

## types/visualization-data.ts

- **Bereich:** Typdefinition
- **Aufgabe:** Beschreibt die Struktur der zentralen
  `visualization-data.json`, die von `scripts/build-data.ts` erzeugt und
  von `scripts/check-data.ts` geprüft wird.
- **Aufbau/Logik:** `EnergySourceValues` (12 SMARD-Energieträger in MWh),
  `MonthlyMixPoint`, `ScatterDailyPoint`, `YearlyMixPoint` und die
  Gesamtstruktur `VisualizationData`.
- **Daten/Zusammenspiel:** Grundlage für `types/mix.ts` und für alle
  Stellen, die `public/data/visualization-data.json` laden (u. a.
  `data/loadVisualizationData.ts`).
- **Berechnungen/Techniken:** Reine Typdefinitionen. Kommentare weisen
  auf Berliner Lokalzeit-Auswertung und die MWh-Einheit hin.
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar.
- **Auffälligkeiten:** Keine, Datei war bereits sauber kommentiert.

---

## scripts/download-smard.ts

- **Bereich:** Datenaufbereitung (Download-Skript)
- **Aufgabe:** Lädt die stündlichen Erzeugungsdaten (und ein paar
  Zusatzwerte wie Last und Pumpspeicherverbrauch) von der öffentlichen
  SMARD-Chart-Data-API und speichert sie zusammengeführt als
  `public/data/smard.json`.
- **Aufbau/Logik:** `filters` (Energieträger → SMARD-Filter-ID),
  `fetchJSON` (HTTP-Helfer), `getTimestamps` (verfügbare Wochenblöcke
  ermitteln), `fetchBlock` (einzelnen Block laden), `fetchFilter` (alle
  Blöcke eines Energieträgers in Gruppen von 8 laden), `main` (alle
  Energieträger laden und nach Zeitstempel zusammenführen).
- **Daten/Zusammenspiel:** Ruft `https://www.smard.de/app/chart_data/...`
  auf. Ergebnis `public/data/smard.json` ist die Rohdatenquelle für
  `scripts/build-data.ts`.
- **Berechnungen/Techniken:** Blockweises, parallel begrenztes Laden
  (`Promise.all` über Gruppen von 8 Zeitstempeln), Zusammenführen nach
  Zeitstempel in einem `Record`, Sortierung am Ende.
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant (reines Build-/Datenaufbereitungsskript, läuft nicht im
  Browser).
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (Datei enthielt keine KI-Erwähnungen im Kommentar).
- **Auffälligkeiten:** Der `filters`-Konfiguration enthält zusätzlich
  zu den 12 in `EnergySourceValues` benötigten Energieträgern noch
  `last` (Gesamtlast), `residuallast` und `pumpspeicherVerbrauch`. Diese
  drei zusätzlichen Zeitreihen werden mitgeladen und landen in
  `smard.json`, werden aber von den 12 benötigten Feldern in
  `EnergySourceValues` nicht verwendet - vermutlich Datenreste von
  früheren Auswertungsideen oder zum Testen.

---

## scripts/build-data.ts

- **Bereich:** Datenaufbereitung (Build-Skript)
- **Aufgabe:** Erstellt aus `public/data/smard.json` und
  `emission_factors.json` die zentrale `public/data/visualization-data.json`
  mit Monats-, Tages- und Jahreswerten für alle Diagramme.
- **Aufbau/Logik:** Läuft einmal über alle stündlichen SMARD-Zeilen,
  wandelt jeden Zeitstempel in Berliner Lokalzeit um
  (`getBerlinDateParts`), liest die Erzeugungswerte
  (`extractSources`), prüft sie auf Gültigkeit und sammelt sie in
  Monats-, Tages- und Jahres-Buckets (`addToMonthBucket`,
  `addToDayBucket`, `addToYearBucket`). Am Ende werden die Buckets zu
  sortierten Arrays zusammengefasst (`finalizeMonthlyMix`,
  `finalizeScatterDaily`, `finalizeYearlyMix`).
- **Daten/Zusammenspiel:** Liest `public/data/smard.json` (aus
  `download-smard.ts`) und `emission_factors.json`. Schreibt
  `public/data/visualization-data.json`, die von `check-data.ts`
  geprüft und vom Frontend (`data/loadVisualizationData.ts`) geladen
  wird. Nutzt die Typen aus `types/visualization-data.ts`.
- **Berechnungen/Techniken:** CO₂-gewichtete Summe (Erzeugungswert ×
  Emissionsfaktor je Energieträger), Erneuerbaren-Anteil, Umrechnung
  UTC → Berliner Lokalzeit mit `Intl.DateTimeFormat`, Sortierung der
  Buckets mit `localeCompare`, Qualitätsprüfung mit Abbruch bei zu
  vielen verworfenen Stunden (`checkSkippedHours`).
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant (reines Build-Skript).
- **KI-Verdacht:** Die Datei enthielt vor der Überarbeitung an rund
  20 Stellen explizite "MIT KI:"/"OHNE KI:"-Vermerke in den
  JSDoc-Kommentaren. Genannt wurden dabei: die Verarbeitung der
  Berliner Zeitzone mit `Intl.DateTimeFormat`/`formatToParts()`, die
  TypeScript-Typisierung dynamischer Feldnamen (`Record<string,
  keyof …>`, der Doppel-Cast `as unknown as EmissionFactors`), die
  Aufteilung der ursprünglich sehr langen Hauptfunktion in kleinere
  Hilfsfunktionen, der Aufbau der `checkSkippedHours`-Sicherheitsprüfung
  sowie die sichere Fehlerbehandlung mit `instanceof Error` im
  catch-Block. Diese Angaben stammen aus den ursprünglichen
  Code-Kommentaren und wurden im Zuge der Überarbeitung aus dem Code
  entfernt.
- **Auffälligkeiten:** Die Funktion `main()` ist mit weitem Abstand die
  längste Funktion der Datei (rund 60 Zeilen), da sie den gesamten
  Ablauf (Laden, Schleife über alle Rohdaten, Aggregation, Schreiben)
  koordiniert - das ist bei einem Build-Skript mit klar linearem
  Ablauf aber nachvollziehbar und wurde bereits in Hilfsfunktionen
  aufgeteilt.

---

## scripts/check-data.ts

- **Bereich:** Datenaufbereitung (Qualitätsprüfung)
- **Aufgabe:** Prüft nach dem Bauen der `visualization-data.json`, ob
  alle drei Datenbereiche (Monats-, Tages-, Jahreswerte) vorhanden und
  die Werte darin plausibel sind (z. B. keine negativen Werte, Summen
  stimmen, Prozentwerte liegen zwischen 0 und 100).
- **Aufbau/Logik:** `isValidNumber` als Basisprüfung, `checkSources`
  für die 12 Energieträgerwerte, `checkMonthlyData`/`checkDailyData`/
  `checkYearlyData` für die drei Datenbereiche, `main` als
  Gesamtablauf, `printErrors` zur Ausgabe gesammelter Fehler.
- **Daten/Zusammenspiel:** Liest `public/data/visualization-data.json`
  und nutzt die Typen aus `types/visualization-data.ts`. Wird manuell
  über `bun run scripts/check-data.ts` aufgerufen, nachdem
  `build-data.ts` gelaufen ist.
- **Berechnungen/Techniken:** Toleranzgrenzen: Quellensumme darf
  höchstens 1 MWh vom Gesamtwert abweichen, CO₂-Werte müssen zwischen
  0 und 1200 g/kWh liegen, Prozentwerte zwischen 0 und 100, Jahre
  zwischen 2015 und 2024.
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant.
- **KI-Verdacht:** Der ursprüngliche Datei-Header enthielt den Hinweis
  "Bei dieser Datei wurde viel mit KI gearbeitet. Die KI half vor
  allem bei der Struktur der Prüfungen, bei TypeScript-Typen und bei
  der Fehlerbehandlung." Diese Angabe wurde aus dem Code entfernt.
- **Auffälligkeiten:** Die drei Check-Funktionen
  (`checkMonthlyData`/`checkDailyData`/`checkYearlyData`) enthalten
  jeweils sehr ähnliche Prüf-Logik (CO₂-Bereich, Prozent-Bereich,
  Stundenanzahl) - eine gemeinsame Hilfsfunktion wäre möglich, wurde
  aber im Sinne der einfachen, direkten Schreibweise nicht
  eingeführt.

---

## scripts/checks/check-calculations.ts

- **Bereich:** Datenaufbereitung (Kontrollrechnung)
- **Aufgabe:** Rechnet für das Jahr 2024 ein paar zentrale Kennzahlen
  (Jahressumme, Erneuerbarenanteil, Kernenergie-Nullwert) unabhängig
  von `build-data.ts` noch einmal von Hand nach, um Rechenfehler in
  der Aggregation aufzudecken.
- **Aufbau/Logik:** `loadData`, `findYear2024`, `checkYearlyTotal`
  (Monatssumme vs. Jahreswert), `checkRenewableShare` (Erneuerbaren-
  Anteil selbst berechnet vs. gespeichert), `main` als Ablauf mit
  abschließender Kernenergie-Prüfung.
- **Daten/Zusammenspiel:** Liest `public/data/visualization-data.json`
  direkt von der Festplatte, nutzt die Typen aus
  `types/visualization-data.ts`.
- **Berechnungen/Techniken:** Toleranzen: 1 MWh bei der Jahressumme,
  0,1 Prozentpunkte beim Erneuerbarenanteil. Wirft bei Abweichung
  einen Fehler mit `process.exit(1)`.
- **Relevanz fürs Handbuch:** Für das Benutzerhandbuch nicht direkt
  relevant.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Keine.

---

## composables/useHighContrast.ts

- **Bereich:** Composable (globaler UI-Zustand)
- **Aufgabe:** Stellt einen Ein/Aus-Schalter für einen kontrastreicheren
  Anzeigemodus bereit (kräftigere Farben, stärkere Kontraste).
- **Aufbau/Logik:** `isActive`-Ref auf Modulebene, damit der Zustand
  beim Seitenwechsel erhalten bleibt. `toggle`, `apply`, `setActive`
  als Funktionen. `apply` setzt `dataset.contrast` auf dem
  Wurzelelement und synchronisiert den Chart-Farbmodus über
  `useMixSelection().setColorMode`.
- **Daten/Zusammenspiel:** Nutzt `useMixSelection` für den
  chartseitigen Farbmodus. Wird von der Navigation (Kontrast-Button)
  aufgerufen.
- **Berechnungen/Techniken:** Keine Berechnungen, reine
  Zustandsverwaltung. `import.meta.client`-Prüfung, da
  `document` im SSR-Build nicht existiert (Projekt läuft aber mit
  `ssr: false`).
- **Relevanz fürs Handbuch:** Ja - der Kontrastmodus ist eine
  Bedienfunktion, die im Handbuch erklärt werden sollte.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Keine.

---

## composables/useMixData.ts

- **Bereich:** Composable (Datenaufbereitung für den Strommix-Chart)
- **Aufgabe:** Normalisiert die rohen Monatsdaten aus
  `useVisualizationData` für das Stacked-Area-Chart: Reduktion auf die
  zehn relevanten Quellen, Umrechnung MWh → TWh, Datumsparsing und
  Berechnung von Jahressummen.
- **Aufbau/Logik:** `parseMonth`, `convertMwhToTwh`,
  `createEmptySourceValues` als Hilfsfunktionen; `normalizeMonth`
  wandelt einen `RawMixMonthPoint` in eine `MixMonthRow` um;
  `calculateYearRows` gruppiert Monatszeilen nach Jahr und summiert
  sie auf. `useMixData()` hält `rawData`, `pending`, `error` als Refs
  und stellt `monthRows`/`yearRows` als computed bereit.
- **Daten/Zusammenspiel:** Nutzt `useVisualizationData` für den Fetch,
  `STACK_ORDER` aus `components/generation/mixConfig` für die
  Quellenreihenfolge, Typen aus `types/mix.ts` und
  `types/visualization-data.ts`.
- **Berechnungen/Techniken:** MWh→TWh-Umrechnung durch Division durch
  1.000.000; Jahressummen über eine `Map<number, ...>`, anschließend
  aufsteigend sortiert.
- **Relevanz fürs Handbuch:** Indirekt - liefert die Datenbasis für
  den Strommix-Chart, aber keine eigene Bedienfunktion.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Datei enthielt fünf ASCII-Trennlinien-Blöcke
  (`// ===...===`) um Abschnittsüberschriften - entfernt, die
  Überschriften selbst als normale Kommentarzeile beibehalten.

---

## composables/useMixSelection.ts

- **Bereich:** Composable (gemeinsamer Auswahlzustand)
- **Aufgabe:** Hält den Auswahlzustand, den sich Strommix- und
  Deviation-Chart teilen: Anzeigemodus, Farbmodus, hervorgehobene
  Quelle, ausgewähltes Jahr, ausgewählte Annotation.
- **Aufbau/Logik:** Alle Refs (`mode`, `colorMode`, `highlighted`,
  `selectedYear`, `selectedAnnotation`) liegen auf Modulebene, damit
  alle aufrufenden Komponenten denselben Zustand teilen, ohne
  Event-Bus oder State-Library. Setter-Funktionen wie `setMode`,
  `setHighlighted`, `toggleHighlighted`, `toggleAnnotation`.
- **Daten/Zusammenspiel:** Wird von `useHighContrast` (Farbmodus) und
  von den Chart-Komponenten (Hervorhebung, Auswahl) genutzt. Typen aus
  `types/mix.ts`.
- **Berechnungen/Techniken:** Keine Berechnungen, reine
  Zustandsverwaltung mit Toggle-Logik.
- **Relevanz fürs Handbuch:** Indirekt - steuert Interaktionen wie
  Hervorhebung und Jahresauswahl in den Charts.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Datei enthielt zwei ASCII-Trennlinien-Blöcke
  um Abschnittsüberschriften - entfernt, Überschriften beibehalten.

---

## composables/useMixMetrics.ts

- **Bereich:** Composable (reine Berechnungsfunktionen)
- **Aufgabe:** Berechnet alle Kennzahlen rund um den Strommix-Chart:
  Übersichtsvergleich 2015 → 2024 je Gruppe, Kennzahlen für eine
  einzelne Quelle (inkl. Höchst-/Tiefstmonat) und den Kontext für eine
  ausgewählte Annotation.
- **Aufbau/Logik:** Enthält keine Vue-Refs und keinen eigenen State -
  nur reine Funktionen. Hilfsfunktionen (`createEmptyGroupValues`,
  `calculateYearTotal`, `calculateYearGroupValues`,
  `calculateMonthTotal`, `calculateMonthGroupValues`,
  `roundToOneDecimal`, `calculateShare`) und drei Hauptfunktionen
  (`getOverviewMetrics`, `getSourceMetrics`, `getAnnotationContext`),
  die bei fehlenden Daten `null` zurückgeben statt einen Fehler zu
  werfen.
- **Daten/Zusammenspiel:** Nutzt `MixYearRow` aus `useMixData.ts`,
  `GROUP_OF`/`STACK_ORDER`/`MIX_GROUP_ORDER` aus
  `components/generation/mixConfig` und Typen aus `types/mix.ts`.
- **Berechnungen/Techniken:** Anteile werden mit Schutz vor Division
  durch null berechnet (`calculateShare`). Prozentpunkt-Änderung wird
  erst nach dem Runden auf eine Nachkommastelle gebildet, damit die
  Differenz zur angezeigten Rundung passt.
- **Relevanz fürs Handbuch:** Ja - die berechneten Kennzahlen
  erscheinen direkt in der Benutzeroberfläche (Übersicht, Quellen-
  Detailansicht, Annotationen).
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Datei enthielt mehrere ASCII-Trennlinien
  (als Abschnittsüberschriften und als alleinstehende Trenner
  zwischen Funktionen ohne Beschriftung) - alle entfernt.

---

## composables/usePageZoom.ts

- **Bereich:** Composable (globaler UI-Zustand)
- **Aufgabe:** Steuert eine Zoom-Stufe für die gesamte Seite (100 %,
  105 %, 110 %), die beim Seitenwechsel erhalten bleibt.
- **Aufbau/Logik:** `currentLevel`-Ref auf Modulebene mit den erlaubten
  Stufen `ZOOM_LEVELS`. `applyZoom` setzt `document.documentElement.
  style.zoom`, `cycleZoom` wechselt zyklisch zur nächsten Stufe,
  `setZoomLevel` setzt eine bestimmte Stufe direkt.
- **Daten/Zusammenspiel:** Wird vermutlich von einem Zoom-Button in der
  Navigation aufgerufen.
- **Berechnungen/Techniken:** Zyklischer Index mit Modulo-Operator
  (`(currentIndex + 1) % ZOOM_LEVELS.length`).
- **Relevanz fürs Handbuch:** Ja - Zoom ist eine Bedienfunktion für
  Barrierefreiheit/Lesbarkeit.
- **KI-Verdacht:** Datei enthielt im Kopfkommentar den Satz "Diese
  Datei ist mit KI-Unterstützung entstanden" - entfernt. Ohne
  weitere Angaben ist nicht mehr rekonstruierbar, welcher Teil genau
  mit KI-Unterstützung entstanden ist; von der Verfasserin zu
  ergänzen, falls für die Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Siehe KI-Verdacht.

---

## data/loadVisualizationData.ts

- **Bereich:** Datenzugriff (Fetch mit Cache)
- **Aufgabe:** Lädt `public/data/visualization-data.json` per `fetch`
  und hält das Ergebnis in einem Modul-Cache, damit die Datei nicht
  mehrfach geladen wird.
- **Aufbau/Logik:** Stand 27.07.2026 nach der studentischen
  Vereinfachung (siehe KI-UND-VEREINFACHUNG.md, Abschnitt 12) deutlich
  schlanker als zuvor: nur noch die Modul-Variable `cachedData` und
  eine einzige Funktion `loadVisualizationData()` innerhalb von
  `useVisualizationData()`. Die Funktion prüft zuerst den Cache, lädt
  bei Bedarf per `fetch`, prüft `response.ok`, castet die Antwort
  direkt auf `VisualizationData` und füllt den Cache. Der frühere
  Typwächter `isVisualizationData` und die `pendingRequest`-basierte
  Deduplizierung gleichzeitiger Aufrufe wurden entfernt (bewusste
  Vereinfachung, kein Bugfix).
- **Daten/Zusammenspiel:** Wird von `useMixData` und `pages/index.vue`
  als Datenquelle genutzt. Typen aus `types/visualization-data.ts`.
- **Berechnungen/Techniken:** Keine eigene Validierung mehr - der
  Kommentar über der Funktion verweist stattdessen auf die bereits
  vorhandene Prüfung durch `scripts/check-data.ts` beim Bauen der
  Datei.
- **Relevanz fürs Handbuch:** Indirekt - technische Grundlage für alle
  Strommix-Ansichten.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Ohne die frühere Deduplizierung könnten zwei
  exakt gleichzeitige erste Aufrufe theoretisch zwei parallele Fetches
  auslösen. Da `useVisualizationData()` in der aktuellen App nur von
  je einer Seite/einem Composable pro Route aus aufgerufen wird, ist
  das in der Praxis kaum relevant (siehe offene Nachfrage in
  KI-UND-VEREINFACHUNG.md, Abschnitt 12, Punkt 6). Kein Code in dieser
  Aufgabe verändert.

---

## utils/charts/BaseChart.ts

- **Bereich:** Chart-Infrastruktur (abstrakte Basisklasse)
- **Aufgabe:** Kapselt die gemeinsamen Chart-Abmessungen (Breite,
  Höhe, Ränder) und gibt ein einheitliches Interface (`render`,
  `update`, `destroy`) für alle D3-Charts im Projekt vor.
- **Aufbau/Logik:** Konstruktor mit `width`/`height`/`margin` und
  Standardwerten, leitet `innerWidth`/`innerHeight` ab. Der
  `margin`-Getter gibt seit der studentischen Vereinfachung am
  27.07.2026 (siehe KI-UND-VEREINFACHUNG.md, Abschnitt 12, Punkt 5)
  das interne `#margin`-Objekt direkt zurück, ohne es vorher zu
  kopieren - der Kommentar an der Stelle begründet das damit, dass
  `margin` im gesamten Projekt nur lesend verwendet wird. Drei
  abstrakte Methoden `render`, `update`, `destroy` müssen von
  Unterklassen implementiert werden.
- **Daten/Zusammenspiel:** Wird von `DeviationChart` und
  `StackedAreaChart` per `extends` genutzt; beide geben im
  Konstruktor eigene Abmessungen an `super()` weiter.
- **Berechnungen/Techniken:** Einfache Subtraktion für
  `innerWidth`/`innerHeight`. Private Klassenfelder (`#width` usw.)
  für echte Kapselung.
- **Relevanz fürs Handbuch:** Indirekt - technisches Fundament, keine
  eigene Bedienfunktion.
- **KI-Verdacht:** Aus dem Quellcode allein nicht sicher erkennbar
  (keine KI-Erwähnungen im Kommentar vorhanden).
- **Auffälligkeiten:** Keine.

---

## utils/charts/deviationChartHelpers.ts

- **Bereich:** Chart-Hilfsfunktionen (Abweichungsdiagramm)
- **Aufgabe:** Stellt zustandslose, einzeln testbare Funktionen für
  das Abweichungsdiagramm bereit: Balkenposition/-breite für ein
  divergierendes Layout um die Nulllinie, symmetrische x-Achsen-Domain,
  Labelposition/-ausrichtung und Formatierung von Prozentpunkten.
- **Aufbau/Logik:** `getDeviationBarX`/`getDeviationBarWidth`
  (Balkenlayout), `createSymmetricDomain` (feste Achsen-Domain über
  alle Jahre), `findMaximumAbsoluteDeviation` (größte Abweichung
  suchen), `labelX`/`labelAnchor` (Labelposition),
  `formatPercentagePoints` (Textformat mit Vorzeichen und Einheit).
- **Daten/Zusammenspiel:** Wird von `utils/charts/DeviationChart.ts`
  genutzt. Nutzt Typen aus `types/mix.ts`.
- **Berechnungen/Techniken:** Divergierendes Balkenlayout: negative
  Balken laufen vom Wert zur Nulllinie, positive von der Nulllinie
  zum Wert. Symmetrische Domain wird auf den nächsten Zehnerwert
  aufgerundet (`Math.ceil(x / 10) * 10`), damit die Achse beim
  Jahreswechsel nicht springt. Echtes Minuszeichen (−) statt
  Bindestrich in der Formatierung, damit die Textausrichtung im SVG
  nicht verrutscht.
- **Relevanz fürs Handbuch:** Indirekt - technische Grundlage für die
  Darstellung des CO₂-Vergleichs.
- **KI-Verdacht:** Datei enthielt mehrere "MIT KI"/"OHNE KI"-Vermerke
  in fast jeder Funktion (u. a. zum divergierenden Balkenlayout, zur
  symmetrischen Domain, zur Labelposition und zur Formatierung) -
  alle entfernt. Ohne weitere Angaben ist nicht mehr im Detail
  rekonstruierbar, welcher Anteil mit und welcher ohne KI-Unterstützung
  entstanden ist; von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Siehe KI-Verdacht.

---

## utils/charts/stackedAreaHelpers.ts

- **Bereich:** Chart-Hilfsfunktionen (Strommix-Chart)
- **Aufgabe:** Stellt zustandslose Funktionen und Typen für die
  `StackedAreaChart`-Klasse und die Vue-Anbindung bereit: Umwandlung
  eines Ereignisdatums in ein `Date`-Objekt und Suche nach dem
  nächstgelegenen Monatswert für den Hover.
- **Aufbau/Logik:** `MixHoverPayload`-Interface für die
  Hover-Nutzlast; `parseAnnotationDate` (parst "YYYY-MM" oder "YYYY",
  setzt bei reinem Jahr die Jahresmitte als Fallback);
  `findNearestMonthRow`. Seit der studentischen Vereinfachung am
  27.07.2026 (siehe KI-UND-VEREINFACHUNG.md, Abschnitt 12, Punkt 2)
  läuft `findNearestMonthRow` über eine einfache lineare Schleife
  (Vergleich von `Math.abs(targetDate.getTime() - row.date.getTime())`
  für jede Zeile) statt über `d3.bisector`. Der `d3`-Import wurde dabei
  komplett entfernt, die Datei hat jetzt keine Laufzeit-Abhängigkeit
  zu D3 mehr.
- **Daten/Zusammenspiel:** Wird von `utils/charts/StackedAreaChart.ts`
  genutzt. Nutzt Typen aus `types/mix.ts`.
- **Berechnungen/Techniken:** Lineare Suche über alle Monatswerte;
  bei rund 120 Monatswerten (10 Jahre) laut Kommentar in der Datei
  kein Performance-Thema, deshalb bewusst keine Bisektionssuche mehr.
- **Relevanz fürs Handbuch:** Indirekt - technische Grundlage für den
  Hover-Tooltip im Strommix-Chart.
- **KI-Verdacht:** Datei enthielt vor der Überarbeitung mehrere
  "MIT KI"/"OHNE KI"-Vermerke, u. a. zur Auslagerung der Funktionen und
  zur ursprünglichen Suche mit `d3.bisector` - alle entfernt. Von der
  Verfasserin zu ergänzen, falls für die Eigenständigkeitserklärung
  relevant.
- **Auffälligkeiten:** Siehe KI-Verdacht. Zusätzlich: Die
  Bisector-basierte Suche wurde im Rahmen der studentischen
  Vereinfachung durch eine lineare Suche ersetzt (kein KI-Verdacht,
  sondern eine bewusste, dokumentierte Vereinfachung dieser Aufgabe).

---

## utils/charts/DeviationChart.ts

- **Bereich:** Chart-Klasse (Abweichungsdiagramm)
- **Aufgabe:** Zeichnet das Abweichungsdiagramm für den CO₂-Vergleich:
  Für jeden Energieträger vergleicht ein Balken den Anteil an der
  Stromerzeugung mit dem Anteil an den direkten CO₂-Emissionen.
- **Aufbau/Logik:** Erbt von `BaseChart`. Öffentliche Setter
  (`setData`, `setXDomain`, `setHighlight`, `setSelectedSource`,
  `setHoverHandler`, `setHoverEndHandler`, `setSelectionHandler`,
  `setColors`, `setSortMode`), `render`/`update`/`destroy` als
  Umsetzung der abstrakten `BaseChart`-Methoden, private Methoden für
  Skalen (`#createXScale`, `#createYScale`), statische Elemente
  (Nulllinie, Gruppentrenner, Richtungslabels), Balken und Labels
  (`#renderBars`, `#renderValueLabels`) sowie Hervorhebung
  (`#opacityFor`, `#updateHighlight`) und Klick-Handling
  (`#handleBarClick`, `#handleBackgroundClick`).
- **Daten/Zusammenspiel:** Nutzt `deviationChartHelpers.ts` für
  Balkenlayout, Labelposition und Formatierung, `mixConfig.ts` für
  Farben/Labels/Reihenfolge und Typen aus `types/mix.ts`. Wird von
  `components/emissions/DeviationChart.vue` eingebunden.
- **Berechnungen/Techniken:** Data-Join mit Key-Funktion
  (`row.sourceKey`) für stabile Übergänge beim Sortierwechsel;
  divergierendes Balkenlayout um die Nulllinie; Opacity-Logik mit
  Vorrangregel (Hover schlägt feste Auswahl); Energieträger ohne
  Erzeugung werden als schmaler grauer Strich dargestellt.
- **Relevanz fürs Handbuch:** Ja - zentrale Chart-Komponente für den
  CO₂-Vergleich, inkl. Sortierung, Hervorhebung und Auswahl.
- **KI-Verdacht:** Datei enthielt zahlreiche "MIT KI"/"OHNE KI"-Vermerke
  in fast jeder Methode (u. a. zum Interface-Stil, zum
  Balken-/Label-Layout, zur Sortierung, zu Achsen und zur
  Opacity-Logik bei Hover/Auswahl) - alle entfernt, technische
  Substanz in normalen Kommentaren/JSDoc erhalten. Von der
  Verfasserin zu ergänzen, falls für die Eigenständigkeitserklärung
  relevant, welcher Anteil tatsächlich mit KI-Unterstützung entstand.
- **Auffälligkeiten:** Siehe KI-Verdacht.

---

## utils/charts/StackedAreaChart.ts

- **Bereich:** Chart-Klasse (Strommix-Chart)
- **Aufgabe:** Zeichnet den Strommix als gestapeltes Flächendiagramm.
  Die Monatswerte der Energieträger liegen übereinander, wahlweise
  als absolute Werte (TWh) oder als Anteile. Übernimmt außerdem
  Hover, Hervorhebungen und die feste Linie für ausgewählte
  Ereignisse (Annotationen).
- **Aufbau/Logik:** Erbt von `BaseChart`. Setter für Modus,
  Hervorhebung, Daten, Hover-/Klick-Handler, Annotationen und Farben;
  `render`/`update`/`destroy`; Daten-/Skalenaufbau
  (`#createStackedSeries`, `#createXScale`, `#createYScale`); Flächen
  zeichnen (`#renderAreas`); Achsen (`#renderXAxis`, `#renderYAxis`);
  Hervorhebung über eine separate Outline-Ebene
  (`#updateHighlight`, `#renderHighlightOutlines`); Hover
  (`#createHoverElements`, `#handlePointerMove`,
  `#handlePointerLeave`) und feste Ereignislinie
  (`#updateFixedAnnotationLine`).
- **Daten/Zusammenspiel:** Nutzt `stackedAreaHelpers.ts` für
  Datumsparsing und Monatssuche, `mixConfig.ts` für Farben/Reihenfolge
  und Typen aus `types/mix.ts`. Wird von
  `components/generation/StackedAreaChart.vue` eingebunden.
- **Berechnungen/Techniken:** `d3.stack` mit fester Schlüsselreihenfolge
  und `stackOffsetExpand` im Anteilsmodus; Zeitachse wird bis Januar
  des Folgejahres erweitert, damit der letzte Jahres-Tick sichtbar
  ist; Konturen für hervorgehobene Flächen laufen über eine eigene
  Outline-Ebene (mit `d3.line().defined()`, damit Monate ohne
  Erzeugung nicht künstlich verbunden werden), damit ein Stroke direkt
  auf den gestapelten Flächen nicht unruhig wirkt; Hover läuft über
  ein transparentes Overlay plus `d3.pointer`/`xScale.invert`, weil
  pointer-events auf gestapelten Pfaden unzuverlässig reagieren; die
  Suche nach der ausgewählten Annotation läuft über die stabile ID,
  nicht über den Array-Index.
- **Relevanz fürs Handbuch:** Ja - zentrale Chart-Komponente für die
  Übersicht des Strommixes, inkl. Modus-Umschaltung, Hervorhebung und
  Ereignis-Markierung.
- **KI-Verdacht:** Datei enthielt zahlreiche "MIT KI"/"OHNE KI"-Vermerke
  in fast jeder Methode (u. a. zum Interface-Stil, zur Reihenfolge von
  Operationen in update()/destroy(), zum Highlight-/Outline-Konzept,
  zum Hover-Overlay und zur ID-basierten Annotationssuche) - alle
  entfernt, technische Substanz in normalen Kommentaren/JSDoc
  erhalten. Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant, welcher Anteil tatsächlich mit
  KI-Unterstützung entstand.
- **Auffälligkeiten:** Siehe KI-Verdacht.

---

## components/emissions/emissionsData.ts

- **Bereich:** Reine Berechnungsfunktionen (Deviation-Chart)
- **Aufgabe:** Berechnet aus den Jahres-Erzeugungswerten die direkten
  CO₂-Emissionen je Energieträger sowie die Abweichung zwischen
  Erzeugungsanteil und Emissionsanteil.
- **Aufbau/Logik:** `loadEmissionFactorsFile` lädt die Emissionsfaktoren
  aus `public/data/emission-factors.json`; `DEFAULT_EMISSION_FACTORS`
  dient als Rückfallwert; `calculateEmissionsMt`/
  `calculateEmissionIntensity` rechnen zwischen TWh/Mt/g-CO₂-pro-kWh
  um; `calculateEmissionRows` baut die einzelnen `EmissionRow`s eines
  Jahres; `calculateDeviationYear` fasst sie zu einem `DeviationYear`
  zusammen.
- **Daten/Zusammenspiel:** Nutzt `STACK_ORDER` aus
  `components/generation/mixConfig.ts` und Typen aus `types/mix.ts`.
  Wird von `components/emissions/deviationData.ts` sowie den
  Deviation-Chart-Komponenten verwendet.
- **Berechnungen/Techniken:** Umrechnung TWh → Mt CO₂ über
  `TWh × g/kWh ÷ 1000`; Anteile werden über eine kleine Hilfsfunktion
  `calculateShare` division-sicher berechnet (0 bei Gesamtsumme 0);
  die Abweichung in Prozentpunkten ist die Differenz aus
  Emissionsanteil und Erzeugungsanteil, multipliziert mit 100.
- **Relevanz fürs Handbuch:** Ja - Grundlage für den Deviation-Chart,
  der zeigt, welche Energieträger überproportional zu den Emissionen
  beitragen.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Datei enthielt drei ASCII-Trennlinien
  (`// ===...===` vor "Konstanten", "Hilfsfunktionen",
  "Hauptfunktionen") - entfernt. Der Datei-Header verwies fälschlich
  auf einen alten Dateinamen ("composables/useEmissions.ts", vermutlich
  ein Überbleibsel aus einer früheren Umbenennung) - auf den echten
  Pfad korrigiert. Außerdem stand vor `loadEmissionFactorsFile` ein
  verirrter Kommentarblock, der eigentlich `DEFAULT_EMISSION_FACTORS`
  beschreibt - an die richtige Stelle direkt vor die Konstante verschoben.
  Zusätzlich: Bei der Bearbeitung dieser Datei gab `read_file` wiederholt
  einen völlig anderen (fabrizierten) Dateiinhalt zurück als der echte
  Disk-Stand - zur Sicherheit wurde der Disk-Inhalt per Terminal
  (`Get-Content -Raw`) verifiziert, bevor die Datei neu geschrieben wurde.
  Bei erneuter Prüfung am 27.07.2026 zusätzlich festgestellt: Der
  Kommentar über `loadEmissionFactorsFile` behauptet "Verwendet $fetch
  (Nuxt-kompatibel)", der Code ruft aber die globale `fetch`-Funktion
  auf, nicht Nuxts `$fetch`. Kleiner Kommentar-/Code-Widerspruch, kein
  funktionaler Fehler (`fetch` funktioniert im Browser genauso). Nicht
  behoben, da kein Code in dieser Aufgabe verändert werden darf.

---

## components/emissions/deviationData.ts

- **Bereich:** Reine Berechnungsfunktionen (Deviation-Chart)
- **Aufgabe:** Stellt abgeleitete Kennzahlen für den Deviation-Chart
  bereit: erneuerbaren Erzeugungsanteil, größte positive Abweichung,
  größte absolute Abweichung sowie die Abweichungsdaten mehrerer Jahre.
- **Aufbau/Logik:** `calculateRenewableShare` summiert die
  Erzeugungsanteile aller erneuerbaren Energieträger;
  `findLargestPositiveDeviation` sucht die größte positive
  `deviationPp` unter den `EmissionRow`s; `calculateShare` berechnet
  den Erzeugungsanteil eines einzelnen Energieträgers; `findLargestMismatch`
  sucht den Energieträger mit der größten absoluten Abweichung und
  gibt Richtung (über/unter) und Anteile zurück; `calculateMultipleYears`
  wendet `calculateDeviationYear` auf eine Liste von Jahren an.
- **Daten/Zusammenspiel:** Nutzt `GROUP_OF`/`STACK_ORDER` aus
  `components/generation/mixConfig.ts`, `calculateDeviationYear`/
  `DEFAULT_EMISSION_FACTORS` aus `components/emissions/emissionsData.ts`
  sowie Typen aus `types/mix.ts` und `composables/useMixData.ts`.
- **Berechnungen/Techniken:** `BASE_YEAR = 2015` als festes
  Vergleichsjahr; `findLargestMismatch` vergleicht die Beträge
  (`Math.abs`) der Abweichungen, damit sowohl über- als auch
  unterproportionale Energieträger gefunden werden können.
- **Relevanz fürs Handbuch:** Ja - liefert die Kennzahlen, die im
  Deviation-Chart und der zugehörigen Sidebar angezeigt werden
  (größte Abweichung, erneuerbarer Anteil).
- **KI-Verdacht:** Kommentar in `findLargestMismatch` enthielt den
  Vermerk "KI-Hilfe beim Vergleich der absoluten Werte" - entfernt.
  Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden. `read_file` zeigte
  hier den korrekten Disk-Stand (im Gegensatz zu emissionsData.ts).

---

## components/emissions/EmissionsPanel.vue

- **Bereich:** Vue-Komponente (Container)
- **Aufgabe:** Rahmen des Deviation-Bereichs mit Überschrift, Einleitung,
  dem eigentlichen `DeviationChart` und einer Fußzeile mit Quellenangabe.
- **Aufbau/Logik:** Reine Template-Komponente ohne eigenes Skript;
  bindet `DeviationChart` ein.
- **Daten/Zusammenspiel:** Wird vermutlich von der Dashboard-Seite
  eingebunden und zeigt den kompletten Deviation-Bereich inklusive
  Sidebar und Slider (über `DeviationChart.vue`).
- **Berechnungen/Techniken:** Keine, reines Layout.
- **Relevanz fürs Handbuch:** Ja - liefert Überschrift und
  Quellenangabe für den Emissionsbereich.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/emissions/YearSlider.vue

- **Bereich:** Vue-Komponente (Bedienelement)
- **Aufgabe:** Schieberegler zur Auswahl des Jahres, dessen Daten im
  Deviation-Chart angezeigt werden.
- **Aufbau/Logik:** `props` für verfügbare Jahre und ausgewähltes Jahr;
  `computed`-Werte für erstes/letztes Jahr und Füllstand der
  Fortschrittslinie; `handleInput` sendet das gewählte Jahr per
  `emit('change', ...)` nach oben.
- **Daten/Zusammenspiel:** Wird von `DeviationChart.vue` eingebunden
  und über `v-model`-ähnliche Props/Events mit `useMixSelection`
  verbunden.
- **Berechnungen/Techniken:** Der Füllstand der Linie wird aus dem
  Abstand von ausgewähltem Jahr zu erstem/letztem Jahr in Prozent
  berechnet; ein natives `<input type="range">` liegt unsichtbar über
  einer eigens gezeichneten Linie, damit Hintergrund und Füllung frei
  gestaltet werden können.
- **Relevanz fürs Handbuch:** Ja - Bedienelement zur Jahresauswahl.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/emissions/DeviationTooltip.vue

- **Bereich:** Vue-Komponente (Tooltip)
- **Aufgabe:** Zeigt beim Hover über einen Balken des Deviation-Charts
  den Erzeugungsanteil, den Emissionsanteil und die Abweichung des
  Energieträgers an.
- **Aufbau/Logik:** Props für Zeile (`EmissionRow`) und
  Bildschirmposition; `formatPercent`/`formatPercentagePoints` für die
  Zahlenformatierung; `tooltipStyle` ist ein anonymes `computed`, das
  die CSS-Position mit kleinem Versatz zum Mauszeiger berechnet (keine
  eigene benannte Funktion `createTooltipStyle`, wie ein früherer
  Eintrag in diesem Dokument fälschlich behauptete).
- **Daten/Zusammenspiel:** Wird von `DeviationChart.vue` im
  `#overlay`-Slot von `ChartTemplate` eingebunden, Position kommt vom
  D3-Diagramm (`DeviationHoverPayload`).
- **Berechnungen/Techniken:** Prozentwerte über `Intl.NumberFormat`
  ('de-DE'); Abweichungen erhalten ein echtes Minuszeichen (−) statt
  des ASCII-Bindestrichs.
- **Relevanz fürs Handbuch:** Ja - Tooltip-Verhalten des
  Deviation-Charts.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Bei erneuter Prüfung am 27.07.2026 festgestellt:
  Die Datei enthält (entgegen dem früheren Eintrag "Datei war bereits
  sauber") drei ASCII-Trennlinien-Blöcke (`// ===...===`) vor den
  Abschnitten "Props", "Formatierungsfunktionen" und "Position". Kein
  Code in dieser Aufgabe verändert.

---

## components/emissions/DeviationChart.vue

- **Bereich:** Vue-Komponente (Container/Verbindung zu D3)
- **Aufgabe:** Verbindet die reine D3-Diagrammklasse `DeviationChart`
  aus `utils/charts/` mit der Vue-Oberfläche: lädt Daten und
  Emissionsfaktoren, verwaltet Jahr, Sortierung, Hover und Auswahl, und
  reicht die passenden Werte an Tooltip, Slider und Sidebar weiter.
- **Aufbau/Logik:** `loadAndCreateChart`/`loadEmissionFactors` laden
  Daten beim Mounten; zahlreiche `computed`-Werte leiten
  Jahr/Kennzahlen ab (`deviationYears`, `activeYear`, `baseYear`,
  `largestMismatch`, `emissionIntensity`, `renewableShare` usw.);
  `createChart`/`updateChartYear`/`updateChartColors` synchronisieren
  die D3-Instanz mit den Vue-Daten; `watch` auf `activeYear` und
  `colorMode` hält das Diagramm aktuell.
- **Daten/Zusammenspiel:** Nutzt `useMixData`/`useMixSelection`,
  `emissionsData.ts`/`deviationData.ts` für die Berechnungen und die
  D3-Klasse `DeviationChart` aus `utils/charts/DeviationChart.ts`.
  Bindet `ChartTemplate`, `DeviationTooltip`, `YearSlider` und
  `DeviationSidebar` ein.
- **Berechnungen/Techniken:** Feste x-Achse (`xDomain = [-50, 50]`) für
  alle Jahre, damit Abweichungen über die Jahre hinweg vergleichbar
  bleiben; `activeYearNumber` fällt auf das letzte verfügbare Jahr
  zurück, falls kein gültiges Jahr ausgewählt ist.
- **Relevanz fürs Handbuch:** Ja - zentrale Steuerungskomponente des
  Deviation-Bereichs.
- **KI-Verdacht:** Kommentar bei `loadEmissionFactors` enthielt "Bei der
  Fehlerbehandlung habe ich KI-Unterstützung genutzt" - entfernt. Von
  der Verfasserin zu ergänzen, falls für die Eigenständigkeitserklärung
  relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden.

---

## components/emissions/DeviationSidebar.vue

- **Bereich:** Vue-Komponente (Kennzahlen-Seitenleiste)
- **Aufgabe:** Zeigt je nach Hover/Auswahl die Kennzahlen eines
  Energieträgers (Erzeugungs-/Emissionsanteil, Abweichung, kurze
  Einordnung, Entwicklung seit 2015) oder ohne Auswahl den
  Jahresüberblick (Emissionsintensität, Erneuerbaren-Anteil,
  Veränderung seit 2015).
- **Aufbau/Logik:** Formatierfunktionen (`formatPercent`,
  `formatPercentagePoints`, `formatIntensity`, `formatChange`,
  `getBarWidth`); `computed`-Werte für den aktiven Zustand
  (`activeRow`, `hasSelection`, `showsSource`, `hasZeroGeneration`,
  `showsDefault`, `groupLabel`, `showsDevelopment`); `createMeaning`
  baut den erklärenden Satz zur Abweichung; `getDevelopmentWord`
  wählt "stieg"/"sank"/"blieb gleich" je nach Vergleich mit 2015.
- **Daten/Zusammenspiel:** Erhält alle Werte als Props von
  `DeviationChart.vue`, nutzt Farben/Labels aus
  `components/generation/mixConfig.ts` und Typen aus `types/mix.ts`.
- **Berechnungen/Techniken:** Abweichungen erhalten ein echtes
  Minuszeichen (−); `createMeaning` unterscheidet zwischen deutlich
  über-/unterproportionalem Beitrag anhand einer Schwelle von 1
  Prozentpunkt; Balkenbreiten werden auf 0-100 % begrenzt, um
  Darstellungsfehler bei Rundungsungenauigkeiten zu vermeiden.
- **Relevanz fürs Handbuch:** Ja - zeigt die zentralen Kennzahlen des
  Deviation-Charts in Textform.
- **KI-Verdacht:** Zwei Kommentare enthielten KI-Hinweise ("KI-Hilfe bei
  der Behandlung der Vorzeichen", "KI-Hilfe bei den drei
  Textvarianten") - beide entfernt. Von der Verfasserin zu ergänzen,
  falls für die Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden.

---

## components/generation/mixConfig.ts

- **Bereich:** Konfiguration/Konstanten
- **Aufgabe:** Zentrale Einstellungen für alle Strommix-Diagramme:
  Reihenfolge der Energieträger im Diagramm, Anzeigenamen, Farben
  (Standard und barrierearm), Gruppenzuordnung sowie Reihenfolge und
  Namen der drei Gruppen.
- **Aufbau/Logik:** Reine Konstanten (`STACK_ORDER`, `MIX_LABELS`,
  `MIX_COLORS`, `MIX_COLORS_ACCESSIBLE`, `GROUP_OF`,
  `MIX_GROUP_ORDER`, `MIX_GROUP_LABELS`), keine Funktionen.
- **Daten/Zusammenspiel:** Wird von praktisch allen Komponenten und
  D3-Klassen des Strommix- und Deviation-Bereichs importiert (u. a.
  `StackedAreaChart.ts`, `DeviationChart.ts`, `MixSidebar.vue`,
  `MixTooltip.vue`, `StackedAreaLegend.vue`, `deviationData.ts`).
- **Berechnungen/Techniken:** Keine, reine Konfigurationsdaten.
- **Relevanz fürs Handbuch:** Indirekt relevant - erklärt, welche
  Farben und Bezeichnungen im gesamten Strommix-Bereich verwendet
  werden.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/generation/GenerationPanel.vue

- **Bereich:** Vue-Komponente (Container)
- **Aufgabe:** Rahmen des Strommix-Bereichs mit Überschrift,
  Einleitung, dem `StackedAreaChart` und einer Fußzeile mit
  Quellenangabe.
- **Aufbau/Logik:** Reine Template-Komponente ohne nennenswerte
  Skriptlogik; bindet `StackedAreaChart` ein.
- **Daten/Zusammenspiel:** Wird von der Dashboard-Seite eingebunden.
- **Berechnungen/Techniken:** Keine, reines Layout.
- **Relevanz fürs Handbuch:** Ja - liefert Überschrift und
  Quellenangabe für den Strommix-Bereich.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Bei erneuter Prüfung am 27.07.2026 festgestellt:
  Der Datei-Header-Kommentar beginnt mit "StrommixPanel.vue — Rahmen
  für die Strommix-Visualisierung", also einem alten Dateinamen
  (die Datei heißt aktuell `GenerationPanel.vue`, vermutlich ein
  Überbleibsel aus einer früheren Umbenennung, ähnlich wie bereits bei
  `emissionsData.ts` und `IntroTrustLine.vue` dokumentiert). Kein Code
  in dieser Aufgabe verändert.

---

## components/generation/AnnotationMarkers.vue

- **Bereich:** Vue-Komponente (Bedienelement)
- **Aufgabe:** Zeigt die nummerierten Ereignis-Buttons unter dem
  Strommix-Diagramm, über die ein historisches Ereignis (Annotation)
  ausgewählt werden kann.
- **Aufbau/Logik:** Props für die Liste der Ereignisse und das
  ausgewählte Ereignis; `handleSelect` reicht den Klick als Event nach
  oben weiter; `getHelpText` liefert den Hinweistext unter den Buttons.
- **Daten/Zusammenspiel:** Wird von `MixSidebar.vue` eingebunden, die
  Auswahl wird letztlich von `useMixSelection` verwaltet.
- **Berechnungen/Techniken:** Keine, reine Anzeige-/Klicklogik.
- **Relevanz fürs Handbuch:** Ja - Bedienelement zur Auswahl von
  Ereignissen im Strommix-Diagramm.
- **KI-Verdacht:** Kommentar bei `getHelpText` enthielt "Ich habe KI
  verwendet, um den langen Ausdruck aus dem Template zu entfernen" -
  entfernt, die Begründung (Lesbarkeit) blieb als eigene Entscheidung
  erhalten. Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden.

---

## components/generation/MixTooltip.vue

- **Bereich:** Vue-Komponente (Tooltip)
- **Aufgabe:** Zeigt beim Hover über das Strommix-Diagramm die Werte
  eines Monats, entweder als Gruppenübersicht oder - bei ausgewähltem
  Energieträger - nur für diesen einen Energieträger.
- **Aufbau/Logik:** `groupValues` berechnet die Werte je Gruppe
  (erneuerbar/Kernenergie/fossil) aus den Einzelwerten;
  `selectedSourceValue` liefert die Werte des ausgewählten
  Energieträgers, falls vorhanden; `formatTwh`/`formatPercent` für die
  Zahlenformatierung.
- **Daten/Zusammenspiel:** Wird von `StackedAreaChart.vue` im
  `#overlay`-Slot eingebunden, Position und Monatsdaten kommen vom
  D3-Diagramm (`MixHoverPayload`).
- **Berechnungen/Techniken:** Anteile werden division-sicher über
  `calculateShare` berechnet (0 bei Gesamtsumme 0).
- **Relevanz fürs Handbuch:** Ja - Tooltip-Verhalten des
  Strommix-Diagramms.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/generation/StackedAreaLegend.vue

- **Bereich:** Vue-Komponente (Legende/Bedienelement)
- **Aufgabe:** Zeigt die klickbare Legende mit allen zehn
  Energieträgern, nach Gruppen geordnet, sowie einen Button, um wieder
  alle Energieträger anzuzeigen.
- **Aufbau/Logik:** `getSourcesForGroup` filtert die Energieträger
  einer Gruppe; `isSourceActive`/`isSourceDisabled`/`isAllActive`
  bestimmen den Anzeigezustand jedes Chips, abhängig davon, ob gerade
  ein Ereignis aktiv ist; `handleSelect`/`handleShowAll` senden die
  Auswahl als Event nach oben.
- **Daten/Zusammenspiel:** Wird von `StackedAreaChart.vue` eingebunden,
  nutzt Farben/Labels/Gruppen aus `mixConfig.ts`. Die eigentliche
  Umschalt-Logik liegt bewusst in `useMixSelection`, nicht in dieser
  Komponente (siehe Datei-Kommentar).
- **Berechnungen/Techniken:** Während ein Ereignis aktiv ist, werden
  nicht zum Ereignis gehörende Chips deaktiviert
  (`isSourceDisabled`), damit die Auswahl nicht mit der
  Ereignis-Hervorhebung kollidiert.
- **Relevanz fürs Handbuch:** Ja - Bedienelement zur Auswahl einzelner
  Energieträger im Strommix-Diagramm.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/generation/StackedAreaChart.vue

- **Bereich:** Vue-Komponente (Container/Verbindung zu D3)
- **Aufgabe:** Verbindet die reine D3-Diagrammklasse `StackedAreaChart`
  aus `utils/charts/` mit der Vue-Oberfläche: lädt Daten und
  Ereignisse, verwaltet Modus, Hervorhebung und Ereignisauswahl, und
  reicht die passenden Werte an Tooltip, Legende und Sidebar weiter.
- **Aufbau/Logik:** `initializeChart` erstellt die D3-Instanz beim
  Mounten; `computed`-Werte leiten Sidebar-Kennzahlen ab
  (`overviewMetrics`, `sourceMetrics`, `annotationContext`) und die
  aktuell hervorgehobenen Energieträger (`highlightedSources`);
  `handle*`-Funktionen verarbeiten Klicks auf Hintergrund, Energieträger
  und Ereignisse; mehrere `watch`-Aufrufe halten die D3-Instanz mit den
  Vue-Daten synchron.
- **Daten/Zusammenspiel:** Nutzt `useMixData`/`useMixSelection` und die
  Hilfsfunktionen aus `useMixMetrics.ts`; lädt zusätzlich
  `/data/annotations.json` für die Ereignisliste. Bindet
  `ChartTemplate`, `MixTooltip`, `StackedAreaLegend` und `MixSidebar`
  ein.
- **Berechnungen/Techniken:** Beim Auswählen eines Ereignisses wird
  eine vorher bestehende Energieträger-Hervorhebung gezielt
  zurückgesetzt, damit sich Ereignis- und Energieträger-Auswahl nicht
  überschneiden; falls das Laden der Ereignisse fehlschlägt, bleibt die
  Liste einfach leer, ohne den restlichen Chart zu blockieren.
- **Relevanz fürs Handbuch:** Ja - zentrale Steuerungskomponente des
  Strommix-Bereichs.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine Trennlinien gefunden (die Kommentare wie
  "// Werte für die Sidebar" sind einfache Abschnittsüberschriften,
  keine ASCII-Trennlinien).

---

## components/generation/MixSidebar.vue

- **Bereich:** Vue-Komponente (Kennzahlen-Seitenleiste)
- **Aufgabe:** Zeigt je nach Zustand entweder Informationen zu einem
  ausgewählten Ereignis, zu einem ausgewählten Energieträger oder eine
  allgemeine Übersicht über den Vergleich 2015 zu 2024.
- **Aufbau/Logik:** Formatierfunktionen (`formatTwh`, `formatPercent`,
  `formatPercentagePoints`, `formatSignedTwh`, `formatMonth`);
  Template verwendet `v-if`/`v-else-if`/`v-else`, um zwischen den drei
  Zuständen (Ereignis, Energieträger, Übersicht) umzuschalten.
- **Daten/Zusammenspiel:** Erhält Kennzahlen als Props von
  `StackedAreaChart.vue` (berechnet in `useMixMetrics.ts`), bindet
  `AnnotationMarkers` ein und nutzt Farben/Labels aus `mixConfig.ts`.
- **Berechnungen/Techniken:** Veränderungen erhalten ein Vorzeichen
  (+/-) je nach Richtung; für Kernenergie gibt es einen zusätzlichen
  erklärenden Hinweistext zur Teilmonats-Abschaltung im April 2023.
- **Relevanz fürs Handbuch:** Ja - zeigt die zentralen Kennzahlen des
  Strommix-Diagramms in Textform.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/home/IntroHero.vue

- **Bereich:** Vue-Komponente (Layout, Einstieg)
- **Aufgabe:** Zeigt die Überschrift und den einleitenden Text der
  Startseite.
- **Aufbau/Logik:** Enthält ein `<script setup lang="ts">` mit einem
  reinen Kommentarblock ohne Logik (kein Import, keine Variable, keine
  Funktion). Ansonsten reine Template-Komponente.
- **Daten/Zusammenspiel:** Wird auf `pages/index.vue` eingebunden.
- **Berechnungen/Techniken:** Keine, reines Layout.
- **Relevanz fürs Handbuch:** Gering, reiner Einleitungstext.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Bei erneuter Prüfung am 27.07.2026 festgestellt
  (entgegen dem früheren Eintrag "Datei war bereits sauber"): (1) Der
  Kommentarblock im `<script setup>` enthält eine ASCII-Trennlinie
  (`===============================`); (2) derselbe Kommentarblock
  verweist mit dem Pfad "components/intro/IntroHero.vue" auf einen
  alten, nicht mehr existierenden Ordner (die Datei liegt aktuell unter
  `components/home/IntroHero.vue`); (3) im `<style scoped>` ist eine
  CSS-Klasse `.eyebrow` definiert, die im Template nicht verwendet wird
  - das Template nutzt stattdessen die Klasse `.title-label` (vermutlich
  aus dem globalen `main.css`). `.eyebrow` ist damit totes CSS. Kein
  Code in dieser Aufgabe verändert.

---

## components/home/IntroMethodology.vue

- **Bereich:** Vue-Komponente (Layout, Glossar)
- **Aufgabe:** Aufklappbarer Abschnitt mit Begriffserklärungen
  (Prozentpunkte, sonstige konventionelle Energieträger, öffentliche
  Nettostromerzeugung).
- **Aufbau/Logik:** Natives `<details>`/`<summary>`-Element, reine
  Template-Komponente ohne Skript.
- **Daten/Zusammenspiel:** Wird auf `pages/index.vue` eingebunden.
- **Berechnungen/Techniken:** Keine, reines Layout.
- **Relevanz fürs Handbuch:** Ja - die hier erklärten Begriffe
  (Prozentpunkte, Nettostromerzeugung) sind auch für das Handbuch
  relevant.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber.

---

## components/home/IntroTrustLine.vue

- **Bereich:** Vue-Komponente (Layout)
- **Aufgabe:** Schmale Zeile mit Datenquelle, Vergleichszeitraum und
  Datengrundlage, direkt unter der Einleitung der Startseite.
- **Aufbau/Logik:** Reine Template-Komponente ohne nennenswerte
  Skriptlogik, drei feste Spalten.
- **Daten/Zusammenspiel:** Wird auf `pages/index.vue` eingebunden.
- **Berechnungen/Techniken:** Keine, reines Layout.
- **Relevanz fürs Handbuch:** Ja - nennt die verwendete Datenquelle und
  den Betrachtungszeitraum.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Der Kopfkommentar enthielt eine ASCII-Trennlinie
  (`====...===` direkt unter dem Dateinamen) - entfernt. Außerdem stand
  dort ein veralteter Pfad ("components/intro/IntroTrustLine.vue"),
  vermutlich ein Überbleibsel aus einer früheren Ordnerstruktur - auf
  den echten Pfad "components/home/IntroTrustLine.vue" korrigiert.

---

## components/home/groupedBarUtils.ts

- **Bereich:** Reine Hilfsfunktionen (Startseiten-Balkendiagramm)
- **Aufgabe:** Stellt Typen, Konstanten und reine Funktionen für das
  gruppierte Balkendiagramm der Startseite bereit, getrennt von Vue,
  damit sie unabhängig getestet werden können.
- **Aufbau/Logik:** Typen `EnergyCategory`, `EnergyDataPoint`,
  `FlatBarItem`; `roundToOneDecimal` für einheitliches Runden;
  `formatDelta`/`formatPercent` für die Zahlenformatierung mit
  deutschem Dezimaltrennzeichen; `getBarOpacity` für die Deckkraft je
  Jahr; `getLabelData` filtert Balken mit Wert 0 aus der Beschriftung;
  `toggleCategoryFilter` schaltet den aktiven Kategoriefilter um.
- **Daten/Zusammenspiel:** Wird von `GroupedBarChart.vue` importiert.
- **Berechnungen/Techniken:** Veränderungen erhalten ein echtes
  Minuszeichen (−) statt des ASCII-Bindestrichs; das deutsche
  Dezimaltrennzeichen wird über `toFixed(1).replace('.', ',')`
  erzeugt.
- **Relevanz fürs Handbuch:** Ja - Formatierungsregeln (Prozentpunkte,
  Rundung) sind auch fürs Handbuch relevant.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Datei enthielt sieben ASCII-Trennlinien-Blöcke
  vor den jeweiligen Abschnitten (Typdefinitionen, Konstanten,
  Rundungsfunktion, Formatierungsfunktionen, Deckkraft, Label-Filter,
  Kategoriefilter) - alle entfernt und durch normale
  Kommentarzeilen ersetzt.

---

## components/home/GroupedBarChart.vue

- **Bereich:** Vue-Komponente (D3-Diagramm auf der Startseite)
- **Aufgabe:** Zeichnet für jeden Energieträger zwei nebeneinander
  liegende Balken (2015 und 2024), inklusive Tooltip, Kategoriefilter
  und Kontrastmodus-Unterstützung.
- **Aufbau/Logik:** `renderChart` baut das SVG direkt mit D3 auf
  (Skalen, Rasterlinien, Achse, Balken, Beschriftungen, Legende);
  `toggleCategoryFilter` filtert die angezeigten Energieträger;
  `getCategoryColor`/`getBarLabelColor` wählen Farben je nach
  Kontrastmodus; ein `MutationObserver` beobachtet das
  `data-contrast`-Attribut und löst bei Änderung ein Neuzeichnen aus.
- **Daten/Zusammenspiel:** Nutzt die Hilfsfunktionen aus
  `groupedBarUtils.ts`, erhält die Rohdaten als Prop `data` von der
  Startseite.
- **Berechnungen/Techniken:** Die x-Achse verwendet eine feste
  Mindestbreite (`Math.max(maxFound * 1.1, 30)`), damit auch bei
  kleinen Werten noch genug Platz für die Balken bleibt; Balken werden
  per `.join()`-Muster mit stabilen IDs aktualisiert, damit D3 bei
  Filterwechseln sauber ein- und ausblendet; die Legendenfarbe hängt
  vom aktuellen Kontrastmodus ab.
- **Relevanz fürs Handbuch:** Ja - zentrales Vergleichsdiagramm der
  Startseite.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Datei hatte am Anfang keinerlei erklärenden
  Kommentar zur Komponente - ein kurzer Kommentar wurde ergänzt.
  Keine Trennlinien gefunden.

---

## components/layout/SiteNav.vue

- **Bereich:** Vue-Komponente (globale Navigation)
- **Aufgabe:** Zeigt die Hauptnavigation der Anwendung (Strommix,
  Entwicklung, CO₂-Vergleich) sowie den Zoom-Button und den
  Kontrast-Schalter.
- **Aufbau/Logik:** `navItems` baut die drei Navigationspunkte inkl.
  aktivem Zustand; `isDevelopmentActive`/`isEmissionsActive`
  unterscheiden die beiden Tabs der Dashboard-Seite anhand der
  Query-Parameter; `zoomLabel` baut den Aria-Label-Text für den
  Zoom-Button.
- **Daten/Zusammenspiel:** Nutzt `usePageZoom` für die Zoomstufe und
  `useHighContrast` für den Kontrastmodus, `useRoute` für die aktuelle
  Route.
- **Berechnungen/Techniken:** Die Aktiv-Markierung der Navigation
  unterscheidet zwischen den beiden Dashboard-Tabs über den
  `tab`-Query-Parameter.
- **Relevanz fürs Handbuch:** Ja - beschreibt die Bedienung der
  Hauptnavigation, des Zooms und des Kontrastmodus.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Bei erneuter Prüfung am 27.07.2026 festgestellt:
  Der hier zuvor dokumentierte Fehler existiert im aktuellen Code
  nicht mehr - Zeile 16 destrukturiert korrekt
  `const { level, cycleZoom } = usePageZoom()`, und der Button ruft
  `@click="cycleZoom"` auf. `usePageZoom()` (siehe
  `composables/usePageZoom.ts`) gibt tatsächlich `cycleZoom` zurück,
  der Code passt also zusammen. Ob der frühere Fehler zwischenzeitlich
  außerhalb dieser Dokumentationsaufgaben behoben wurde, ist aus dem
  Quellcode allein nicht sicher erkennbar - von der Verfasserin zu
  ergänzen.

---

## components/shared/ChartTemplate.vue

- **Bereich:** Vue-Komponente (gemeinsamer Rahmen für D3-Diagramme)
- **Aufgabe:** Stellt den gemeinsamen Rahmen für alle D3-Diagramme
  bereit: einen Container, in den D3 zeichnet, sowie Slots für
  Bedienelemente (`controls`), Overlay-Inhalte wie Tooltips
  (`overlay`) und Hinweise unter dem Diagramm (Standard-Slot).
- **Aufbau/Logik:** `chartContainer` ist die Referenz auf das
  DOM-Element, in das D3 zeichnet; wird über `defineExpose` an die
  aufrufende Komponente weitergegeben, damit diese die D3-Instanz
  darauf rendern kann.
- **Daten/Zusammenspiel:** Wird von allen Diagramm-Containern
  eingebunden (`DeviationChart.vue`, `StackedAreaChart.vue`).
- **Berechnungen/Techniken:** Keine, reine Layout-/Slot-Struktur.
- **Relevanz fürs Handbuch:** Indirekt relevant - erklärt den
  gemeinsamen Aufbau aller Diagramme (Bedienelemente oben, Diagramm in
  der Mitte, Hinweise unten).
- **KI-Verdacht:** Bei erneuter Prüfung am 27.07.2026 enthält die
  Datei tatsächlich zwei KI-Hinweise im Code (entgegen dem früheren
  Eintrag in diesem Dokument): beim `chartContainer`-Ref ("Bei dieser
  Stelle wurde kurz KI genutzt, weil mir zuerst nicht klar war, wie
  eine andere Komponente mit defineExpose auf dieses Element
  zugreifen kann.") und im CSS-Kommentar zu `.chart-header` ("Bei den
  flexiblen Abständen wurde KI genutzt, weil der Bereich auch bei
  wenig Platz lesbar bleiben und nicht über den Rand laufen sollte.").
  Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Siehe KI-Verdacht - der frühere Eintrag in
  diesem Dokument war an dieser Stelle unzutreffend. Keine
  ASCII-Trennlinien gefunden. Kein Code in dieser Aufgabe verändert.

---

## pages/dashboard.vue

- **Bereich:** Nuxt-Seite (Dashboard)
- **Aufgabe:** Stellt die Dashboard-Seite mit den beiden Tabs
  "Entwicklung" (`GenerationPanel`) und "CO₂-Vergleich"
  (`EmissionsPanel`) bereit.
- **Aufbau/Logik:** `DashboardTab` legt die beiden möglichen Werte
  fest; `activeTab` ist ein computed, das aus `route.query.tab`
  ermittelt, welcher Tab aktiv ist.
- **Daten/Zusammenspiel:** Nutzt `useRoute` für den Query-Parameter
  `tab` und bindet die beiden Panel-Komponenten per `v-if` an
  `activeTab`.
- **Berechnungen/Techniken:** Da `route.query.tab` je nach Aufruf ein
  string, ein string[] oder undefined sein kann, wird nur strikt auf
  `'emissions'` geprüft und in jedem anderen Fall auf `'generation'`
  zurückgefallen. Das erspart eine eigene Fallunterscheidung zwischen
  Array und String und liefert automatisch einen sinnvollen
  Default-Wert.
- **Relevanz fürs Handbuch:** Ja - beschreibt den Aufbau der
  Dashboard-Seite und den Wechsel zwischen den beiden Tabs.
- **KI-Verdacht:** Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine, Datei war bereits sauber bis auf den
  entfernten KI-Hinweis im JSDoc von `activeTab`.

---

## pages/homeDataTransform.ts

- **Bereich:** TypeScript-Modul (Datenaufbereitung für die Startseite)
- **Aufgabe:** Wandelt die Jahresdaten von 2015 und 2024 in das
  Format um, das `GroupedBarChart` erwartet.
- **Aufbau/Logik:** `ItemConfigEntry` beschreibt einen Eintrag der
  Konfiguration (`key: MixSourceKey` - der Import kommt direkt aus
  `~/types/mix`, ein eigener lokaler `SourceKey`-Typ existiert nicht
  mehr, siehe KI-UND-VEREINFACHUNG.md Abschnitt 12, Punkt 4);
  `ITEM_CONFIG` listet die zehn dargestellten Energieträger mit Label
  und Kategorie; `calculateSharePercent` berechnet den Anteil eines
  Energieträgers an der Gesamterzeugung; `transformYearlyDataToChartData`
  baut daraus die fertigen Diagrammdaten für beide Jahre.
- **Daten/Zusammenspiel:** Wird von `pages/index.vue` genutzt, um die
  geladenen Jahresdaten in die Form für `GroupedBarChart` zu bringen.
- **Berechnungen/Techniken:** Der Zugriff über `configItem.key` funktioniert
  typsicher, weil `ItemConfigEntry.key` direkt als `MixSourceKey` (aus
  `~/types/mix`) typisiert ist - der Compiler weiß dadurch, dass die
  Keys in `ITEM_CONFIG` immer echte Felder von `YearlyMixPoint.sources`
  sind, ohne dass ein eigener lokaler Typ nötig wäre.
  `displayedDelta` wird bewusst aus den gerundeten Werten berechnet,
  nicht aus der exakten Differenz, damit die im Diagramm gezeigte
  Differenz mit den angezeigten Prozentwerten übereinstimmt; die
  ungerundeten Werte bleiben trotzdem in `value2015`/`value2024`
  erhalten, damit die Balkenhöhen exakt sind.
- **Relevanz fürs Handbuch:** Ja - erklärt, wie die rohen Jahresdaten
  in die Anteile und Deltas des Startseiten-Diagramms umgerechnet
  werden.
- **KI-Verdacht:** Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden. Zwei KI-Hinweise im
  JSDoc von `transformYearlyDataToChartData` entfernt, technische
  Begründung dabei beibehalten.

---

## pages/index.vue

- **Bereich:** Nuxt-Seite (Startseite)
- **Aufgabe:** Zeigt die Startseite mit Hero-Bereich, Vertrauenslinie,
  dem Vergleichsdiagramm 2015/2024 (`GroupedBarChart`) und der
  Methodik-Erklärung.
- **Aufbau/Logik:** `strommixData`, `loading` und `error` sind refs
  für den Ladezustand; `findYear` sucht den passenden Jahres-Eintrag
  über `data.find(...)` (seit der studentischen Vereinfachung am
  27.07.2026, vorher eine manuelle For-Schleife, siehe
  KI-UND-VEREINFACHUNG.md Abschnitt 11); `loadPageData` lädt die
  Visualisierungsdaten, sucht die Einträge für 2015 und 2024 und
  wandelt sie über `transformYearlyDataToChartData` in die
  Diagrammdaten um.
- **Daten/Zusammenspiel:** Nutzt `useVisualizationData` zum Laden der
  Rohdaten und `transformYearlyDataToChartData` aus
  `homeDataTransform.ts` zur Aufbereitung; das Template zeigt je nach
  Zustand ein Lade-Skelett, eine Fehlermeldung oder das Diagramm samt
  Fußnote.
- **Berechnungen/Techniken:** Im catch-Zweig von `loadPageData` wird
  mit `caughtError instanceof Error` geprüft, weil im catch
  grundsätzlich alles ankommen kann (Error, String, undefined, …) und
  ein direkter Zugriff auf `caughtError.message` sonst selbst einen
  Fehler auslösen könnte, falls `caughtError` kein Error-Objekt ist.
- **Relevanz fürs Handbuch:** Ja - beschreibt den Aufbau der
  Startseite und wie die Vergleichsdaten geladen und dargestellt
  werden.
- **KI-Verdacht:** Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Keine Trennlinien gefunden. Drei KI-Hinweise
  entfernt: im Datei-Header-JSDoc, im JSDoc von `loadPageData` und in
  einem CSS-Kommentar zum responsiven Verhalten der Seite; ein
  weiterer KI-Hinweis in einem CSS-Kommentar zur Skeleton-Animation
  wurde zusätzlich gefunden und entfernt.

---

## assets/css/chart-styles.css

- **Bereich:** CSS (Diagramm-Grundstile)
- **Aufgabe:** Enthält die gemeinsamen Gestaltungsregeln für die
  D3-Diagramme (Container-Breite, SVG-Skalierung, Achsentext,
  Werteanzeigen, Achsenlinien inkl. Kontrastmodus).
- **Aufbau/Logik:** Reine CSS-Regeln, keine Skriptlogik; nutzt Klassen
  wie `.chart`, `.chart .x-axis`, `.chart .deviation-label` und das
  Attribut `[data-contrast='on']` für den Kontrastmodus.
- **Daten/Zusammenspiel:** Farben und Schriften greifen auf die
  CSS-Variablen aus `assets/css/main.css` zurück, damit Theme- und
  Kontrastwechsel automatisch übernommen werden.
- **Berechnungen/Techniken:** `shape-rendering: geometricPrecision`
  sorgt für eine möglichst genaue Darstellung der Flächen im SVG.
- **Relevanz fürs Handbuch:** Eher gering - reine Gestaltungsdetails
  ohne Bedienrelevanz.
- **KI-Verdacht:** Keine KI-Erwähnung im Code gefunden.
- **Auffälligkeiten:** Keine, Datei war bereits sauber (keine
  Trennlinien, keine KI-Erwähnungen).

---

## assets/css/main.css

- **Bereich:** CSS (globale Grundstile)
- **Aufgabe:** Enthält die projektweiten Grundstile: eingebundene
  Schriftarten, CSS-Variablen für Farben und Schriften, Reset-Regeln,
  Basis-Typografie (Überschriften, Absätze, Links) sowie den
  Kontrastmodus.
- **Aufbau/Logik:** `@font-face`-Regeln binden die lokalen
  Schriftdateien ein; `:root` definiert die Design-Tokens als
  CSS-Variablen; `[data-contrast='on']` überschreibt einzelne
  Variablen für den Kontrastmodus; darunter folgen die
  Basis-Regeln für `html`, `body`, Fokuszustände, Übergänge und
  Überschriften/Absätze/Links.
- **Daten/Zusammenspiel:** Die hier definierten CSS-Variablen
  (`--sans-font`, `--serif-font`, `--text-color` usw.) werden in der
  gesamten Anwendung sowie in `chart-styles.css` verwendet.
- **Berechnungen/Techniken:** Überschriftengrößen sind bewusst in rem
  angegeben, damit sie mit der Basisschriftgröße von `html`
  mitskalieren. `:focus-visible` sorgt dafür, dass der Fokusring nur
  bei Tastaturnavigation erscheint, nicht bei jedem Mausklick.
- **Relevanz fürs Handbuch:** Ja - erklärt die grundlegenden
  Gestaltungsentscheidungen (Schriften, Farben, Kontrastmodus,
  Barrierefreiheit über sichtbaren Fokus).
- **KI-Verdacht:** Von der Verfasserin zu ergänzen, falls für die
  Eigenständigkeitserklärung relevant.
- **Auffälligkeiten:** Vier KI-Hinweise entfernt (Datei-Header-JSDoc,
  Reset-Kommentar, Basis-Schriftgrößen-Kommentar,
  Überschriften-Kommentar). Außerdem wurde im Header ein falscher
  Dateiname korrigiert ("charts.css" stand dort fälschlich statt
  "chart-styles.css"). Keine Trennlinien gefunden.

---

## public/data/visualization-data.json

- **Bereich:** Generierte Datendatei (Ausgabe von `scripts/build-data.ts`)
- **Zweck:** Zentrale Datengrundlage der gesamten App. Enthält die aus
  `smard.json` aggregierten Monats-, Tages- und Jahreswerte für den
  Strommix 2015–2024.
- **Struktur/Feldbedeutung:** Objekt mit drei Arrays, siehe
  `types/visualization-data.ts`: `monthlyMix` (ein Eintrag je Monat mit
  `month` "YYYY-MM", `sources` mit den 12 Energieträgern in MWh,
  `totalGenerationMwh`, `availableHourCount`), `scatterDaily` (ein
  Eintrag je Tag mit `date`, `renewableSharePercent`,
  `co2GramsPerKwh`, `availableHourCount`), `yearlyMix` (ein Eintrag je
  Jahr, gleiche Felder wie `monthlyMix` plus `renewableSharePercent`
  und `co2GramsPerKwh`). Beispiel-Eintrag in `monthlyMix`: Monat
  "2015-01" mit einem `sources`-Objekt aus 12 Energieträger-Feldern.
- **Herkunft:** Wird nicht von Hand gepflegt, sondern automatisch durch
  `bun run scripts/build-data.ts` aus `public/data/smard.json` und
  `emission_factors.json` (Projekt-Root) erzeugt und anschließend über
  `bun run scripts/check-data.ts` geprüft.
- **Offene Doku-Punkte:** Aus dem Quellcode allein nicht sicher
  erkennbar, wann die Datei zuletzt neu erzeugt wurde (kein
  Zeitstempel im Dateiinhalt). Von der Verfasserin zu ergänzen, falls
  für das Handbuch relevant.

---

## public/data/smard.json

- **Bereich:** Rohdaten-Download (Ausgabe von `scripts/download-smard.ts`)
- **Zweck:** Enthält die stündlichen Rohwerte, die
  `scripts/download-smard.ts` direkt von der SMARD-Chart-Data-API der
  Bundesnetzagentur heruntergeladen hat. Grundlage für
  `visualization-data.json`.
- **Struktur/Feldbedeutung:** Array von Objekten mit deutschen
  Feldnamen je Zeitstempel: `timestamp`, `braunkohle`, `kernenergie`,
  `windOffshore`, `wasserkraft`, `sonstigeKonventionelle`,
  `sonstigeErneuerbare`, `biomasse`, `windOnshore`, `solar`,
  `steinkohle`, `pumpspeicher`, `erdgas`, sowie zusätzlich `last`,
  `residuallast` und `pumpspeicherVerbrauch` (Nachfrage-/Netzwerte, die
  laut `scripts/build-data.ts` aktuell nicht in
  `visualization-data.json` weiterverarbeitet werden). Die deutschen
  Feldnamen werden in `scripts/build-data.ts` über
  `GERMAN_TO_ENGLISH` auf die englischen Schlüssel aus
  `EnergySourceAccum` abgebildet.
- **Herkunft:** SMARD / Bundesnetzagentur, Filter-IDs siehe
  `scripts/download-smard.ts` (`filters`-Objekt). Genaues
  Download-Datum und exakte URL-Parameter sind aus dem Quellcode allein
  nicht sicher erkennbar (keine eingebetteten Metadaten in der Datei
  selbst). Von der Verfasserin zu ergänzen.
- **Offene Doku-Punkte:** Von der Verfasserin zu ergänzen: genaues
  Abrufdatum der Rohdaten, ggf. Lizenz-/Nutzungshinweise von SMARD.

---

## public/data/emission-factors.json

- **Bereich:** Referenzdaten (Emissionsfaktoren)
- **Zweck:** Liefert die direkten CO₂-Emissionsfaktoren je
  Energieträger in g CO2/kWh, Grundlage für den Deviation-Chart
  (`components/emissions/emissionsData.ts`).
- **Struktur/Feldbedeutung:** Entspricht `EmissionFactorsFile` aus
  `types/mix.ts`: `source`-Objekt mit vollständiger Quellenangabe
  (`title`, `publisher`, `authors`, `publication`, `url`, `note`),
  `factors`-Objekt mit einem Zahlenwert je `MixSourceKey` (erneuerbare
  Quellen und Kernenergie = 0 g/kWh, `gas` = 411, `other_fossil` = 750,
  `hardcoal` = 835, `lignite` = 1075), sowie `unit` als Einheitentext.
- **Herkunft:** Direkt in der Datei eingebettet und damit vollständig
  nachvollziehbar: Umweltbundesamt (UBA), Titel "Entwicklung der
  spezifischen Treibhausgas-Emissionen des deutschen Strommix in den
  Jahren 1990–2025", Autorinnen/Autoren Petra Icha und Dr. Thomas Lauf,
  Veröffentlichung "Climate Change 16/2026", URL
  `https://www.umweltbundesamt.de/publikationen/entwicklung-der-spezifischen-treibhausgas-0`.
- **Offene Doku-Punkte:** Keine - Quelle ist vollständig in der Datei
  selbst dokumentiert.

---

## public/data/annotations.json

- **Bereich:** Referenzdaten (historische Ereignisse für den
  Strommix-Chart)
- **Zweck:** Liefert die fünf Ereignisse, die im Stacked-Area-Chart als
  auswählbare Markierungen auf der Zeitachse erscheinen
  (`components/generation/AnnotationMarkers.vue`,
  `utils/charts/StackedAreaChart.ts`).
- **Struktur/Feldbedeutung:** Array von fünf Objekten, entspricht
  `MixAnnotation` aus `types/mix.ts` (`id`, `date` als "YYYY-MM",
  `title`, `text`, `highlight` als Liste von `MixSourceKey`-Werten):
  (1) id 1, 2015-12, Pariser Klimaabkommen; (2) id 2, 2020-07,
  Kohleausstiegsgesetz; (3) id 3, 2021-12, Abschaltung von drei
  Kernkraftwerken (Brokdorf, Grohnde, Gundremmingen C); (4) id 4,
  2022-02, Beginn des Kriegs gegen die Ukraine; (5) id 5, 2023-04,
  Abschluss des Atomausstiegs (Isar 2, Emsland, Neckarwestheim 2).
- **Herkunft:** Historische Allgemeinwissen-Ereignisse ohne eingebettete
  Quellenangabe in der Datei selbst. Von der Verfasserin zu ergänzen,
  woher die genauen Daten/Formulierungen der fünf Kurztexte stammen
  (siehe auch Quellenverzeichnis weiter unten).
- **Offene Doku-Punkte:** Für jedes der fünf Ereignisse: konkrete
  Quelle für Datum und Text von der Verfasserin zu ergänzen.

---

# Zusatzabschnitt A: KI-Einsatzbereiche (ohne Codegenerierung)

Dieser Abschnitt wurde am 27.07.2026 ergänzt. Er beschreibt, in
welchen Bereichen KI-Unterstützung im Projekt sinnvoll eingesetzt
werden konnte oder kann, *ohne* dass die KI eigenständig
Produktivcode geschrieben hat. Als Ergänzung zu den bereits im Code
vorhandenen KI-Vermerken (siehe die einzelnen Datei-Einträge oben) und
zu KI-UND-VEREINFACHUNG.md Abschnitt 9 ("KI-Nutzung zur manuellen
Bestätigung").

| Einsatzbereich | Konkretes Beispiel im Projekt | Passender Beispiel-Prompt | Existiert bereits eine Prompt-Spur? |
| --- | --- | --- | --- |
| Erklärung von D3-Funktionen über das Vorlesungsskript hinaus | `d3.stack().offset(d3.stackOffsetExpand)` in `utils/charts/StackedAreaChart.ts`; `d3.pointer` in Kombination mit `xScale.invert` beim Hover | "Was macht d3.stackOffsetExpand genau, und warum ändert sich dadurch die y-Skala auf [0,1]?" | Nein, aus dem Quellcode allein nicht sicher erkennbar - von der Verfasserin zu ergänzen |
| Erklärung von TypeScript-Fehlermeldungen | Der `as unknown as EmissionFactors`-Doppel-Cast in `scripts/build-data.ts` (`loadEmissionFactors`) | "Warum lässt TypeScript keinen direkten Cast von Record<string, number> auf ein Interface mit festen Feldern zu?" | Ja, indirekt - der Kommentar an der Stelle erklärt bereits die Begründung, was auf eine vorherige Klärung (ggf. mit KI) hindeutet, aber nicht zweifelsfrei belegt ist |
| Review von Kommentar-Klarheit und Ton | Die ausführlichen Warum-Kommentare in `pages/index.vue`, `pages/homeDataTransform.ts` und `scripts/build-data.ts` | "Ist dieser Kommentar verständlich für jemanden, der die Datei zum ersten Mal liest?" | Aus dem Quellcode allein nicht sicher erkennbar |
| Recherche zu Fachbegriffen | Zeitzonen/Sommer- und Winterzeit-Behandlung in `scripts/build-data.ts` (`Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'`); Schaltjahre bei `availableHourCount` in `types/visualization-data.ts` | "Wie berechnet man in JavaScript zuverlässig Tages-/Monatsgrenzen in einer bestimmten Zeitzone inklusive Sommerzeitumstellung?" | Aus dem Quellcode allein nicht sicher erkennbar |
| Recherche zu Emissionsfaktoren/Datenquellen | Herkunft und Aussagekraft der UBA-Emissionsfaktoren in `public/data/emission-factors.json` | "Was bedeutet 'direkte Emissionen' bei Stromerzeugung, im Unterschied zu Lebenszyklus-Emissionen?" | Nein - Quelle ist zwar in der JSON-Datei zitiert, ein Recherche-Prompt dazu ist nicht nachweisbar |
| Umformulierung von Dokumentationstexten | Diese Datei (DOKU-GRUNDLAGE.md) sowie KI-UND-VEREINFACHUNG.md | "Formuliere diesen Absatz klarer, ohne den fachlichen Inhalt zu verändern." | Aus dem Quellcode allein nicht sicher erkennbar |
| Ideen für Diagramm-/Beschriftungsvarianten | Die Richtungslabels ("← geringerer CO2-Anteil" / "höherer CO2-Anteil →") in `utils/charts/DeviationChart.ts` | "Wie könnte man die beiden Enden einer divergierenden Skala verständlich beschriften?" | Aus dem Quellcode allein nicht sicher erkennbar |
| Vergleich alternativer Lösungsansätze | Lineare Suche vs. `d3.bisector` in `utils/charts/stackedAreaHelpers.ts` (`findNearestMonthRow`), siehe auch KI-UND-VEREINFACHUNG.md Abschnitt 12 | "Was sind Vor- und Nachteile einer linearen Suche gegenüber einer Bisektionssuche bei ca. 120 Werten?" | Ja - diese konkrete Vereinfachung ist in KI-UND-VEREINFACHUNG.md Abschnitt 12 dokumentiert |

**Wichtiger Hinweis:** Diese Tabelle beschreibt plausible/mögliche
KI-Einsatzbereiche anhand des vorliegenden Codes und der Vorgeschichte
dieses Dokuments. Wo keine Prompt-Spur im Code oder in den
Begleitdokumenten nachweisbar ist, wurde das ausdrücklich vermerkt.
Es wurden keine Prompt-Historien erfunden.

---

# Zusatzabschnitt B: Quellenverzeichnis (Rohentwurf)

Dieser Abschnitt wurde am 27.07.2026 ergänzt und sammelt alle im
Projekt auffindbaren Quellenangaben sowie die Stellen, an denen
Quellenangaben fehlen und von der Verfasserin ergänzt werden müssten.

| Art der Quelle | Bezeichnung | Referenz im Projekt | Was im Projekt tatsächlich vorhanden ist |
| --- | --- | --- | --- |
| Rohdaten (Stromerzeugung) | SMARD / Bundesnetzagentur, Chart-Data-API | `scripts/download-smard.ts`, `public/data/smard.json` | Nur die Filter-IDs und die API-Basis-URL (`https://www.smard.de/app/chart_data`) im Skript, keine eingebettete Zitation mit Abrufdatum in der JSON-Datei selbst. Von der Verfasserin zu ergänzen: genaues Abrufdatum, ggf. Lizenzhinweis von SMARD. |
| Referenzdaten (Emissionsfaktoren) | UBA, "Entwicklung der spezifischen Treibhausgas-Emissionen des deutschen Strommix in den Jahren 1990–2025", Petra Icha & Dr. Thomas Lauf, Climate Change 16/2026 | `public/data/emission-factors.json` (`source`-Objekt) | Vollständige Zitation direkt in der Datei vorhanden (Titel, Herausgeber, Autorinnen/Autoren, Publikation, URL). Kann direkt übernommen werden. |
| Historisches Ereignis 1 | Pariser Klimaabkommen (2015-12) | `public/data/annotations.json`, id 1 | Nur Titel/Text, keine Quellenangabe in der Datei. Von der Verfasserin zu ergänzen. |
| Historisches Ereignis 2 | Kohleausstiegsgesetz (2020-07) | `public/data/annotations.json`, id 2 | Nur Titel/Text, keine Quellenangabe in der Datei. Von der Verfasserin zu ergänzen. |
| Historisches Ereignis 3 | Abschaltung dreier Kernkraftwerke (2021-12) | `public/data/annotations.json`, id 3 | Nur Titel/Text, keine Quellenangabe in der Datei. Von der Verfasserin zu ergänzen. |
| Historisches Ereignis 4 | Beginn des Kriegs gegen die Ukraine (2022-02) | `public/data/annotations.json`, id 4 | Nur Titel/Text, keine Quellenangabe in der Datei. Von der Verfasserin zu ergänzen. |
| Historisches Ereignis 5 | Abschluss des Atomausstiegs (2023-04) | `public/data/annotations.json`, id 5 | Nur Titel/Text, keine Quellenangabe in der Datei. Von der Verfasserin zu ergänzen. |
| Vorlesungsskript | Prof. Jürgen Singer, "84171 Visualisierung mit Type-/JavaScript und D3" | Erwähnt in README.md (Kopfbereich) sowie sinngemäß als Vorbild für `BaseChart.ts` und die Chart-Klassen (siehe jeweilige Datei-Einträge oben) | Nur als Titelnennung in README.md, keine genaue Kapitel-/Foliennummer für einzelne übernommene Muster. Von der Verfasserin zu ergänzen, falls im Handbuch einzelne Quellen genauer belegt werden sollen. |
| Bibliothek | Vue 3.5.39 | `package.json`, `bun.lock` | Versionsnummer über `bun.lock` bestätigt. |
| Bibliothek | Nuxt 4.4.8 | `package.json` | Versionsnummer direkt aus `package.json`. |
| Bibliothek | D3 7.9.0 | `package.json` | Versionsnummer direkt aus `package.json`. |
| Bibliothek | TypeScript 5.8 | `package.json` | Versionsnummer direkt aus `package.json`. |
| Bibliothek | Vitest 4.1.10 | `package.json`, `vitest.config.ts` | Konfiguriert, aber siehe Zusatzabschnitt C - keine Tests vorhanden. |
| Laufzeitumgebung | Bun 1.3.14 | Terminal (`bun --version`) | Nicht in einer Projektdatei dokumentiert, nur zur Laufzeit geprüft. |
| Schriftarten | Inter (400/500/600/700), Source Serif 4 (600/700/800) | `public/fonts/`, eingebunden über `assets/css/main.css` | Nur die Dateien selbst liegen im Repository, keine Lizenz- oder Herkunftsangabe (z. B. Google Fonts, SIL Open Font License) im Projekt. Von der Verfasserin zu ergänzen. |
| Farbpaletten/Kontrastmodus | `MIX_COLORS`, `MIX_COLORS_ACCESSIBLE` in `components/generation/mixConfig.ts` | `components/generation/mixConfig.ts` | Keine explizite externe Quelle (z. B. ColorBrewer, WCAG-Kontrastrechner) im Code referenziert. Von der Verfasserin zu ergänzen, falls die Farbwahl auf einer bestimmten Quelle beruht. |

---

# Zusatzabschnitt C: Unit-Test-Analyse

Dieser Abschnitt wurde am 27.07.2026 ergänzt.

**Aktueller Stand (verifiziert über das Dateisystem):** Vitest ist im
Projekt vollständig konfiguriert - `package.json` enthält das Skript
`"test": "vitest run"` sowie `"check": "npx nuxi typecheck && vitest
run && nuxt build"`, die Abhängigkeiten `vitest`, `@vue/test-utils` und
`happy-dom` sind in `package.json` als devDependencies eingetragen, und
`vitest.config.ts` ist vorhanden und konfiguriert `environment:
'happy-dom'` sowie `include: ['tests/**/*.test.ts']`. **Tatsächlich
existiert aber kein einziger Testfile im Projekt:** Der Ordner
`tests/` existiert nicht, und es gibt im gesamten Repository keine
Datei mit der Endung `.test.ts` oder `.spec.ts`.

**Wichtiger Widerspruch zu README.md:** README.md behauptet an einer
Stelle, es gäbe eine Datei `tests/calculations.test.ts` mit "30
Unit-Tests". Das ist nach der Prüfung des tatsächlichen
Dateisystemstands falsch bzw. veraltet - README.md beschreibt an
mehreren Stellen ohnehin eine ältere Projektstruktur (u. a.
`ScatterAnalysis.vue`, `components/dashboard/`, `components/viz/`,
`checks/level1-integrity.mjs`), die im aktuellen Code nicht mehr
existiert. Für diese Dokumentationsaufgabe wurde ausschließlich der
tatsächliche, aktuelle Code als Grundlage verwendet, nicht README.md.

**Empfehlung:** Da keinerlei Tests existieren, wären aus
Aufwandsgründen zuerst reine, zustandslose Berechnungs-/Hilfsfunktionen
sinnvoll zu testen - also Funktionen ohne Vue-Komponenten, ohne
D3-Zeichenlogik und ohne Netzwerkzugriff. Die folgende Tabelle listet
konkrete Kandidaten.

| Datei | Funktion | Warum testen | Sinnvolle Testfälle | Aufwand |
| --- | --- | --- | --- | --- |
| `scripts/build-data.ts` | `roundToTwoDecimals` | Einfache, aber überall verwendete Rundungslogik | (1) 1.005 → 1.01 oder 1.0 je nach Fließkomma-Rundung prüfen; (2) negative Zahl; (3) bereits gerundeter Wert bleibt gleich | klein |
| `scripts/build-data.ts` | `extractSources` | Enthält die Sonderfall-Logik für den Atomausstieg (`NUCLEAR_PHASEOUT_DATE`) | (1) Kernenergiewert fehlt vor dem Ausstiegsdatum → `null`; (2) Kernenergiewert fehlt nach dem Ausstiegsdatum → 0 eingesetzt; (3) anderer Wert fehlt oder ist keine gültige Zahl → `null` | mittel |
| `scripts/build-data.ts` | `calculateCo2Weighted`, `calculateRenewableGeneration` | Kernrechnung für CO2-Gewichtung und EE-Anteil | (1) bekannte Werte mit Handrechnung vergleichen; (2) alle Werte 0 → Ergebnis 0 | klein |
| `scripts/build-data.ts` | `hasNegativeGeneration` | Datenqualitätsprüfung mit Toleranzgrenze -0,001 | (1) Wert genau -0.001 → false (toleriert); (2) Wert -0.002 → true; (3) alle Werte positiv → false | klein |
| `pages/homeDataTransform.ts` | `calculateSharePercent` | Division-durch-Null-Schutz ist zentral fürs Diagramm | (1) normaler Fall; (2) `totalMwh` = 0 → 0 statt NaN; (3) negativer Wert (sollte laut Datenprüfung nicht vorkommen, aber Funktionsverhalten dokumentieren) | klein |
| `pages/homeDataTransform.ts` | `transformYearlyDataToChartData` | Delta-Berechnung aus gerundeten statt exakten Werten ist eine bewusste, aber leicht falsch zu implementierende Entscheidung | (1) Delta stimmt mit der Differenz der gerundeten Anzeigewerte überein, nicht mit der exakten Differenz; (2) Reihenfolge/Anzahl der zehn Einträge entspricht `ITEM_CONFIG` | mittel |
| `utils/charts/deviationChartHelpers.ts` | `getDeviationBarX`, `getDeviationBarWidth` | Fallunterscheidung negativ/positiv ist die Kernlogik des divergierenden Balkendiagramms | (1) negativer Wert; (2) positiver Wert; (3) Wert 0 | klein |
| `utils/charts/deviationChartHelpers.ts` | `createSymmetricDomain` | Rundung auf den nächsten Zehner und Sonderfall ≤ 0 | (1) `maximumDeviation` = 0 → `[-1, 1]`; (2) Wert knapp unter einem Zehner (z. B. 27) → `[-30, 30]`; (3) Wert genau auf einem Zehner (z. B. 30) → `[-30, 30]` | klein |
| `utils/charts/deviationChartHelpers.ts` | `formatPercentagePoints` | Vorzeichen- und Formatierungslogik mit Sonderzeichen (echtes Minuszeichen) | (1) positiver Wert → "+x,x pp"; (2) negativer Wert → "-x,x pp" (mit echtem Minuszeichen); (3) Wert 0 → "0 pp" | klein |
| `utils/charts/stackedAreaHelpers.ts` | `parseAnnotationDate` | Drei verschiedene Eingabeformate mit Fallback-Logik | (1) "YYYY-MM" → korrektes Datum; (2) nur "YYYY" → 1. Juli des Jahres (Monat-Index 6); (3) ungültiges Format (sollte laut aktuellen Daten nicht vorkommen, aber Funktionsverhalten dokumentieren) | klein |
| `utils/charts/stackedAreaHelpers.ts` | `findNearestMonthRow` | Seit der Vereinfachung eine einfache lineare Suche - gut geeignet, um die Umstellung von `d3.bisector` abzusichern | (1) Zieldatum liegt genau auf einem Monatswert; (2) Zieldatum liegt zwischen zwei Monatswerten; (3) leeres Array → `null` | klein |
| `composables/useMixMetrics.ts` | `getOverviewMetrics` | Enthält mehrere Suchschritte (Jahr 2015/2024) mit `null`-Rückgabe bei fehlenden Jahren | (1) beide Jahre vorhanden → korrekte Gruppensummen; (2) eines der beiden Jahre fehlt → `null`; (3) größter Zuwachs/Rückgang wird korrekt bestimmt | mittel |
| `composables/useMixMetrics.ts` | `getSourceMetrics` | Kombiniert Anteilsberechnung mit Extremwertsuche | (1) normaler Fall mit bekannten Werten; (2) `monthRows` leer → `null`; (3) Änderung in Prozentpunkten korrekt berechnet | mittel |

**Wenn die Zeit knapp ist**, würde ich mit diesen drei Tests zuerst
beginnen, weil sie am wenigsten Aufwand bei größtem Nutzen versprechen:
`getDeviationBarX`/`getDeviationBarWidth`, `calculateSharePercent` und
`formatPercentagePoints`.

---

# Zusatzabschnitt D: Testabdeckung je Datei (tatsächlicher Stand)

Dieser Abschnitt wurde am 27.07.2026 ergänzt und beantwortet für die
oben in Zusatzabschnitt C genannten sowie weitere Dateien mit
Berechnungslogik die Frage: "Gibt es für diese Datei aktuell
tatsächlich Tests?" Die Antwort ist für **jede einzelne Datei im
Projekt identisch**, weil - wie in Zusatzabschnitt C erklärt - keine
einzige Testdatei existiert:

| Datei | Enthält testbare, reine Funktionen? | Tatsächliche Testabdeckung |
| --- | --- | --- |
| `scripts/build-data.ts` | Ja (siehe Zusatzabschnitt C) | Keine Tests vorhanden. |
| `scripts/check-data.ts` | Teilweise (`isValidNumber`, `checkSources`) | Keine Tests vorhanden. |
| `scripts/checks/check-calculations.ts` | Ja (`findYear2024`, `checkYearlyTotal`, `checkRenewableShare`), wird aber selbst schon als manuelles Kontrollskript genutzt (`bun run scripts/checks/check-calculations.ts`) | Keine automatisierten Tests vorhanden, nur die manuelle Skriptausführung. |
| `pages/homeDataTransform.ts` | Ja (siehe Zusatzabschnitt C) | Keine Tests vorhanden. |
| `utils/charts/deviationChartHelpers.ts` | Ja (siehe Zusatzabschnitt C) | Keine Tests vorhanden. |
| `utils/charts/stackedAreaHelpers.ts` | Ja (siehe Zusatzabschnitt C) | Keine Tests vorhanden. |
| `composables/useMixMetrics.ts` | Ja (siehe Zusatzabschnitt C) | Keine Tests vorhanden. |
| `composables/useMixData.ts` | Ja (`normalizeMonth`, `calculateYearRows` sind reine Funktionen, wenn auch nicht Teil von Zusatzabschnitt C) | Keine Tests vorhanden. |
| `components/home/groupedBarUtils.ts` | Ja (`roundToOneDecimal`, `formatDelta`, `formatPercent`, `getBarOpacity` u. a.) | Keine Tests vorhanden. |
| `components/emissions/emissionsData.ts` | Ja (`calculateEmissionsMt`, `calculateEmissionIntensity`, `calculateShare`) | Keine Tests vorhanden. |
| `components/emissions/deviationData.ts` | Aus dem Quellcode allein nicht abschließend geprüft in dieser Aufgabe, aber laut bestehendem Eintrag oben ebenfalls reine Berechnungsfunktionen | Keine Tests vorhanden. |
| `utils/charts/BaseChart.ts`, `utils/charts/DeviationChart.ts`, `utils/charts/StackedAreaChart.ts` | Nein direkt - diese Klassen zeichnen SVG über D3 und sind damit für einfache Unit-Tests ungeeignet (siehe Empfehlung in Zusatzabschnitt C, nur die ausgelagerten reinen Hilfsfunktionen zu testen) | Keine Tests vorhanden. |
| Alle Vue-Komponenten (`components/**/*.vue`, `pages/*.vue`) | Nein direkt - würden Komponenten-Tests mit `@vue/test-utils` erfordern, was über einfache Unit-Tests hinausgeht | Keine Tests vorhanden. |
| `types/mix.ts`, `types/visualization-data.ts` | Nein - reine Typdefinitionen ohne Laufzeitverhalten | Nicht testbar/nicht zutreffend. |

**Zusammenfassung:** Von 47 Quelldateien im Projekt enthalten nach
dieser Prüfung mindestens 9 Dateien reine, ohne größeren Aufwand
testbare Funktionen (siehe Tabelle oben und Zusatzabschnitt C). Keine
davon ist aktuell durch automatisierte Tests abgedeckt, obwohl Vitest
vollständig eingerichtet ist. Dies ist unabhängig von den in dieser
Aufgabe vorgenommenen Dokumentationsänderungen - es wurde kein Code
verändert und keine Testdatei angelegt.

---

## Tests implementiert (03.08.2026)

- Ordner `tests/` angelegt (Vitest war bereits über `vitest.config.ts`
  und die Devdependencies in `package.json` vollständig eingerichtet -
  `include: ['tests/**/*.test.ts']`, `environment: 'happy-dom'`,
  Alias `~`/`@` auf das Projektverzeichnis. Es musste also nichts neu
  installiert oder konfiguriert werden.)
- Getestete Funktionen (7 von 11 ursprünglich vorgesehenen):
  - `calculateSharePercent` (`pages/homeDataTransform.ts`)
  - `transformYearlyDataToChartData` (`pages/homeDataTransform.ts`)
  - `getDeviationBarX` (`utils/charts/deviationChartHelpers.ts`)
  - `getDeviationBarWidth` (`utils/charts/deviationChartHelpers.ts`)
  - `createSymmetricDomain` (`utils/charts/deviationChartHelpers.ts`)
  - `formatPercentagePoints` (`utils/charts/deviationChartHelpers.ts`)
  - `findNearestMonthRow` (`utils/charts/stackedAreaHelpers.ts`)
- Framework: Vitest (bereits vorhandenes Setup, siehe oben), Tests
  laufen ohne Dateisystem- oder Netzwerkzugriff, nur mit lokal im
  jeweiligen Testfile erzeugten Beispieldaten.
- Ergebnis: 7 Testdateien, 17 `it()`-Fälle, **17 grün, 0 rot**
  (`bun run test` → `Test Files 7 passed (7)`, `Tests 17 passed (17)`).
- **Nicht umgesetzt:** `extractSources`, `calculateCo2Weighted`,
  `calculateRenewableGeneration` und `hasNegativeGeneration` aus
  `scripts/build-data.ts` wurden **nicht** getestet. Grund ist nicht
  nur, dass diese vier Funktionen nicht exportiert sind, sondern vor
  allem, dass die Datei am Dateiende unbedingt (ohne Guard wie
  `if (import.meta.main)`) `main().catch(handleMainError)` ausführt.
  Ein `import` aus dieser Datei in einem Testfile würde also beim
  Laden des Moduls sofort den kompletten Build-Vorgang anstoßen (echte
  Dateizugriffe auf `public/data/*.json`, potenziell `process.exit(1)`
  bei einem Fehler) - das hätte den gesamten Testlauf gefährdet, nicht
  nur die vier betroffenen Tests. Passend zur Vorgabe "Quellcode bei
  Testproblemen nicht anfassen" wurde `scripts/build-data.ts`
  deshalb unverändert gelassen und auf Tests für diese vier Funktionen
  verzichtet.

## CSS- und Style-Block-Prüfung (Nachtrag)

Geprüft wurden alle CSS-Dateien (`assets/css/main.css`,
`assets/css/chart-styles.css`) sowie die `<style>`-Blöcke in allen 20
`.vue`-Dateien unter `components/`, `pages/` und `app.vue`. Die Suche
lief direkt über das Dateisystem (nicht über den Editor-Puffer), um
sicherzugehen, dass wirklich der aktuelle Stand auf der Festplatte
geprüft wird.

**Ergebnis KI-Erwähnungen:** Es wurde **keine** KI-Erwähnung mehr in
CSS-Dateien oder `<style>`-Blöcken gefunden (gesucht u. a. nach
"KI-Vorschlag", "KI-Antwort", "KI-Unterstützung", "Claude", "ChatGPT",
"Copilot", "künstliche Intelligenz"). `assets/css/chart-styles.css`
enthielt zum Zeitpunkt der Prüfung ebenfalls keine solchen Kommentare
mehr - diese waren offenbar bereits in einem früheren, hier nicht
protokollierten Schritt entfernt worden. Es wurde also keine CSS-Regel
verändert, weil keine entsprechende Textstelle mehr vorhanden war.

**Ergebnis Autor-Tag:** Dabei ist aufgefallen, dass 14 Dateien den
Hinweis `@author Selina Schneider` im Kopfkommentar noch nicht
enthielten, obwohl er in anderen Dateien des Projekts durchgängig
verwendet wird. Ergänzt wurde der Tag in:

- `assets/css/chart-styles.css`
- `components/emissions/DeviationTooltip.vue`
- `components/emissions/EmissionsPanel.vue`
- `components/emissions/YearSlider.vue`
- `components/generation/GenerationPanel.vue`
- `components/generation/MixSidebar.vue`
- `components/generation/MixTooltip.vue`
- `components/generation/StackedAreaChart.vue`
- `components/generation/StackedAreaLegend.vue`
- `components/home/GroupedBarChart.vue`
- `components/home/IntroHero.vue`
- `components/home/IntroMethodology.vue`
- `components/home/IntroTrustLine.vue`
- `components/layout/SiteNav.vue`
- `app.vue`

Bei den meisten dieser Dateien gab es bereits einen kurzen
Kopfkommentar, dem nur die `@author`-Zeile fehlte. Bei vier Dateien
(`EmissionsPanel.vue`, `YearSlider.vue`, `IntroMethodology.vue`,
`app.vue`) gab es noch gar keinen richtigen Kopfkommentar - dort wurde
ein kurzer, ein- bis zweizeiliger Kommentar mit Dateiname, knapper
Beschreibung und Autor-Tag neu ergänzt (Stil an die bereits
vorhandenen Kommentare in anderen Dateien angelehnt).

**Bestätigung:** An keiner Stelle wurde eine CSS-Regel, ein Selektor,
ein Wert oder die Reihenfolge von Regeln verändert - ausschließlich
Kommentartext wurde angepasst bzw. ergänzt. `bun run typecheck` läuft
nach den Änderungen weiterhin fehlerfrei durch.