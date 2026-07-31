# Die Klimabilanz des deutschen Stroms

Interaktive Visualisierung des deutschen Strommixes und seiner CO₂-Bilanz von 2015 bis 2024.

## Setup

```bash
bun install
bun run dev -o
```

## Wichtige Befehle

- `bun run test` – Tests ausführen
- `bun run check` – Typprüfung, Tests und Produktions-Build ausführen
- `bun run generate` – statische Ausgabe erzeugen

## Daten aktualisieren

- `bun run data:download` – SMARD-Daten herunterladen
- `bun run data:build` – Visualisierungsdaten erzeugen
- `bun run data:check` – Visualisierungsdaten prüfen

## Projektstruktur

- `pages/` und `components/` – Seiten und Vue-Komponenten
- `composables/` und `utils/` – Anwendungs- und Diagrammlogik
- `scripts/` – Datenaufbereitung
- `public/data/` – JSON-Daten
- `tests/` – automatisierte Tests
- `public/projektbeschreibung.html` – eigenständige HTML-Projektbeschreibung

## Datenquellen

- SMARD/Bundesnetzagentur – Stromerzeugungsdaten
- Umweltbundesamt – direkte CO₂-Emissionsfaktoren

## Verfasserin

Selina Schneider · 84171 Visualisierung · Hochschule Harz