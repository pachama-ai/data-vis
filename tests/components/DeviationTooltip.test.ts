/**
 * tests/components/DeviationTooltip.test.ts
 *
 * Testet die DeviationTooltip-Komponente.
 *
 * Aufruf: npx vitest run tests/components/DeviationTooltip.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import DeviationTooltip from '~/components/viz/DeviationTooltip.vue'

import type { EmissionRow } from '~/types/mix'

function createTestRow(overrides: Partial<EmissionRow> = {}): EmissionRow {
  return {
    sourceKey: 'lignite',
    generationTwh: 40,
    generationShare: 0.162,
    emissionsMt: 43,
    emissionShare: 0.431,
    deviationPp: 26.9,
    ...overrides,
  }
}

describe('DeviationTooltip', () => {
  it('zeigt den Quellennamen (Braunkohle)', () => {
    const row = createTestRow()

    const wrapper = mount(DeviationTooltip, {
      props: { row, chartX: 100, chartY: 200 },
    })

    expect(wrapper.text()).toContain('Braunkohle')
  })

  it('zeigt den Erzeugungsanteil', () => {
    const row = createTestRow({ generationShare: 0.162 })

    const wrapper = mount(DeviationTooltip, {
      props: { row, chartX: 100, chartY: 200 },
    })

    expect(wrapper.text()).toContain('16,2 %')
  })

  it('zeigt den Emissionsanteil', () => {
    const row = createTestRow({ emissionShare: 0.431 })

    const wrapper = mount(DeviationTooltip, {
      props: { row, chartX: 100, chartY: 200 },
    })

    expect(wrapper.text()).toContain('43,1 %')
  })

  it('zeigt positive Abweichung (+26,9 pp)', () => {
    const row = createTestRow({ deviationPp: 26.9 })

    const wrapper = mount(DeviationTooltip, {
      props: { row, chartX: 100, chartY: 200 },
    })

    expect(wrapper.text()).toContain('+26,9 pp')
  })

  it('zeigt negative Abweichung mit Minuszeichen', () => {
    const row = createTestRow({ deviationPp: -12.4 })

    const wrapper = mount(DeviationTooltip, {
      props: { row, chartX: 100, chartY: 200 },
    })

    expect(wrapper.text()).toContain('−12,4 pp')
  })
})
