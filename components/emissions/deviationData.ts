/**
 * Berechnen von Abweichungen zwischen Stromerzeugung
 * und direkten CO₂-Emissionen
 *
 * Verglichen werden der Anteil eines Energieträgers
 * an der Stromerzeugung und sein Anteil an den gesamten
 * direkten CO₂-Emissionen
 *
 * Positive Werte stehen für einen größeren Emissionsanteil
 * Negative Werte stehen für einen kleineren Emissionsanteil
 *
 * @author Selina Schneider
 */

import {
  GROUP_OF,
  STACK_ORDER,
} from '~/components/generation/mixConfig'

import {
  calculateDeviationYear,
  DEFAULT_EMISSION_FACTORS,
} from '~/components/emissions/emissionsData'

import type { MixYearRow } from '~/composables/useMixData'
import type {
  DeviationYear,
  EmissionFactorValues,
  EmissionRow,
} from '~/types/emissions'

/* Festlegen des Vergleichsjahres */
export const BASE_YEAR = 2015

/**
 * Berechnen des gesamten Erzeugungsanteils
 * der erneuerbaren Energieträger
 *
 * @param deviationYear Berechnete Daten eines Jahres
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

  return renewableShare * 100
}

/**
 * Berechnen der Abweichungsdaten für mehrere Jahre
 *
 * Jahre ohne gültiges Ergebnis werden übersprungen,
 * damit nur verwendbare Daten in der Liste landen
 *
 * @param yearRows Erzeugungsdaten aller Jahre
 * @param emissionFactors Emissionsfaktoren der Energieträger
 * @returns Berechnete Jahresdaten
 */
export function calculateMultipleYears(
  yearRows: MixYearRow[],
  emissionFactors: EmissionFactorValues =
    DEFAULT_EMISSION_FACTORS,
): DeviationYear[] {
  const results: DeviationYear[] = []

  for (const yearRow of yearRows) {
    const deviationYear = calculateDeviationYear(
      yearRow,
      emissionFactors,
    )

    if (deviationYear !== null) {
      results.push(deviationYear)
    }
  }

  return results
}
