/**
 * tests/components/DashboardPage.test.ts
 *
 * Testet die Dashboard-Seite mit Tab-Navigation.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardPage from '~/pages/dashboard.vue'

const StrommixPanelStub = {
  template:
    '<div data-testid="strommix-panel-stub">StrommixPanel</div>',
}

const EmissionPanelStub = {
  template:
    '<div data-testid="emission-panel-stub">EmissionPanel</div>',
}

describe('DashboardPage', () => {
  it('zeigt beide Tab-Buttons', () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          StrommixPanel: StrommixPanelStub,
          EmissionPanel: EmissionPanelStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Erzeugung')
    expect(wrapper.text()).toContain('Emissionen')
  })

  it('Erzeugung ist standardmäßig aktiv', () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          StrommixPanel: StrommixPanelStub,
          EmissionPanel: EmissionPanelStub,
        },
      },
    })

    const generationButton = wrapper.findAll('button')[0]!

    expect(
      generationButton.attributes('aria-pressed'),
    ).toBe('true')

    const strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    const emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(true)
    expect(emissionPanel.exists()).toBe(false)
  })

  it('Emissionen-Tab aktiviert Emissions-Panel', async () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          StrommixPanel: StrommixPanelStub,
          EmissionPanel: EmissionPanelStub,
        },
      },
    })

    const emissionButton = wrapper.findAll('button')[1]!

    await emissionButton.trigger('click')

    const emissionsButton = wrapper.findAll('button')[1]!

    expect(
      emissionsButton.attributes('aria-pressed'),
    ).toBe('true')

    const generationButton = wrapper.findAll('button')[0]!

    expect(
      generationButton.attributes('aria-pressed'),
    ).toBe('false')

    const strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    const emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(false)
    expect(emissionPanel.exists()).toBe(true)
  })

  it('zurück zu Erzeugung funktioniert', async () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          StrommixPanel: StrommixPanelStub,
          EmissionPanel: EmissionPanelStub,
        },
      },
    })

    // Erst zu Emissionen wechseln
    const buttons = wrapper.findAll('button')

    await buttons[1]!.trigger('click')

    // Dann zurück zu Erzeugung
    await buttons[0]!.trigger('click')

    const strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    const emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(true)
    expect(emissionPanel.exists()).toBe(false)
  })

  it('nach jedem Wechsel ist genau ein Panel sichtbar', async () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          StrommixPanel: StrommixPanelStub,
          EmissionPanel: EmissionPanelStub,
        },
      },
    })

    const buttons = wrapper.findAll('button')

    // Erzeugung aktiv
    let strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    let emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(true)
    expect(emissionPanel.exists()).toBe(false)

    // Zu Emissionen wechseln
    await buttons[1]!.trigger('click')

    strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(false)
    expect(emissionPanel.exists()).toBe(true)

    // Zurück zu Erzeugung
    await buttons[0]!.trigger('click')

    strommixPanel = wrapper.find(
      '[data-testid="strommix-panel-stub"]',
    )
    emissionPanel = wrapper.find(
      '[data-testid="emission-panel-stub"]',
    )

    expect(strommixPanel.exists()).toBe(true)
    expect(emissionPanel.exists()).toBe(false)
  })
})
