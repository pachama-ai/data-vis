/**
 * tests/components/DashboardPage.test.ts
 *
 * Testet die Dashboard-Seite – der aktive Tab wird jetzt über den
 * Query-Parameter ?tab=emissions gesteuert (useRoute).
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardPage from '~/pages/dashboard.vue'

const GenerationPanelStub = {
  template:
    '<div data-testid="generation-panel-stub">GenerationPanel</div>',
}

const EmissionsPanelStub = {
  template:
    '<div data-testid="emissions-panel-stub">EmissionsPanel</div>',
}

// useRoute simulieren
const mockRoute = vi.fn(() => ({ path: '/dashboard', query: {} }))

vi.mock('nuxt/app', () => ({
  useRoute: () => mockRoute(),
}))

describe('DashboardPage', () => {
  it('zeigt standardmäßig das Erzeugungs-Panel', () => {
    mockRoute.mockReturnValue({ path: '/dashboard', query: {} })

    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          GenerationPanel: GenerationPanelStub,
          EmissionsPanel: EmissionsPanelStub,
        },
      },
    })

    expect(
      wrapper.find('[data-testid="generation-panel-stub"]').exists(),
    ).toBe(true)
    expect(
      wrapper.find('[data-testid="emissions-panel-stub"]').exists(),
    ).toBe(false)
  })

  it('zeigt Emissions-Panel bei ?tab=emissions', () => {
    mockRoute.mockReturnValue({
      path: '/dashboard',
      query: { tab: 'emissions' },
    })

    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          GenerationPanel: GenerationPanelStub,
          EmissionsPanel: EmissionsPanelStub,
        },
      },
    })

    expect(
      wrapper.find('[data-testid="generation-panel-stub"]').exists(),
    ).toBe(false)
    expect(
      wrapper.find('[data-testid="emissions-panel-stub"]').exists(),
    ).toBe(true)
  })

  it('enthält keine Tab-Buttons mehr (Navigation über SiteNav)', () => {
    mockRoute.mockReturnValue({ path: '/dashboard', query: {} })

    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          GenerationPanel: GenerationPanelStub,
          EmissionsPanel: EmissionsPanelStub,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    const buttonTexts = buttons.map((b) => b.text())
    expect(buttonTexts).not.toContain('Erzeugung')
    expect(buttonTexts).not.toContain('Emissionen')
  })
})
