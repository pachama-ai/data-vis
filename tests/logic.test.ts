/**
 * tests/logic.test.ts
 * ===================
 * Zusätzliche Tests für kritische Fachlogik:
 * Aggregation, fehlende Werte, Prozentpunkte, Filter, Grenzfälle.
 */

import { describe, it, expect } from 'vitest'

// ===========================================================================
// Aggregation nach Stunde, Monat, Jahr
// ===========================================================================
function hourlyToYearlyAvg(rows: Array<{ ts: number; value: number }>, year: number): number {
  const filtered = rows.filter(r => new Date(r.ts).getUTCFullYear() === year)
  return filtered.length ? filtered.reduce((s, r) => s + r.value, 0) / filtered.length : 0
}

function hourlyToYearlySum(rows: Array<{ ts: number; value: number }>, year: number): number {
  const filtered = rows.filter(r => new Date(r.ts).getUTCFullYear() === year)
  return filtered.reduce((s, r) => s + r.value, 0)
}

describe('Jahres-Aggregation', () => {
  const data = [
    { ts: Date.UTC(2024, 0, 1, 0), value: 10 },
    { ts: Date.UTC(2024, 0, 1, 1), value: 20 },
    { ts: Date.UTC(2024, 0, 1, 2), value: 30 },
    { ts: Date.UTC(2023, 11, 31, 23), value: 5 },
  ]

  it('Durchschnitt 2024 = 20', () => {
    expect(hourlyToYearlyAvg(data, 2024)).toBeCloseTo(20, 1)
  })

  it('Summe 2024 = 60', () => {
    expect(hourlyToYearlySum(data, 2024)).toBeCloseTo(60, 1)
  })

  it('Kein Daten für 2025 = 0', () => {
    expect(hourlyToYearlyAvg(data, 2025)).toBe(0)
  })
})

// ===========================================================================
// Umgang mit fehlenden Werten
// ===========================================================================
describe('Fehlende Werte', () => {
  it('null in Datenreihe ignorieren', () => {
    const data = [1, null, 3, undefined, 5].filter((v): v is number => v !== null && v !== undefined)
    expect(data).toEqual([1, 3, 5])
  })

  it('NaN in Berechnung abfangen', () => {
    const vals = [10, NaN, 30].filter(v => !isNaN(v))
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    expect(avg).toBeCloseTo(20, 1)
  })

  it('leeres Array → 0', () => {
    const avg = [].length ? [].reduce((s: number, v: number) => s + v, 0) / [].length : 0
    expect(avg).toBe(0)
  })
})

// ===========================================================================
// Prozentpunkte (nicht Prozent)
// ===========================================================================
describe('Prozentpunkte', () => {
  it('EE-Anteil steigt von 33,1% auf 56,7% → +23,6 PP', () => {
    const pp = 56.7 - 33.1
    expect(pp).toBeCloseTo(23.6, 1)
  })

  it('Von 0 auf 100 = +100 PP', () => {
    expect(100 - 0).toBe(100)
  })

  it('Negative PP (Rückgang)', () => {
    expect(30 - 50).toBe(-20)
  })
})

// ===========================================================================
// Filter-Kombinationen
// ===========================================================================
describe('Filter', () => {
  const data = [
    { ts: Date.UTC(2024, 5, 1, 10), value: 10, hour: 10 },
    { ts: Date.UTC(2024, 5, 1, 14), value: 20, hour: 14 },
    { ts: Date.UTC(2024, 11, 1, 10), value: 30, hour: 10 },
    { ts: Date.UTC(2023, 5, 1, 10), value: 5, hour: 10 },
  ]

  it('Filter auf Jahr 2024 → 3 Einträge', () => {
    const filtered = data.filter(r => new Date(r.ts).getUTCFullYear() === 2024)
    expect(filtered).toHaveLength(3)
  })

  it('Filter auf Stunde 10 → 3 Einträge (über Jahre)', () => {
    const filtered = data.filter(r => r.hour === 10)
    expect(filtered).toHaveLength(3)
  })

  it('Filter auf Jahr 2024 + Stunde 10 → 2 Einträge', () => {
    const filtered = data.filter(r =>
      new Date(r.ts).getUTCFullYear() === 2024 && r.hour === 10
    )
    expect(filtered).toHaveLength(2)
  })

  it('Leere Menge = 0', () => {
    const filtered = data.filter(r => r.hour === 99)
    expect(filtered).toHaveLength(0)
  })
})

// ===========================================================================
// Division durch null abfangen
// ===========================================================================
describe('Division durch null', () => {
  function safeDivide(a: number, b: number): number {
    return b === 0 ? 0 : a / b
  }

  it('5 / 2 = 2,5', () => expect(safeDivide(5, 2)).toBeCloseTo(2.5, 1))
  it('5 / 0 = 0 (kein NaN)', () => expect(safeDivide(5, 0)).toBe(0))
  it('0 / 0 = 0', () => expect(safeDivide(0, 0)).toBe(0))
  it('Null durch Zahl = 0', () => expect(safeDivide(0, 5)).toBe(0))
})

// ===========================================================================
// Vergleich 2015 vs 2024 (zentral für das Dashboard)
// ===========================================================================
describe('Vergleich 2015 vs 2024', () => {
  const yearly = [
    { year: 2015, ee: 33.1, co2: 472.7 },
    { year: 2016, ee: 33.7, co2: 467.9 },
    { year: 2017, ee: 37.5, co2: 445.3 },
    { year: 2018, ee: 37.3, co2: 442.1 },
    { year: 2019, ee: 42.2, co2: 372.0 },
    { year: 2020, ee: 45.4, co2: 332.4 },
    { year: 2021, ee: 40.9, co2: 382.5 },
    { year: 2022, ee: 45.1, co2: 413.7 },
    { year: 2023, ee: 54.5, co2: 360.2 },
    { year: 2024, ee: 56.7, co2: 342.5 },
  ]

  it('EE-Anteil 2015 → 2024: +23,6 PP', () => {
    const y2015 = yearly.find(r => r.year === 2015)!
    const y2024 = yearly.find(r => r.year === 2024)!
    expect(y2024.ee - y2015.ee).toBeCloseTo(23.6, 1)
  })

  it('CO2 2015 → 2024: -130,2 g/kWh', () => {
    const y2015 = yearly.find(r => r.year === 2015)!
    const y2024 = yearly.find(r => r.year === 2024)!
    expect(y2024.co2 - y2015.co2).toBeCloseTo(-130.2, 1)
  })

  it('EE-Anteil steigt über die Jahre (monoton steigend im Trend)', () => {
    const sorted = [...yearly].sort((a, b) => a.year - b.year)
    const first = sorted[0].ee
    const last = sorted[sorted.length - 1].ee
    expect(last).toBeGreaterThan(first)
  })
})

// ===========================================================================
// Min-/Max-Berechnung (für Sparklines)
// ===========================================================================
describe('Min/Max Berechnung', () => {
  it('Normale Werte', () => {
    const data = [3, 7, 2, 9, 5]
    expect(Math.min(...data)).toBe(2)
    expect(Math.max(...data)).toBe(9)
  })

  it('Ein Wert = Min und Max', () => {
    expect(Math.min(...[5])).toBe(5)
    expect(Math.max(...[5])).toBe(5)
  })

  it('Negative Werte', () => {
    const data = [-5, -2, -10, -1]
    expect(Math.min(...data)).toBe(-10)
    expect(Math.max(...data)).toBe(-1)
  })
})

// ===========================================================================
// Trendlinien-Berechnung (lineare Regression)
// ===========================================================================
describe('Trendlinie (OLS)', () => {
  function linreg(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = Math.min(x.length, y.length)
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 }
    const mx = x.reduce((s, v) => s + v, 0) / n
    const my = y.reduce((s, v) => s + v, 0) / n
    let num = 0, den = 0, totalSS = 0, residSS = 0
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my
      num += dx * dy
      den += dx * dx
    }
    const slope = den === 0 ? 0 : num / den
    const intercept = my - slope * mx
    for (let i = 0; i < n; i++) {
      const pred = slope * x[i] + intercept
      totalSS += (y[i] - my) ** 2
      residSS += (y[i] - pred) ** 2
    }
    const r2 = totalSS === 0 ? 0 : 1 - residSS / totalSS
    return { slope, intercept, r2 }
  }

  it('y = -2x + 100 → slope = -2, r2 = 1', () => {
    const x = [0, 10, 20, 30, 40, 50]
    const y = x.map(v => -2 * v + 100)
    const r = linreg(x, y)
    expect(r.slope).toBeCloseTo(-2, 2)
    expect(r.r2).toBeCloseTo(1, 2)
  })

  it('y = 3x + 5 → slope = 3, intercept = 5', () => {
    const x = [0, 1, 2, 3, 4, 5]
    const y = x.map(v => 3 * v + 5)
    const r = linreg(x, y)
    expect(r.slope).toBeCloseTo(3, 2)
    expect(r.intercept).toBeCloseTo(5, 1)
  })

  it('Rauschen → r2 nahe 0', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const y = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
    const r = linreg(x, y)
    expect(r.r2).toBeLessThan(0.5)
  })

  it('Weniger als 2 Punkte → 0', () => {
    expect(linreg([1], [2]).slope).toBe(0)
    expect(linreg([], []).r2).toBe(0)
  })
})
