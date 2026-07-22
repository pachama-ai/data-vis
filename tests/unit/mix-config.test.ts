/**
 * tests/unit/mix-config.test.ts
 *
 * Testet die zentralen Farbkonstanten für das Stacked-Area-Chart.
 * Prüft alle zehn Farben und dass Steinkohle ≠ Braunkohle.
 */

import { describe, it, expect } from 'vitest'
import { MIX_COLORS } from '~/utils/mix-config'

describe('MIX_COLORS', () => {
  it('enthält alle zehn aktualisierten Farben', () => {
    expect(MIX_COLORS.hydro).toBe('#3d6b4a')
    expect(MIX_COLORS.biomass).toBe('#6b9c5e')
    expect(MIX_COLORS.wind_offshore).toBe('#98bd7e')
    expect(MIX_COLORS.wind_onshore).toBe('#c2d6a0')
    expect(MIX_COLORS.pv).toBe('#e8c55f')
    expect(MIX_COLORS.nuclear).toBe('#b5628f')
    expect(MIX_COLORS.gas).toBe('#c99a5e')
    expect(MIX_COLORS.other_fossil).toBe('#ddd0b8')
    expect(MIX_COLORS.hardcoal).toBe('#6b5744')
    expect(MIX_COLORS.lignite).toBe('#9c5f30')
  })

  it('Steinkohle und Braunkohle sind klar unterscheidbar', () => {
    expect(MIX_COLORS.hardcoal).not.toBe(MIX_COLORS.lignite)
  })
})
