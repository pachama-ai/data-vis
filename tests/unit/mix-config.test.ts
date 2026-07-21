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
    expect(MIX_COLORS.hydro).toBe('#2e6e5e')
    expect(MIX_COLORS.biomass).toBe('#4a8b6a')
    expect(MIX_COLORS.wind_offshore).toBe('#5aa896')
    expect(MIX_COLORS.wind_onshore).toBe('#8bc5b4')
    expect(MIX_COLORS.pv).toBe('#e0b13c')
    expect(MIX_COLORS.nuclear).toBe('#9c6b9e')
    expect(MIX_COLORS.gas).toBe('#d08a4a')
    expect(MIX_COLORS.other_fossil).toBe('#c9b79a')
    expect(MIX_COLORS.hardcoal).toBe('#6b5d4f')
    expect(MIX_COLORS.lignite).toBe('#8a5a34')
  })

  it('Steinkohle und Braunkohle sind klar unterscheidbar', () => {
    expect(MIX_COLORS.hardcoal).not.toBe(MIX_COLORS.lignite)
  })
})
