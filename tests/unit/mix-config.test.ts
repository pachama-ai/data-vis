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
    expect(MIX_COLORS.hydro).toBe('#6b8f5e')
    expect(MIX_COLORS.biomass).toBe('#86a86f')
    expect(MIX_COLORS.wind_offshore).toBe('#9dbb85')
    expect(MIX_COLORS.wind_onshore).toBe('#b8cfa2')
    expect(MIX_COLORS.pv).toBe('#d9c47a')
    expect(MIX_COLORS.nuclear).toBe('#b8709a')
    expect(MIX_COLORS.gas).toBe('#c2a173')
    expect(MIX_COLORS.other_fossil).toBe('#d4c3a5')
    expect(MIX_COLORS.hardcoal).toBe('#7a6248')
    expect(MIX_COLORS.lignite).toBe('#a37348')
  })

  it('Steinkohle und Braunkohle sind klar unterscheidbar', () => {
    expect(MIX_COLORS.hardcoal).not.toBe(MIX_COLORS.lignite)
  })
})
