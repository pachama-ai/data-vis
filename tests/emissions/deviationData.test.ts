/**
 * tests/unit/useDeviation.test.ts
 *
 * Testet die reinen Berechnungsfunktionen aus composables/useDeviation.ts.
 *
 * Aufruf: npx vitest run tests/unit/useDeviation.test.ts
 */

import { describe, it, expect } from 'vitest'

import {
  calculateShare,
  findLargestMismatch,
  calculateMultipleYears,
} from '~/components/emissions/deviationData'

import { calculateDeviationYear } from '~/components/emissions/emissionsData'

import type { MixSourceKey, EmissionRow } from '~/types/mix'
import type { MixYearRow } from '~/composables/useMixData'

// =========================================================================
// Hilfsfunktion für Testdaten
// =========================================================================

function createSourceValues(
  defaultValue: number,
): Record<MixSourceKey, number> {
  return {
    hydro: defaultValue,
    biomass: defaultValue,
    wind_offshore: defaultValue,
    wind_onshore: defaultValue,
    pv: defaultValue,
    nuclear: defaultValue,
    gas: defaultValue,
    other_fossil: defaultValue,
    hardcoal: defaultValue,
    lignite: defaultValue,
  }
}

function createTestYearRow(
  year: number = 2024,
  overrides: Partial<Record<MixSourceKey, number>> = {},
): MixYearRow {
  const values = createSourceValues(10)
  values.gas = 30
  values.hardcoal = 20
  values.lignite = 40
  values.other_fossil = 5
  values.hydro = 15
  values.biomass = 25
  values.wind_offshore = 20
  values.wind_onshore = 50
  values.pv = 35
  values.nuclear = 10

  for (const [key, value] of Object.entries(overrides)) {
    values[key as MixSourceKey] = value
  }

  return { year, values, totalTwh: 250 }
}

function createSimpleYearRow(
  year: number = 2024,
): MixYearRow {
  // Ein Jahr mit nur 3 relevanten Quellen
  const values = createSourceValues(0)
  values.pv = 50        // 50 % Erzeugung, 0 % Emissionen
  values.gas = 30        // 30 % Erzeugung, mittlere Emissionen
  values.lignite = 20    // 20 % Erzeugung, 100 % Emissionen (vereinfacht)

  return { year, values, totalTwh: 100 }
}

function getTestDeviationYear(year: number = 2024) {
  const yearRow = createSimpleYearRow(year)
  return calculateDeviationYear(yearRow)
}

// =========================================================================
// calculateShare
// =========================================================================

describe('calculateShare', () => {
  it('gibt 0 zurück bei null-Eingabe', () => {
    expect(calculateShare(null, 'pv')).toBe(0)
  })

  it('berechnet den Anteil korrekt', () => {
    const yearRow = createSimpleYearRow(2024)

    // pv = 50, gas = 30, lignite = 20 → total 100
    expect(calculateShare(yearRow, 'pv')).toBeCloseTo(0.5, 5)
    expect(calculateShare(yearRow, 'gas')).toBeCloseTo(0.3, 5)
    expect(calculateShare(yearRow, 'lignite')).toBeCloseTo(0.2, 5)
  })

  it('gibt 0 für Quellen ohne Erzeugung', () => {
    const yearRow = createSimpleYearRow(2024)

    expect(calculateShare(yearRow, 'nuclear')).toBe(0)
  })
})

// =========================================================================
// findLargestMismatch
// =========================================================================

describe('findLargestMismatch', () => {
  it('gibt null zurück bei null-Eingabe', () => {
    const result = findLargestMismatch(null)

    expect(result).toBeNull()
  })

  it('findet PV als größte Abweichung (50% Erzeugung, 0% Emissionen)', () => {
    const deviationYear = getTestDeviationYear(2024)
    const result = findLargestMismatch(deviationYear)

    expect(result).not.toBeNull()
    // PV: 50% Erzeugung, 0% Emissionen → deviationPp = -50 (abs 50)
    // Lignite: 20% Erzeugung, 63.6% Emissionen → deviationPp = +43.6 (abs 43.6)
    // Also the largest absolute deviation
    expect(result!.sourceKey).toBe('pv')
    expect(result!.direction).toBe('under')
    expect(result!.deviationPp).toBeLessThan(0)
  })

  it('findet PV als größte negative Abweichung', () => {
    const deviationYear = getTestDeviationYear(2024)

    // Alle negativen Abweichungen durchgehen und die größte absolut finden
    const result = findLargestMismatch(deviationYear)

    // PV: 50% Erzeugung, 0% Emissionen → deviationPp = -50
    // Lignite: 20% Erzeugung, 63.6% Emissionen → deviationPp = +43.6
    // Gas: 30% Erzeugung, 36.4% Emissionen → deviationPp = +6.4
    // So the largest absolute is pv with 50
    expect(result!.sourceKey).toBe('pv')
    expect(result!.direction).toBe('under')
  })
})

// =========================================================================
// calculateMultipleYears
// =========================================================================

describe('calculateMultipleYears', () => {
  it('gibt leeres Array bei leerem Input', () => {
    const result = calculateMultipleYears([])

    expect(result).toEqual([])
  })

  it('berechnet mehrere Jahre korrekt', () => {
    const yearRows = [
      createSimpleYearRow(2023),
      createSimpleYearRow(2024),
    ]

    const results = calculateMultipleYears(yearRows)

    expect(results).toHaveLength(2)
    expect(results[0]!.year).toBe(2023)
    expect(results[1]!.year).toBe(2024)
    expect(results[0]!.rows).toHaveLength(10)
    expect(results[1]!.rows).toHaveLength(10)
  })
})
