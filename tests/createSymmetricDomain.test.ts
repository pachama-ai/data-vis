import { describe, it, expect } from 'vitest'

import { createSymmetricDomain } from '~/utils/charts/deviationChartHelpers'

describe('createSymmetricDomain', () => {
  it('rundet 27 auf den nächsten Zehner und gibt ein symmetrisches Paar zurück', () => {
    const result = createSymmetricDomain(27)

    expect(result).toEqual([-30, 30])
  })

  it('gibt bei 0 die im Code hinterlegte Fallback-Domain zurück', () => {
    const result = createSymmetricDomain(0)

    expect(result).toEqual([-1, 1])
  })
})
