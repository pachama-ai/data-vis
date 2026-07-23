/**
 * tests/common/ChartTemplate.test.ts
 *
 * Testet den wiederverwendbaren Chart-Rahmen.
 * - Titel und Untertitel werden angezeigt
 * - Controls-Slot wird gerendert
 * - Overlay-Slot wird gerendert
 * - chartContainer wird per ref exponiert
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartTemplate from '~/components/common/ChartTemplate.vue'

describe('ChartTemplate', function () {
  it('zeigt den Titel an', function () {
    var wrapper = mount(ChartTemplate, {
      props: { title: 'Stromerzeugung 2024' },
    })

    expect(wrapper.text()).toContain('Stromerzeugung 2024')
  })

  it('zeigt den Untertitel an', function () {
    var wrapper = mount(ChartTemplate, {
      props: { subtitle: 'Monatswerte in TWh' },
    })

    expect(wrapper.text()).toContain('Monatswerte in TWh')
  })

  it('rendert keinen Titel, wenn keiner übergeben wird', function () {
    var wrapper = mount(ChartTemplate)

    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('rendert keinen Untertitel, wenn keiner übergeben wird', function () {
    var wrapper = mount(ChartTemplate)

    expect(wrapper.find('.chart-subtitle').exists()).toBe(false)
  })

  it('rendert den Controls-Slot', function () {
    var wrapper = mount(ChartTemplate, {
      slots: {
        controls: '<button>Schaltfläche</button>',
      },
    })

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('Schaltfläche')
  })

  it('rendert den Overlay-Slot', function () {
    var wrapper = mount(ChartTemplate, {
      slots: {
        overlay: '<div class="test-overlay">Overlay</div>',
      },
    })

    expect(wrapper.find('.test-overlay').exists()).toBe(true)
  })

  it('rendert den Default-Slot (Footer)', function () {
    var wrapper = mount(ChartTemplate, {
      slots: {
        default: '<p class="footer-text">Fußzeile</p>',
      },
    })

    expect(wrapper.find('.footer-text').exists()).toBe(true)
  })

  it('exponiert chartContainer per defineExpose', function () {
    var wrapper = mount(ChartTemplate)

    expect(wrapper.vm.chartContainer).toBeDefined()
  })

  it('setzt eine zusätzliche wrapperClass', function () {
    var wrapper = mount(ChartTemplate, {
      props: { wrapperClass: 'custom-chart' },
    })

    expect(wrapper.find('.chart-wrapper.custom-chart').exists()).toBe(true)
  })
})
