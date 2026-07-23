/**
 * tests/unit/useMixData.test.ts
 *
 * Testet die reinen Berechnungsfunktionen aus useMixData:
 * - normalizeMonth (Monatsnormalisierung)
 * - calculateYearRows (Jahressummen)
 *
 * Der Nuxt-Fetch wird nicht getestet – das wäre ein Integrationstest,
 * der für Phase 2 nicht vorgesehen ist.
 */

import { describe, it, expect } from 'vitest'
import { normalizeMonth, calculateYearRows } from '~/composables/useMixData'
import type { MixMonthRow, MixSourceKey } from '~/types/mix'
import type { MonthlyMixPoint } from '~/types/visualization-data'
import { STACK_ORDER } from '~/components/generation/mixConfig'

// =========================================================================
// Hilfsfunktion: erzeugt einen minimalen Rohdatenpunkt
// =========================================================================

function createRawMonth(
  month: string,
  overrides: Partial<Record<MixSourceKey, number>> = {},
): MonthlyMixPoint {
  const sources = {
    biomass: 0,
    hydro: 0,
    wind_onshore: 0,
    wind_offshore: 0,
    pv: 0,
    other_renewables: 0,
    lignite: 0,
    hardcoal: 0,
    gas: 0,
    nuclear: 0,
    other_fossil: 0,
    pumped_storage: 0,
  }

  for (const key of STACK_ORDER) {
    if (overrides[key] !== undefined) {
      sources[key] = overrides[key]!
    }
  }

  return {
    month,
    sources,
    totalGenerationMwh: 0,
    availableHourCount: 720,
  }
}

// =========================================================================
// 1. Monatsnormalisierung
// =========================================================================

describe('normalizeMonth', () => {
  it('wandelt einen Rohdatenpunkt in eine MixMonthRow um', () => {
    const rawMonth = createRawMonth('2024-06', {
      hydro: 2_000_000,
      biomass: 3_000_000,
      wind_offshore: 1_500_000,
      wind_onshore: 5_000_000,
      pv: 4_000_000,
      nuclear: 2_500_000,
      gas: 3_500_000,
      other_fossil: 1_000_000,
      hardcoal: 4_500_000,
      lignite: 6_000_000,
    })

    const result = normalizeMonth(rawMonth)

    // Datum prüfen
    expect(result.month).toBe('2024-06')
    expect(result.date.getFullYear()).toBe(2024)
    expect(result.date.getMonth()).toBe(5) // Juni = 5 (0-basiert)
    expect(result.date.getDate()).toBe(1)
  })

  it('rechnet MWh korrekt in TWh um (2.000.000 MWh = 2 TWh)', () => {
    const rawMonth = createRawMonth('2024-01', {
      wind_onshore: 2_000_000,
    })

    const result = normalizeMonth(rawMonth)

    expect(result.values.wind_onshore).toBeCloseTo(2.0, 5)
  })

  it('enthält genau die zehn Quellen aus STACK_ORDER', () => {
    const rawMonth = createRawMonth('2024-01')

    const result = normalizeMonth(rawMonth)

    const resultKeys = Object.keys(result.values)

    // Alle zehn erwarteten Keys sind vorhanden
    for (const expectedKey of STACK_ORDER) {
      expect(resultKeys).toContain(expectedKey)
    }

    // Es sind genau zehn Keys
    expect(resultKeys.length).toBe(10)
  })

  it('enthält other_renewables und pumped_storage nicht', () => {
    const rawMonth = createRawMonth('2024-01')

    const result = normalizeMonth(rawMonth)

    const resultKeys = Object.keys(result.values)

    expect(resultKeys).not.toContain('other_renewables')
    expect(resultKeys).not.toContain('pumped_storage')
  })
})

// =========================================================================
// 2. Jahressummen
// =========================================================================

describe('calculateYearRows', () => {
  it('addiert zwei Monate desselben Jahres korrekt', () => {
    const monthRows: MixMonthRow[] = [
      {
        month: '2024-01',
        date: new Date(2024, 0, 1),
        values: {
          hydro: 1.0,
          biomass: 2.0,
          wind_offshore: 0.5,
          wind_onshore: 3.0,
          pv: 1.5,
          nuclear: 2.0,
          gas: 3.0,
          other_fossil: 1.0,
          hardcoal: 4.0,
          lignite: 5.0,
        },
        totalGenerationTwh: 10,
      },
      {
        month: '2024-02',
        date: new Date(2024, 1, 1),
        values: {
          hydro: 1.0,
          biomass: 2.0,
          wind_offshore: 0.5,
          wind_onshore: 3.0,
          pv: 2.0,
          nuclear: 2.0,
          gas: 2.5,
          other_fossil: 1.0,
          hardcoal: 3.5,
          lignite: 5.0,
        },
        totalGenerationTwh: 10,
      },
    ]

    const result = calculateYearRows(monthRows)

    expect(result.length).toBe(1)
    expect(result[0]!.year).toBe(2024)
    expect(result[0]!.values.hydro).toBeCloseTo(2.0, 5)
    expect(result[0]!.values.pv).toBeCloseTo(3.5, 5)
    expect(result[0]!.values.gas).toBeCloseTo(5.5, 5)
  })

  it('erzeugt zwei Jahreszeilen für zwei Jahre', () => {
    const monthRows: MixMonthRow[] = [
      {
        month: '2023-06',
        date: new Date(2023, 5, 1),
        values: {
          hydro: 1.0,
          biomass: 1.0,
          wind_offshore: 1.0,
          wind_onshore: 1.0,
          pv: 1.0,
          nuclear: 1.0,
          gas: 1.0,
          other_fossil: 1.0,
          hardcoal: 1.0,
          lignite: 1.0,
        },
        totalGenerationTwh: 10,
      },
      {
        month: '2024-06',
        date: new Date(2024, 5, 1),
        values: {
          hydro: 2.0,
          biomass: 2.0,
          wind_offshore: 2.0,
          wind_onshore: 2.0,
          pv: 2.0,
          nuclear: 2.0,
          gas: 2.0,
          other_fossil: 2.0,
          hardcoal: 2.0,
          lignite: 2.0,
        },
        totalGenerationTwh: 10,
      },
    ]

    const result = calculateYearRows(monthRows)

    expect(result.length).toBe(2)
    expect(result[0]!.year).toBe(2023)
    expect(result[1]!.year).toBe(2024)
    expect(result[0]!.values.wind_onshore).toBeCloseTo(1.0, 5)
    expect(result[1]!.values.wind_onshore).toBeCloseTo(2.0, 5)
  })

  it('sortiert Jahre aufsteigend bei unsortierter Eingabe', () => {
    const monthRows: MixMonthRow[] = [
      {
        month: '2024-01',
        date: new Date(2024, 0, 1),
        values: {
          hydro: 0,
          biomass: 0,
          wind_offshore: 0,
          wind_onshore: 0,
          pv: 0,
          nuclear: 0,
          gas: 0,
          other_fossil: 0,
          hardcoal: 0,
          lignite: 0,
        },
        totalGenerationTwh: 10,
      },
      {
        month: '2022-01',
        date: new Date(2022, 0, 1),
        values: {
          hydro: 0,
          biomass: 0,
          wind_offshore: 0,
          wind_onshore: 0,
          pv: 0,
          nuclear: 0,
          gas: 0,
          other_fossil: 0,
          hardcoal: 0,
          lignite: 0,
        },
        totalGenerationTwh: 10,
      },
    ]

    const result = calculateYearRows(monthRows)

    expect(result[0]!.year).toBe(2022)
    expect(result[1]!.year).toBe(2024)
  })

  it('gibt leeres Array bei leerer Eingabe zurück', () => {
    const result = calculateYearRows([])

    expect(result).toEqual([])
  })
})
