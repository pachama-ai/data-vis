---

## 50. Performance-Optimierungen — Gesamtübersicht (Stand 10.07.2026)

### Umgesetzte Optimierungen

#### ScatterAnalysis.vue (Haupt-Arbeitspaket)

| Optimierung | Status | Wirkung |
|---|---|---|
| `updateVisuals(ux, uy)` — gemeinsame Render-Funktion für Zoom + Watch | ✅ Final | Ein Code-Pfad, keine Inkonsistenzen |
| Grids nutzen `useX`/`useY` statt ungezoomter `xScale`/`yScale` | ✅ Final | Grids immer synchron zu Achsen |
| `useX`/`useY` vor aller Renderlogik definiert (kein TDZ) | ✅ Final | Axiale Stabilität |
| Trendlinie in `updateVisuals` integriert | ✅ Final | Wird beim Zoomen mitaktualisiert |
| Zoom-Handler auf `updateVisuals(zx, zy)` reduziert | ✅ Final | Kein doppelter Code |
| `watchEffect` → gezielte `watch()` + `scheduleRender(reason)` | ✅ Final | Nur nötige Render-Pfade pro Änderung |
| `requestAnimationFrame`-Scheduler (`scheduleRender`) | ✅ Final | Bündelung bei Slider-Ziehen |
| Trendlinie debounced (150ms) | ✅ Final | Keine Neuberechnung bei jedem Tick |
| `allPoints` entfernt → echter Data-Join mit `rangePoints` | ✅ Final | DOM hat nur ~4k–24k Circles statt 85k |
| `timeRangeChanged` macht echten D3-Data-Join | ✅ Final | Kein `style.display`-Toggling |
| Single-Circle-Layer (vorher zwei Layer) | ✅ Final | DOM-Elemente halbiert |
| `TRANS_DURATION = 0` — keine D3-Transitions | ✅ Final | Keine gestauten Animation-Frames |
| Voronoi/Delaunay entfernt → Brute-Force-Hover | ✅ Final | Hover < 1ms, Bundle 100 kB statt 119 kB |
| Pointer-Move rAF-Scheduler mit `lastHoverId`-Dedup | ✅ Final | Maximal 1 Berechnung pro Frame |
| `performance.mark/measure` mit eindeutigen IDs | ✅ Final | Saubere Profiling-Ergebnisse |
| `console.table({filteredPoints, circlesInDom})` nach Data-Join | ✅ Final | Verifikation der DOM-Menge |
| Semantische Punktfarben pro X-Achse | ✅ Final | Kein Performance-Effekt, aber UX |
| Tageszeit-Färbung mit Legende | ✅ Final | Kein Performance-Effekt |
| `onUnmounted`: `cancelAnimationFrame(renderRaf + hoverRaf)` + `clearTimeout(trendlineTimer)` | ✅ Final | Keine ausstehenden Callbacks nach Unmount |

#### Datenloading

| Optimierung | Status | Wirkung |
|---|---|---|
| Shared Promises in `useData.ts` | ✅ Final | Kein doppelter Fetch bei Parallelaufrufen |
| `finally { promise = null }` nach Fehlern | ✅ Final | Wiederholter Ladeversuch nach Fehler möglich |
| `shallowRef` für große Arrays in `dashboard.vue` | ✅ Final | Keine tiefe Reaktivität auf 85k-Zeilen |
| `loadSmard()` + `loadPrices()` in `useData.ts` | ✅ Final | Landingpage und Dashboard teilen Cache |
| `useDashboardPreload` mit `requestIdleCallback` + setTimeout-Fallback | ✅ Final | Daten im Hintergrund, blockiert Render nicht |
| `@pointerenter` + `@focus`-Preload auf Dashboard-Link | ✅ Final | Datenstart bei Nutzerabsicht |

#### Lazy Loading

| Optimierung | Status | Wirkung |
|---|---|---|
| `defineAsyncComponent` für 3 von 4 Chart-Tabs | ✅ Final | Dashboard initial nur 60 kB statt 101 kB (−40%) |
| `v-if` statt `v-show` für Tab-Inhalte | ✅ Final | Komponenten laden erst bei Tab-Wechsel |
| `<Suspense>` mit Fallback-Text | ✅ Final | Kein Layout-Sprung beim ersten Tab-Wechsel |
| Network-Tab bestätigt: Chunks laden nur bei Klick | ✅ Final | ScatterAnalysis: 30 kB, HeatmapCO2: 17 kB, DuckCurve: 18 kB |

#### Offline-Fähigkeit

| Optimierung | Status | Wirkung |
|---|---|---|
| Google Fonts lokal eingebunden | ✅ Final | Kein CDN nötig, 7 Font-Dateien in `public/fonts/` |
| `@font-face` in `main.css`, CDN-Link aus `nuxt.config.ts` entfernt | ✅ Final | 0 externe Requests bei Runtime |
| Performance-API bestätigt: 0 externe Ressourcen | ✅ Final | Landing + Dashboard voll offline-fähig |

#### Landingpage

| Optimierung | Status | Wirkung |
|---|---|---|
| SMARD-Rohdaten + Preise teilen Cache mit Dashboard | ✅ Final | Kein doppelter 35-MB-Fetch |
| 8 datenbasierte Meilensteine aus echten Timestamps | ✅ Final | Keine erfundenen Daten |

### Verworfen / Nicht umgesetzt

| Ansatz | Grund für Verwerfung |
|---|---|
| `allPoints`-computed mit 85k DOM + `style.display`-Toggle | **Verworfen** — User-Feedback: 85k DOM-Knoten inakzeptabel. Ersetzt durch echten Data-Join (Abschnitt 49). |
| Canvas statt SVG für Scatterplot | **Nicht umgesetzt** — User-Vorgabe: „kein Canvas-Umbau, solange Messungen das nicht begründen". SVG-Scatter mit ~4k Punkten ist < 50ms. |
| Web Worker für Datenverarbeitung | **Nicht umgesetzt** — User-Vorgabe: kein Web Worker ohne Messgrundlage. |
| IndexedDB für Daten-Caching | **Nicht umgesetzt** — User-Vorgabe: kein IndexedDB ohne Messgrundlage. HTTP-Cache + Module-Cache reichen. |
| Service Worker / PWA | **Nicht umgesetzt** — Nicht gefordert; lokale Daten + HTTP-Cache ausreichend. |
| d3-hexbin für Dichtedarstellung | **Nicht umgesetzt** — Alpha-Rendering (opacity 0.25–0.40) liefert ausreichende Dichteinformation. |
| Pinia / externer State-Manager | **Nicht umgesetzt** — `reactive()` im Modul-Scope ist für dieses Projekt ausreichend und einfacher. |
| Nuxt 4 Migration | **Nicht umgesetzt** — User-Vorgabe: „kein Wechsel auf Nuxt 4". |
| RacingBarChart (erste Landingpage-Version) | **Verworfen** — Ersetzt durch AnimatedStreamgraph, später durch RecordTimeline. |
| Scatter-Phasen-Animation (Play/Pause) | **Verworfen** — Ersetzt durch Range-Slider (monatsweise). |

### Aktueller Stand

```
✔ 730+ Module kompilieren fehlerfrei
✔ 0 Build-Fehler
✔ 0 Lint-Warnungen
✔ Bundle: initial 177 kB (entry) + 60 kB (dashboard) → Lazy-Chunks: ~18–38 kB
✔ Landingpage: Hero, Trust, Timeline-Skeleton, Methodik, CTA
  └── ⚠ RecordTimeline + TimelineFilters benötigen Watch-Fix
✔ Dashboard: voll funktionsfähig (alle 4 Tabs, KPIs, Filter)
✔ Offline: 0 externe Requests, lokale Fonts
✔ Daten-Cache: Landingpage + Dashboard teilen alle Loader
```

### Offene Aufgaben (nicht im Scope dieser Iteration)

- RecordTimeline Watch-Fix (D3-SVG wird nach Datenladung nicht gerendert)
- TimelineFilters-Sichtbarkeit (durch ClientOnly-Kapselung)
- Performance-Messwerte mit CPU-Drosselung 4× eintragen
- `bun run dev`-Kompatibilität (bekanntes Nuxt 3.21 + Vite 7 + Windows-Problem)
