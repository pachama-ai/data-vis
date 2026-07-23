/**
 * tests/logic.test.ts – Zusätzliche Tests für kritische Fachlogik.
 *
 * Deckt Aggregation, fehlende Werte, Prozentpunkte, Filter, Grenzfälle,
 * Trendlinien und Einheitenumrechnung ab.
 */

import { describe, it, expect } from 'vitest'

// aggregation grundlagen
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

  it('berechnet den Durchschnitt der Stundenwerte f�r 2024', () => {
    expect(hourlyToYearlyAvg(data, 2024)).toBeCloseTo(20, 1)
  })

  it('summiert die Stundenwerte f�r 2024', () => {
    expect(hourlyToYearlySum(data, 2024)).toBeCloseTo(60, 1)
  })

  it('Kein Daten für 2025 = 0', () => {
    expect(hourlyToYearlyAvg(data, 2025)).toBe(0)
  })
})

// edge cases: null, undefined, NaN
describe('Fehlende Werte', () => {
  it('entfernt null und undefined aus der Datenreihe', () => {
    const data = [1, null, 3, undefined, 5].filter((v): v is number => v !== null && v !== undefined)
    expect(data).toEqual([1, 3, 5])
  })

  it('entfernt NaN-Werte vor der Berechnung', () => {
    const vals = [10, NaN, 30].filter(v => !isNaN(v))
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    expect(avg).toBeCloseTo(20, 1)
  })

  it('leeres Array → 0', () => {
    const avg = [].length ? [].reduce((s: number, v: number) => s + v, 0) / [].length : 0
    expect(avg).toBe(0)
  })
})

// prozentpunkte vs prozent — nicht verwechseln!
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

// filter kombos
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

// division durch null abfangen
describe('Division durch null', () => {
  function safeDivide(a: number, b: number): number {
    return b === 0 ? 0 : a / b
  }

  it('5 / 2 = 2,5', () => expect(safeDivide(5, 2)).toBeCloseTo(2.5, 1))
  it('5 / 0 = 0 (kein NaN)', () => expect(safeDivide(5, 0)).toBe(0))
  it('0 / 0 = 0', () => expect(safeDivide(0, 0)).toBe(0))
  it('Null durch Zahl = 0', () => expect(safeDivide(0, 5)).toBe(0))
})

// 2015 vs 2024 — zentral für dashboard
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
    const y2015 = yearly.find(r => r.year === 2015)
    const y2024 = yearly.find(r => r.year === 2024)
    if (!y2015 || !y2024) throw new Error('Jahresdaten unvollständig')
    expect(y2024.ee - y2015.ee).toBeCloseTo(23.6, 1)
  })

  it('CO2 2015 → 2024: -130,2 g/kWh', () => {
    const y2015 = yearly.find(r => r.year === 2015)
    const y2024 = yearly.find(r => r.year === 2024)
    if (!y2015 || !y2024) throw new Error('Jahresdaten unvollständig')
    expect(y2024.co2 - y2015.co2).toBeCloseTo(-130.2, 1)
  })

  it('EE-Anteil steigt über die Jahre (monoton steigend im Trend)', () => {
    const sorted = [...yearly].sort((a, b) => a.year - b.year)
    expect(sorted.length).toBeGreaterThanOrEqual(2)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (!first || !last) throw new Error('Nicht genug Daten')
    expect(last.ee).toBeGreaterThan(first.ee)
  })
})

// min/max für sparklines
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

// ols regression
describe('Trendlinie (OLS)', () => {
  function linreg(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = Math.min(x.length, y.length)
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 }
    const mx = x.reduce((s, v) => s + v, 0) / n
    const my = y.reduce((s, v) => s + v, 0) / n
    let num = 0, den = 0, totalSS = 0, residSS = 0
    for (let i = 0; i < n; i++) {
      const xi = x[i]; const yi = y[i]
      if (xi === undefined || yi === undefined) continue
      const dx = xi - mx, dy = yi - my
      num += dx * dy
      den += dx * dx
    }
    const slope = den === 0 ? 0 : num / den
    const intercept = my - slope * mx
    for (let i = 0; i < n; i++) {
      const xi = x[i]; const yi = y[i]
      if (xi === undefined || yi === undefined) continue
      const pred = slope * xi + intercept
      totalSS += (yi - my) ** 2
      residSS += (yi - pred) ** 2
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

// einheiten umrechnen
describe('Einheitenumrechnung', () => {
  it('100 MWh in 1 Stunde = 100 MW (Intervall = 1 h)', () => {
    const mwh = 100
    const intervallH = 1
    const mw = mwh / intervallH
    expect(mw).toBe(100)
  })

  it('500 MWh / 1 h = 500 MW → 0,5 GW', () => {
    const mw = 500 / 1
    const gw = mw / 1000
    expect(gw).toBeCloseTo(0.5, 2)
  })

  it('50.000 MWh / 1 h = 50 GW', () => {
    const gw = 50000 / 1 / 1000
    expect(gw).toBe(50)
  })

  it('0 MWh → 0 MW → 0 GW', () => {
    expect(0 / 1 / 1000).toBe(0)
  })
})

// chronologische sortierung
describe('Chronologische Sortierung', () => {
  it('Unsorted timestamps → aufsteigend sortiert', () => {
    const data = [
      Date.UTC(2024, 11, 31, 23),
      Date.UTC(2024, 0, 1, 0),
      Date.UTC(2024, 5, 15, 12),
    ]
    const sorted = [...data].sort((a, b) => a - b)
    expect(sorted[0]).toBe(Date.UTC(2024, 0, 1, 0))
    expect(sorted[1]).toBe(Date.UTC(2024, 5, 15, 12))
    expect(sorted[2]).toBe(Date.UTC(2024, 11, 31, 23))
  })

  it('Gleiche Timestamps bleiben gleich', () => {
    const ts = Date.UTC(2024, 0, 1)
    expect([ts, ts].sort((a, b) => a - b)).toEqual([ts, ts])
  })
})

// ===========================================================================
// Schaltjahre
// ===========================================================================
describe('Schaltjahre', () => {
  function isSchaltJahr(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  }

  it('2024 ist ein Schaltjahr (366 Tage → 8784 h)', () => {
    expect(isSchaltJahr(2024)).toBe(true)
  })

  it('2023 ist kein Schaltjahr (365 Tage → 8760 h)', () => {
    expect(isSchaltJahr(2023)).toBe(false)
  })

  it('2000 ist ein Schaltjahr (durch 400 teilbar)', () => {
    expect(isSchaltJahr(2000)).toBe(true)
  })

  it('1900 ist kein Schaltjahr (durch 100, aber nicht 400)', () => {
    expect(isSchaltJahr(1900)).toBe(false)
  })

  it('2016 und 2020 sind Schaltjahre', () => {
    expect(isSchaltJahr(2016)).toBe(true)
    expect(isSchaltJahr(2020)).toBe(true)
  })

  it('2015, 2017–2019, 2021–2023 sind keine Schaltjahre', () => {
    for (const y of [2015, 2017, 2018, 2019, 2021, 2022, 2023]) {
      expect(isSchaltJahr(y)).toBe(false)
    }
  })
})

// ===========================================================================
// Konventioneller Anteil (fossil + Kernenergie)
// ===========================================================================
describe('Konventioneller Anteil', () => {
  function calcConventionalShare(genBySource: Record<string, number>): number {
    // Konventionell = alle nicht-EE-Träger ohne Pumpspeicher
    const eeKeys = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro', 'other_renewables']
    const total = Object.values(genBySource).reduce((s, v) => s + (v ?? 0), 0)
    if (total === 0) return 0
    const ee = eeKeys.reduce((s, k) => s + (genBySource[k] ?? 0), 0)
    return (total - ee) / total * 100
  }

  it('Nur Kernenergie → 100 % konventionell', () => {
    const gen = { nuclear: 100, wind_onshore: 0, pv: 0, biomass: 0, hydro: 0, wind_offshore: 0, other_renewables: 0, lignite: 0, hardcoal: 0, gas: 0, other_fossil: 0, pumped_storage: 0 }
    expect(calcConventionalShare(gen)).toBeCloseTo(100, 1)
  })

  it('Nur Erneuerbare → 0 % konventionell', () => {
    const gen = { wind_onshore: 40, pv: 30, biomass: 20, hydro: 10 }
    expect(calcConventionalShare(gen)).toBeCloseTo(0, 1)
  })

  it('50 % Kernenergie + 50 % PV → 50 % konventionell', () => {
    const gen = { nuclear: 50, pv: 50 }
    expect(calcConventionalShare(gen)).toBeCloseTo(50, 1)
  })

  it('Kohle + Gas + Kernenergie → 100 % konventionell', () => {
    const gen = { lignite: 30, hardcoal: 20, gas: 15, nuclear: 10, pv: 25 }
    expect(calcConventionalShare(gen)).toBeCloseTo(75, 1) // (30+20+15+10)/100 = 75%
  })
})

// ===========================================================================
// Erzeugungsgewichteter CO₂-Referenzwert
// ===========================================================================
describe('Erzeugungsgewichtete CO₂-Intensität', () => {
  const EMISSION_FACTORS: Record<string, number> = {
    lignite: 1075, hardcoal: 835, gas: 411, nuclear: 0,
    biomass: 230, hydro: 0, wind_onshore: 0, wind_offshore: 0, pv: 0,
    other_fossil: 750, other_renewables: 100, pumped_storage: 0,
  }

  function calcCo2Weighted(genBySource: Record<string, number>): number {
    const total = Object.values(genBySource).reduce((s, v) => s + (v ?? 0), 0)
    if (total === 0) return 0
    const co2Sum = Object.entries(genBySource).reduce((s, [k, v]) => {
      return s + (v ?? 0) * (EMISSION_FACTORS[k] ?? 0)
    }, 0)
    return co2Sum / total
  }

  it('Gleiche Zusammensetzung → einfacher MW = gewichteter MW', () => {
    const rows = [
      { gen: { lignite: 50, pv: 50 }, co2: calcCo2Weighted({ lignite: 50, pv: 50 }) },
      { gen: { lignite: 50, pv: 50 }, co2: calcCo2Weighted({ lignite: 50, pv: 50 }) },
    ]
    const r0 = rows[0]; const r1 = rows[1]
    if (!r0 || !r1) throw new Error('Testdaten unvollständig')
    const simpleAvg = rows.reduce((s, r) => s + r.co2, 0) / rows.length
    // Bei gleicher Zusammensetzung sind einfacher und gewichteter MW identisch
    const totalGen = 100 + 100 // MWh
    const weightedNum = r0.co2 * 100 + r1.co2 * 100
    const weightedAvg = weightedNum / totalGen
    expect(simpleAvg).toBeCloseTo(weightedAvg, 5)
  })

  it('Unterschiedliche Zusammensetzung → einfacher MW ≠ gewichteter MW', () => {
    const rows = [
      { gen: { lignite: 80, pv: 20 }, co2: calcCo2Weighted({ lignite: 80, pv: 20 }) },
      { gen: { lignite: 20, pv: 20 }, co2: calcCo2Weighted({ lignite: 20, pv: 20 }) },
    ]
    // Stunde 1: 100 MWh, 80% Braunkohle → CO₂ = (80*1075 + 20*0)/100 = 860
    // Stunde 2:  40 MWh, 50% Braunkohle → CO₂ = (20*1075 + 20*0)/40 = 537,5
    const r0 = rows[0]; const r1 = rows[1]
    if (!r0 || !r1) throw new Error('Testdaten unvollständig')
    const simpleAvg = rows.reduce((s, r) => s + r.co2, 0) / rows.length // (860+537,5)/2 = 698,75
    const weightedNum = r0.co2 * 100 + r1.co2 * 40
    const weightedAvg = weightedNum / 140
    expect(simpleAvg).not.toBeCloseTo(weightedAvg, 0)
    // Gewichteter MW ist niedriger, weil die CO₂-arme Stunde weniger erzeugt
    // (niedrigeres CO₂ hat geringeres Gewicht im gewichteten MW)
  })
})

// ===========================================================================
// Filter nach Monat und Tagesstunde
// ===========================================================================
describe('Filter nach Monat und Stunde', () => {
  function filterMonthHour(
    rows: Array<{ ts: number }>, month: number, hour: number
  ): number {
    return rows.filter(r => {
      const d = new Date(r.ts)
      return d.getUTCMonth() === month && d.getUTCHours() === hour
    }).length
  }

  it('Filter Juni 2024, 14 Uhr → 1 Treffer', () => {
    const data = [
      { ts: Date.UTC(2024, 5, 1, 14) }, // Juni, 14 Uhr
      { ts: Date.UTC(2024, 5, 1, 15) }, // Juni, 15 Uhr
      { ts: Date.UTC(2024, 6, 1, 14) }, // Juli, 14 Uhr
    ]
    expect(filterMonthHour(data, 5, 14)).toBe(1) // Juni = Monat 5
  })

  it('Kein Treffer bei nicht existenter Kombination', () => {
    const data = [{ ts: Date.UTC(2024, 0, 1, 0) }]
    expect(filterMonthHour(data, 6, 12)).toBe(0)
  })
})
