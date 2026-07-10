# Offline-Testprotokoll

> Erstellt: 10.07.2026
> Projekt: Stromdaten-Visualisierung (Hochschule Harz, Medieninformatik)

## Voraussetzung

Das Projekt läuft gemäß der vorgesehenen Abgabeanweisung (z. B. `node .output/server/index.mjs` nach `npx nuxt build`).

## Testablauf

1. Server starten
2. Landingpage (`http://localhost:3000/`) im Browser öffnen
3. Dashboard (`http://localhost:3000/dashboard`) öffnen
4. DevTools → Network → „Offline" setzen
5. Seite vollständig neu laden (Strg+F5)
6. Alle Routen öffnen: `/`, `/dashboard`
7. Alle Visualisierungen bedienen:
   - **Landingpage**: Streamgraph-Animation prüfen
   - **Strommix (Tab 1)**: StackedArea — Legende togglen, Modus wechseln
   - **Einflussfaktoren (Tab 2)**: Scatterplot — Slider, Zoom, Metrikwechsel, Tooltip
   - **Tagesmuster (Tab 3)**: Heatmap — Metrikwechsel, Hover, Klick
   - **Markt & Preise (Tab 4)**: DuckCurve — Story-Schritte, Presets
8. KPIs, Filter-Chips und Footer prüfen

## Prüfliste externe Ressourcen

| Ressource | Status | Bemerkung |
|---|---|---|
| Google Fonts (Inter, Source Serif 4) | ⬜ Geprüft | Fallback-Schriften vorhanden? |
| CDN-Skripte | ⬜ Geprüft | Keine erlaubt |
| Externe Bilder | ⬜ Geprüft | Keine erlaubt |
| Externe Icons | ⬜ Geprüft | Keine erlaubt |
| SMARD-API zur Laufzeit | ⬜ Geprüft | Daten liegen lokal als JSON |
| ENTSO-E-API zur Laufzeit | ⬜ Geprüft | Daten liegen lokal als JSON |
| Sonstige http/https-Requests | ⬜ Geprüft | |

## Externe Requests im DevTools-Netzwerk-Tab

| URL | Quelle | Status |
|---|---|---|
| `http://localhost:3000/` | Eigen | ✅ |
| `http://localhost:3000/dashboard` | Eigen | ✅ |
| `http://localhost:3000/data/hourly_2015_2024.json` | Eigen | ✅ |
| `http://localhost:3000/data/yearly_mix.json` | Eigen | ✅ |
| `http://localhost:3000/_nuxt/...` | Eigen | ✅ |
| `https://fonts.googleapis.com/...` | Google Fonts | ⬜ |
| | | |

## Ergebnis

| Kriterium | Erwartung | Tatsächlich |
|---|---|---|
| Landingpage ohne Internet | Seite lädt vollständig | ⬜ |
| Dashboard ohne Internet | KPIs + Charts laden + Daten sichtbar | ✅ |
| Visualisierungen interaktiv | Slider, Zoom, Hover, Tabs funktionieren | ✅ |
| Keine Fehler in Konsole | 0 Netzwerkfehler | ✅ |
| Keine externen Requests (außer localhost) | 0 | ✅ |

## Ergebnisse (10.07.2026)

| Prüfung | Status | Details |
|---|---|---|
| Google Fonts lokal | ✅ Erledigt | 7 @font-face-Deklarationen in `main.css`, CDN-Link aus `nuxt.config.ts` entfernt |
| Fonts geladen (lokal) | ✅ | `Inter-400.ttf` bis `Inter-700.ttf` + `SourceSerif4-600.ttf` bis `SourceSerif4-800.ttf` in `public/fonts/` |
| Externe Requests zur Laufzeit | ✅ Keine | Performance-API zeigt 0 externe Ressourcen (nur localhost) |
| Lazy-Loading funktioniert | ✅ | ScatterAnalysis, HeatmapCO2, DuckCurve laden nur bei Tab-Wechsel |
| Promise-Reset bei Fehlern | ✅ | `finally`-Block setzt `hourlyPromise`/`yearlyPromise`/`factorsPromise` zurück |
| Hover-rAF | ✅ | Module-level `hoverRaf`, `pointermove` statt `mousemove`, Cleanup bei Unmount |
| renderRaf/Trendline-Cleanup | ✅ | `cancelAnimationFrame` + `clearTimeout` in `onUnmounted` |
| Shallow-Reactivity | ✅ | `shallowRef` in dashboard.vue, `useData` nutzt plain Module-Variablen |

## Bekannte Einschränkungen

- **Kein Service Worker**: Die App nutzt kein PWA-Setup. Nach dem ersten Laden sind alle Ressourcen im Browser-Cache (HTTP-Cache) verfügbar, solange der Cache nicht geleert wird.
