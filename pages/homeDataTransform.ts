/**
 * Bereitet die Jahresdaten für das Balkendiagramm auf der Startseite auf.
 *
 * Das Diagramm vergleicht die Anteile jedes Energieträgers zwischen
 * 2015 und 2024.
 *
 * @author Selina Schneider
 */

import type { YearlyMixPoint } from '~/types/visualization-data'
import type {
  EnergyDataPoint,
  EnergyCategory,
} from '~/components/home/groupedBarUtils'
import type { MixSourceKey } from '~/types/energy-mix'

import { roundToOneDecimal } from '~/components/home/groupedBarUtils'


/**
 * Enthält die Angaben, die für einen Energieträger im Diagramm
 * benötigt werden.
 */
interface ItemConfigEntry {
  /** Schlüssel in den geladenen Jahresdaten */
  key: MixSourceKey

  /** Eindeutige ID für das Diagramm */
  id: string

  /** Name, der im Diagramm angezeigt wird */
  label: string

  /** Gruppe für die farbliche Zuordnung */
  category: EnergyCategory
}

/**
 * Legt die Reihenfolge und Beschriftung der Energieträger im Diagramm
 * fest. Die Sortierung (Erneuerbare → Fossile → Kernenergie) taucht so
 * auch im Diagramm wieder auf, deshalb ist sie fest verdrahtet.
 */
const ITEM_CONFIG: ItemConfigEntry[] = [
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
 * Berechnet den prozentualen Anteil eines Energieträgers an der
 * gesamten Stromerzeugung. Bei einer Gesamterzeugung von 0 gebe ich 0
 * zurück, damit das Diagramm nicht mit NaN weiterrechnet.
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
 * Wandelt die Jahresdaten von 2015 und 2024 in die Daten für das
 * Balkendiagramm um. Für jeden Energieträger wird der Anteil an der
 * gesamten Stromerzeugung berechnet.
 *
 * Bei `displayedDelta` benutz ich die gerundeten Werte
 * statt der exakten Differenz, weil sich die sichtbare Differenz
 * sonst nicht mit dem deckt, was im Diagramm zu lesen ist. Die
 * ungerundeten Werte bleiben trotzdem in `value2015`/`value2024`
 * erhalten, damit die Balken korrekt bleiben.
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

    // Für das Delta die gerundeten Werte verwenden, damit die
    // Differenz den angezeigten Zahlen zusammenpasst.
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