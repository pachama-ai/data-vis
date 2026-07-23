# Tests – Übersicht

## Testframework

Das Projekt verwendet **Vitest** mit **happy-dom** als Browser-Umgebung und **@vue/test-utils** für Komponententests.

Alle Tests starten mit:

```
npx vitest run
```

Einzelne Testdateien:

```
npx vitest run tests/home/GroupedBarChart.test.ts
```

## Testarten

### Unit-Tests

Prüfen einzelne Funktionen oder kleine Module isoliert – ohne Vue-Komponente, ohne DOM.

Beispiele:
- `tests/home/groupedBarUtils.test.ts` – Formatiert Funktionen, Filterlogik
- `tests/generation/mixConfig.test.ts` – Farbkonstanten
- `tests/emissions/deviationData.test.ts` – Abweichungsberechnungen

### Komponententests

Prüfen Vue-Komponenten mit `mount()`: sichtbare Texte, Props, Emits, Klicks, ARIA-Attribute.

Beispiele:
- `tests/home/GroupedBarChart.test.ts` – D3-Rendering, Balken, Labels
- `tests/generation/StackedAreaLegend.test.ts` – Legenden-Chips, Klickverhalten
- `tests/common/SiteNav.test.ts` – Navigation, Zoom, Kontrast

### Integrationstests

Prüfen das Zusammenspiel mehrerer Module oder Komponenten.

Beispiele:
- `tests/dashboard/DashboardPage.test.ts` – Tab-Wechsel über Query-Parameter
- `tests/emissions/DeviationChart.test.ts` – Chart + Sidebar + Slider

### Datenqualitätstests

Prüfen fachliche Konsistenz der Daten.

Beispiele:
- `tests/data-quality.test.ts` – Einheiten, EE-Anteil, Rundung
- `tests/data/nuclearData.test.ts` – Kernenergie-Ausstieg 2023

## Teststruktur

```
tests/
├── home/            GroupedBarChart, groupedBarUtils, homeDataTransform
├── generation/      StackedAreaChart, Legend, Sidebar, Tooltip, u.a.
├── emissions/       DeviationChart, Sidebar, Tooltip, YearSlider, u.a.
├── dashboard/       DashboardPage
├── common/          SiteNav
├── composables/     useHighContrast
├── data/            nuclearData
└── rest/            calculations, data-quality, logic
```

## Testnamen

Testnamen sollen kurz erklären, was geprüft wird:

- „sortiert die Balken nach Klimawirkung"
- „zeigt 2024 als ausgewähltes Jahr"
- „wechselt nach einem Klick zu Emissionen"
- „berechnet eine positive Abweichung"

Keine vagen Namen wie „should work correctly" oder „handles data".

## Testdaten

Testdaten liegen inline im Test oder in dedizierten Hilfsdateien:

- `tests/generation/stackedAreaTestData.ts` – `createMonthRow()` für StackedArea-Tests

Neue Testdaten sollen klein, lesbar und fachlich plausibel sein.

## JSDoc in Tests

JSDoc ist sinnvoll bei:
- exportierten Testhilfen (`createMonthRow`)
- Testdatengeneratoren
- gemeinsam genutzten Mount-Funktionen

Nicht nötig vor jedem `it`-Block – der Testname soll erklären, was geprüft wird.

## Wichtige fachliche Regeln (getestet)

- Prozentanteile berechnen
- Prozentpunkte (Abweichung) berechnen
- Emissionen aus Erzeugung × Faktor
- Sortierung nach Kategorie / Klimawirkung
- Labelposition außerhalb des Balkens
- TWh-/Prozent-Umschaltung
- Jahresauswahl per Slider
- Ereignisauswahl (Annotationen)
- Energieträgerauswahl in der Legende
- Tab-Wechsel im Dashboard
- Seiten-Zoom 100/105/110%
- Kontrastmodus (Farben + CSS-Tokens)

## Offline-Fähigkeit

- Datenpfade zeigen auf lokale JSON-Dateien unter `public/data/`
- Fonts werden lokal aus `public/fonts/` geladen
- Emissionsfaktoren werden lokal geladen
- Keine externen API-Aufrufe in produktiven Komponenten
