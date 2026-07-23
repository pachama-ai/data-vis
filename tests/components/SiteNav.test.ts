/**
 * tests/components/SiteNav.test.ts
 *
 * Testet die globale Navigation SiteNav:
 * – Rendert 3 Tabs + Zoom-Button + Kontrast-Button
 * – Aktiver Tab je nach Route
 * – Zoom-Button und Kontrast-Button funktionieren
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SiteNav from '~/components/layout/SiteNav.vue'

// useRoute simulieren – Standard-Rückgabe
const mockRoute = vi.fn(() => ({ path: '/', query: {} }))

vi.mock('nuxt/app', () => ({
  useRoute: () => mockRoute(),
}))

const NuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('SiteNav', () => {
  beforeEach(() => {
    mockRoute.mockReturnValue({ path: '/', query: {} })
    // Zoom auf 100 % zurücksetzen
    document.documentElement.style.zoom = ''
  })

  function mountSiteNav() {
    return mount(SiteNav, {
      global: {
        stubs: {
          NuxtLink: NuxtLinkStub,
        },
      },
    })
  }

  it('rendert drei Navigations-Links', () => {
    const wrapper = mountSiteNav()

    const links = wrapper.findAll('a')
    expect(links.length).toBe(3)
    expect(links[0]!.text()).toBe('Strommix')
    expect(links[1]!.text()).toBe('Entwicklung')
    expect(links[2]!.text()).toBe('CO₂-Vergleich')
  })

  it('Strommix ist aktiv auf Route /', () => {
    const wrapper = mountSiteNav()

    const links = wrapper.findAll('a')
    expect(links[0]!.attributes('aria-current')).toBe('page')
    expect(links[1]!.attributes('aria-current')).toBeUndefined()
    expect(links[2]!.attributes('aria-current')).toBeUndefined()
  })

  it('Entwicklung ist aktiv auf Route /dashboard', () => {
    mockRoute.mockReturnValue({ path: '/dashboard', query: {} })

    const wrapper = mountSiteNav()

    const links = wrapper.findAll('a')
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
    expect(links[1]!.attributes('aria-current')).toBe('page')
    expect(links[2]!.attributes('aria-current')).toBeUndefined()
  })

  it('CO₂-Vergleich ist aktiv auf Route /dashboard?tab=emissions', () => {
    mockRoute.mockReturnValue({ path: '/dashboard', query: { tab: 'emissions' } })

    const wrapper = mountSiteNav()

    const links = wrapper.findAll('a')
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
    expect(links[1]!.attributes('aria-current')).toBeUndefined()
    expect(links[2]!.attributes('aria-current')).toBe('page')
  })

  it('zeigt zwei Buttons (Zoom + Kontrast)', () => {
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(2)
  })

  it('zeigt "Besser lesbar" Button', () => {
    const wrapper = mountSiteNav()

    expect(wrapper.text()).toContain('Besser lesbar')
  })

  it('Zoom-Button zeigt Lupe mit Plus als SVG', () => {
    const wrapper = mountSiteNav()

    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    const lines = svg.findAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('Zoom-Button hat aria-label mit aktuellem Wert', () => {
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('aria-label')).toContain('100 %')
  })

  it('Klick zoomt auf 105 %', async () => {
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')

    expect(buttons[0]!.attributes('aria-label')).toContain('105 %')
  })

  it('Ab 105 % weiterer Klick auf 110 %', async () => {
    // Vorheriger Test hat auf 105 % gesetzt – ein Klick geht auf 110 %
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')

    expect(buttons[0]!.attributes('aria-label')).toContain('110 %')
  })

  it('Ab 110 % Klick zurück auf 100 %', async () => {
    // Vorherige Tests haben auf 110 % gesetzt – ein Klick geht zurück auf 100 %
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')

    expect(buttons[0]!.attributes('aria-label')).toContain('100 %')
  })

  it('Kontrast-Button toggelt aria-pressed', async () => {
    const wrapper = mountSiteNav()

    const buttons = wrapper.findAll('button')
    const contrastBtn = buttons[buttons.length - 1]!

    expect(contrastBtn.attributes('aria-pressed')).toBe('false')

    await contrastBtn.trigger('click')
    expect(contrastBtn.attributes('aria-pressed')).toBe('true')

    await contrastBtn.trigger('click')
    expect(contrastBtn.attributes('aria-pressed')).toBe('false')
  })

  it('keine Reste von Textgrößen-Regler', () => {
    const wrapper = mountSiteNav()

    expect(wrapper.text()).not.toContain('Schriftgrösse')
    expect(wrapper.text()).not.toContain('Schriftgröße')
  })
})
