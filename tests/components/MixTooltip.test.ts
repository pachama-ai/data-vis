/**
 * tests/components/MixTooltip.test.ts
 *
 * Testet die MixTooltip-Komponente mit
 * Gruppenübersicht (keine Auswahl) und Einzelauswahl.
 *
 * Aufruf: npx vitest run tests/components/MixTooltip.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MixTooltip from '~/components/viz/MixTooltip.vue'
import type { MixMonthRow, MixSourceKey } from '~/types/mix'

// =========================================================================
// Testdaten: Erneuerbare=6, Kernenergie=1, Fossil=3, Gesamt=10
// =========================================================================

function createTooltipData(): MixMonthRow {
  return {
    month: '2024-01',
    date: new Date(2024, 0, 1),
    values: {
      hydro: 2.0,
      biomass: 1.0,
      wind_offshore: 1.0,
      wind_onshore: 1.0,
      pv: 1.0,
      nuclear: 1.0,
      gas: 1.0,
      other_fossil: 0.5,
      hardcoal: 1.0,
      lignite: 0.5,
    },
    totalGenerationTwh: 10,
  }
}

function createDefaultProps(
  overrides: Partial<{
    monthRow: MixMonthRow
    chartX: number
    chartY: number
    highlightedSource: MixSourceKey | null
  }> = {},
) {
  return {
    monthRow: createTooltipData(),
    chartX: 100,
    chartY: 200,
    highlightedSource: null,
    ...overrides,
  }
}

describe('MixTooltip', () => {
  // =======================================================================
  // Monatsanzeige
  // =======================================================================

  it('zeigt den Monat auf Deutsch an', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps(),
    })

    expect(wrapper.text()).toContain('Januar 2024')
  })

  // =======================================================================
  // Gruppenübersicht ohne Auswahl
  // =======================================================================

  it('zeigt alle vier Gruppenzeilen (Gesamt, Erneuerbare, Kernenergie, Fossil)', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: null }),
    })

    expect(wrapper.text()).toContain('Gesamt')
    expect(wrapper.text()).toContain('Erneuerbare')
    expect(wrapper.text()).toContain('Kernenergie')
    expect(wrapper.text()).toContain('Fossile')
  })

  it('zeigt die korrekten Gruppensummen (6+1+3=10 TWh)', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: null }),
    })

    expect(wrapper.text()).toContain('10,0 TWh')
    expect(wrapper.text()).toContain('6,0 TWh')
    expect(wrapper.text()).toContain('1,0 TWh')
    expect(wrapper.text()).toContain('3,0 TWh')
  })

  it('zeigt die korrekten Gruppenanteile (60 %, 10 %, 30 %)', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: null }),
    })

    expect(wrapper.text()).toContain('60,0 %')
    expect(wrapper.text()).toContain('10,0 %')
    expect(wrapper.text()).toContain('30,0 %')
  })

  it('zeigt keine zehn Einzelquellen an', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: null }),
    })

    expect(wrapper.text()).not.toContain('Braunkohle')
  })

  // =======================================================================
  // Einzelauswahl
  // =======================================================================

  it('zeigt bei Auswahl von Photovoltaik den Quellennamen', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: 'pv' }),
    })

    expect(wrapper.text()).toContain('Januar 2024')
    expect(wrapper.text()).toContain('Photovoltaik')
  })

  it('zeigt bei Einzelauswahl Wert und Monatsanteil', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: 'pv' }),
    })

    // pv = 1.0 von 10 = 10,0 %
    expect(wrapper.text()).toContain('1,0 TWh')
    expect(wrapper.text()).toContain('10,0 %')
    expect(wrapper.text()).toContain('des Monats')
  })

  it('bei Einzelauswahl erscheinen keine Gruppenzeilen', () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: 'lignite' }),
    })

    expect(wrapper.text()).not.toContain('Gesamt')
    expect(wrapper.text()).not.toContain('Erneuerbare')
    expect(wrapper.text()).not.toContain('Fossile')
  })

  // =======================================================================
  // Prop-Reaktivität: wechselt zwischen Gruppen- und Einzelmodus
  // =======================================================================

  it('wechselt bei Prop-Änderung von null → pv → null zwischen den Zuständen', async () => {
    const wrapper = mount(MixTooltip, {
      props: createDefaultProps({ highlightedSource: null }),
    })

    // Start: Gruppenmodus
    expect(wrapper.text()).toContain('Gesamt')
    expect(wrapper.text()).toContain('Erneuerbare')

    // Prop auf pv ändern
    await wrapper.setProps({ highlightedSource: 'pv' })

    // Jetzt: Einzelmodus
    expect(wrapper.text()).toContain('Photovoltaik')
    expect(wrapper.text()).toContain('1,0 TWh')
    expect(wrapper.text()).toContain('10,0 %')
    expect(wrapper.text()).not.toContain('Gesamt')

    // Prop zurück auf null
    await wrapper.setProps({ highlightedSource: null })

    // Wieder: Gruppenmodus
    expect(wrapper.text()).toContain('Gesamt')
    expect(wrapper.text()).toContain('Erneuerbare')
    expect(wrapper.text()).toContain('Kernenergie')
    expect(wrapper.text()).toContain('Fossile')
    expect(wrapper.text()).not.toContain('Photovoltaik')
  })
})
