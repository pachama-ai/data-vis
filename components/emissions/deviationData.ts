/**
 * Berechnet Abweichungen zwischen Stromerzeugung und direkten
 * CO₂-Emissionen je Energieträger.
 *
 * Verglichen werden der Anteil eines Energieträgers an der
 * Stromerzeugung und sein Anteil an den gesamten direkten
 * CO₂-Emissionen. Die Differenz sagt, ob ein Energieträger
 * überproportional oder unterproportional zu den Emissionen
 * beiträgt:
 *
 * - Positive Werte: größerer Emissionsanteil als Erzeugungsanteil
 *   – der Träger ist klimaschädlicher als der Durchschnitt.
 * - Negative Werte: kleinerer Emissionsanteil als Erzeugungsanteil
 *   – der Träger ist klimafreundlicher als der Durchschnitt.
 *
 * @author Selina Schneider
 */

import {
  GROUP_OF,
} from '~/components/generation/mixConfig'

import {
  calculateDeviationYear,
  DEFAULT_EMISSION_FACTORS,
} from '~/components/emissions/emissionsData'

import type { MixYearRow } from '~/composables/useMixData'
import type {
  DeviationYear,
  EmissionFactorValues,
} from '~/types/emissions'


/** Basisjahr, gegen das alle anderen Jahre verglichen werden. */
export const BASE_YEAR = 2015

/**
 * Berechnet den gesamten Erzeugungsanteil aller erneuerbaren
 * Energieträger in einem Jahr.
 *
 * @param deviationYear Berechnete Jahresdaten mit allen Energieträgern
 * @returns Anteil der erneuerbaren Energien in Prozent
 */
export function calculateRenewableShare(
  deviationYear: DeviationYear,
): number {
  let renewableShare = 0

  for (const row of deviationYear.rows) {
    const group = GROUP_OF[row.sourceKey]

    if (group === 'renewable') {
      renewableShare += row.generationShare
    }
  }

  // generationShare liegt als Dezimalzahl (0–1) vor, daher mal 100
  // für die Anzeige in Prozent.
  return renewableShare * 100
}

/**
 * Berechnet die Abweichungsdaten für eine Liste von Jahren.
 * Jahre, die sich nicht auswerten lassen, werden übersprungen.
 *
 * @param yearRows Rohe Erzeugungsdaten aller verfügbaren Jahre
 * @param emissionFactors Emissionsfaktoren je Energieträger
 * @returns Liste der erfolgreich berechneten Jahresdaten
 */
export function calculateMultipleYears(
  yearRows: MixYearRow[],
  emissionFactors: EmissionFactorValues = DEFAULT_EMISSION_FACTORS,
): DeviationYear[] {
  const results: DeviationYear[] = []

  for (const yearRow of yearRows) {
    const deviationYear = calculateDeviationYear(
      yearRow,
      emissionFactors,
    )

    // null bedeutet, dass das Jahr nicht auswertbar war.
    if (deviationYear !== null) {
      results.push(deviationYear)
    }
  }

  return results
}