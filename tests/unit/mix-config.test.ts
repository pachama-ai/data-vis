/**
 * tests/unit/mix-config.test.ts
 *
 * Testet die zentralen Farbkonstanten für das Stacked-Area-Chart.
 * Prüft alle zehn Farben und dass Steinkohle ≠ Braunkohle.
 */

import { describe, it, expect } from 'vitest'
import { MIX_COLORS } from '~/components/generation/mixConfig'

describe('MIX_COLORS', () => {
  it('enthält alle zehn aktualisierten Farben', () => {
    expect(MIX_COLORS.hydro).toBe('#4a7c59')
    expect(MIX_COLORS.biomass).toBe('#6b9e6b')
    expect(MIX_COLORS.wind_offshore).toBe('#9ac088')
    expect(MIX_COLORS.wind_onshore).toBe('#c8dcb0')
    expect(MIX_COLORS.pv).toBe('#dfb54a')
    expect(MIX_COLORS.nuclear).toBe('#b0648f')
    expect(MIX_COLORS.gas).toBe('#cc9a52')
    expect(MIX_COLORS.other_fossil).toBe('#e3d9c6')
    expect(MIX_COLORS.hardcoal).toBe('#5c5147')
    expect(MIX_COLORS.lignite).toBe('#9d6234')
  })

  it('Steinkohle und Braunkohle sind klar unterscheidbar', () => {
    expect(MIX_COLORS.hardcoal).not.toBe(MIX_COLORS.lignite)
  })
})
