/**
 * Lädt die Visualisierungsdaten aus einer JSON-Datei.
 *
 * Einmal geladen, wird das Ergebnis im Cache gehalten und bei
 * weiteren Aufrufen direkt zurückgegeben.
 *
 * @author Selina Schneider
 */

import type { VisualizationData } from '~/types/visualization-data'

/** Bereits erfolgreich geladene Daten */
let cachedData: VisualizationData | null = null

/**
 * Stellt die Ladefunktion für die Visualisierungsdaten bereit.
 */
export function useVisualizationData() {
  /**
   * Lädt die Daten oder gibt bereits vorhandene Daten zurück.
   *
   * Die Struktur der Datei ist bereits über scripts/check-data.ts
   * geprüft, deshalb reicht hier ein einfacher Cast.
   *
   * @returns Visualisierungsdaten
   * @throws Fehler beim Laden
   */
  async function loadVisualizationData(): Promise<VisualizationData> {
    if (cachedData) {
      return cachedData
    }

    const response = await fetch('/data/visualization-data.json')

    if (!response.ok) {
      throw new Error(
        `Visualisierungsdaten konnten nicht geladen werden: ${response.status}`,
      )
    }

    const raw: unknown = await response.json()
    const data = raw as VisualizationData
    cachedData = data

    return data
  }

  return {
    loadVisualizationData,
  }
}