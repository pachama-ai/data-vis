/**
 * tests/unit/useEmissions.test.ts
 *
 * Testet die reinen Berechnungsfunktionen aus composables/useEmissions.ts.
 *
 * Aufruf: npx vitest run tests/unit/useEmissions.test.ts
 */

import { describe, it, expect } from 'vitest'

import {
  calculateEmissionsMt,
  calculateEmissionIntensity,
  calculateEmissionRows,
  calculateDeviationYear,
  DEFAULT_EMISSION_FACTORS,
} from '~/components/emissions/emissionsData'

import type { MixSourceKey } from '~/types/mix'
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

  // Fossile auf realistischere Werte setzen
  values.gas = 30
  values.hardcoal = 20
  values.lignite = 40
  values.other_fossil = 5

  // Erneuerbare
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

// =========================================================================
// calculateEmissionsMt
// =========================================================================

describe('calculateEmissionsMt', () => {
  it('berechnet 0 Mt bei 0 TWh', () => {
    expect(calculateEmissionsMt(0, 411)).toBe(0)
  })

  it('berechnet 0 Mt bei Faktor 0', () => {
    expect(calculateEmissionsMt(100, 0)).toBe(0)
  })

  it('berechnet korrekt für Braunkohle (40 TWh × 1075 g/kWh)', () => {
    // 40 TWh × 1075 g/kWh = 43.000 g·TWh/kWh
    // 43.000 / 1.000.000 = 0.043 Mt
    // Wait: 40 * 10^9 kWh * 1075 g/kWh = 43.000 * 10^9 g = 43.000.000 t = 43 Mt
    // 40 * 1075 / 1.000.000 = 43.000 / 1.000.000 = 0.043 Mt? No.
    // 1 TWh = 10^9 kWh
    // 40 TWh * 1075 g/kWh = 40 * 10^9 * 1075 g = 43.000 * 10^9 g
    // 43.000 * 10^9 g = 43.000.000 t = 43 Mt
    // Using formula: TWh * g/kWh / 1.000.000 = Mt
    // 40 * 1075 / 1.000.000 = 43.000 / 1.000.000 = 0.043? No...
    // Let me recalculate: 40 * 1075 = 43000
    // 43000 / 1_000_000 = 0.043
    // But 40 TWh * 1075 g/kWh should be 43 Mt...
    // 
    // 1 TWh = 10^9 Wh = 10^6 kWh
    // 40 TWh = 40 * 10^6 kWh
    // 40 * 10^6 kWh * 1075 g/kWh = 43.000 * 10^6 g = 43.000 t = 0.043 Mt
    // That doesn't seem right...
    //
    // Actually: 1 TWh = 10^9 kWh (10^9 = 1,000,000,000)
    // 40 TWh = 40 * 10^9 kWh
    // 40 * 10^9 kWh * 1075 g/kWh = 43,000 * 10^9 g
    // 43,000 * 10^9 g = 43,000,000 * 10^6 g = 43,000,000 t = 43 Mt
    //
    // The formula: TWh * g/kWh / 10^6 = Mt
    // Because: 1 TWh = 10^9 kWh
    // g/kWh * 10^9 = g/TWh
    // g/TWh / 10^12 = t/TWh ... wait let me redo this.
    //
    // 1 TWh = 10^9 kWh (kilo = 10^3, so 1 TWh = 10^9 Wh = 10^6 kWh)
    // Wait: 1 TWh = 10^12 Wh
    // 1 kWh = 10^3 Wh
    // So 1 TWh = 10^9 kWh
    // 
    // Emission = generation_kWh * factor_g/kWh = g
    // 40 TWh = 40 * 10^9 kWh
    // 40 * 10^9 kWh * 1075 g/kWh = 43,000 * 10^9 g
    // 1 Mt = 10^12 g (10^6 t * 10^6 g/t)
    // 43,000 * 10^9 g = 43,000 / 10^3 * 10^12 g = 43 * 10^12 g = 43 Mt
    //
    // So: TWh * 10^9 * g/kWh / 10^12 = Mt
    // = TWh * g/kWh / 10^3 = Mt
    // Hmm, but my code says / 1_000_000
    //
    // Let me recheck: 40 * 1075 / 1_000_000 = 0.043
    // But expected: 43 Mt
    //
    // So the formula is wrong. Let me fix:
    // 1 TWh = 10^9 kWh (since 1 TWh = 10^12 Wh, and 1 kWh = 10^3 Wh, so 10^12/10^3 = 10^9)
    // Emissions (g) = generation_kWh * factor_g/kWh = TWh * 10^9 * factor
    // To convert g to Mt: divide by 10^12 (since 1 Mt = 10^6 t = 10^12 g)
    // = TWh * factor * 10^9 / 10^12 = TWh * factor / 10^3
    //
    // So the formula should be: TWh * g/kWh / 1000 = Mt
    //
    // Let me verify: 40 * 1075 / 1000 = 43 Mt ✓

    expect(calculateEmissionsMt(40, 1075)).toBeCloseTo(43, 5)
  })

  it('berechnet korrekt für Erdgas (30 TWh × 411 g/kWh)', () => {
    // 30 * 411 / 1000 = 12.33 Mt
    expect(calculateEmissionsMt(30, 411)).toBeCloseTo(12.33, 5)
  })

  it('berechnet 0 Mt für erneuerbare Energien (Faktor 0)', () => {
    expect(calculateEmissionsMt(50, 0)).toBe(0)
  })
})

// =========================================================================
// calculateEmissionIntensity
// =========================================================================

describe('calculateEmissionIntensity', () => {
  it('gibt 0 zurück bei fehlender Erzeugung', () => {
    expect(calculateEmissionIntensity(100, 0)).toBe(0)
  })

  it('berechnet die Intensität korrekt', () => {
    // 43 Mt bei 40 TWh → 43 * 1.000.000 / 40 = 1.075.000... wait
    // 43 Mt = 43.000.000 t
    // 40 TWh = 40.000.000.000 kWh (40 * 10^9... no)
    // 
    // emissionIntensity = emissionsMt * 1.000.000 / generationTwh
    // = 43 * 1.000.000 / 40 = 1.075.000... that's wrong
    //
    // The intensity in g/kWh should be the original factor: 1075
    // emissionsMt = 43 Mt = 43 * 10^12 g (1 Mt = 10^12 g)
    // generationTwh = 40 TWh = 40 * 10^9 kWh
    // intensity = 43 * 10^12 / (40 * 10^9) = 43 * 10^3 / 40 = 1075 g/kWh ✓
    //
    // So the formula: emissionsMt * 10^12 / (generationTwh * 10^9) = emissionsMt * 10^3 / generationTwh
    // But my code does: (emissionsMt * 1_000_000) / generationTwh
    // That gives: 43 * 1_000_000 / 40 = 1.075.000 which is wrong!
    //
    // It should be: (emissionsMt * 1_000) / generationTwh = 43 * 1000 / 40 = 1075 ✓
    // 
    // Wait, the issue is the formula in the code was wrong. Let me check.
    //
    // calculateEmissionIntensity:
    // return (emissionsMt * 1_000_000) / generationTwh
    //
    // This assumes 1 Mt = 10^6 g which is wrong.
    // 1 Mt = 10^6 t = 10^12 g
    // 1 TWh = 10^9 kWh
    // intensity = emissions_g / generation_kWh
    // = (emissionsMt * 10^12) / (generationTwh * 10^9)
    // = (emissionsMt * 10^3) / generationTwh
    // = (emissionsMt * 1000) / generationTwh
    //
    // So the formula should use 1000, not 1_000_000!
    // I need to fix this in the implementation.
    //
    // Actually wait... let me recheck calculateEmissionsMt
    // 
    // calculateEmissionsMt:
    // return (generationTwh * factorGPerKwh) / 1_000_000
    //
    // If 1 TWh = 10^9 kWh, then:
    // generation_kWh = generationTwh * 10^9
    // emissions_g = generation_kWh * factor = generationTwh * 10^9 * factor
    // emissions_Mt = emissions_g / 10^12 = generationTwh * factor * 10^9 / 10^12
    // = generationTwh * factor / 10^3
    //
    // So calculateEmissionsMt should divide by 1000, not 1_000_000!
    //
    // Let me trace through:
    // For lignite: 40 TWh * 1075 g/kWh = 43.000 g*TWh/kWh
    // = 40 * 10^9 kWh * 1075 g/kWh = 43.000 * 10^9 g
    // = 43 * 10^12 g = 43 Mt
    //
    // Using formula generationTwh * factor / 1000:
    // 40 * 1075 / 1000 = 43 ✓
    //
    // Using the current formula generationTwh * factor / 1_000_000:
    // 40 * 1075 / 1_000_000 = 0.043 ✗
    //
    // So my formula is wrong! I need to fix it.

    const intensity = calculateEmissionIntensity(43, 40)
    expect(intensity).toBeCloseTo(1075, 0)
  })

  it('gibt 0 zurück bei negativer Erzeugung', () => {
    expect(calculateEmissionIntensity(10, -5)).toBe(0)
  })
})

// =========================================================================
// calculateEmissionRows
// =========================================================================

describe('calculateEmissionRows', () => {
  it('gibt null zurück bei null-Eingabe', () => {
    const result = calculateEmissionRows(null)

    expect(result).toBeNull()
  })

  it('berechnet rows mit korrekten Anteilen', () => {
    // Ein Jahr, in dem nur Braunkohle und PV erzeugen
    const yearRow: MixYearRow = {
      year: 2024,
      values: {
        hydro: 0,
        biomass: 0,
        wind_offshore: 0,
        wind_onshore: 0,
        pv: 30,
        nuclear: 0,
        gas: 0,
        other_fossil: 0,
        hardcoal: 0,
        lignite: 70,
      },
      totalTwh: 100,
    }

    const rows = calculateEmissionRows(yearRow)

    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(10)

    // pv: 30 TWh, 30% Erzeugung, 0% Emissionen
    const pvRow = rows!.find((r) => r.sourceKey === 'pv')
    expect(pvRow).toBeDefined()
    expect(pvRow!.generationShare).toBeCloseTo(0.3, 5)
    expect(pvRow!.emissionShare).toBe(0)
    expect(pvRow!.deviationPp).toBeCloseTo(-30, 5)

    // lignite: 70 TWh, 70% Erzeugung, 100% Emissionen
    const ligniteRow = rows!.find(
      (r) => r.sourceKey === 'lignite',
    )
    expect(ligniteRow).toBeDefined()
    expect(ligniteRow!.generationShare).toBeCloseTo(0.7, 5)
    expect(ligniteRow!.emissionShare).toBe(1)
    expect(ligniteRow!.deviationPp).toBeCloseTo(30, 5)
  })
})

// =========================================================================
// calculateDeviationYear
// =========================================================================

describe('calculateDeviationYear', () => {
  it('gibt null zurück bei null-Eingabe', () => {
    const result = calculateDeviationYear(null)

    expect(result).toBeNull()
  })

  it('berechnet Summen korrekt', () => {
    const yearRow = createTestYearRow(2024)
    const deviationYear = calculateDeviationYear(yearRow)

    expect(deviationYear).not.toBeNull()
    expect(deviationYear!.year).toBe(2024)
    expect(deviationYear!.rows).toHaveLength(10)
    expect(deviationYear!.totalGenerationTwh).toBeGreaterThan(0)
    expect(deviationYear!.totalEmissionsMt).toBeGreaterThan(0)
  })
})
