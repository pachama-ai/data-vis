# Die Klimabilanz des deutschen Stroms

Interaktive Visualisierung des deutschen Strommix und seiner
CO₂-Bilanz zwischen 2015 und 2024.

## Setup

### Voraussetzungen

- [Bun](https://bun.sh/) (empfohlen) oder Node.js 20+
- Kein API-Key nötig – alle Daten liegen bereits im Repository

### Installation

```bash
bun install
```

## Starten

```bash
bun run dev        # Entwicklungsserver, http://localhost:3000
bun run build       # Produktions-Build
bun run preview     # Vorschau des Builds
```

Weitere Befehle:

| Befehl | Beschreibung |
|--------|-------------|
| `bun run typecheck` | TypeScript-Prüfung |
| `bun run test` | Unit-Tests (Vitest) |
| `bun run check` | Typecheck + Tests + Build |

## Daten aktualisieren

```bash
bun run data:download   # Rohdaten von SMARD neu laden
bun run data:build       # visualization-data.json neu bauen
bun run data:check       # Daten auf Plausibilität prüfen
```

Normalerweise nicht nötig, weil die Datendateien schon im Projekt liegen.

## Projektstruktur

- `pages/` – Startseite und Dashboard-Seite
- `components/` – Vue-Komponenten, gegliedert nach Bereich (`emissions/`, `generation/`, `home/`, `layout/`, `shared/`)
- `composables/` – geteilte Vue-Logik (Daten, Auswahl, Zoom, Kontrastmodus)
- `utils/charts/` – reine D3-Diagrammklassen und Hilfsfunktionen
- `data/` – Laden der Visualisierungsdaten im Frontend
- `types/` – zentrale TypeScript-Typen
- `scripts/` – Datenpipeline (Download, Aufbereitung, Prüfung)
- `public/data/` – JSON-Rohdaten und aufbereitete Daten
- `assets/css/` – globale und diagrammspezifische Stile

## Datenquellen

- SMARD (Bundesnetzagentur) – Stromerzeugung 2015–2024
- Emissionsfaktoren aus `public/data/emission-factors.json`

Details zu Quellen, Abrufdatum und Lizenz stehen in der Projektdokumentation.

## Weiterführend

Eine ausführliche Beschreibung des Projekts, der Diagramme und der
Methodik steht in der Projektdokumentation (PDF) sowie in
`projektbeschreibung.html`.

## Verfasserin / Modul

Selina Schneider · Modul 84171 Visualisierung · Hochschule Harz
