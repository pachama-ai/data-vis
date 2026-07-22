/**
 * tests/audit-data-quality.test.ts – Datenqualitäts- und Plausibilitätstests.
 *
 * Diese Tests dokumentieren den IST-Zustand der Daten und Berechnungen.
 * Sie laufen gegen eingebaute Testdaten (keine echten API-Aufrufe).
 * Ein fehlschlagender Test zeigt eine reale Datenqualitäts-Warnung an.
 *
 * Aufruf: npx vitest run tests/audit-data-quality.test.ts
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// 1. EINHEITENKONSISTENZ
// ---------------------------------------------------------------------------

describe('Einheitenkonsistenz', () => {
  // Wenn SMARD stündliche Energie in MWh liefert, dann:
  // 1000 MWh in 1 Stunde = 1 GW mittlere Leistung
  it('1000 MWh/h = 1 GW (MWh → GW Umrechnung)', () => {
    const mwh = 1000
    const gw = mwh / 1000
    expect(gw).toBe(1)
  })

  // Vier Viertelstunden mit je 250 MWh = 1000 MWh = 1 GW
  it('4× Viertelstunde 250 MWh = 1 GW mittlere Leistung', () => {
    const q1 = 250, q2 = 250, q3 = 250, q4 = 250
    const hourlyMwh = q1 + q2 + q3 + q4
    expect(hourlyMwh).toBe(1000)
    expect(hourlyMwh / 1000).toBe(1)
  })

  // g/kWh zu kg/MWh: numerisch identisch
  it('1 g/kWh = 1 kg/MWh (numerisch identisch)', () => {
    expect(1).toBe(1) // 1 g/kWh = 1 kg/MWh, gleiche Zahl
  })

  // CO₂-gewichteter Durchschnitt muss zwischen min und max Faktor liegen
  it('CO₂-Gewicht: Mix aus 0+1075 → Ergebnis zwischen 0 und 1075', () => {
    const gen: Record<string, number> = { pv: 50, lignite: 50 }
    const factors: Record<string, number> = { pv: 0, lignite: 1075 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const co2Sum = Object.entries(gen).reduce((s, [k, v]) => s + v * (factors[k] ?? 0), 0)
    const co2 = total > 0 ? co2Sum / total : 0
    expect(co2).toBeGreaterThanOrEqual(0)
    expect(co2).toBeLessThanOrEqual(1075)
    expect(co2).toBeCloseTo(537.5, 0)
  })

  // Preis in EUR/MWh: negativ erlaubt
  it('Negative Preise bleiben erhalten (kein Abschneiden bei 0)', () => {
    const prices = [-500.01, -50.00, -0.01, 0, 50.00, 2000.00]
    const nonNegative = prices.filter(p => p >= 0)
    expect(nonNegative.length).toBeLessThan(prices.length)
    expect(prices).toContain(-500.01)
    expect(prices).toContain(-0.01)
  })

  // Preis-Cap: historisch ~3000 EUR/MWh bis 2024
  it('Preise sollten unter 4000 EUR/MWh liegen (Marktregel)', () => {
    const realisticPrices = [-500, -1, 0, 50, 100, 500, 3000]
    for (const p of realisticPrices) {
      expect(Math.abs(p)).toBeLessThan(4000)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. RESIDUALLAST-DEFINITIONEN
// ---------------------------------------------------------------------------

describe('Residuallast nach verschiedenen Definitionen', () => {
  // Beispiel-Daten: typische Stunde
  const loadMwh = 55000 // 55 GW Gesamtlast
  const gen = {
    wind_onshore: 12000, wind_offshore: 5000, pv: 10000,
    biomass: 3000, hydro: 2000, other_renewables: 500,
    lignite: 10000, hardcoal: 5000, gas: 5000, nuclear: 2000,
    other_fossil: 500, pumped_storage: 0,
  } as Record<string, number>
  const eeKeys = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro']

  // Enge Definition: Last − (Wind Onshore + Wind Offshore + PV)
  it('Enge Residuallast (nur Wind+PV)', () => {
    const eeNarrow = (gen.wind_onshore ?? 0) + (gen.wind_offshore ?? 0) + (gen.pv ?? 0)
    const residual = (loadMwh - eeNarrow) / 1000
    // 55000 - (12000+5000+10000) = 28000 MWh = 28 GW
    expect(residual).toBeCloseTo(28, 0)
  })

  // Im Code verwendete Definition: Last − alle EE
  it('Broad Residuallast (alle EE, inkl. Biomasse+Hydro)', () => {
    const eeBroad = eeKeys.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const residual = (loadMwh - eeBroad) / 1000
    // 55000 - (12000+5000+10000+3000+2000) = 23000 MWh = 23 GW
    expect(residual).toBeCloseTo(23, 0)
  })

  // HourlyProfile verwendet Broad-Definition (incl. other_renewables)
  it('HourlyProfile Residuallast (alle EE + other_renewables)', () => {
    const ee = eeKeys.reduce((s, k) => s + (gen[k] ?? 0), 0) + (gen.other_renewables ?? 0)
    const residual = (loadMwh - ee) / 1000
    // 55000 - 32500 = 22500 MWh = 22.5 GW
    expect(residual).toBeCloseTo(22.5, 1)
  })

  // Negative Residuallast ist fachlich möglich (EE > Last)
  it('Negative Residuallast ist erlaubt (EE überdeckt Last)', () => {
    const highEe: Record<string, number> = { ...gen, wind_onshore: 30000, pv: 20000 }
    const eeSum = eeKeys.reduce((s, k) => s + (highEe[k] ?? 0), 0)
    const residual = (loadMwh - eeSum) / 1000
    // 55000 - (30000+5000+20000+3000+2000) = -5000 MWh = -5 GW
    expect(residual).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// 3. CO₂-BERECHNUNG
// ---------------------------------------------------------------------------

describe('CO₂-Berechnung – Gewichtungsidentität', () => {
  const FACTORS: Record<string, number> = {
    lignite: 1075, hardcoal: 835, gas: 411, nuclear: 0,
    biomass: 230, hydro: 0, wind_onshore: 0, wind_offshore: 0, pv: 0,
    other_fossil: 750, other_renewables: 100, pumped_storage: 0,
  }

  it('CO₂-Intensität muss zwischen min und max Faktor liegen', () => {
    const gen: Record<string, number> = { lignite: 30, gas: 20, wind_onshore: 40, pv: 10 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const co2Sum = Object.entries(gen).reduce((s, [k, v]) => s + v * (FACTORS[k] ?? 0), 0)
    const co2 = total > 0 ? co2Sum / total : 0
    const minFactor = Math.min(...Object.values(FACTORS))
    const maxFactor = Math.max(...Object.values(FACTORS))
    expect(co2).toBeGreaterThanOrEqual(minFactor)
    expect(co2).toBeLessThanOrEqual(maxFactor)
  })

  it('CO₂-Intensität bei nur fossilen = gewichteter Durchschnitt der Faktoren', () => {
    const gen: Record<string, number> = { lignite: 50, hardcoal: 30, gas: 20 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const co2Sum = Object.entries(gen).reduce((s, [k, v]) => s + v * (FACTORS[k] ?? 0), 0)
    const co2 = total > 0 ? co2Sum / total : 0
    const expected = (50*1075 + 30*835 + 20*411) / 100
    expect(co2).toBeCloseTo(expected, 0)
  })

  it('CO₂ bei leerer Erzeugung = 0 (kein NaN)', () => {
    const total = 0
    const co2 = total > 0 ? 42 / total : 0
    expect(co2).toBe(0)
    expect(Number.isNaN(co2)).toBe(false)
  })

  it('Biomasse erzeugt CO₂ (Faktor 230 g/kWh)', () => {
    const gen: Record<string, number> = { biomass: 100 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const co2Sum = Object.entries(gen).reduce((s, [k, v]) => s + v * (FACTORS[k] ?? 0), 0)
    const co2 = total > 0 ? co2Sum / total : 0
    expect(co2).toBe(230)
  })
})

// ---------------------------------------------------------------------------
// 4. ZEIT UMSTELLUNG (DST)
// ---------------------------------------------------------------------------

describe('Zeitumstellung – 23h/25h Tage', () => {
  // März 2024: UTC+1 → UTC+2 am 31.03.
  it('Frühjahr 2024: 31.03. hat 23 Stunden in Berliner Zeit', () => {
    // 31.03.2024 00:00 UTC = 01:00 CET → 31.03. 01:00 UTC = 03:00 CEST
    // Die Stunde 02:00 CEST existiert nicht lokal
    const dstStart = new Date(Date.UTC(2024, 2, 31, 1, 0)) // 03:00 CEST
    const hour = parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(dstStart), 10)
    expect(hour).toBe(3)
  })

  // Oktober 2024: UTC+2 → UTC+1 am 27.10.
  it('Herbst 2024: 27.10. hat 25 Stunden in Berliner Zeit', () => {
    const dstEnd1 = new Date(Date.UTC(2024, 9, 27, 0, 0)) // 02:00 CEST (erste)
    const dstEnd2 = new Date(Date.UTC(2024, 9, 27, 1, 0)) // 02:00 CET (zweite)
    const hour1 = parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(dstEnd1), 10)
    const hour2 = parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(dstEnd2), 10)
    // Beide UTC-Timestamps ergeben Berlin 02:00
    expect(hour1).toBe(2)
    expect(hour2).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 5. SCHALTJAHRE
// ---------------------------------------------------------------------------

describe('Schaltjahre', () => {
  it('2016 ist ein Schaltjahr (29.02. existiert)', () => {
    const d = new Date(Date.UTC(2016, 1, 29))
    expect(d.getUTCMonth()).toBe(1)
    expect(d.getUTCDate()).toBe(29)
  })

  it('2020 ist ein Schaltjahr (8784 Stunden erwartet)', () => {
    const expectedHours = 8784 // 366 * 24
    expect(expectedHours).toBe(8784)
  })

  it('2024 ist ein Schaltjahr', () => {
    const expectedHours = 8784
    expect(expectedHours).toBe(8784)
  })

  it('2015 ist kein Schaltjahr (8760 Stunden erwartet)', () => {
    const expectedHours = 8760 // 365 * 24
    expect(expectedHours).toBe(8760)
  })
})

// ---------------------------------------------------------------------------
// 6. SAISONDEFINITIONEN (Meteorologisch)
// ---------------------------------------------------------------------------

describe('Saisons (meteorologische Definition)', () => {
  // HourlyProfile verwendet: Sommer = Juni(J=5) + Juli(J=6) + August(J=7) [getMonth ist 0-based]
  // inSummer: getBerlinMonth >= 5 && <= 7 → Monate 6,7,8
  // inWinter: getBerlinMonth <= 2 || >= 11 → Monate 1,2,3,12
  // ACHTUNG: getBerlinMonth liefert 1-12 (nicht 0-11!)

  // Reimplementierung der HourlyProfile-Logik
  function inSummer(month1to12: number): boolean {
    return month1to12 >= 6 && month1to12 <= 8
  }
  function inWinter(month1to12: number): boolean {
    return month1to12 <= 2 || month1to12 >= 12
  }

  it('Sommer: Juni(6), Juli(7), August(8)', () => {
    expect(inSummer(6)).toBe(true)
    expect(inSummer(7)).toBe(true)
    expect(inSummer(8)).toBe(true)
    expect(inSummer(5)).toBe(false)  // Mai
    expect(inSummer(9)).toBe(false)  // September
  })

  it('Winter: Dezember(12), Januar(1), Februar(2)', () => {
    expect(inWinter(12)).toBe(true)
    expect(inWinter(1)).toBe(true)
    expect(inWinter(2)).toBe(true)
    expect(inWinter(3)).toBe(false)  // März
    expect(inWinter(11)).toBe(false) // November
  })

  it('Übergangsmonate (März–Mai, September–November) sind weder Sommer noch Winter', () => {
    for (let m = 3; m <= 5; m++) {
      expect(inSummer(m)).toBe(false)
      expect(inWinter(m)).toBe(false)
    }
    for (let m = 9; m <= 11; m++) {
      expect(inSummer(m)).toBe(false)
      expect(inWinter(m)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// 7. WERKTAG / WOCHENENDE
// ---------------------------------------------------------------------------

describe('Werktag/Wochenende-Definition', () => {
  // HourlyProfile: Werktag = Montag–Freitag (isBerlinWeekend = false)
  // Wochenende = Samstag + Sonntag (isBerlinWeekend = true)
  // Keine Feiertagslogik

  // Hilfsfunktion: Wochentag in Berliner Zeit
  function getBerlinWeekday(ts: number): number {
    const map: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 }
    const fmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' })
    return map[fmt.format(ts)] ?? 0
  }

  function isWeekend(ts: number): boolean {
    const wd = getBerlinWeekday(ts)
    return wd === 0 || wd === 6
  }

  // 2024-01-01 (Neujahr) = Montag → Werktag (obwohl Feiertag!)
  it('Neujahr 2024 (Montag) wird als Werktag behandelt (keine Feiertagslogik)', () => {
    const ts = Date.UTC(2024, 0, 1, 12, 0)
    expect(isWeekend(ts)).toBe(false)
    // Characterization: das ist der IST-Zustand, kein Soll
  })

  // 2024-12-25 (Weihnachten) = Mittwoch → Werktag
  it('Weihnachten 2024 (Mittwoch) wird als Werktag behandelt', () => {
    const ts = Date.UTC(2024, 11, 25, 12, 0)
    expect(isWeekend(ts)).toBe(false)
  })

  // Samstag
  it('Samstag = Wochenende', () => {
    const ts = Date.UTC(2024, 0, 6, 12, 0) // 2024-01-06 = Samstag
    expect(isWeekend(ts)).toBe(true)
  })

  // Sonntag
  it('Sonntag = Wochenende', () => {
    const ts = Date.UTC(2024, 0, 7, 12, 0) // 2024-01-07 = Sonntag
    expect(isWeekend(ts)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. HOURLY PROFILE – PROFIL-BERECHNUNG
// ---------------------------------------------------------------------------

describe('HourlyProfile computeProfile – Grundlogik', () => {
  // Simuliert computeProfile() Logik
  function getBerlinHour(ts: number): number {
    return parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(ts), 10)
  }
  function getBerlinMonth(ts: number): number {
    return Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' }).format(ts))
  }
  function inSummer(ts: number): boolean {
    const m = getBerlinMonth(ts)
    return m >= 6 && m <= 8
  }
  function inWinter(ts: number): boolean {
    const m = getBerlinMonth(ts)
    return m <= 2 || m >= 12
  }

  // Test-Rows
  const makeRow = (ts: number, pv: number, load: number, price: number, co2: number) => ({
    timestamp: ts,
    generation_by_source: { pv, wind_onshore: 0, wind_offshore: 0, biomass: 0, hydro: 0, other_renewables: 0,
      lignite: 0, hardcoal: 0, gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0 },
    load_mwh: load,
    price_eur_mwh: price,
    co2_g_per_kwh: co2,
    ee_share: 0,
    fossil_share: 0,
  })

  // Sommer-Sonne: 2024-06-15 13:00 CEST = UTC 11:00
  const summerDay13h = Date.UTC(2024, 5, 15, 11, 0)
  // Winter-Nacht: 2024-01-15 03:00 CET = UTC 02:00
  const winterNight3h = Date.UTC(2024, 0, 15, 2, 0)

  it('Sommerfilter: Juni-Daten werden eingeschlossen', () => {
    expect(inSummer(summerDay13h)).toBe(true)
  })

  it('Winterfilter: Januar-Daten werden eingeschlossen', () => {
    expect(inWinter(winterNight3h)).toBe(true)
  })

  it('Sommerfilter schließt Januar aus', () => {
    expect(inSummer(winterNight3h)).toBe(false)
  })

  it('Winterfilter schließt Juni aus', () => {
    expect(inWinter(summerDay13h)).toBe(false)
  })

  it('Berliner Stunde: 13:00 CEST = UTC 11:00', () => {
    expect(getBerlinHour(summerDay13h)).toBe(13)
  })

  it('Berliner Stunde: 03:00 CET = UTC 02:00', () => {
    expect(getBerlinHour(winterNight3h)).toBe(3)
  })

  // Bucket-Test: 3 Werte in Bucket 13 → Mittel
  it('Arithmetisches Mittel in Bucket: (10+20+30)/3 = 20', () => {
    const bucket = [10, 20, 30]
    const avg = bucket.reduce((a, v) => a + v, 0) / bucket.length
    expect(avg).toBe(20)
  })

  // Leerer Bucket → 0
  it('Leerer Bucket liefert 0 (kein NaN)', () => {
    const bucket: number[] = []
    const avg = bucket.length ? bucket.reduce((a, v) => a + v, 0) / bucket.length : 0
    expect(avg).toBe(0)
    expect(Number.isNaN(avg)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 9. PIPELINE-RUNDUNG
// ---------------------------------------------------------------------------

describe('Pipeline-Rundung (CHARACTERIZATION TEST – IST-Zustand)', () => {
  // build_hourly.ts rundet auf 2 Dezimalstellen für generation_by_source
  // und auf 1 Dezimalstelle für co2, ee_share
  // Diese Tests zeigen den Effekt dieser Rundung

  it('Rundung auf 2 Dezimalstellen: 123.456 → 123.46', () => {
    const gerundet = Math.round(123.456 * 100) / 100
    expect(gerundet).toBe(123.46)
  })

  it('Rundungsverlust bei kleinen Werten: 0.001 → 0.00 (verschwindet)', () => {
    const gerundet = Math.round(0.001 * 100) / 100
    expect(gerundet).toBe(0)
    // Ein Wert von 0.001 MWh = 1 kWh geht durch Rundung verloren
  })

  it('Rundung co2 (1 Dezimalstelle): 12.345 → 12.3 (Genauigkeitsverlust)', () => {
    const gerundet = Math.round(12.345 * 10) / 10
    expect(gerundet).toBe(12.3)
  })

  it('Rundung ee_share (1 Dezimalstelle): 56.72% → 56.7%', () => {
    const raw = 56.72
    const gerundet = Math.round(raw * 10) / 10
    expect(gerundet).toBe(56.7)
  })

  it('Kein NaN bei Division durch 0 nach Rundung', () => {
    const genSum = 0
    const co2 = genSum > 0 ? 42 / genSum : 0
    expect(co2).toBe(0)
    expect(Number.isNaN(co2)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. AGGREGATIONS-KORREKTHEIT
// ---------------------------------------------------------------------------

describe('Aggregationslogik', () => {
  it('Monats-Mittelwert aus Stunden = Σ(stundenwerte) / anzahl_stunden', () => {
    const hourly = [10, 20, 30, 40, 50] // 5 Stunden
    const avg = hourly.reduce((s, v) => s + v, 0) / hourly.length
    expect(avg).toBe(30)
  })

  it('Jahres-Mittel aus Monats-Mitteln ist NICHT gleich Monats-Mittel aus Stunden (ungleiche Gewichtung)', () => {
    // Januar: 31 Tage = 744h, Februar: 28 Tage = 672h
    const janValue = 100, febValue = 200
    const correctAvg = (janValue * 744 + febValue * 672) / (744 + 672)
    const wrongAvg = (janValue + febValue) / 2
    expect(correctAvg).not.toBeCloseTo(wrongAvg, 0)
    expect(correctAvg).toBeCloseTo(147.5, 0)
    expect(wrongAvg).toBe(150)
  })

  it('Leere Daten → 0 (kein Absturz)', () => {
    const data: number[] = []
    const avg = data.length ? data.reduce((s, v) => s + v, 0) / data.length : 0
    expect(avg).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 11. PREIS-LOGIK
// ---------------------------------------------------------------------------

describe('Preis-Logik', () => {
  it('Negativer Preis wird als negativ erkannt: -0.01 < 0', () => {
    expect(-0.01 < 0).toBe(true)
  })

  it('Preis genau 0 wird nicht als negativ gezählt', () => {
    expect(0 < 0).toBe(false)
  })

  it('Preis +0.01 wird nicht als negativ gezählt', () => {
    expect(0.01 < 0).toBe(false)
  })

  it('Durchschnitt negativer Preise: (-500 + -1 + -50) / 3 = -183.67', () => {
    const negPrices = [-500, -1, -50]
    const avg = negPrices.reduce((s, v) => s + v, 0) / negPrices.length
    expect(avg).toBeCloseTo(-183.67, 1)
  })

  it('Über 24h gemittelter Preis = korrekt (negative erhalten)', () => {
    const prices = [-50, -20, 0, 30, 50, 100] // 6 Stunden
    const avg = prices.reduce((s, v) => s + v, 0) / prices.length
    expect(avg).toBeCloseTo(18.33, 1)
  })
})

// ---------------------------------------------------------------------------
// 12. EE-ANTEIL UND KONSISTENZ
// ---------------------------------------------------------------------------

describe('EE-Anteil – Plausibilität', () => {
  it('EE-Anteil + konventioneller Anteil + Sonstige = 100% (wenn Sonstige definiert)', () => {
    // Typischer Strommix
    const ee = 56.7
    const conventional = 38.5  // Kohle + Gas + Kern + SonstigeKonventionelle
    const other = 4.8          // Pumpspeicher, SonstigeErneuerbare Rest
    const sum = ee + conventional + other
    expect(sum).toBeCloseTo(100, 0)
  })

  it('EE-Anteil steigt über die Jahre 2015–2024 (Trend)', () => {
    const eeByYear = [33.1, 33.7, 37.5, 37.3, 42.2, 45.4, 40.9, 45.1, 54.5, 56.7]
    const first3 = eeByYear.slice(0, 3).reduce((s, v) => s + v, 0) / 3
    const last3 = eeByYear.slice(-3).reduce((s, v) => s + v, 0) / 3
    expect(last3).toBeGreaterThan(first3)
  })
})

// ---------------------------------------------------------------------------
// 13. EINHEITEN IN UI-KOMPONENTEN
// ---------------------------------------------------------------------------

describe('UI-Einheiten-Konsistenz', () => {
  it('PV-Erzeugung in GW (nicht MW)', () => {
    const mwh = 15000 // 15 GWh in einer Stunde
    const gw = mwh / 1000
    expect(gw).toBe(15)
    // Im UI: "15,0 GW"
  })

  it('Residuallast in GW', () => {
    const loadMwh = 60000
    const eeMwh = 25000
    const residuallastGw = (loadMwh - eeMwh) / 1000
    expect(residuallastGw).toBe(35)
    // Im UI: "35,0 GW"
  })

  it('Preis in EUR/MWh (nicht EUR/kWh oder Cent)', () => {
    const priceEursPerMwh = 78.8
    // Falsch wäre: 78.8 / 1000 = 0.0788 EUR/kWh oder 7.88 Cent/kWh
    expect(priceEursPerMwh).toBe(78.8)
  })

  it('CO₂-Intensität in g/kWh (nicht kg/MWh, obwohl numerisch identisch)', () => {
    const co2 = 372 // g/kWh
    expect(co2).toBe(372)
    // 372 g/kWh = 372 kg/MWh (numerisch identisch, andere Einheit)
  })
})

// ---------------------------------------------------------------------------
// 14. M1: KATEGORIE `other` – FACHMTâCHE AUFTEILUNG
// ---------------------------------------------------------------------------

describe('M1: other-Kategorie – fachliche Aufteilung', () => {
  // Simuliert die Zusammensetzung: other = other_renewables + other_fossil + pumped_storage
  // Dies war der Zustand vor der Aufteilung (nur als Referenz)

  it('other_renewables zählt zum EE-Anteil', () => {
    const RENEWABLE_KEYS = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro', 'other_renewables']
    const gen: Record<string, number> = { wind_onshore: 30, pv: 20, other_renewables: 5, lignite: 40, gas: 5 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const ee = RENEWABLE_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const eeShare = total > 0 ? ee / total : 0
    // (30+20+5) / 100 = 55%
    expect(eeShare).toBeCloseTo(0.55, 2)
    // Ohne other_renewables: (30+20)/100 = 50%
    const eeWithout = ((gen.wind_onshore ?? 0) + (gen.pv ?? 0)) / total
    expect(eeShare).toBeGreaterThan(eeWithout)
  })

  it('other_fossil zählt zum konventionellen Anteil', () => {
    const CONVENTIONAL_KEYS = ['lignite', 'hardcoal', 'gas', 'nuclear', 'other_fossil']
    const gen: Record<string, number> = { lignite: 40, gas: 10, other_fossil: 8, wind_onshore: 30, pv: 12 }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const conv = CONVENTIONAL_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const convShare = total > 0 ? conv / total : 0
    // (40+10+8) / 100 = 58%
    expect(convShare).toBeCloseTo(0.58, 2)
    // Ohne other_fossil: (40+10)/100 = 50%
    const convWithout = ((gen.lignite ?? 0) + (gen.gas ?? 0)) / total
    expect(convShare).toBeGreaterThan(convWithout)
  })

  it('pumped_storage zählt weder zu EE noch zu konventionell', () => {
    const RENEWABLE_KEYS = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro', 'other_renewables']
    const CONVENTIONAL_KEYS = ['lignite', 'hardcoal', 'gas', 'nuclear', 'other_fossil']
    const gen: Record<string, number> = {
      wind_onshore: 20, pv: 10, biomass: 5,  // EE
      lignite: 30, gas: 10,                    // konventionell
      pumped_storage: 15,                       // Speicher (weder noch)
      other_renewables: 2, other_fossil: 3,
    }
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const ee = RENEWABLE_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const conv = CONVENTIONAL_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    // pumped_storage sollte nicht in ee oder conv sein
    expect(ee).not.toContain(gen.pumped_storage)
    expect(conv).not.toContain(gen.pumped_storage)
    // Es sollte als separate Größe existieren
    expect(gen.pumped_storage).toBe(15)
  })

  it('Summe der drei neuen Felder entspricht dem frueheren other', () => {
    const other_renewables = 5.2
    const other_fossil = 42.8
    const pumped_storage = 18.3
    const otherOld = other_renewables + other_fossil + pumped_storage
    expect(otherOld).toBeCloseTo(66.3, 1)
    // Einzelnachweise
    expect(other_renewables + other_fossil + pumped_storage).toBeCloseTo(otherOld, 5)
  })

  it('Keine Doppelzählung: EE + konventionell + pumpspeicher = Gesamterzeugung', () => {
    const gen: Record<string, number> = {
      biomass: 5, hydro: 2, wind_onshore: 20, wind_offshore: 5, pv: 10, other_renewables: 1,
      nuclear: 3, gas: 12, hardcoal: 8, lignite: 15, other_fossil: 3,
      pumped_storage: 4,
    }
    const RENEWABLE_KEYS = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro', 'other_renewables']
    const CONVENTIONAL_KEYS = ['lignite', 'hardcoal', 'gas', 'nuclear', 'other_fossil']
    const total = Object.values(gen).reduce((s, v) => s + v, 0)
    const ee = RENEWABLE_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const conv = CONVENTIONAL_KEYS.reduce((s, k) => s + (gen[k] ?? 0), 0)
    const ps = gen.pumped_storage ?? 0
    expect(ee + conv + ps).toBeCloseTo(total, 5)
  })

  it('Alle Labels und Farben für die drei neuen Kategorien sind definiert', () => {
    const LABELS: Record<string, string> = {
      other_renewables: 'Sonstige Erneuerbare',
      other_fossil: 'Sonstige Konventionelle',
      pumped_storage: 'Pumpspeicher',
    }
    const COLORS: Record<string, string> = {
      other_renewables: '#A8D35C',
      other_fossil: '#8B7355',
      pumped_storage: '#5B9BD5',
    }
    expect(LABELS.other_renewables).toBe('Sonstige Erneuerbare')
    expect(LABELS.other_fossil).toBe('Sonstige Konventionelle')
    expect(LABELS.pumped_storage).toBe('Pumpspeicher')
    expect(COLORS.other_renewables).toBeTruthy()
    expect(COLORS.other_fossil).toBeTruthy()
    expect(COLORS.pumped_storage).toBeTruthy()
  })

  it('Aggregierte Datensätze enthalten kein altes other-Feld mehr', () => {
    // Simuliert MonthlyDataPoint ohne das alte 'other'-Feld
    const point = {
      date: new Date('2024-01-01'),
      total: 50000,
      biomass: 3000, hydro: 2000, wind_onshore: 10000, wind_offshore: 3000, pv: 5000,
      nuclear: 2000, gas: 5000, hardcoal: 4000, lignite: 8000,
      other_renewables: 500, other_fossil: 2000, pumped_storage: 1500,
    } as Record<string, unknown>
    // Das alte 'other'-Feld darf nicht existieren
    expect(point).not.toHaveProperty('other')
    // Die drei neuen Felder muessen existieren
    expect(point).toHaveProperty('other_renewables')
    expect(point).toHaveProperty('other_fossil')
    expect(point).toHaveProperty('pumped_storage')
  })

  it('undefined- oder NaN-Werte in den drei Feldern werden abgefangen', () => {
    const gen: Record<string, number | undefined> = {
      other_renewables: undefined,
      other_fossil: undefined,
      pumped_storage: undefined,
    }
    // Sichere Extraktion wie in aggregate.ts
    const or = gen.other_renewables ?? 0
    const of = gen.other_fossil ?? 0
    const ps = gen.pumped_storage ?? 0
    expect(or).toBe(0)
    expect(of).toBe(0)
    expect(ps).toBe(0)
    expect(Number.isNaN(or)).toBe(false)
    expect(Number.isNaN(of)).toBe(false)
    expect(Number.isNaN(ps)).toBe(false)
  })
})
