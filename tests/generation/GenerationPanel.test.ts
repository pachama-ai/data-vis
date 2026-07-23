/**
 * tests/components/GenerationPanel.test.ts
 *
 * Testet ausschließlich den Rahmen des Strommix-Panels.
 * Die interaktive Logik von StackedArea wird separat getestet.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GenerationPanel from '~/components/generation/GenerationPanel.vue'

// Einfacher Stub für StackedArea, damit keine D3- oder Fetch-Logik läuft
const StackedAreaChartStub = {
  template: '<div data-testid="stacked-area-stub">Chart</div>',
}

// Stub für NuxtLink, damit kein Router nötig ist
const NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('GenerationPanel', () => {
  it('zeigt den Titel Erzeugungsmix 2015–2024', () => {
    const wrapper = mount(GenerationPanel, {
      global: {
        stubs: {
          StackedAreaChart: StackedAreaChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Entwicklung der Stromerzeugung 2015–2024')
  })

  it('zeigt den Untertitel mit SMARD-Bezug', () => {
    const wrapper = mount(GenerationPanel, {
      global: {
        stubs: {
          StackedAreaChart: StackedAreaChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('SMARD-Daten')
  })

  it('bindet StackedArea als Visualisierung ein', () => {
    const wrapper = mount(GenerationPanel, {
      global: {
        stubs: {
          StackedAreaChart: StackedAreaChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const stackedAreaStub = wrapper.find(
      '[data-testid="stacked-area-stub"]',
    )

    expect(stackedAreaStub.exists()).toBe(true)
  })

  it('enthält keine Quellenangabe im Panel (nur übergeordnet)', () => {
    const wrapper = mount(GenerationPanel, {
      global: {
        stubs: {
          StackedAreaChart: StackedAreaChartStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const sourceMatches = wrapper.text().match(/Quelle:/g) ?? []

    expect(sourceMatches).toHaveLength(0)
  })
})
