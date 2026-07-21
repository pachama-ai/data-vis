/**
 * tests/unit/StackedAreaChart.test.ts
 *
 * Testet die StackedAreaChart-Klasse: SVG-Erzeugung, Layer, Achsen,
 * destroy, mehrfaches render und leere Daten.
 *
 * happy-dom stellt einen DOM-Browser bereit – D3 kann darin SVG-Elemente
 * erzeugen, aber einige D3-Funktionen (z. B. getBBox) sind eingeschränkt.
 * Für diese Tests reicht die Existenz der SVG-Elemente.
 */

import { describe, it, expect } from 'vitest'
import { StackedAreaChart } from '~/utils/charts/StackedAreaChart'
import type { MixMonthRow } from '~/types/mix'

// =========================================================================
// Hilfsfunktion: erzeugt eine MixMonthRow mit gleichen Werten
// =========================================================================

function createMonthRow(month: string, sourceValue: number): MixMonthRow {
  const [yearText, monthText] = month.split('-')

  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  return {
    month,
    date: new Date(year, monthIndex, 1),
    values: {
      hydro: sourceValue,
      biomass: sourceValue,
      wind_offshore: sourceValue,
      wind_onshore: sourceValue,
      pv: sourceValue,
      nuclear: sourceValue,
      gas: sourceValue,
      other_fossil: sourceValue,
      hardcoal: sourceValue,
      lignite: sourceValue,
    },
  }
}

// =========================================================================
// 1. Render-Tests
// =========================================================================

describe('StackedAreaChart – Render', () => {
  it('erzeugt ein SVG mit viewBox und role="img"', () => {
    // Arrange
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    // Act
    chart.render(container)

    // Assert
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 900 460')
    expect(svg!.getAttribute('role')).toBe('img')
  })

  it('erzeugt bei Daten zehn path.layer-Elemente', () => {
    // Arrange
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    // Act
    chart.render(container)
    chart.setData(monthRows)

    // Assert
    const layers = container.querySelectorAll('.layer')
    expect(layers.length).toBe(10)
  })

  it('erzeugt X- und Y-Achse', () => {
    // Arrange
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-06', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    // Act
    chart.render(container)
    chart.setData(monthRows)

    // Assert
    const xAxis = container.querySelector('.x-axis')
    const yAxis = container.querySelector('.y-axis')

    expect(xAxis).not.toBeNull()
    expect(yAxis).not.toBeNull()
  })
})

// =========================================================================
// 2. destroy
// =========================================================================

describe('StackedAreaChart – destroy', () => {
  it('entfernt das SVG aus dem Container', () => {
    // Arrange
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)

    // Act
    chart.destroy()

    // Assert
    expect(container.querySelector('svg')).toBeNull()
  })
})

// =========================================================================
// 3. Mehrfaches render
// =========================================================================

describe('StackedAreaChart – mehrfaches render', () => {
  it('erzeugt bei zweimaligem render genau ein SVG', () => {
    // Arrange
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    // Act
    chart.render(container)
    chart.render(container)

    // Assert
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(1)
  })
})

// =========================================================================
// 4. Leere Daten
// =========================================================================

describe('StackedAreaChart – leere Daten', () => {
  it('entfernt Layer und Achsen bei setData([])', () => {
    // Arrange
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)

    // Vorher prüfen: Layer und Achsen sind vorhanden
    expect(container.querySelectorAll('.layer').length).toBe(10)
    expect(container.querySelector('.x-axis')).not.toBeNull()
    expect(container.querySelector('.y-axis')).not.toBeNull()

    // Act
    chart.setData([])

    // Assert
    expect(container.querySelectorAll('.layer').length).toBe(0)
  })
})

// =========================================================================
// 5. Moduswechsel
// =========================================================================

describe('StackedAreaChart – Moduswechsel', () => {
  it('zeigt Prozent in der Y-Achse nach setMode("share")', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)
    chart.setMode('share')

    const yAxis = container.querySelector('.y-axis')
    expect(yAxis).not.toBeNull()
    expect(yAxis!.textContent).toContain('%')
    expect(yAxis!.textContent).not.toContain('TWh')
  })

  it('zeigt TWh in der Y-Achse nach Wechsel zurück zu absolute', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)
    chart.setMode('share')
    chart.setMode('absolute')

    const yAxis = container.querySelector('.y-axis')
    expect(yAxis).not.toBeNull()
    expect(yAxis!.textContent).toContain('TWh')
  })
})

// =========================================================================
// 6. Highlight / Opazität
// =========================================================================

describe('StackedAreaChart – Highlight', () => {
  it('setzt opacity=1 auf allen Layern ohne Highlight', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)

    const layers = container.querySelectorAll<SVGPathElement>('.layer')
    expect(layers.length).toBe(10)

    for (const layer of layers) {
      expect(layer.getAttribute('opacity')).toBe('1')
    }
  })

  it('setzt opacity=1 auf dem hervorgehobenen Layer', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)
    chart.setHighlightedSources(['pv'])

    const pvLayer = container.querySelector('.layer-pv')
    expect(pvLayer?.getAttribute('opacity')).toBe('1')
  })

  it('setzt opacity=0.15 auf anderen Layern bei Highlight', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)
    chart.setHighlightedSources(['pv'])

    const gasLayer = container.querySelector('.layer-gas')
    expect(gasLayer?.getAttribute('opacity')).toBe('0.15')
  })

  it('setzt alle Layer zurück auf opacity=1 bei setHighlightedSources(null)', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)
    chart.setHighlightedSources(['pv'])
    chart.setHighlightedSources(null)

    const layers = container.querySelectorAll<SVGPathElement>('.layer')
    for (const layer of layers) {
      expect(layer.getAttribute('opacity')).toBe('1')
    }
  })
})

// =========================================================================
// 7. findNearestMonthRow
// =========================================================================

import { findNearestMonthRow } from '~/utils/charts/StackedAreaChart'

describe('findNearestMonthRow', () => {
  const testMonths = [
    createMonthRow('2024-01', 10),
    createMonthRow('2024-02', 20),
  ]

  it('gibt null bei leerem Array zurück', () => {
    const result = findNearestMonthRow([], new Date(2024, 0, 15))
    expect(result).toBeNull()
  })

  it('gibt ersten Monat bei Datum davor zurück', () => {
    const result = findNearestMonthRow(testMonths, new Date(2023, 11, 15))
    expect(result?.month).toBe('2024-01')
  })

  it('gibt letzten Monat bei Datum danach zurück', () => {
    const result = findNearestMonthRow(testMonths, new Date(2025, 0, 1))
    expect(result?.month).toBe('2024-02')
  })

  it('gibt näheren vorherigen Monat bei gleicher Distanz zurück', () => {
    // Mitte Januar: 15.1.2024 – näher an Januar (14 Tage) als Februar (17 Tage)
    const result = findNearestMonthRow(testMonths, new Date(2024, 0, 15))
    expect(result?.month).toBe('2024-01')
  })

  it('gibt näheren nächsten Monat zurück', () => {
    // 20.1.2024 – näher an Februar (12 Tage) als Januar (19 Tage)
    const result = findNearestMonthRow(testMonths, new Date(2024, 0, 20))
    expect(result?.month).toBe('2024-02')
  })
})

// =========================================================================
// 8. Hover-Elemente
// =========================================================================

describe('StackedAreaChart – Hover-Elemente', () => {
  it('erzeugt Overlay, Führungslinie und Monatslabel', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-02', 12.0),
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setData(monthRows)

    const overlay = container.querySelector('.hover-overlay')
    const guide = container.querySelector('.hover-guide')
    const label = container.querySelector('.hover-month-label')

    expect(overlay).not.toBeNull()
    expect(guide).not.toBeNull()
    expect(label).not.toBeNull()
  })
})

// =========================================================================
// 9. parseAnnotationDate
// =========================================================================

import { parseAnnotationDate } from '~/utils/charts/StackedAreaChart'
import type { MixAnnotation } from '~/types/mix'

describe('parseAnnotationDate', () => {
  it('parst YYYY-MM in Date (1. des Monats)', () => {
    const date = parseAnnotationDate('2023-04')
    expect(date.getFullYear()).toBe(2023)
    expect(date.getMonth()).toBe(3) // April = 3
    expect(date.getDate()).toBe(1)
  })

  it('parst YYYY in Date (1. Juli)', () => {
    const date = parseAnnotationDate('2022')
    expect(date.getFullYear()).toBe(2022)
    expect(date.getMonth()).toBe(6) // Juli = 6
    expect(date.getDate()).toBe(1)
  })
})

// =========================================================================
// 10. Annotation Guide Line
// =========================================================================

describe('StackedAreaChart – Fixed Annotation Guide Line', () => {
  it('erzeugt die fixed-annotation-guide Line', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-06', 12.0),
    ]
    const annotations: MixAnnotation[] = [
      { id: 1, date: '2024-01', title: 'Test', text: 'Testtext', highlight: ['pv'] },
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setAnnotations(annotations)
    chart.setData(monthRows)

    const guide = container.querySelector('.fixed-annotation-guide')
    expect(guide).not.toBeNull()
  })

  it('zeigt die Linie bei ausgewählter Annotation', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-06', 12.0),
    ]
    const annotations: MixAnnotation[] = [
      { id: 1, date: '2024-01', title: 'Test', text: 'Testtext', highlight: ['pv'] },
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setAnnotations(annotations)
    chart.setData(monthRows)
    chart.setSelectedAnnotation(1)

    const guide = container.querySelector('.fixed-annotation-guide') as SVGLineElement
    expect(guide).not.toBeNull()
    expect(guide.style.display).not.toBe('none')
  })

  it('verbirgt die Linie bei setSelectedAnnotation(null)', () => {
    const monthRows = [
      createMonthRow('2024-01', 10.0),
      createMonthRow('2024-06', 12.0),
    ]
    const annotations: MixAnnotation[] = [
      { id: 1, date: '2024-01', title: 'Test', text: 'Testtext', highlight: ['pv'] },
    ]
    const container = document.createElement('div')
    const chart = new StackedAreaChart()

    chart.render(container)
    chart.setAnnotations(annotations)
    chart.setData(monthRows)
    chart.setSelectedAnnotation(1)
    chart.setSelectedAnnotation(null)

    const guide = container.querySelector('.fixed-annotation-guide') as SVGLineElement
    expect(guide).not.toBeNull()
    expect(guide.style.display).toBe('none')
  })
})
