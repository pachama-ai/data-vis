/**
 * pages/index.transform.ts – Datentransformation für die Landing Page
 * ====================================================================
 *
 * Enthält die Logik, um aus YearlyMixPoint-Daten (aus der JSON-Datei)
 * das EnergyDataPoint[]-Array für das GroupedBarChart zu berechnen.
 * In eine separate Datei ausgelagert, damit sie ohne Vue-Mount testbar ist.
 */

import type { YearlyMixPoint } from '~/types/visualization-data'
import type { EnergyDataPoint, EnergyCategory } from '~/components/intro/GroupedBarChart.utils'
import { roundToOneDecimal } from '~/components/intro/GroupedBarChart.utils'

// =========================================================================
// Typdefinitionen
// =========================================================================

/**
 * Die Schlüssel der EnergySourceValues, die für den GroupedBar-Chart
 * relevant sind. Jeder Schlüssel kommt genau einmal in ITEM_CONFIG vor.
 */
export type SourceKey =
  | 'wind_onshore'
  | 'pv'
  | 'biomass'
  | 'wind_offshore'
  | 'hydro'
  | 'lignite'
  | 'hardcoal'
  | 'gas'
  | 'other_fossil'
  | 'nuclear'

// =========================================================================
// Konfiguration: Sortierung und Metadaten der Energieträger
// =========================================================================

/**
 * Sortierung nach Kategorie unterstützt Preattentive Processing
 * (Skript Kap. 3.4): Erneuerbare wachsen als Block,
 * Fossile schrumpfen als Block, Kernkraft verschwindet.
 * Alle Energieträger stammen aus SMARD (öffentliche Netzeinspeisung).
 */
export interface ItemConfigEntry {
  /** Schlüssel im EnergySourceValues-Objekt */
  key: SourceKey
  /** Eindeutiger Bezeichner, wird zur id im EnergyDataPoint */
  id: string
  /** Anzeigename */
  label: string
  /** Kategorie für Farbcodierung */
  category: EnergyCategory
}

export const ITEM_CONFIG: ItemConfigEntry[] = [
  // Block 1 — Erneuerbar
  { key: 'wind_onshore',  id: 'wind_land',      label: 'Windenergie an Land',         category: 'erneuerbar' },
  { key: 'pv',            id: 'photovoltaik',   label: 'Photovoltaik',               category: 'erneuerbar' },
  { key: 'biomass',       id: 'biomasse',       label: 'Biomasse',                   category: 'erneuerbar' },
  { key: 'wind_offshore', id: 'wind_see',       label: 'Windenergie auf See',         category: 'erneuerbar' },
  { key: 'hydro',         id: 'wasserkraft',    label: 'Wasserkraft',                category: 'erneuerbar' },
  // Block 2 — Fossil
  { key: 'lignite',       id: 'braunkohle',     label: 'Braunkohle',                 category: 'fossil' },
  { key: 'hardcoal',      id: 'steinkohle',     label: 'Steinkohle',                 category: 'fossil' },
  { key: 'gas',           id: 'erdgas',         label: 'Erdgas',                     category: 'fossil' },
  { key: 'other_fossil',  id: 'sonstige_konv',  label: 'Sonstige konventionelle Energieträger', category: 'fossil' },
  // Block 3 — Kernkraft
  { key: 'nuclear',       id: 'kernenergie',    label: 'Kernenergie',                category: 'kernkraft' },
]

// =========================================================================
// Transformationsfunktionen
// =========================================================================

/**
 * Berechnet den prozentualen Anteil einer Quelle an der Gesamterzeugung.
 * Wenn die Gesamterzeugung 0 oder negativ ist, wird 0 zurückgegeben,
 * um Division durch Null zu vermeiden.
 */
export function calculateSharePercent(sourceValueMwh: number, totalMwh: number): number {
  if (totalMwh <= 0) {
    return 0
  }
  return (sourceValueMwh / totalMwh) * 100
}

// =========================================================================
// Haupttransformation
// =========================================================================

/**
 * Transformiert zwei YearlyMixPoint-Objekte (2015 und 2024) in ein
 * EnergyDataPoint[]-Array, wie es das GroupedBarChart erwartet.
 * Die Berechnung pro Eintrag:
 *   1. Prozentualen Anteil für 2015 und 2024 berechnen
 *   2. Beide Werte auf eine Nachkommastelle runden
 *   3. displayedDelta = gerundet(displayed2024 - displayed2015)
 *
 * Grund für Schritt 3: Der Leser soll keine Rundungs-Inkonsistenz sehen.
 *   Angezeigter Wert 2024 minus angezeigter Wert 2015 = angezeigtes Delta.
 */
export function transformYearlyDataToChartData(
  year2015: YearlyMixPoint,
  year2024: YearlyMixPoint,
): EnergyDataPoint[] {
  const totalGeneration2015 = year2015.totalGenerationMwh
  const totalGeneration2024 = year2024.totalGenerationMwh
  const result: EnergyDataPoint[] = []

  for (const configItem of ITEM_CONFIG) {
    const exact2015 = calculateSharePercent(
      year2015.sources[configItem.key],
      totalGeneration2015,
    )
    const exact2024 = calculateSharePercent(
      year2024.sources[configItem.key],
      totalGeneration2024,
    )
    const displayed2015 = roundToOneDecimal(exact2015)
    const displayed2024 = roundToOneDecimal(exact2024)

    result.push({
      id: configItem.id,
      label: configItem.label,
      category: configItem.category,
      value2015: exact2015,
      value2024: exact2024,
      displayedDelta: roundToOneDecimal(displayed2024 - displayed2015),
    })
  }

  return result
}
