import { describe, it, expect } from 'vitest'
import * as d3 from 'd3'

import { getDeviationBarWidth } from '~/utils/charts/deviationChartHelpers'

describe('getDeviationBarWidth', () => {
  const xScale = d3.scaleLinear().domain([-50, 50]).range([0, 400])

  it('positiver Wert ergibt den richtigen Abstand zur Nulllinie', () => {
    const result = getDeviationBarWidth(20, xScale)
    const expected = Math.abs(xScale(20) - xScale(0))

    expect(result).toBe(expected)
  })

  it('negativer Wert ergibt die gleiche (positive) Breite wie der Betrag', () => {
    const positiveWidth = getDeviationBarWidth(20, xScale)
    const negativeWidth = getDeviationBarWidth(-20, xScale)

    expect(negativeWidth).toBe(positiveWidth)
  })
})
