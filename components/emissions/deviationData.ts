/**
 * composables/useDeviation.ts – Reine Berechnungsfunktionen für die
 * Abweichungsanalyse (Strombeitrag vs. Emissionsanteil).
 *
 * Enthält kein Vue, kein Fetch, keinen State.
 * Alle Funktionen sind rein und geben null zurück, wenn nicht genügend
 * Daten vorliegen.
 *
 * Kernidee:
 *  Jeder Energieträger hat einen Anteil an der Gesamterzeugung (Strombeitrag)
 *  und einen Anteil an den gesamten CO₂-Emissionen (Emissionsanteil).
 *  Die Abweichung (Deviation) in Prozentpunkten zeigt, ob ein Energieträger
 *  überproportional (positiv) oder unterproportional (negativ) zu den
 *  Emissionen beiträgt.
 *
 *  deviation_pp = emissionShare - generationShare
 *
 *  Ein positiver Wert bedeutet: Der Anteil an den Emissionen ist höher als
 *  der Anteil an der Erzeugung (z. B. Braunkohle: 20 % Erzeugung, 80 %
 *  Emissionen → +60 pp).
 *  Ein negativer Wert bedeutet: Der Anteil an den Emissionen ist niedriger
 *  (z. B. Erneuerbare: 50 % Erzeugung, 0 % Emissionen → –50 pp).
 */

import { GROUP_OF, STACK_ORDER } from '~/components/generation/mixConfig'

import type { EmissionRow, DeviationYear, MixGroup, MixSourceKey } from '~/types/mix'
import type { MixYearRow } from '~/composables/useMixData'

import {
  calculateDeviationYear,
  DEFAULT_EMISSION_FACTORS,
} from '~/components/emissions/emissionsData'

// =========================================================================
// Typen (nur hier, da Phase A noch keine separaten Typ-Dateien anlegt)
// =========================================================================

/** Ergebnis der größten Abweichung (positiv = höherer Emissionsanteil). */
export interface LargestMismatch {
  sourceKey: MixSourceKey
  deviationPp: number
  direction: 'over' | 'under'
  generationShare: number
  emissionShare: number
}

/** Fachliches Basisjahr für den Vergleich. */
export const BASE_YEAR = 2015

// =========================================================================
// Hilfsfunktionen
// =========================================================================

/**
 * Berechnet deviationPp aus zwei Anteilen.
 *
 * @param emissionShare – Anteil an den Emissionen (0–1)
 * @param generationShare – Anteil an der Erzeugung (0–1)
 * @returns Abweichung in Prozentpunkten
 */
export function calculateDeviationPp(
  emissionShare: number,
  generationShare: number,
): number {
  return (emissionShare - generationShare) * 100
}

/**
 * Berechnet den kumulierten Erzeugungsanteil aller erneuerbaren Quellen.
 *
 * @param deviationYear – Das Jahr mit Emissionszeilen
 * @returns Anteil der Erneuerbaren an der Gesamterzeugung (0–100)
 */
export function calculateRenewableShare(
  deviationYear: DeviationYear,
): number {
  let renewableShare = 0

  for (const row of deviationYear.rows) {
    if (GROUP_OF[row.sourceKey] === 'renewable') {
      renewableShare += row.generationShare
    }
  }

  return renewableShare * 100
}

/**
 * Findet den Energieträger mit der größten positiven Abweichung.
 * Nur Werte mit deviationPp > 0 werden berücksichtigt.
 *
 * @param rows – Liste der Emissionszeilen
 * @returns Die Zeile mit der größten positiven Abweichung oder null
 */
export function findLargestPositiveDeviation(
  rows: EmissionRow[],
): EmissionRow | null {
  let largest: EmissionRow | null = null
  let largestValue = -Infinity

  for (const row of rows) {
    if (row.deviationPp > 0 && row.deviationPp > largestValue) {
      largestValue = row.deviationPp
      largest = row
    }
  }

  return largest
}

// =========================================================================
// Hauptfunktionen
// =========================================================================

/**
 * Berechnet den prozentualen Erzeugungsanteil eines Energieträgers.
 *
 * @param yearRow – Erzeugungsdaten des Jahres
 * @param sourceKey – Der Energieträger
 * @returns Anteil als Zahl zwischen 0 und 1 (oder 0 bei fehlender Erzeugung)
 */
export function calculateShare(
  yearRow: MixYearRow | null,
  sourceKey: MixSourceKey,
): number {
  if (!yearRow) {
    return 0
  }

  let totalGenerationTwh = 0

  for (const key of STACK_ORDER) {
    totalGenerationTwh += yearRow.values[key]
  }

  if (totalGenerationTwh === 0) {
    return 0
  }

  return yearRow.values[sourceKey] / totalGenerationTwh
}

/**
 * Findet den Energieträger mit der größten Abweichung (nach Absolutwert).
 *
 * @param deviationYear – Das berechnete Jahr
 * @returns Der Energieträger mit der größten Abweichung oder null
 */
export function findLargestMismatch(
  deviationYear: DeviationYear | null,
): LargestMismatch | null {
  if (!deviationYear || deviationYear.rows.length === 0) {
    return null
  }

  let largest: EmissionRow | null = null
  let largestAbs = -1

  for (const row of deviationYear.rows) {
    const absDeviation = Math.abs(row.deviationPp)

    if (absDeviation > largestAbs) {
      largestAbs = absDeviation
      largest = row
    }
  }

  if (!largest) {
    return null
  }

  return {
    sourceKey: largest.sourceKey,
    deviationPp: largest.deviationPp,
    direction: largest.deviationPp > 0 ? 'over' : 'under',
    generationShare: largest.generationShare,
    emissionShare: largest.emissionShare,
  }
}

/**
 * Berechnet für mehrere Jahre die Abweichungsanalyse.
 *
 * @param yearRows – Liste der Jahres-Erzeugungsdaten
 * @param emissionFactors – Emissionsfaktoren
 * @returns Liste der DeviationYear-Objekte (nur Jahre mit gültigen Daten)
 */
export function calculateMultipleYears(
  yearRows: MixYearRow[],
  emissionFactors: Record<MixSourceKey, number> = DEFAULT_EMISSION_FACTORS,
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
