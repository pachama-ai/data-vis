/**
 * Berechnet Abweichungen zwischen Stromerzeugung
 * und direkten CO₂-Emissionen.
 *
 * Verglichen werden der Anteil eines Energieträgers
 * an der Stromerzeugung und sein Anteil an den gesamten
 * direkten CO₂-Emissionen.
 *
 * Positive Werte bedeuten einen größeren Emissionsanteil.
 * Negative Werte bedeuten einen kleineren Emissionsanteil.
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
  MixSourceKey,
} from '~/types/emissions'

/**
 * Enthält die Angaben zur größten absoluten Abweichung.
 */
export interface LargestMismatch {
  /** Energieträger mit der größten Abweichung */
  sourceKey: MixSourceKey

  /** Abweichung in Prozentpunkten */
  deviationPp: number

  /** Richtung der Abweichung */
  direction: 'over' | 'under'

  /** Anteil an der Stromerzeugung */
  generationShare: number

  /** Anteil an den direkten CO₂-Emissionen */
  emissionShare: number
}

/** Festgelegtes Vergleichsjahr des Diagramms. */
export const BASE_YEAR = 2015

/**
 * Berechnet den gesamten Erzeugungsanteil
 * der erneuerbaren Energieträger.
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
 * Sucht den Energieträger mit der größten
 * positiven Abweichung.
 *
 * Negative Abweichungen werden dabei nicht berücksichtigt.
 *
 * @param rows Berechnete Daten der Energieträger
 * @returns Zeile mit der größten positiven Abweichung oder null
 */
export function findLargestPositiveDeviation(
  rows: EmissionRow[],
): EmissionRow | null {
  let largestRow: EmissionRow | null = null
  let largestValue = 0

  for (const row of rows) {
    if (row.deviationPp > largestValue) {
      largestValue = row.deviationPp
      largestRow = row
    }
  }

  return largestRow
}

/**
 * Berechnet den Erzeugungsanteil eines Energieträgers.
 *
 * Dafür wird zuerst die gesamte Erzeugung des Jahres
 * aus allen Energieträgern zusammengezählt.
 *
 * @param yearRow Erzeugungsdaten eines Jahres
 * @param sourceKey Gesuchter Energieträger
 * @returns Anteil an der Gesamterzeugung von 0 bis 1
 */
export function calculateShare(
  yearRow: MixYearRow | null,
  sourceKey: MixSourceKey,
): number {
  if (yearRow === null) {
    return 0
  }

  let totalGenerationTwh = 0

  for (const key of STACK_ORDER) {
    totalGenerationTwh += yearRow.values[key]
  }

  if (totalGenerationTwh === 0) {
    return 0
  }

  const sourceGenerationTwh =
    yearRow.values[sourceKey]

  return sourceGenerationTwh / totalGenerationTwh
}

/**
 * Sucht den Energieträger mit der größten absoluten Abweichung.
 *
 * @param deviationYear Berechnete Daten eines Jahres
 * @returns Angaben zur größten Abweichung oder null
 */
export function findLargestMismatch(
  deviationYear: DeviationYear | null,
): LargestMismatch | null {
  if (deviationYear === null) {
    return null
  }

  if (deviationYear.rows.length === 0) {
    return null
  }

  let largestRow = deviationYear.rows[0]!

  for (const row of deviationYear.rows) {
    const currentValue =
      Math.abs(row.deviationPp)

    const largestValue =
      Math.abs(largestRow.deviationPp)

    if (currentValue > largestValue) {
      largestRow = row
    }
  }

  let direction: 'over' | 'under' = 'under'

  if (largestRow.deviationPp > 0) {
    direction = 'over'
  }

  return {
    sourceKey: largestRow.sourceKey,
    deviationPp: largestRow.deviationPp,
    direction,
    generationShare: largestRow.generationShare,
    emissionShare: largestRow.emissionShare,
  }
}

/**
 * Berechnet die Abweichungsdaten für mehrere Jahre.
 *
 * Jahre ohne gültiges Ergebnis werden nicht in die
 * fertige Liste übernommen.
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