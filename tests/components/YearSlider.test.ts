/**
 * tests/components/YearSlider.test.ts
 *
 * Testet die YearSlider-Komponente.
 *
 * Aufruf: npx vitest run tests/components/YearSlider.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import YearSlider from '~/components/emissions/YearSlider.vue'

describe('YearSlider', () => {
  it('zeigt das gewählte Jahr an', () => {
    const wrapper = mount(YearSlider, {
      props: {
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
        selectedYear: 2022,
      },
    })

    expect(wrapper.text()).toContain('2022')
  })

  it('zeigt Minimum und Maximum korrekt an', () => {
    const wrapper = mount(YearSlider, {
      props: {
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
        selectedYear: 2024,
      },
    })

    expect(wrapper.text()).toContain('2015')
    expect(wrapper.text()).toContain('2024')
  })

  it('emittiert eine Zahl beim Ändern', () => {
    const wrapper = mount(YearSlider, {
      props: {
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
        selectedYear: 2024,
      },
    })

    const inputElement = wrapper.find('input[type="range"]')

    // Wert programmatisch setzen und input-Event auslösen
    const inputDomElement = inputElement.element as HTMLInputElement
    inputDomElement.value = '2022'

    inputElement.trigger('input')

    const emittedEvents = wrapper.emitted('change')

    expect(emittedEvents).toEqual([[2022]])
  })

  it('leere Jahresliste verursacht keine Exception', () => {
    const wrapper = mount(YearSlider, {
      props: {
        years: [],
        selectedYear: 2024,
      },
    })

    // Sollte Exception-frei rendern
    expect(wrapper.exists()).toBe(true)
  })
})
