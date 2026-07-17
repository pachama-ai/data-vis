/**
 * composables/useVisualizationData.ts
 * ====================================
 * Lädt public/data/visualization-data.json und gibt ein
 * Promise<VisualizationData> zurück.
 *
 * Cache und laufendes Promise liegen auf Modulebene, damit:
 *   a) mehrere Komponenten dieselben Daten nutzen
 *   b) parallele Aufrufe nicht mehrere Fetches auslösen
 *   c) erfolgreich geladene Daten nicht erneut geladen werden
 *
 * @example
 * const { loadVisualizationData } = useVisualizationData()
 * const data = await loadVisualizationData()
 */

import type { VisualizationData } from '~/types/visualization-data'

let cache: VisualizationData | null = null
let pendingPromise: Promise<VisualizationData> | null = null

/**
 * Minimale Schutzprüfung: stellt sicher, dass das geladene JSON
 * die erwarteten vier Arrays enthält. Die vollständige Validierung
 * erfolgt durch scripts/check-data.ts.
 */
function hasValidStructure(raw: unknown): raw is VisualizationData {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return (
    Array.isArray(obj.monthlyMix) &&
    Array.isArray(obj.heatmapCo2) &&
    Array.isArray(obj.scatterDaily) &&
    Array.isArray(obj.yearlyMix)
  )
}

export function useVisualizationData() {
  async function loadVisualizationData(): Promise<VisualizationData> {
    if (cache) return cache
    if (pendingPromise) return pendingPromise

    pendingPromise = (async () => {
      try {
        const res = await fetch('/data/visualization-data.json')
        if (!res.ok) {
          throw new Error(
            `Fehler beim Laden der Visualisierungsdaten: ${res.status} ${res.statusText}`
          )
        }
        const raw: unknown = await res.json()

        if (!hasValidStructure(raw)) {
          throw new Error('Die Visualisierungsdaten haben ein ungültiges Format.')
        }

        cache = raw
        return cache
      } finally {
        pendingPromise = null
      }
    })()

    return pendingPromise
  }

  return { loadVisualizationData }
}
