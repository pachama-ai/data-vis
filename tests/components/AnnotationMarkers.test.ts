import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AnnotationMarkers from '~/components/generation/AnnotationMarkers.vue'
import type { MixSourceKey } from '~/types/mix'

const testAnnotations = [
  { id: 1, date: '2015-12', title: 'Pariser Klimaabkommen beschlossen', text: 'Am 12. Dezember 2015 …', highlight: ['pv' as MixSourceKey] },
  { id: 2, date: '2020-07', title: 'Kohleausstiegsgesetz beschlossen', text: 'Am 3. Juli 2020 …', highlight: ['hardcoal' as MixSourceKey] },
  { id: 3, date: '2021-12', title: 'Drei Kernkraftwerke wurden abgeschaltet', text: 'Am 31. Dezember 2021 …', highlight: ['nuclear' as MixSourceKey] },
  { id: 4, date: '2022-02', title: 'Ukrainekrieg verschärfte die Energiekrise', text: 'Angriff auf die Ukraine …', highlight: ['gas' as MixSourceKey] },
  { id: 5, date: '2023-04', title: 'Atomausstieg wurde abgeschlossen', text: 'Am 15. April 2023 …', highlight: ['nuclear' as MixSourceKey] },
]

describe('AnnotationMarkers', () => {
  it('rendert fünf Buttons (kein Punkt 6 mehr)', () => {
    const wrapper = mount(AnnotationMarkers, {
      props: {
        annotations: testAnnotations,
        selectedAnnotation: null,
      },
    })

    const buttons = wrapper.findAll('.annotation-button')
    expect(buttons.length).toBe(5)
  })

  it('zeigt die Nummern 1 bis 5 in den Buttons', () => {
    const wrapper = mount(AnnotationMarkers, {
      props: {
        annotations: testAnnotations,
        selectedAnnotation: null,
      },
    })

    const buttons = wrapper.findAll('.annotation-button')
    expect(buttons[0]?.text()).toBe('1')
    expect(buttons[1]?.text()).toBe('2')
    expect(buttons[2]?.text()).toBe('3')
    expect(buttons[3]?.text()).toBe('4')
    expect(buttons[4]?.text()).toBe('5')
  })

  it('emittiert select-Event bei Klick auf Button', async () => {
    const wrapper = mount(AnnotationMarkers, {
      props: {
        annotations: testAnnotations,
        selectedAnnotation: null,
      },
    })

    const buttons = wrapper.findAll('.annotation-button')
    await buttons[3]?.trigger('click')

    const emitted = wrapper.emitted('select')?.[0]?.[0] as { id: number }

    expect(emitted.id).toBe(4)
  })

  it('setzt aria-pressed auf aktivem Button', () => {
    const wrapper = mount(AnnotationMarkers, {
      props: {
        annotations: testAnnotations,
        selectedAnnotation: 4,
      },
    })

    const buttons = wrapper.findAll('.annotation-button')
    expect(buttons[3]?.attributes('aria-pressed')).toBe('true')
  })

  it('hat eindeutige aria-label auf jedem Button', () => {
    const wrapper = mount(AnnotationMarkers, {
      props: {
        annotations: testAnnotations,
        selectedAnnotation: null,
      },
    })

    const buttons = wrapper.findAll('.annotation-button')
    expect(buttons[3]?.attributes('aria-label')).toContain('Ukrainekrieg')
  })
})
