/**
 * tests/unit/DeviationChart.test.ts
 *
 * Testet die DeviationChart-Klasse und ihre Hilfsfunktionen.
 *
 * Aufruf: npx vitest run tests/unit/DeviationChart.test.ts
 */

import { describe, it, expect } from 'vitest'
import * as d3 from 'd3'

import {
  DeviationChart,
  getDeviationBarX,
  getDeviationBarWidth,
  createSymmetricDomain,
  findMaximumAbsoluteDeviation,
  formatPercentagePoints,
  labelX,
  labelAnchor,
} from '~/utils/charts/DeviationChart'

import { STACK_ORDER } from '~/components/generation/mixConfig'

import type { EmissionRow, MixSourceKey } from '~/types/mix'

// =========================================================================
// Hilfsfunktion für Testdaten
// =========================================================================

function createEmissionRow(
  sourceKey: MixSourceKey,
  deviationPp: number,
): EmissionRow {
  return {
    sourceKey,
    generationTwh: 10,
    generationShare: 0.1,
    emissionsMt: deviationPp > 0 ? 5 : 0,
    emissionShare: deviationPp > 0 ? 0.2 : 0,
    deviationPp,
  }
}

function createTestData(): EmissionRow[] {
  return [
    createEmissionRow('hydro', -5),
    createEmissionRow('biomass', -3),
    createEmissionRow('wind_offshore', -4),
    createEmissionRow('wind_onshore', -35),
    createEmissionRow('pv', -25),
    createEmissionRow('nuclear', -2),
    createEmissionRow('other_fossil', 8),
    createEmissionRow('gas', 12),
    createEmissionRow('hardcoal', 20),
    createEmissionRow('lignite', 35),
  ]
}

function createContainer(): HTMLElement {
  const container = document.createElement('div')

  container.style.width = '860px'
  container.style.height = '520px'

  return container
}

function flushTransitions(): void {
  // D3-Transitions abschließen
  d3.timerFlush()
}

// =========================================================================
// Hilfsfunktionen-Tests
// =========================================================================

describe('getDeviationBarX', () => {
  it('positiver Balken beginnt bei null', () => {
    const xScale = d3.scaleLinear().domain([-30, 30]).range([0, 300])

    const barX = getDeviationBarX(20, xScale)

    expect(barX).toBe(xScale(0))
  })

  it('negativer Balken beginnt am negativen Wert', () => {
    const xScale = d3.scaleLinear().domain([-30, 30]).range([0, 300])

    const barX = getDeviationBarX(-20, xScale)

    expect(barX).toBe(xScale(-20))
  })
})

describe('getDeviationBarWidth', () => {
  it('Breite eines positiven Werts', () => {
    const xScale = d3.scaleLinear().domain([-30, 30]).range([0, 300])

    const width = getDeviationBarWidth(20, xScale)

    expect(width).toBe(Math.abs(xScale(20) - xScale(0)))
  })

  it('Breite eines negativen Werts (gleicher Betrag)', () => {
    const xScale = d3.scaleLinear().domain([-30, 30]).range([0, 300])

    const positiveWidth = getDeviationBarWidth(20, xScale)
    const negativeWidth = getDeviationBarWidth(-20, xScale)

    expect(negativeWidth).toBe(positiveWidth)
  })
})

describe('createSymmetricDomain', () => {
  it('rundet 26.9 auf [-30, 30]', () => {
    expect(createSymmetricDomain(26.9)).toEqual([-30, 30])
  })

  it('gibt [-1, 1] bei 0', () => {
    expect(createSymmetricDomain(0)).toEqual([-1, 1])
  })

  it('gibt [-1, 1] bei negativem Wert', () => {
    expect(createSymmetricDomain(-5)).toEqual([-1, 1])
  })

  it('rundet 7.3 auf [-10, 10]', () => {
    expect(createSymmetricDomain(7.3)).toEqual([-10, 10])
  })

  it('rundet 31.2 auf [-40, 40]', () => {
    expect(createSymmetricDomain(31.2)).toEqual([-40, 40])
  })
})

describe('findMaximumAbsoluteDeviation', () => {
  it('findet das Maximum über mehrere Jahre', () => {
    const year1 = [createEmissionRow('lignite', 0.35), createEmissionRow('pv', -0.25)]
    const year2 = [createEmissionRow('lignite', 0.4), createEmissionRow('pv', -0.3)]

    const maximum = findMaximumAbsoluteDeviation([year1, year2])

    expect(maximum).toBe(0.4)
  })

  it('gibt 0 bei leerem Input', () => {
    expect(findMaximumAbsoluteDeviation([])).toBe(0)
  })
})

describe('formatPercentagePoints', () => {
  it('formatiert 0', () => {
    expect(formatPercentagePoints(0)).toBe('0 pp')
  })

  it('formatiert positive Werte mit Plus', () => {
    expect(formatPercentagePoints(20)).toBe('+20,0 pp')
  })

  it('formatiert negative Werte mit Minuszeichen', () => {
    expect(formatPercentagePoints(-20)).toBe('−20,0 pp')
  })
})

// =========================================================================
// Chart-Klassen-Tests
// =========================================================================

describe('DeviationChart', () => {
  it('erzeugt ein SVG mit korrekter viewBox und role', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)

    const svgElements = container.querySelectorAll('svg')

    expect(svgElements).toHaveLength(1)

    const svgElement = svgElements[0]!

    expect(svgElement.getAttribute('viewBox')).toBe('0 0 860 540')
    expect(svgElement.getAttribute('role')).toBe('img')
  })

  it('zeichnet zehn Balken', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const bars = container.querySelectorAll('.deviation-bar')

    expect(bars).toHaveLength(10)
  })

  it('behält die feste STACK_ORDER-Reihenfolge bei', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const bars = container.querySelectorAll<SVGRectElement>('.deviation-bar')

    expect(bars).toHaveLength(10)

    // y-Positionen sollten der STACK_ORDER-Reihenfolge entsprechen
    const yPositions: number[] = []

    bars.forEach((bar) => {
      const yValue = Number(bar.getAttribute('y'))
      yPositions.push(yValue)
    })

    // y-Werte aufsteigend (oben nach unten)
    for (let i = 1; i < yPositions.length; i++) {
      expect(yPositions[i]!).toBeGreaterThanOrEqual(yPositions[i - 1]!)
    }
  })

  it('zeichnet eine Nulllinie', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const zeroLine = container.querySelectorAll('.zero-line')

    expect(zeroLine).toHaveLength(1)
  })

  it('zeichnet x- und y-Achse', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const xAxis = container.querySelectorAll('.x-axis')
    const yAxis = container.querySelectorAll('.y-axis')

    expect(xAxis).toHaveLength(1)
    expect(yAxis).toHaveLength(1)
  })

  it('zeigt positive und negative Balken korrekt an', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)

    // Nur PV (-0.25) und Lignite (0.35) als Testfälle
    const testData: EmissionRow[] = [
      createEmissionRow('pv', -0.25),
      createEmissionRow('lignite', 0.35),
    ]

    chart.setXDomain([-1, 1])
    chart.setData(testData)
    flushTransitions()

    const bars = container.querySelectorAll<SVGRectElement>('.deviation-bar')

    expect(bars).toHaveLength(2)

    // Lignite (positiv): x sollte xScale(0) sein
    // Also gleich der Position der Nulllinie
    const zeroLine = container.querySelector<SVGLineElement>('.zero-line')
    const zeroLineX = Number(zeroLine!.getAttribute('x1'))
    const positiveBarX = Number(bars[1]!.getAttribute('x'))

    expect(positiveBarX).toBe(zeroLineX)
  })

  it('zeigt Wertelabels an', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const labels = container.querySelectorAll('.deviation-value')

    expect(labels).toHaveLength(10)
  })

  it('setzt Highlight und dimmt andere Balken', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    chart.setHighlight('lignite')

    const bars =
      container.querySelectorAll<SVGRectElement>('.deviation-bar')

    bars.forEach((bar) => {
      const sourceKey = bar.getAttribute('data-source-key')
      const opacity = Number(bar.getAttribute('opacity'))

      if (sourceKey === 'lignite') {
        expect(opacity).toBe(1)
      } else {
        expect(opacity).toBe(0.55)
      }
    })
  })

  it('setzt Highlight zurück auf volle Opazität', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    chart.setHighlight('lignite')
    chart.setHighlight(null)

    const bars =
      container.querySelectorAll<SVGRectElement>('.deviation-bar')

    bars.forEach((bar) => {
      expect(Number(bar.getAttribute('opacity'))).toBe(1)
    })
  })

  it('behält nach Daten-Update zehn Balken und ein Label', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    // Neue Jahresdaten setzen
    chart.setData(createTestData())
    flushTransitions()

    const bars = container.querySelectorAll('.deviation-bar')
    const labels = container.querySelectorAll('.deviation-value')
    const zeroLine = container.querySelectorAll('.zero-line')

    expect(bars).toHaveLength(10)
    expect(labels).toHaveLength(10)
    expect(zeroLine).toHaveLength(1)
  })

  it('erzeugt bei zweifachem Render nur ein SVG', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const svgElements = container.querySelectorAll('svg')

    expect(svgElements).toHaveLength(1)
  })

  it('behandelt leere Daten ohne Exception', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData([])
    flushTransitions()

    const bars = container.querySelectorAll('.deviation-bar')
    const labels = container.querySelectorAll('.deviation-value')

    expect(bars).toHaveLength(0)
    expect(labels).toHaveLength(0)
  })

  it('destroy entfernt das SVG', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.destroy()

    const svgElements = container.querySelectorAll('svg')

    expect(svgElements).toHaveLength(0)
  })

  it('mehrfaches destroy wirft keine Exception', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.destroy()
    chart.destroy()

    // Sollte keine Exception werfen
  })

  it('wechselt die Balkenreihenfolge beim Sortieren nach Klimawirkung', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    // Kategorie-Reihenfolge: hydro hat generationShare 0.05, deviationPp -4
    const getBarKeys = (): string[] => {
      return Array.from(
        container.querySelectorAll<SVGRectElement>('.deviation-bar'),
      ).map((bar) => bar.getAttribute('data-source-key')!)
    }

    const categoryOrder = getBarKeys()

    // Sortierung nach Klimawirkung umschalten
    chart.setSortMode('impact')
    flushTransitions()

    const impactOrder = getBarKeys()

    // Die Reihenfolge muss sich geändert haben
    expect(impactOrder).not.toEqual(categoryOrder)

    // Bei impact-Sortierung: negativste Abweichung zuerst (wind_onshore: -30)
    expect(impactOrder[0]).toBe('wind_onshore')

    // positivste Abweichung zuletzt (lignite: +30)
    expect(impactOrder[impactOrder.length - 1]).toBe('lignite')
  })
})

// =========================================================================
// labelX / labelAnchor – Wertelabel-Positionierung
// =========================================================================

describe('labelX', () => {
  const xScale = d3.scaleLinear().domain([-50, 50]).range([0, 600])

  it('positiver Wert: Label rechts vom Balkenende', () => {
    const x = labelX(20, xScale)
    const barEnd = xScale(20)
    expect(x).toBeGreaterThan(barEnd)
  })

  it('negativer Wert: Label links vom Balkenende', () => {
    const x = labelX(-20, xScale)
    const barEnd = xScale(-20)
    expect(x).toBeLessThan(barEnd)
  })

  it('sehr kleiner positiver Wert (0,3): Label rechts von der Nulllinie', () => {
    const x = labelX(0.3, xScale)
    expect(x).toBeGreaterThan(xScale(0))
  })

  it('sehr kleiner negativer Wert (−0,3): Label links von der Nulllinie', () => {
    const x = labelX(-0.3, xScale)
    expect(x).toBeLessThan(xScale(0))
  })

  it('Null: Label rechts von der Nulllinie (wie positiv)', () => {
    const x = labelX(0, xScale)
    expect(x).toBeGreaterThan(xScale(0))
  })

  it('Abstand zum Balkenende entspricht LABEL_PADDING', () => {
    const xPos = labelX(30, xScale)
    expect(xPos - xScale(30)).toBeCloseTo(6, 0)

    const xNeg = labelX(-30, xScale)
    expect(xNeg - xScale(-30)).toBeCloseTo(-6, 0)
  })
})

describe('labelAnchor', () => {
  it('positiver Wert: start', () => {
    expect(labelAnchor(10)).toBe('start')
  })

  it('negativer Wert: end', () => {
    expect(labelAnchor(-10)).toBe('end')
  })

  it('Null: start (wie positiv)', () => {
    expect(labelAnchor(0)).toBe('start')
  })

  it('sehr kleiner positiver Wert: start', () => {
    expect(labelAnchor(0.01)).toBe('start')
  })

  it('sehr kleiner negativer Wert: end', () => {
    expect(labelAnchor(-0.01)).toBe('end')
  })
})

describe('labelX – Konsistenz zwischen Enter und Update', () => {
  it('liefert für denselben Wert immer dieselbe Position', () => {
    const xScale = d3.scaleLinear().domain([-50, 50]).range([0, 600])
    const values = [-30, -15, -5, -0.3, 0, 0.3, 5, 15, 30, 50]

    for (const value of values) {
      const first = labelX(value, xScale)
      const second = labelX(value, xScale)
      expect(second).toBe(first)
    }
  })

  it('Rendering-Integration: Labels nach setData haben korrekte text-anchor', () => {
    const container = createContainer()
    const chart = new DeviationChart()

    chart.render(container)
    chart.setData(createTestData())
    flushTransitions()

    const labels = container.querySelectorAll<SVGTextElement>('text.deviation-value')

    expect(labels.length).toBeGreaterThan(0)

    labels.forEach((label) => {
      const sourceKey = label.closest('g')?.querySelector('text')?.textContent ?? ''
      const text = label.textContent ?? ''
      const anchor = label.getAttribute('text-anchor')

      // Alle Labels mit "-" im Text sollten end-Anker haben
      if (text.startsWith('−') || text.startsWith('-')) {
        expect(anchor).toBe('end')
      } else {
        expect(anchor).toBe('start')
      }
    })
  })
})
