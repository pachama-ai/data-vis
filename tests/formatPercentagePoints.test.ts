import { describe, it, expect } from 'vitest'

import { formatPercentagePoints } from '~/utils/charts/deviationChartHelpers'

describe('formatPercentagePoints', () => {
  // Ich nehme hier bewusst Werte mit nur einer Nachkommastelle, damit
  // beim Test kein Rundungsstreit durch Fließkomma-Ungenauigkeiten
  // entsteht.
  it('positiver Wert bekommt ein + und die Einheit pp', () => {
    const result = formatPercentagePoints(12.3)

    expect(result).toBe('+12,3 pp')
  })

  it('negativer Wert bekommt das echte Minuszeichen (−), keinen Bindestrich', () => {
    const result = formatPercentagePoints(-8.3)

    expect(result).toBe('−8,3 pp')
  })

  it('Wert 0 wird ohne Vorzeichen dargestellt', () => {
    const result = formatPercentagePoints(0)

    expect(result).toBe('0 pp')
  })
})
