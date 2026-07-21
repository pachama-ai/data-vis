/**
 * tests/components/StrommixPanel.test.ts
 *
 * Testet ausschließlich den Rahmen des Strommix-Panels.
 * Die interaktive Logik von StackedArea wird separat getestet.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StrommixPanel from '~/components/dashboard/StrommixPanel.vue'

// Einfacher Stub für StackedArea, damit keine D3- oder Fetch-Logik läuft
const StackedAreaStub = {
  template: '<div data-testid="stacked-area-stub">Chart</div>',
}

// Stub für NuxtLink, damit kein Router nötig ist
const NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('StrommixPanel', () => {
  it('zeigt den Titel Erzeugungsmix 2015–2024', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Entwicklung der Stromerzeugung 2015–2024')
  })

  it('zeigt den Rücksprung-Link mit ← Zur Übersicht', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const link = wrapper.find('a')

    expect(link.text()).toContain('Zur Übersicht')
    expect(link.attributes('href')).toBe('/')
  })

  it('zeigt den Untertitel mit SMARD-Bezug', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('SMARD-Daten')
  })

  it('bindet StackedArea als Visualisierung ein', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const stackedAreaStub = wrapper.find(
      '[data-testid="stacked-area-stub"]',
    )

    expect(stackedAreaStub.exists()).toBe(true)
  })

  it('zeigt einen Link Zur Übersicht mit Ziel /', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const startPageLink = wrapper.find('a')

    expect(startPageLink.text()).toContain('Zur Übersicht')
    expect(startPageLink.attributes('href')).toBe('/')
  })

  it('enthält keine Quellenangabe im Panel (nur übergeordnet)', () => {
    const wrapper = mount(StrommixPanel, {
      global: {
        stubs: {
          StackedArea: StackedAreaStub,
          NuxtLink: NuxtLinkStub,
        },
      },
    })

    const sourceMatches = wrapper.text().match(/Quelle:/g) ?? []

    expect(sourceMatches).toHaveLength(0)
  })
})
