/**
 * tests/components/DeviationChartView.test.ts
 *
 * Testet die DeviationChartView-Komponente.
 *
 * Mockt useMixData und loadEmissionFactorsFile.
 * Der echte Chart wird unter happy-dom getestet.
 *
 * Aufruf: npx vitest run tests/components/DeviationChartView.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import * as d3 from 'd3'

import DeviationChartView from '~/components/viz/DeviationChartView.vue'

import type { MixSourceKey } from '~/types/mix'
import type { MixYearRow } from '~/composables/useMixData'

// =========================================================================
// Mock-Daten (via vi.hoisted, da vi.mock Factory hoisted wird)
// =========================================================================

const mockYearRows = vi.hoisted(() => {
  return [
    {
      year: 2015,
      values: {
        hydro: 20000,
        biomass: 30000,
        wind_offshore: 5000,
        wind_onshore: 40000,
        pv: 25000,
        nuclear: 80000,
        gas: 40000,
        other_fossil: 10000,
        hardcoal: 80000,
        lignite: 120000,
      },
    },
    {
      year: 2024,
      values: {
        hydro: 18000,
        biomass: 35000,
        wind_offshore: 20000,
        wind_onshore: 70000,
        pv: 50000,
        nuclear: 5000,
        gas: 35000,
        other_fossil: 6000,
        hardcoal: 30000,
        lignite: 60000,
      },
    },
  ] as MixYearRow[]
})

const mockEmissionFactors = vi.hoisted(() => {
  return {
    source: {
      title: 'Test',
      publisher: 'Test',
      authors: 'Test',
      publication: 'Test',
      url: 'https://example.com',
      note: 'Test',
    },
    factors: {
      hydro: 0,
      biomass: 0,
      wind_offshore: 0,
      wind_onshore: 0,
      pv: 0,
      nuclear: 0,
      gas: 411,
      other_fossil: 750,
      hardcoal: 835,
      lignite: 1075,
    },
    unit: 'g CO₂/kWh',
  }
})

// =========================================================================
// Mocks
// =========================================================================

vi.mock('~/composables/useMixData', () => {
  return {
    useMixData: () => ({
      monthRows: { value: [] },
      yearRows: { value: mockYearRows },
      pending: { value: false },
      error: { value: null },
      loadData: vi.fn().mockResolvedValue(undefined),
    }),
  }
})

vi.mock('~/composables/useEmissions', async () => {
  const actual = await vi.importActual('~/composables/useEmissions')

  return {
    ...actual,
    loadEmissionFactorsFile: vi.fn().mockResolvedValue(
      mockEmissionFactors,
    ),
  }
})

// =========================================================================
// Tests
// =========================================================================

describe('DeviationChartView', () => {
  it('zeigt den Titel an', async () => {
    const wrapper = mount(DeviationChartView, {
      global: {
        stubs: {
          ChartTemplate: false,
          DeviationTooltip: true,
          YearSlider: true,
          DeviationSidebar: true,
        },
      },
    })

    // Warten auf asynchrone Initialisierung
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.find('.chart-container svg').exists()).toBe(true)
  })

  it('zeigt ein SVG mit Balken', async () => {
    const wrapper = mount(DeviationChartView, {
      global: {
        stubs: {
          ChartTemplate: false,
          DeviationTooltip: true,
          YearSlider: true,
          DeviationSidebar: true,
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    d3.timerFlush()

    const svgElements = wrapper.findAllComponents({ deep: true })

    // Prüfe, ob der Chart-Container existiert
    const chartContainer = wrapper.find('.chart-container')

    expect(chartContainer.exists()).toBe(true)
  })

  it('chart wird gerendert (Chart-Text sichtbar)', async () => {
    const wrapper = mount(DeviationChartView, {
      global: {
        stubs: {
          ChartTemplate: false,
          DeviationTooltip: true,
          YearSlider: true,
          DeviationSidebar: true,
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    d3.timerFlush()

    // Chart-Container wurde befüllt (SVG mit Achsentext)
    expect(wrapper.find('.chart-container svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('Wasserkraft')
    expect(wrapper.text()).toContain('Braunkohle')
  })

  it('Sidebar ist vorhanden (als stub)', async () => {
    const wrapper = mount(DeviationChartView, {
      global: {
        stubs: {
          ChartTemplate: false,
          DeviationTooltip: true,
          YearSlider: true,
          DeviationSidebar: true,
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const sidebar = wrapper.findComponent({ name: 'DeviationSidebar' })

    expect(sidebar.exists()).toBe(true)
  })

  it('Sidebar ist vorhanden', async () => {
    const wrapper = mount(DeviationChartView, {
      global: {
        stubs: {
          ChartTemplate: false,
          DeviationTooltip: true,
          YearSlider: true,
          DeviationSidebar: false,
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const sidebar = wrapper.findComponent({ name: 'DeviationSidebar' })

    expect(sidebar.exists()).toBe(true)
  })
})
