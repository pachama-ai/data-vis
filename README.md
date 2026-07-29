# Die Klimabilanz des deutschen Stroms

Interaktive D3-Visualisierung des deutschen Strommix und seiner CO₂-Bilanz 2015–2024.

## Setup

`ash
bun install        # Abhängigkeiten installieren
bun run dev        # Entwicklungsserver (http://localhost:3000)
bun run build      # Produktions-Build
bun run check      # Typecheck + Tests + Build
`

## Daten aktualisieren

`ash
bun run data:download   # Rohdaten von SMARD neu laden
bun run data:build      # visualization-data.json neu bauen
bun run data:check      # Daten auf Plausibilität prüfen
`

## Projektstruktur

- pages/ – Startseite und Dashboard
- components/ – Vue-Komponenten
- composables/ – geteilte Logik (Daten, Auswahl, Zoom, Kontrast)
- utils/charts/ – D3-Diagrammklassen
- scripts/ – Datenpipeline
- public/data/ – aufbereitete JSON-Daten
- projektbeschreibung.html – ausführliche Projektdokumentation

## Datenquellen

SMARD (Bundesnetzagentur) · Umweltbundesamt (Emissionsfaktoren)

## Verfasserin

Selina Schneider · Modul 84171 Visualisierung · Hochschule Harz
