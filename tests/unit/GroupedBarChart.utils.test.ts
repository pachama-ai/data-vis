/**
 * tests/unit/GroupedBarChart.utils.test.ts
 * =========================================
 * Unit-Tests für die reinen Hilfsfunktionen aus
 * components/intro/GroupedBarChart.utils.ts.
 *
 * Wichtig, weil diese Funktionen die Daten formatieren und filtern,
 * die im Chart angezeigt werden. Fehler hier führen zu falschen
 * Anzeigewerten oder fehlenden Balken.
 */

import { describe, it, expect } from 'vitest'
import {
  roundToOneDecimal,
  formatDelta,
  formatPercent,
  getLabelData,
  getBarOpacity,
} from '~/components/home/groupedBarUtils'
import type { FlatBarItem, EnergyDataPoint } from '~/components/home/groupedBarUtils'

// =========================================================================
// roundToOneDecimal
// =========================================================================

// Testet die Rundungsfunktion für die Prozentanzeige.
// Wichtig, weil die Anzeigewerte im Chart auf einer Nachkommastelle
// basieren und konsistent gerundet sein müssen.

describe('roundToOneDecimal', () => {

  it('gibt 16.8 zurück, wenn der Eingabewert 16.75 ist', () => {
    const result = roundToOneDecimal(16.75)
    expect(result).toBe(16.8)
  })

  it('gibt 16.7 zurück, wenn der Eingabewert 16.74 ist', () => {
    const result = roundToOneDecimal(16.74)
    expect(result).toBe(16.7)
  })

  it('gibt 0 zurück, wenn der Eingabewert 0 ist', () => {
    const result = roundToOneDecimal(0)
    expect(result).toBe(0)
  })

  it('rundet negative Werte korrekt', () => {
    // JavaScripts Math.round rundet .5 gegen +∞, daher -16.75 → -16.7
    const result = roundToOneDecimal(-16.75)
    expect(result).toBe(-16.7)
  })

  it('rundet -16.74 zu -16.7', () => {
    const result = roundToOneDecimal(-16.74)
    expect(result).toBe(-16.7)
  })

  it('rundet -16.76 zu -16.8 (Wegrunden bei .6)', () => {
    const result = roundToOneDecimal(-16.76)
    expect(result).toBe(-16.8)
  })
})

// =========================================================================
// formatDelta
// =========================================================================

// Testet die Formatierung von Delta-Werten (Prozentpunkt-Differenz).
// Wichtig, weil die Delta-Labels rechts neben den Balken die Kernaussage
// des Charts tragen: wie hat sich jeder Energieträger verändert.

describe('formatDelta', () => {

  it('formatiert einen positiven Wert mit Plus und pp', () => {
    const result = formatDelta(11.8)
    expect(result).toBe('+11,8 pp')
  })

  it('formatiert einen negativen Wert mit typografischem Minus', () => {
    const result = formatDelta(-16.8)
    // \u2212 ist das typografische Minus (kein Bindestrich)
    expect(result).toBe('\u2212' + '16,8 pp')
  })

  it('formatiert Null als 0,0 pp', () => {
    const result = formatDelta(0)
    expect(result).toBe('0,0 pp')
  })

  it('formatiert einen kleinen positiven Wert', () => {
    const result = formatDelta(0.4)
    expect(result).toBe('+0,4 pp')
  })

  it('formatiert einen kleinen negativen Wert', () => {
    const result = formatDelta(-10.4)
    expect(result).toBe('\u2212' + '10,4 pp')
  })
})

// =========================================================================
// formatPercent
// =========================================================================

// Testet die Formatierung von Prozentwerten mit deutschem Komma.
// Wichtig, weil diese Labels direkt auf den Balken stehen.

describe('formatPercent', () => {

  it('formatiert einen Normalwert mit deutschem Komma', () => {
    const result = formatPercent(16.75)
    expect(result).toBe('16,8 %')
  })

  it('formatiert Null als 0,0 %', () => {
    const result = formatPercent(0)
    expect(result).toBe('0,0 %')
  })

  it('formatiert eine glatte Ganzzahl mit ,0', () => {
    const result = formatPercent(25)
    expect(result).toBe('25,0 %')
  })

  it('formatiert 100 als 100,0 %', () => {
    const result = formatPercent(100)
    expect(result).toBe('100,0 %')
  })
})

// =========================================================================
// getLabelData
// =========================================================================

// Testet den Filter, der Balken mit value === 0 von der Label-Anzeige
// ausschließt. Wichtig, weil sonst auf leeren Balken (z. B. Kernenergie
// 2024, value = 0) fälschlich "0,0 %" stehen würde.

describe('getLabelData', () => {

  /** Hilfskonstruktor für Test-FlatBarItems. */
  function createTestBar(
    id: string,
    value: number,
  ): FlatBarItem {
    const parent: EnergyDataPoint = {
      id: id.replace('-2015', '').replace('-2024', ''),
      label: 'Test',
      category: 'fossil',
      value2015: 0,
      value2024: 0,
      displayedDelta: 0,
    }
    return { id, parent, year: '2015', value }
  }

  it('behält Balken mit positivem Wert', () => {
    const bars: FlatBarItem[] = [
      createTestBar('a-2015', 10),
      createTestBar('a-2024', 20),
    ]
    const result = getLabelData(bars)
    expect(result.length).toBe(2)
  })

  it('entfernt Balken mit value 0', () => {
    const bars: FlatBarItem[] = [
      createTestBar('a-2015', 10),
      createTestBar('a-2024', 0),
    ]
    const result = getLabelData(bars)
    expect(result.length).toBe(1)
    expect(result[0]!.id).toBe('a-2015')
  })

  it('gibt leeres Array zurück, wenn alle Werte 0 sind', () => {
    const bars: FlatBarItem[] = [
      createTestBar('a-2015', 0),
      createTestBar('a-2024', 0),
    ]
    const result = getLabelData(bars)
    expect(result.length).toBe(0)
  })

  it('gibt leeres Array zurück, wenn das Eingabe-Array leer ist', () => {
    const bars: FlatBarItem[] = []
    const result = getLabelData(bars)
    expect(result.length).toBe(0)
  })
})

// =========================================================================
// getBarOpacity
// =========================================================================

// Testet die Deckkraft-Zuordnung nach Jahr.
// Wichtig, weil 2015-Balken gedämpft (0.45) und 2024-Balken
// voll deckend (1.0) dargestellt werden müssen.

describe('getBarOpacity', () => {

  /** Erzeugt einen minimalen FlatBarItem für den Opazitätstest. */
  function createBarForYear(year: '2015' | '2024'): FlatBarItem {
    const parent: EnergyDataPoint = {
      id: 'test',
      label: 'Test',
      category: 'fossil',
      value2015: 10,
      value2024: 20,
      displayedDelta: 10,
    }
    return { id: 'test-' + year, parent, year, value: year === '2015' ? 10 : 20 }
  }

  it('gibt 0.45 für 2015 zurück', () => {
    const bar = createBarForYear('2015')
    const result = getBarOpacity(bar)
    expect(result).toBe(0.45)
  })

  it('gibt 1.0 für 2024 zurück', () => {
    const bar = createBarForYear('2024')
    const result = getBarOpacity(bar)
    expect(result).toBe(1.0)
  })
})
