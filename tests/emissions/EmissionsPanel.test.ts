/**
 * tests/emissions/EmissionsPanel.test.ts
 *
 * Testet das EmissionsPanel als Rahmenkomponente.
 * DeviationChart wird gestubbt.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import EmissionsPanel from '~/components/emissions/EmissionsPanel.vue'

var DeviationChartStub = {
  template:
    '<div data-testid="deviation-chart-stub">Chart</div>',
}

var NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('EmissionsPanel', function () {
  it('zeigt die Überschrift CO₂-Vergleich', function () {
    var wrapper = mount(EmissionsPanel, {
      global: {
        stubs: {
          DeviationChart: DeviationChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('CO₂')
  })

  it('bindet die DeviationChart-Komponente ein', function () {
    var wrapper = mount(EmissionsPanel, {
      global: {
        stubs: {
          DeviationChart: DeviationChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(
      wrapper.find('[data-testid="deviation-chart-stub"]').exists(),
    ).toBe(true)
  })
})
