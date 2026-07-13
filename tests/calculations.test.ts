/**
 * tests/calculations.test.ts
 * ==========================
 * Level 2 — Berechnungs-Korrektheit
 * Unit-Tests für alle im Dashboard verwendeten Berechnungen.
 *
 * Aufruf: bun x vitest run
 */

import { describe, it, expect } from 'vitest'

// ===========================================================================
// 1. EE-Anteil
// ===========================================================================
function calcEeShare(genBySource: Record<string, number>): number {
  const eeKeys = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro']
  const ee = eeKeys.reduce((s, k) => s + (genBySource[k] ?? 0), 0)
  const total = Object.values(genBySource).reduce((s, v) => s + (v ?? 0), 0)
  if (total === 0) return 0
  return ee / total * 100
}

describe('EE-Anteil', () => {
  it('40 GWh EE bei 100 GWh Gesamt → 40%', () => {
    const gen = {
      wind_onshore: 20, wind_offshore: 10, pv: 5, biomass: 3, hydro: 2,
      lignite: 30, hardcoal: 15, gas: 10, nuclear: 3, other_fossil: 1, other_renewables: 1, pumped_storage: 0,
    }
    expect(calcEeShare(gen)).toBeCloseTo(40, 1)
  })

  it('0% wenn keine EE', () => {
    const gen = { lignite: 50, gas: 30, hardcoal: 20, nuclear: 10, other_fossil: 5, other_renewables: 0, pumped_storage: 0, wind_onshore: 0, wind_offshore: 0, pv: 0, biomass: 0, hydro: 0 }
    expect(calcEeShare(gen)).toBe(0)
  })

  it('100% wenn nur EE', () => {
    const gen = { wind_onshore: 40, pv: 30, biomass: 20, hydro: 10, wind_offshore: 5, other_renewables: 0, lignite: 0, hardcoal: 0, gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0 }
    expect(calcEeShare(gen)).toBeCloseTo(100, 1)
  })

  it('0 bei leerer Erzeugung', () => {
    expect(calcEeShare({})).toBe(0)
  })
})

// ===========================================================================
// 2. Residuallast
// ===========================================================================
function calcResiduallast(loadMwh: number, genBySource: Record<string, number>): number {
  const eeKeys = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro']
  const ee = eeKeys.reduce((s, k) => s + (genBySource[k] ?? 0), 0)
  return (loadMwh - ee) / 1000 // GW
}

describe('Residuallast', () => {
  it('60 GW Last − 25 GW EE → 35 GW', () => {
    // Werte in MWh (15 GW = 15.000 MWh)
    const gen = { wind_onshore: 15000, pv: 5000, biomass: 3000, hydro: 2000, wind_offshore: 0 }
    expect(calcResiduallast(60000, gen)).toBeCloseTo(35, 1)
  })

  it('Netzlast = EE → 0 GW', () => {
    const gen = { wind_onshore: 20000, wind_offshore: 10000, pv: 5000, biomass: 0, hydro: 0 }
    expect(calcResiduallast(35000, gen)).toBeCloseTo(0, 1)
  })

  it('0 Last → 0 GW', () => {
    expect(calcResiduallast(0, {})).toBe(0)
  })
})

// ===========================================================================
// 3. CO₂-Intensität
// ===========================================================================
const EMISSION_FACTORS: Record<string, number> = {
  lignite: 1075, hardcoal: 835, gas: 411, nuclear: 0,
  biomass: 230, hydro: 0, wind_onshore: 0, wind_offshore: 0, pv: 0,
  other_fossil: 750, other_renewables: 100, pumped_storage: 0,
}

function calcCo2Intensity(genBySource: Record<string, number>): number {
  const total = Object.values(genBySource).reduce((s, v) => s + (v ?? 0), 0)
  if (total === 0) return 0
  const co2Sum = Object.entries(genBySource).reduce((s, [k, v]) => {
    return s + (v ?? 0) * (EMISSION_FACTORS[k] ?? 0)
  }, 0)
  return co2Sum / total
}

describe('CO₂-Intensität', () => {
  it('Nur Erneuerbare (ohne Biomasse) → 0 g/kWh', () => {
    const gen = { wind_onshore: 50, pv: 30, hydro: 10 }
    expect(calcCo2Intensity(gen)).toBeCloseTo(0, 0)
  })

  it('Biomasse (230 g/kWh) allein → 230 g/kWh', () => {
    expect(calcCo2Intensity({ biomass: 100 })).toBeCloseTo(230, 0)
  })

  it('Nur Braunkohle → 1075 g/kWh', () => {
    expect(calcCo2Intensity({ lignite: 100 })).toBeCloseTo(1075, 0)
  })

  it('50% Braunkohle (1075) + 50% PV (0) → 537.5 g/kWh', () => {
    const gen = { lignite: 50, pv: 50 }
    expect(calcCo2Intensity(gen)).toBeCloseTo(537.5, 0)
  })

  it('Mix 2024-typisch: Braunkohle 17% + Steinkohle 12% + Gas 15% + EE 56%', () => {
    const gen = {
      lignite: 17, hardcoal: 12, gas: 15,
      wind_onshore: 20, wind_offshore: 5, pv: 10, biomass: 8, hydro: 3,
      nuclear: 0, other_fossil: 5, other_renewables: 5, pumped_storage: 0,
    }
    const co2 = calcCo2Intensity(gen)
    // Erwartet: (17*1075 + 12*835 + 15*411 + 8*230 + 5*750 + 5*100) / 100
    const expected = (17*1075 + 12*835 + 15*411 + 8*230 + 5*750 + 5*100) / 100
    expect(co2).toBeCloseTo(expected, 0)
  })
})

// ===========================================================================
// 4. Perzentile (unterste/oberste 10%)
// ===========================================================================
function bottom10pct(sorted: number[]): number[] {
  if (!sorted.length) return []
  return sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.1)))
}
function top10pct(sorted: number[]): number[] {
  if (!sorted.length) return []
  const count = Math.max(1, Math.round(sorted.length * 0.1))
  return sorted.slice(sorted.length - count)
}

describe('Perzentile (10%)', () => {
  it('100 sortierte Werte → untere 10 sind 1-10, obere 10 sind 91-100', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(bottom10pct(data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(top10pct(data)).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99, 100])
  })

  it('10 Werte → untere 1, obere 1', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(bottom10pct(data)).toEqual([1])
    expect(top10pct(data)).toEqual([10])
  })

  it('1 Wert → gleicher Wert für beide', () => {
    expect(bottom10pct([42])).toEqual([42])
    expect(top10pct([42])).toEqual([42])
  })

  it('0 Werte → leeres Array', () => {
    expect(bottom10pct([])).toEqual([])
    expect(top10pct([])).toEqual([])
  })
})

// ===========================================================================
// 5. Pearson-Korrelation
// ===========================================================================
function pearsonR(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : num / den
}

describe('Pearson-Korrelation', () => {
  it('y = -2x + 100 → r = -1.0 (perfekt negativ)', () => {
    const x = [0, 10, 20, 30, 40, 50]
    const y = x.map(v => -2 * v + 100)
    expect(pearsonR(x, y)).toBeCloseTo(-1, 2)
  })

  it('y = x → r = 1.0 (perfekt positiv)', () => {
    const x = [1, 2, 3, 4, 5]
    expect(pearsonR(x, x)).toBeCloseTo(1, 2)
  })

  it('y = 42 (konstant) → r = 0', () => {
    const x = [0, 1, 2, 3, 4]
    const y = [42, 42, 42, 42, 42]
    expect(pearsonR(x, y)).toBeCloseTo(0, 2)
  })

  it('Keine Korrelation bei zufälliger Streuung → r nahe 0', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const y = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3] // π-Ziffern
    const r = pearsonR(x, y)
    expect(Math.abs(r)).toBeLessThan(0.5)
  })
})

// ===========================================================================
// 6. Lineare Regression (Steigung)
// ===========================================================================
function linregSlope(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    num += dx * (y[i] - my)
    den += dx * dx
  }
  return den === 0 ? 0 : num / den
}

describe('Lineare Regression (Steigung)', () => {
  it('y = -2x + 100 → Steigung = -2.0', () => {
    const x = [0, 10, 20, 30, 40, 50]
    const y = x.map(v => -2 * v + 100)
    expect(linregSlope(x, y)).toBeCloseTo(-2, 2)
  })

  it('y = 0.5x → Steigung = 0.5', () => {
    const x = [0, 10, 20, 30, 40, 50]
    const y = x.map(v => 0.5 * v)
    expect(linregSlope(x, y)).toBeCloseTo(0.5, 2)
  })

  it('y = 100 (konstant) → Steigung = 0', () => {
    const x = [0, 1, 2, 3, 4]
    const y = [100, 100, 100, 100, 100]
    expect(linregSlope(x, y)).toBeCloseTo(0, 2)
  })

  it('2 Datenpunkte → exakte Steigung', () => {
    expect(linregSlope([0, 10], [0, 5])).toBeCloseTo(0.5, 2)
  })
})

// ===========================================================================
// 7. Diff-String-Formatierung (buildDeltaStr)
// ===========================================================================
function buildDeltaStr(diff: number, unit: string, label: string): { label: string | null; positive: boolean; tooltip: string } | null {
  if (Math.abs(diff) < 0.05) return null
  const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '')
  const fmtDiff = Math.abs(diff).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const unitLower = unit === 'PP' ? 'pp' : unit
  return { label: `${label}: ${sign}${fmtDiff} ${unitLower}`, positive: diff > 0, tooltip: label }
}

describe('buildDeltaStr', () => {
  it('+23,6 PP über 10 Jahre', () => {
    const r = buildDeltaStr(23.6, 'PP', '2015 → 2024')
    expect(r!.label).toBe('2015 → 2024: +23,6 pp')
    expect(r!.positive).toBe(true)
  })

  it('-12,3 g/kWh', () => {
    const r = buildDeltaStr(-12.3, 'g/kWh', 'vs. Vorjahr')
    expect(r!.label).toBe('vs. Vorjahr: -12,3 g/kWh')
    expect(r!.positive).toBe(false)
  })

  it('Differenz < 0.05 → null', () => {
    expect(buildDeltaStr(0.03, 'PP', 'Test')).toBeNull()
  })

  it('Null → null', () => {
    expect(buildDeltaStr(0, 'PP', 'Test')).toBeNull()
  })
})

// ===========================================================================
// 8. Daten-Aggregation (Jahresmittel aus Stundenwerten)
// ===========================================================================
function yearlyAvg(rows: Array<{ timestamp: number; value: number }>, year: number): number {
  const filtered = rows.filter(r => new Date(r.timestamp).getUTCFullYear() === year)
  if (!filtered.length) return 0
  return filtered.reduce((s, r) => s + r.value, 0) / filtered.length
}

describe('Jahresaggregation', () => {
  it('Mittelwert eines Jahres aus 3 Werten', () => {
    const data = [
      { timestamp: Date.UTC(2024, 0, 1, 0), value: 10 },
      { timestamp: Date.UTC(2024, 0, 1, 1), value: 20 },
      { timestamp: Date.UTC(2024, 0, 1, 2), value: 30 },
    ]
    expect(yearlyAvg(data, 2024)).toBeCloseTo(20, 1)
  })

  it('Kein Daten für Jahr → 0', () => {
    expect(yearlyAvg([], 2024)).toBe(0)
  })
})
