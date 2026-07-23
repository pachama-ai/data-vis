/**
 * tests/components/StackedAreaLegend.test.ts
 *
 * Testet die StackedAreaLegend-Komponente isoliert:
 * Anzeige aller Quellen, Gruppen, Klick-Event und aktiver Zustand.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StackedAreaLegend from '~/components/generation/StackedAreaLegend.vue'

describe('StackedAreaLegend', () => {
  it('zeigt alle zehn Energieträger plus "Alle"-Button', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(11)
  })

  it('zeigt die drei Gruppenüberschriften an', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    expect(wrapper.text()).toContain('Erneuerbare')
    expect(wrapper.text()).toContain('Kernenergie')
    expect(wrapper.text()).toContain('Fossile')
  })

  it('emittiert den Source-Key bei Klick', async () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const buttons = wrapper.findAll('button')
    const pvButton = buttons.find((btn) => btn.text().includes('Photovoltaik'))

    await pvButton?.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['pv']])
  })

  it('setzt aria-pressed auf dem aktiven Chip', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: 'pv', colorMode: 'default' },
    })

    const buttons = wrapper.findAll('button')
    const pvButton = buttons.find((btn) => btn.text().includes('Photovoltaik'))

    expect(pvButton?.attributes('aria-pressed')).toBe('true')
  })

  it('zeigt den "Alle"-Button mit aria-label', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.exists()).toBe(true)
    expect(allButton.attributes('aria-label')).toBe(
      'Alle Energieträger anzeigen',
    )
  })

  it('"Alle" ist standardmäßig aktiv bei highlighted=null', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.attributes('aria-pressed')).toBe('true')
  })

  it('"Alle" emittiert null bei Klick', async () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const allButton = wrapper.find('.legend-all-button')
    await allButton.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[null]])
  })

  it('"Alle" ist nicht aktiv, wenn eine Quelle hervorgehoben ist', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: 'pv', colorMode: 'default' },
    })

    const allButton = wrapper.find('.legend-all-button')

    expect(allButton.attributes('aria-pressed')).toBe('false')
  })

  it('disables unrelated sources when highlightedSources is set', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: {
        highlighted: null,
        colorMode: 'default',
        highlightedSources: ['pv', 'wind_onshore'],
        hasActiveAnnotation: true,
      },
    })

    const buttons = wrapper.findAll('button')
    const pvButton = buttons.find((btn) => btn.text().includes('Photovoltaik'))
    const ligniteButton = buttons.find((btn) => btn.text().includes('Braunkohle'))

    // PV is in highlightedSources → not disabled
    expect(pvButton?.attributes('disabled')).toBeUndefined()

    // Braunkohle is NOT in highlightedSources → disabled
    expect(ligniteButton?.attributes('disabled')).toBeDefined()
  })

  it('click on disabled source does nothing', async () => {
    const wrapper = mount(StackedAreaLegend, {
      props: {
        highlighted: null,
        colorMode: 'default',
        highlightedSources: ['pv'],
        hasActiveAnnotation: true,
      },
    })

    const buttons = wrapper.findAll('button')
    const ligniteButton = buttons.find((btn) => btn.text().includes('Braunkohle'))

    await ligniteButton?.trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('all sources are enabled when highlightedSources is null', () => {
    const wrapper = mount(StackedAreaLegend, {
      props: { highlighted: null, colorMode: 'default' },
    })

    const buttons = wrapper.findAll('button')
    const sourceButtons = buttons.filter((btn) => !btn.classes().includes('legend-all-button') && !btn.classes().includes('legend-contrast-button'))

    for (const btn of sourceButtons) {
      expect(btn.attributes('disabled')).toBeUndefined()
    }
  })
})
