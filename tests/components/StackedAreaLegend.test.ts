/**
 * tests/components/StackedAreaLegend.test.ts
 *
 * Testet die StackedAreaLegend-Komponente isoliert:
 * Anzeige aller Quellen, Gruppen, Klick-Event und aktiver Zustand.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StackedAreaLegend from '~/components/viz/StackedAreaLegend.vue'

describe('StackedAreaLegend', () => {
  it('zeigt alle zehn Energieträger plus "Alle"-Button', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(11)
  })

  it('zeigt die drei Gruppenüberschriften an', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    expect(wrapper.text()).toContain('Erneuerbare')
    expect(wrapper.text()).toContain('Kernenergie')
    expect(wrapper.text()).toContain('Fossile')
  })

  it('emittiert den Source-Key bei Klick', async () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    const buttons = wrapper.findAll('button')
    const pvButton = buttons.find((btn) => btn.text().includes('Photovoltaik'))

    await pvButton?.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['pv']])
  })

  it('setzt aria-pressed auf dem aktiven Chip', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: 'pv' },
    })

    const buttons = wrapper.findAll('button')
    const pvButton = buttons.find((btn) => btn.text().includes('Photovoltaik'))

    expect(pvButton?.attributes('aria-pressed')).toBe('true')
  })

  it('zeigt den "Alle"-Button mit aria-label', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.exists()).toBe(true)
    expect(allButton.attributes('aria-label')).toBe(
      'Alle Energieträger anzeigen',
    )
  })

  it('"Alle" ist standardmäßig aktiv bei highlighted=null', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.attributes('aria-pressed')).toBe('true')
  })

  it('"Alle" emittiert null bei Klick', async () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null },
    })

    const allButton = wrapper.find('.legend-all-button')
    await allButton.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[null]])
  })

  it('"Alle" ist nicht aktiv, wenn eine Quelle hervorgehoben ist', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: 'pv' },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.attributes('aria-pressed')).toBe('false')
  })
})
