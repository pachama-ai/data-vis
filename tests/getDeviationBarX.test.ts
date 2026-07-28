import { describe, it, expect } from 'vitest'
import * as d3 from 'd3'

import { getDeviationBarX } from '~/utils/charts/deviationChartHelpers'

describe('getDeviationBarX', () => {
  // Ich benutze für alle drei Fälle dieselbe Skala, das reicht für
  // diese einfache Prüfung völlig aus.
  const xScale = d3.scaleLinear().domain([-50, 50]).range([0, 400])

  it('positiver Wert: Balken beginnt an der Nulllinie', () => {
    const result = getDeviationBarX(20, xScale)

    expect(result).toBe(xScale(0))
  })

  it('negativer Wert: Balken beginnt direkt am Wert', () => {
    const result = getDeviationBarX(-20, xScale)

    expect(result).toBe(xScale(-20))
  })

  it('Wert 0: Balken beginnt ebenfalls an der Nulllinie', () => {
    const result = getDeviationBarX(0, xScale)

    expect(result).toBe(xScale(0))
  })
})
