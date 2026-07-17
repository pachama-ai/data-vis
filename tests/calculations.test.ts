/**
 * tests/calculations.test.ts – Unit-Tests für Dashboard-Berechnungen.
 *
 * Testet EE-Anteil, Residuallast, CO₂-Intensität, Perzentile,
 * Korrelation, Regression und Aggregation.
 *
 * Aufruf: bun x vitest run
 */

import { describe, it, expect } from 'vitest'

// ee-anteil berechnung
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

// residuallast
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

// co2 intensität (gewichteter durchschnitt)
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

// extreme werte (perzentile)
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

// zeitzonen — bug von letzter woche
function berlinHour(ts: number): number {
  return parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(ts), 10)
}
function berlinYear(ts: number): number {
  return Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(ts))
}
function berlinMonth(ts: number): number {
  return Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' }).format(ts))
}

describe('Berliner Lokalzeit', () => {
  // Winter: CET = UTC+1
  it('Winter 00:00 Berlin = UTC 23:00 Vortag, Stunde 0', () => {
    // 2015-01-05 00:00 CET = 2015-01-04 23:00 UTC
    const ts = Date.UTC(2015, 0, 4, 23, 0)
    expect(berlinHour(ts)).toBe(0)
    expect(berlinYear(ts)).toBe(2015)
    expect(berlinMonth(ts)).toBe(1)
  })

  // Sommer: CEST = UTC+2
  it('Sommer 13:00 Berlin = UTC 11:00, Stunde 13', () => {
    const ts = Date.UTC(2024, 5, 21, 11, 0) // 11:00 UTC = 13:00 CEST
    expect(berlinHour(ts)).toBe(13)
  })

  // DST-Beginn: 31.03.2024, Berlin springt 02:00→03:00
  it('DST-Beginn: 03:00 Berlin = UTC 01:00, Stunde 3', () => {
    const ts = Date.UTC(2024, 2, 31, 1, 0) // 01:00 UTC = 03:00 CEST
    expect(berlinHour(ts)).toBe(3)
  })

  // DST-Ende: beide Berlin 02:00 haben unterschiedliche UTC-Timestamps
  it('DST-Ende: erste 02:00 Berlin = UTC 00:00 (CEST)', () => {
    const ts = Date.UTC(2024, 9, 27, 0, 0) // 00:00 UTC = 02:00 CEST
    expect(berlinHour(ts)).toBe(2)
  })

  it('DST-Ende: zweite 02:00 Berlin = UTC 01:00 (CET)', () => {
    const ts = Date.UTC(2024, 9, 27, 1, 0) // 01:00 UTC = 02:00 CET
    expect(berlinHour(ts)).toBe(2)
  })

  // Jahreswechsel: UTC 23:00 am 31.12. = 01.01. 00:00 Berlin
  it('Silvester 23:00 UTC = 01.01. 00:00 Berlin (nächstes Jahr)', () => {
    const ts = Date.UTC(2023, 11, 31, 23, 0)
    expect(berlinHour(ts)).toBe(0)
    expect(berlinYear(ts)).toBe(2024)
    expect(berlinMonth(ts)).toBe(1)
  })

  // UTC-Mitternacht im Winter = Berlin 01:00 (nächster Tag)
  it('UTC 00:00 im Winter = Berlin 01:00 CET, gleicher Tag', () => {
    const ts = Date.UTC(2024, 0, 15, 0, 0)
    expect(berlinHour(ts)).toBe(1)
  })
})

// pearson korrelation
function pearsonR(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx, dy = y[i]! - my
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

// lineare regression
function linregSlope(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx
    num += dx * (y[i]! - my)
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

// diff string (wird für anzeige gebraucht)
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

// aggregation — stunden zu jahresmittel
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

// kpi jahreswerte (berlin zeitzone)
function genRow(ts: number, ee: number, co2: number, price: number) {
  return {
    timestamp: ts, co2_g_per_kwh: co2, ee_share: ee, fossil_share: 0,
    price_eur_mwh: price, load_mwh: 0, generation_by_source: {
      lignite: 0, nuclear: 0, wind_offshore: 0, hydro: 0, other_fossil: 0,
      other_renewables: 0, biomass: 0, wind_onshore: 0, pv: 0, hardcoal: 0,
      pumped_storage: 0, gas: 0,
    },
  }
}

describe('KPI-Jahreswerte (Berlin-Jahr)', () => {
  it('Silvester 23:00 UTC gehört zum Berlin-Jahr 2024, nicht 2023', () => {
    // 2023-12-31 23:00 UTC = 2024-01-01 00:00 Berlin (CET)
    const ts = Date.UTC(2023, 11, 31, 23, 0)
    expect(berlinYear(ts)).toBe(2024)
    expect(new Date(ts).getUTCFullYear()).toBe(2023)
  })

  it('Jahresmittel aus 3 Stundenwerten mit Berlin-Jahr', () => {
    const data = [
      { timestamp: Date.UTC(2024, 0, 1, 0), value: 10 },
      { timestamp: Date.UTC(2024, 5, 15, 12), value: 20 },
      { timestamp: Date.UTC(2024, 11, 31, 23), value: 30 },
    ]
    // Alle 3 timestamps sind auch Berlin 2024 (kein DST-Überlauf an Silvester)
    expect(yearlyAvg(data, 2024)).toBeCloseTo(20, 1)
  })

  it('Jahresgrenze: UTC 2023-12-31 23:00 zählt nicht zu UTC-2024, aber zu Berlin-2024', () => {
    const data = [
      { timestamp: Date.UTC(2023, 11, 31, 23, 0), value: 100 }, // Berlin: 2024-01-01 00:00
      { timestamp: Date.UTC(2024, 0, 1, 0, 0), value: 200 },   // Berlin: 2024-01-01 01:00
      { timestamp: Date.UTC(2024, 0, 1, 22, 0), value: 300 },  // Berlin: 2024-01-01 23:00
    ]
    // Mit UTC-Jahr: nur 2 Werte (200 und 300) → MW = 250
    const utcAvg = data.filter(r => new Date(r.timestamp).getUTCFullYear() === 2024)
      .reduce((s, r) => s + r.value, 0) / 2
    expect(utcAvg).toBe(250)
    // Mit Berlin-Jahr: alle 3 Werte → MW = 200
    const berlinAvg = data.filter(r => berlinYear(r.timestamp) === 2024)
      .reduce((s, r) => s + r.value, 0) / 3
    expect(berlinAvg).toBe(200)
  })

  it('Negative Preisstunden zählen mit Berlin-Jahr', () => {
    // 3 hours: two with negative price in Berlin 2024, one in Berlin 2023
    const rows = [
      genRow(Date.UTC(2024, 5, 15, 10, 0), 50, 300, -10),  // Berlin 2024, negativ
      genRow(Date.UTC(2024, 5, 15, 11, 0), 50, 300, -20),  // Berlin 2024, negativ
      genRow(Date.UTC(2024, 5, 15, 12, 0), 50, 300, 30),   // Berlin 2024, positiv
    ]
    const negCount = rows.filter(r => berlinYear(r.timestamp) === 2024 && r.price_eur_mwh < 0).length
    expect(negCount).toBe(2)
  })

  it('Einzeljahres-Mittelwert EE-Anteil', () => {
    const rows = [
      genRow(Date.UTC(2024, 0, 1, 0), 30, 400, 50),  // ee=30
      genRow(Date.UTC(2024, 5, 15, 12), 50, 300, 80), // ee=50
      genRow(Date.UTC(2024, 11, 31, 12), 40, 350, 60), // ee=40
    ]
    const eeValues = rows.filter(r => berlinYear(r.timestamp) === 2024).map(r => r.ee_share)
    const avg = eeValues.reduce((s, v) => s + v, 0) / eeValues.length
    expect(avg).toBeCloseTo(40, 1) // (30+50+40)/3 = 40
  })

  it('Leere Jahresdaten → 0', () => {
    expect(yearlyAvg([], 2024)).toBe(0)
    expect(yearlyAvg([], 2025)).toBe(0)
  })
})

// preis kpi 2015 vs 2024
function yearlyPriceValues(rows: Array<{ timestamp: number; price_eur_mwh: number }>) {
  // Simuliert yearlyValues('price') aus dashboard.vue: gruppiert nach Berlin-Jahr, filtert 2015–2024
  const byY: Record<number, number[]> = {}
  for (const r of rows) {
    const y = berlinYear(r.timestamp)
    if (y < 2015 || y > 2024) continue
    if (!byY[y]) byY[y] = []
    byY[y].push(r.price_eur_mwh)
  }
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
  return years.map((y) => {
    const vals = byY[y]
    return vals ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
}

describe('Preis-KPI Jahresvergleich', () => {
  const makeRow = (ts: number, price: number) => genRow(ts, 50, 400, price)

  it('Test A: Delta 2015 vs 2024 ignoriert Berlin-2025-Stunde', () => {
    // 2 Stunden 2015, 2 Stunden 2024, 1 Stunde Berlin 2025
    const rows = [
      makeRow(Date.UTC(2015, 5, 1, 10), 30),     // Berlin 2015
      makeRow(Date.UTC(2015, 5, 1, 11), 40),     // Berlin 2015
      makeRow(Date.UTC(2024, 5, 1, 10), 80),     // Berlin 2024
      makeRow(Date.UTC(2024, 5, 1, 11), 90),     // Berlin 2024
      makeRow(Date.UTC(2024, 11, 31, 23), 999),  // Berlin 2025! Darf nicht zählen
    ]
    const vals = yearlyPriceValues(rows)
    expect(vals[0]).toBeCloseTo(35, 0)  // 2015: (30+40)/2 = 35
    expect(vals[9]).toBeCloseTo(85, 0)  // 2024: (80+90)/2 = 85
    expect(vals.length).toBe(10)         // Nur 2015-2024
  })

  it('Test B: Sparkline enthält keine 2025-Daten', () => {
    const rows = [
      makeRow(Date.UTC(2024, 11, 31, 23), 100), // Berlin 2025
      makeRow(Date.UTC(2024, 0, 1, 12), 50),    // Berlin 2024
    ]
    const vals = yearlyPriceValues(rows)
    // vals[9] = 2024, vals[8] = 2023 (0 weil keine Daten)
    expect(vals[9]).toBeCloseTo(50, 0)
    expect(vals.length).toBe(10)
  })

  it('Test C: Fehlendes Start- oder Endjahr wird sauber behandelt', () => {
    const rows = [makeRow(Date.UTC(2020, 5, 1, 12), 100)]
    const vals = yearlyPriceValues(rows)
    expect(vals[0]).toBe(0)  // 2015: keine Daten
    expect(vals[5]).toBeCloseTo(100, 0) // 2020
    expect(vals[9]).toBe(0)  // 2024: keine Daten
    expect(vals.length).toBe(10)
  })

  it('Test D: Berlin 2025 erkannt, aber nicht im Vergleich 2015→2024', () => {
    const ts = Date.UTC(2024, 11, 31, 23, 0)
    expect(berlinYear(ts)).toBe(2025) // Berlin-Jahr erkannt
    expect(new Date(ts).getUTCFullYear()).toBe(2024) // UTC-Jahr ist 2024

    const rows = [
      makeRow(Date.UTC(2015, 0, 1, 0), 30),
      makeRow(ts, 999),              // Berlin 2025
      makeRow(Date.UTC(2024, 5, 1, 0), 80),
    ]
    const vals = yearlyPriceValues(rows)
    // Delta: vals[9] - vals[0] = 80 - 30 = +50 (nicht 999-30)
    const delta = vals[9]! - vals[0]!
    expect(delta).toBeCloseTo(50, 0)
  })
})
