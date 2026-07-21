/**
 * tests/unit/useMixMetrics.test.ts
 *
 * Testet die reinen Berechnungsfunktionen aus useMixMetrics.
 * Jeder Test prüft ein klares Verhalten mit kleinen, nachvollziehbaren Daten.
 */

import { describe, it, expect } from 'vitest'

import {
  getOverviewMetrics,
  getSourceMetrics,
  getAnnotationContext,
} from '~/composables/useMixMetrics'

import type { MixSourceKey, MixMonthRow, MixAnnotation } from '~/types/mix'
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

// =========================================================================
// Testdaten
// =========================================================================

function createTestYearRows(): MixYearRow[] {
  // Einfache Werte: 2015 alle 10 Quellen = 10 TWh → total 100 TWh
  // 2024: pv auf 40, hardcoal auf 1, rest auf 10 → total 10+10+10+10+40+10+10+10+1+10 = 121
  const year2015Values = createSourceValues(10)
  const year2024Values = createSourceValues(10)

  // pv steigt stark
  year2024Values.pv = 40
  // hardcoal sinkt
  year2024Values.hardcoal = 1

  return [
    { year: 2015, values: year2015Values },
    { year: 2024, values: year2024Values },
  ]
}

function createTestMonthRows(): MixMonthRow[] {
  return [
    {
      month: '2024-01',
      date: new Date(2024, 0, 1),
      values: { ...createSourceValues(1), pv: 1 },
    },
    {
      month: '2024-06',
      date: new Date(2024, 5, 1),
      values: { ...createSourceValues(5), pv: 5 },
    },
    {
      month: '2024-03',
      date: new Date(2024, 2, 1),
      values: { ...createSourceValues(3), pv: 3 },
    },
  ]
}

// =========================================================================
// getOverviewMetrics
// =========================================================================

describe('getOverviewMetrics', () => {
  it('gibt null zurück, wenn 2024 fehlt', () => {
    const yearRows: MixYearRow[] = [
      { year: 2015, values: createSourceValues(10) },
    ]

    const result = getOverviewMetrics(yearRows)

    expect(result).toBeNull()
  })

  it('berechnet den Anteil für erneuerbare Energien', () => {
    const yearRows = createTestYearRows()

    // 2015: 5 erneuerbare Quellen (hydro, biomass, wind_offshore, wind_onshore, pv) × 10 = 50
    // total 100 → share 0.5
    // 2024: 5 erneuerbare Quellen (hydro=10, biomass=10, wind_offshore=10, wind_onshore=10, pv=40) = 80
    // total 121 → share 80/121 ≈ 0.6612
    const result = getOverviewMetrics(yearRows)

    expect(result).not.toBeNull()

    const renewableGroup = result!.groups.find((group) => {
      return group.group === 'renewable'
    })

    expect(renewableGroup).not.toBeUndefined()
    expect(renewableGroup!.share2015).toBe(0.5)
    expect(renewableGroup!.share2024).toBeCloseTo(80 / 121, 4)
  })

  it('berechnet die Prozentpunktänderung korrekt', () => {
    const yearRows = createTestYearRows()

    const result = getOverviewMetrics(yearRows)

    expect(result).not.toBeNull()

    const renewableGroup = result!.groups.find((group) => {
      return group.group === 'renewable'
    })

    // share2024 ≈ 0.6612, share2015 = 0.5
    // percentagePointChange = (0.6612 - 0.5) * 100 ≈ 16.12
    expect(renewableGroup!.percentagePointChange).toBeCloseTo(
      ((80 / 121) - 0.5) * 100,
      2,
    )
  })

  it('erkennt Photovoltaik als größten Zuwachs', () => {
    const yearRows = createTestYearRows()

    // pv: 40 - 10 = +30 TWh
    // hardcoal: 1 - 10 = -9 TWh
    // rest: 10 - 10 = 0 TWh
    const result = getOverviewMetrics(yearRows)

    expect(result).not.toBeNull()
    expect(result!.largestIncrease.sourceKey).toBe('pv')
    expect(result!.largestIncrease.changeTwh).toBe(30)
  })

  it('erkennt Braunkohle als größten Rückgang', () => {
    const yearRows = createTestYearRows()

    const result = getOverviewMetrics(yearRows)

    expect(result).not.toBeNull()
    expect(result!.largestDecrease.sourceKey).toBe('hardcoal')
    expect(result!.largestDecrease.changeTwh).toBe(-9)
  })
})

// =========================================================================
// getSourceMetrics
// =========================================================================

describe('getSourceMetrics', () => {
  it('gibt null zurück, wenn Jahresdaten fehlen', () => {
    const yearRows: MixYearRow[] = [
      { year: 2015, values: createSourceValues(10) },
    ]

    const result = getSourceMetrics(yearRows, [], 'pv')

    expect(result).toBeNull()
  })

  it('berechnet Jahreswert und Veränderung für Photovoltaik', () => {
    const yearRows = createTestYearRows()
    const monthRows = createTestMonthRows()

    // pv 2015: 10, pv 2024: 40 → changeTwh = 30
    const result = getSourceMetrics(yearRows, monthRows, 'pv')

    expect(result).not.toBeNull()
    expect(result!.value2015).toBe(10)
    expect(result!.value2024).toBe(40)
    expect(result!.changeTwh).toBe(30)
  })

  it('berechnet den Jahresanteil für Photovoltaik', () => {
    const yearRows = createTestYearRows()
    const monthRows = createTestMonthRows()

    // 2024 total = 121, pv = 40 → share = 40/121
    const result = getSourceMetrics(yearRows, monthRows, 'pv')

    expect(result).not.toBeNull()
    expect(result!.share2024).toBeCloseTo(40 / 121, 4)
  })

  it('findet den Monat mit dem höchsten Wert', () => {
    const yearRows = createTestYearRows()
    const monthRows = createTestMonthRows()

    // pv-Werte: Januar=1, Juni=5, März=3 → Maximum = Juni
    const result = getSourceMetrics(yearRows, monthRows, 'pv')

    expect(result).not.toBeNull()
    expect(result!.maximumMonth.monthRow.month).toBe('2024-06')
    expect(result!.maximumMonth.valueTwh).toBe(5)
  })

  it('findet den Monat mit dem niedrigsten Wert', () => {
    const yearRows = createTestYearRows()
    const monthRows = createTestMonthRows()

    // pv-Werte: Januar=1, Juni=5, März=3 → Minimum = Januar
    const result = getSourceMetrics(yearRows, monthRows, 'pv')

    expect(result).not.toBeNull()
    expect(result!.minimumMonth.monthRow.month).toBe('2024-01')
    expect(result!.minimumMonth.valueTwh).toBe(1)
  })
})

// =========================================================================
// getAnnotationContext
// =========================================================================

describe('getAnnotationContext', () => {
  const annotation2023: MixAnnotation = {
    id: 5,
    date: '2023-04',
    title: 'Atomausstieg wurde abgeschlossen',
    text: 'Am 15. April 2023 sind die letzten drei deutschen Kernkraftwerke Isar 2, Emsland und Neckarwestheim 2 abgeschaltet worden.',
    highlight: ['nuclear' as MixSourceKey],
  }

  const annotationMissing: MixAnnotation = {
    id: 99,
    date: '2099-12',
    title: 'Unbekannt',
    text: 'Dieser Monat existiert nicht in den Testdaten.',
    highlight: [],
  }

  it('gibt null zurück, wenn der Monat nicht vorhanden ist', () => {
    const monthRows = createTestMonthRows()

    const result = getAnnotationContext(monthRows, annotationMissing)

    expect(result).toBeNull()
  })

  it('findet die passende Monatszeile anhand des Datums', () => {
    // Monatszeile für 2023-04 manuell erstellen
    const monthRows: MixMonthRow[] = [
      {
        month: '2023-04',
        date: new Date(2023, 3, 1),
        values: { ...createSourceValues(1), nuclear: 2 },
      },
    ]

    const result = getAnnotationContext(monthRows, annotation2023)

    expect(result).not.toBeNull()
    expect(result!.monthRow.month).toBe('2023-04')
  })

  it('berechnet Gruppenanteile korrekt', () => {
    // renewable: hydro=6, biomass=0, wind_offshore=0, wind_onshore=0, pv=0 → 6
    // nuclear: 1
    // fossil: gas=1, other_fossil=0, hardcoal=0, lignite=2 → 3
    // total = 10
    const monthRows: MixMonthRow[] = [
      {
        month: '2023-04',
        date: new Date(2023, 3, 1),
        values: {
          hydro: 6,
          biomass: 0,
          wind_offshore: 0,
          wind_onshore: 0,
          pv: 0,
          nuclear: 1,
          gas: 1,
          other_fossil: 0,
          hardcoal: 0,
          lignite: 2,
        },
      },
    ]

    const result = getAnnotationContext(monthRows, annotation2023)

    expect(result).not.toBeNull()

    const renewableShare = result!.groupShares.find((groupShare) => {
      return groupShare.group === 'renewable'
    })

    const nuclearShare = result!.groupShares.find((groupShare) => {
      return groupShare.group === 'nuclear'
    })

    const fossilShare = result!.groupShares.find((groupShare) => {
      return groupShare.group === 'fossil'
    })

    expect(renewableShare!.share).toBeCloseTo(0.6, 4)
    expect(nuclearShare!.share).toBeCloseTo(0.1, 4)
    expect(fossilShare!.share).toBeCloseTo(0.3, 4)
  })
})
