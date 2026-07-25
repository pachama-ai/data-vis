/**
 * Bereitet die Jahresdaten für das Balkendiagramm
 * auf der Startseite vor.
 *
 * Die Berechnung liegt in einer eigenen Datei,
 * damit sie auch ohne die Vue-Komponente getestet werden kann.
 *
 * @author Selina Schneider
 */

import type { YearlyMixPoint } from '~/types/visualization-data'
import type {
  EnergyDataPoint,
  EnergyCategory,
} from '~/components/home/groupedBarUtils'

import { roundToOneDecimal } from '~/components/home/groupedBarUtils'

/**
 * Energieträger, die im Balkendiagramm vorkommen.
 *
 * Die Bezeichnungen entsprechen den Schlüsseln
 * aus den geladenen Jahresdaten.
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

/**
 * Enthält die Angaben, die für einen Energieträger
 * im Diagramm benötigt werden.
 */
export interface ItemConfigEntry {
  /** Schlüssel in den geladenen Jahresdaten */
  key: SourceKey

  /** Eindeutige ID für das Diagramm */
  id: string

  /** Name, der im Diagramm angezeigt wird */
  label: string

  /** Gruppe für die farbliche Zuordnung */
  category: EnergyCategory
}

/**
 * Legt die Reihenfolge und Beschriftung
 * der Energieträger im Diagramm fest.
 *
 * Die Einträge sind nach erneuerbaren Energien,
 * fossilen Energieträgern und Kernenergie sortiert.
 */
export const ITEM_CONFIG: ItemConfigEntry[] = [
  // Erneuerbare Energien
  {
    key: 'wind_onshore',
    id: 'wind_land',
    label: 'Windenergie an Land',
    category: 'erneuerbar',
  },
  {
    key: 'pv',
    id: 'photovoltaik',
    label: 'Photovoltaik',
    category: 'erneuerbar',
  },
  {
    key: 'biomass',
    id: 'biomasse',
    label: 'Biomasse',
    category: 'erneuerbar',
  },
  {
    key: 'wind_offshore',
    id: 'wind_see',
    label: 'Windenergie auf See',
    category: 'erneuerbar',
  },
  {
    key: 'hydro',
    id: 'wasserkraft',
    label: 'Wasserkraft',
    category: 'erneuerbar',
  },

  // Fossile Energieträger
  {
    key: 'lignite',
    id: 'braunkohle',
    label: 'Braunkohle',
    category: 'fossil',
  },
  {
    key: 'hardcoal',
    id: 'steinkohle',
    label: 'Steinkohle',
    category: 'fossil',
  },
  {
    key: 'gas',
    id: 'erdgas',
    label: 'Erdgas',
    category: 'fossil',
  },
  {
    key: 'other_fossil',
    id: 'sonstige_konv',
    label: 'Sonstige konventionelle Energieträger',
    category: 'fossil',
  },

  // Kernenergie
  {
    key: 'nuclear',
    id: 'kernenergie',
    label: 'Kernenergie',
    category: 'kernkraft',
  },
]

/**
 * Berechnet den prozentualen Anteil eines Energieträgers
 * an der gesamten Stromerzeugung.
 *
 * Bei dieser Funktion habe ich KI genutzt, um zu prüfen,
 * was bei einer Gesamterzeugung von 0 passiert. Ohne die Abfrage
 * würde durch 0 geteilt und das Ergebnis wäre ungültig.
 *
 * @param sourceValueMwh Erzeugung des Energieträgers in MWh
 * @param totalMwh Gesamte Stromerzeugung in MWh
 * @returns Anteil des Energieträgers in Prozent
 */
export function calculateSharePercent(
  sourceValueMwh: number,
  totalMwh: number,
): number {
  if (totalMwh <= 0) {
    return 0
  }

  return (sourceValueMwh / totalMwh) * 100
}

/**
 * Wandelt die Jahresdaten von 2015 und 2024
 * in die Daten für das Balkendiagramm um.
 *
 * Für jeden Energieträger wird der Anteil an der
 * gesamten Stromerzeugung berechnet.
 *
 * Hier habe ich KI an zwei Stellen gebraucht. Zuerst hatte ich
 * Probleme mit dem Zugriff über configItem.key, weil TypeScript
 * den Schlüssel nicht sicher zuordnen konnte. Die Lösung war der
 * Typ SourceKey, damit nur vorhandene Energieträger verwendet werden.
 *
 * Außerdem war ich unsicher, ob die Differenz aus den genauen oder
 * aus den gerundeten Werten berechnet werden soll. Ich habe mich für
 * die gerundeten Werte entschieden, damit die sichtbare Differenz
 * auch wirklich zu den angezeigten Zahlen passt.
 *
 * @param year2015 Strommix des Jahres 2015
 * @param year2024 Strommix des Jahres 2024
 * @returns Aufbereitete Daten für das Balkendiagramm
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
      displayedDelta: roundToOneDecimal(
        displayed2024 - displayed2015,
      ),
    })
  }

  return result
}
