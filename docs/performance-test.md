# Performance-Testprotokoll

> Erstellt: 10.07.2026
> Projekt: Stromdaten-Visualisierung (Hochschule Harz, Medieninformatik)

## Testumgebung

| Kriterium | Wert |
|---|---|
| Browser | Chrome / Chromium |
| DevTools | Performance Panel |
| CPU-Drosselung | 4× (optional 6×) |
| Netzwerk | Fast 3G oder Slow 4G |
| Cache | Deaktiviert |

## Testablauf

1. Landingpage (`http://localhost:3000/`) neu laden
2. Dashboard öffnen (Tab „Strommix")
3. Tab „Einflussfaktoren" öffnen (Scatterplot)
4. Range-Slider bewegen
5. Zoomen (Mausrad + Verschieben)
6. Metrik wechseln (X-Achse)
7. Tooltip testen (Hover über Punkten)

## Messwerte

| Test | Testumgebung | Messwert | Beobachtung |
|---|---|---|---|
| Landingpage sichtbar | 4× CPU, Fast 3G | | |
| Dashboard bereit | 4× CPU | | |
| Scatterplot Initialrender | 4× CPU | | |
| Slider-Interaktion | 4× CPU | | |
| Zoom | 4× CPU | | |
| Hover | 4× CPU | | |
| Tab-Wechsel (Strommix → Einflussfaktoren) | 4× CPU | ~30 kB Nachladung | Lazy-Chunk ScatterAnalysis (29,8 kB JS + 6,3 kB CSS) |
| Tab-Wechsel (Einflussfaktoren → Tagesmuster) | 4× CPU | ~18 kB Nachladung | Lazy-Chunk HeatmapCO2 (17,7 kB JS + 2,0 kB CSS) |
| Tab-Wechsel (Tagesmuster → Markt & Preise) | 4× CPU | ~19 kB Nachladung | Lazy-Chunk DuckCurve (18,4 kB JS + 5,3 kB CSS) |

## Wiederholungen

| Datum | Tester | Landingpage | Dashboard | Slider | Zoom | Hover | Bemerkungen |
|---|---|---|---|---|---|---|---|
| 2026-07-10 | CI | ✅ Lädt | ✅ 60 kB initial | – | – | – | Lazy-Chunks bestätigt: je ~18–30 kB |

## Interpretation

- **Richtwert Landingpage**: Sollte nach < 3s sichtbar sein (Streamgraph lädt yearly_mix.json, ~4 kB)
- **Richtwert Dashboard**: hourly_2015_2024.json (~32 MB) muss geladen sein — bei Fast 3G kann das > 10s dauern
- **Richtwert Scatterplot**: Initialrender mit ~4k Punkten sollte < 50ms dauern
- **Richtwert Hover**: Tooltip sollte < 16ms (1 Frame) nach Mausbewegung erscheinen
