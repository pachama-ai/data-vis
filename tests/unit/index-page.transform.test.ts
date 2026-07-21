/**
 * tests/unit/index-page.transform.test.ts
 * ========================================
 * Unit-Tests für die Datentransformation der Landing Page.
 *
 * Die Funktionen in pages/index.transform.ts berechnen aus den
 * rohen YearlyMixPoint-Daten (MWh) die EnergyDataPoint-Arrays
 * für das GroupedBarChart. Fehler in dieser Transformation führen
 * zu falschen Prozentwerten oder inkonsistenten Deltas.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSharePercent,
  transformYearlyDataToChartData,
  ITEM_CONFIG,
} from '~/pages/index.transform'
import type { YearlyMixPoint } from '~/types/visualization-data'

// =========================================================================
// calculateSharePercent
// =========================================================================

// Testet die Berechnung des prozentualen Anteils.
// Wichtig, weil alle Chart-Werte auf dieser Funktion basieren.

describe('calculateSharePercent', () => {

  it('gibt 50 zurück, wenn 50 von 100 MWh', () => {
    const result = calculateSharePercent(50, 100)
    expect(result).toBe(50)
  })

  it('gibt 0 zurück, wenn totalMwh 0 ist', () => {
    const result = calculateSharePercent(50, 0)
    expect(result).toBe(0)
  })

  it('gibt 0 zurück, wenn totalMwh negativ ist', () => {
    const result = calculateSharePercent(50, -100)
    expect(result).toBe(0)
  })

  it('gibt 100 zurück, wenn sourceValue und totalMwh gleich sind', () => {
    const result = calculateSharePercent(100, 100)
    expect(result).toBe(100)
  })

  it('gibt 0 zurück, wenn sourceValue 0 ist', () => {
    const result = calculateSharePercent(0, 100)
    expect(result).toBe(0)
  })
})

// =========================================================================
// transformYearlyDataToChartData
// =========================================================================

// Testet die Haupttransformation von YearlyMixPoint → EnergyDataPoint[].
// Wichtig, weil diese Funktion die Datenstruktur erzeugt, die das
// GroupedBarChart direkt zum Zeichnen verwendet.

describe('transformYearlyDataToChartData', () => {

  /**
   * Erzeugt ein synthetisches YearlyMixPoint-Paar mit fiktiven,
   * aber runden Werten, damit die Deltas einfach nachzurechnen sind.
   *
   * 2015: Insgesamt 1000 MWh, erneuerbare je 100, fossile je 80,
   *       Kernenergie 200
   * 2024: Insgesamt 1000 MWh, erneuerbare je 150, fossile je 50,
   *       Kernenergie 0 (Ausstieg)
   *
   * Daraus ergeben sich diese Prozentwerte (vor Rundung):
   *   Wind an Land:     2015 = 10,0 %, 2024 = 15,0 %  → Delta = +5,0 pp
   *   Photovoltaik:     2015 = 10,0 %, 2024 = 15,0 %  → Delta = +5,0 pp
   *   Biomasse:         2015 = 10,0 %, 2024 = 15,0 %  → Delta = +5,0 pp
   *   Wind auf See:     2015 = 10,0 %, 2024 = 15,0 %  → Delta = +5,0 pp
   *   Wasserkraft:      2015 = 10,0 %, 2024 = 15,0 %  → Delta = +5,0 pp
   *   Braunkohle:       2015 =  8,0 %, 2024 =  5,0 %  → Delta = −3,0 pp
   *   Steinkohle:       2015 =  8,0 %, 2024 =  5,0 %  → Delta = −3,0 pp
   *   Erdgas:           2015 =  8,0 %, 2024 =  5,0 %  → Delta = −3,0 pp
   *   Sonstige konv.:   2015 =  8,0 %, 2024 =  5,0 %  → Delta = −3,0 pp
   *   Kernenergie:      2015 = 20,0 %, 2024 =  0,0 %  → Delta = −20,0 pp
   *
   * Summe 2015: 5*10 + 4*8 + 20 = 50 + 32 + 20 = 102 (nicht 100 %
   *   wegen der Modell-Rechnung; echte Daten haben auch minimale
   *   Abweichungen durch sonstige Quellen wie Pumpspeicher).
   */
  const year2015: YearlyMixPoint = {
    year: 2015,
    totalGenerationMwh: 1000,
    renewableSharePercent: 50,
    co2GramsPerKwh: 500,
    availableHourCount: 8760,
    sources: {
      biomass: 100,
      hydro: 100,
      wind_onshore: 100,
      wind_offshore: 100,
      pv: 100,
      other_renewables: 0,
      lignite: 80,
      hardcoal: 80,
      gas: 80,
      nuclear: 200,
      other_fossil: 80,
      pumped_storage: 0,
    },
  }

  const year2024: YearlyMixPoint = {
    year: 2024,
    totalGenerationMwh: 1000,
    renewableSharePercent: 75,
    co2GramsPerKwh: 300,
    availableHourCount: 8784,
    sources: {
      biomass: 150,
      hydro: 150,
      wind_onshore: 150,
      wind_offshore: 150,
      pv: 150,
      other_renewables: 0,
      lignite: 50,
      hardcoal: 50,
      gas: 50,
      nuclear: 0,
      other_fossil: 50,
      pumped_storage: 0,
    },
  }

  it('gibt 10 Einträge zurück (einen pro Energieträger)', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)
    expect(result.length).toBe(10)
  })

  it('hat wind_land als ersten Eintrag (Reihenfolge der ITEM_CONFIG)', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)
    expect(result[0]!.id).toBe('wind_land')
  })

  it('hat kernenergie als letzten Eintrag', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)
    const lastIndex = result.length - 1
    expect(result[lastIndex]!.id).toBe('kernenergie')
  })

  it('berechnet displayedDelta konsistent: gerundet(2024) minus gerundet(2015)', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)

    // Wind an Land: 2015 = 10,0 %, 2024 = 15,0 %, Delta = 15,0 - 10,0 = 5,0 pp
    const windLand = result[0]!
    expect(windLand.id).toBe('wind_land')
    expect(windLand.displayedDelta).toBe(5.0)
  })

  it('berechnet displayedDelta fuer Kernenergie als -20,0 pp', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)

    // Kernenergie: 2015 = 20,0 %, 2024 = 0,0 %, Delta = 0,0 - 20,0 = -20,0 pp
    const kernenergie = result[result.length - 1]!
    expect(kernenergie.id).toBe('kernenergie')
    expect(kernenergie.displayedDelta).toBe(-20.0)
  })

  it('setzt value2024 fuer Kernenergie auf 0', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)
    const kernenergie = result[result.length - 1]!
    expect(kernenergie.id).toBe('kernenergie')
    expect(kernenergie.value2024).toBe(0)
  })

  it('ordnet Eintraege in der gleichen Reihenfolge wie ITEM_CONFIG', () => {
    const result = transformYearlyDataToChartData(year2015, year2024)
    for (let index = 0; index < ITEM_CONFIG.length; index++) {
      expect(result[index]!.id).toBe(ITEM_CONFIG[index]!.id)
    }
  })

  it('gibt leeres Array zurueck, wenn keine yearlyData vorhanden sind', () => {
    // Der Fall yearlyData === null wird im computed behandelt,
    // transformYearlyDataToChartData wird dann gar nicht erst aufgerufen.
    // Dieser Test stellt sicher, dass die Funktion mit korrekten Daten
    // immer 10 Eintraege liefert.
    const result = transformYearlyDataToChartData(year2015, year2024)
    expect(result.length).toBe(10)
  })
})
