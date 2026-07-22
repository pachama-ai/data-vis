/**
 * tests/components/EmissionPanel.test.ts
 *
 * Testet das EmissionPanel als Rahmenkomponente.
 * DeviationChartView wird gestubbt.
 *
 * Aufruf: npx vitest run tests/components/EmissionPanel.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import EmissionPanel from '~/components/dashboard/EmissionPanel.vue'

const DeviationChartViewStub = {
  template:
    '<div data-testid="deviation-chart-view-stub">Chart</div>',
}

const NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('EmissionPanel', () => {
  it('zeigt den Titel', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
        },
      },
    })

    expect(wrapper.text()).toContain(
      'Stromerzeugung und CO₂-Emissionen im Vergleich',
    )
  })

  it('zeigt den Untertitel mit Systemgrenze', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
        },
      },
    })

    expect(wrapper.text()).toContain('direkten CO₂-Emissionen')
  })

  it('bindet die DeviationChartView-Komponente ein', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
        },
      },
    })

    const chartStub = wrapper.find(
      '[data-testid="deviation-chart-view-stub"]',
    )

    expect(chartStub.exists()).toBe(true)
  })

  it('zeigt den Systemgrenzen-Hinweis', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
        },
      },
    })

    expect(wrapper.text()).toContain(
      'Emissionen aus Herstellung, Transport und Entsorgung sind nicht enthalten.',
    )
  })

  it('zeigt Quellenhinweis mit SMARD und Umweltbundesamt', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
        },
      },
    })

    expect(wrapper.text()).toContain('SMARD')
    expect(wrapper.text()).toContain('Umweltbundesamt')
  })

  it('zeigt den Rücksprung-Link mit ← Zur Übersicht', () => {
    const wrapper = mount(EmissionPanel, {
      global: {
        stubs: {
          DeviationChartView: DeviationChartViewStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const link = wrapper.find('a')

    expect(link.text()).toContain('Zur Übersicht')
    expect(link.attributes('href')).toBe('/')
  })
})
