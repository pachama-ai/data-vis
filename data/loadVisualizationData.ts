/**
 * composables/useVisualizationData.ts
 * ====================================
 * Lädt public/data/visualization-data.json und gibt ein
 * Promise<VisualizationData> zurück.
 *
 * Cache und laufender Request liegen auf Modulebene, damit:
 *   a) mehrere Komponenten dieselben Daten nutzen
 *   b) parallele Aufrufe nicht mehrere Fetches auslösen
 *   c) erfolgreich geladene Daten nicht erneut geladen werden
 */

import type { VisualizationData } from '~/types/visualization-data'

let cachedData: VisualizationData | null = null
let pendingRequest: Promise<VisualizationData> | null = null

/**
 * Minimale Strukturprüfung: prüft, dass das geladene JSON die vier
 * erwarteten Hauptarrays enthält. Die vollständige fachliche Validierung
 * erfolgt in scripts/check-data.ts – dieser Guard verhindert nur, dass
 * offensichtlich ungültige Daten in den Cache gelangen.
 */
function isVisualizationData(value: unknown): value is VisualizationData {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    Array.isArray(obj.monthlyMix) &&
    Array.isArray(obj.heatmapCo2) &&
    Array.isArray(obj.scatterDaily) &&
    Array.isArray(obj.yearlyMix)
  )
}

async function fetchVisualizationData(): Promise<VisualizationData> {
  const response = await fetch('/data/visualization-data.json')

  if (!response.ok) {
    throw new Error(
      `Fehler beim Laden der Visualisierungsdaten: ${response.status} ${response.statusText}`,
    )
  }

  const raw: unknown = await response.json()

  if (!isVisualizationData(raw)) {
    throw new Error('Die Visualisierungsdaten haben ein ungültiges Format.')
  }

  return raw
}

export function useVisualizationData() {
  async function loadVisualizationData(): Promise<VisualizationData> {
    if (cachedData) return cachedData
    if (pendingRequest) return pendingRequest

    pendingRequest = fetchVisualizationData()
      .then((data) => {
        cachedData = data
        return data
      })
      .finally(() => {
        pendingRequest = null
      })

    return pendingRequest
  }

  return { loadVisualizationData }
}
