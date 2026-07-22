/**
 * tests/components/StackedArea.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useMixSelection } from '~/composables/useMixSelection'
import StackedArea from '~/components/viz/StackedArea.vue'

function createMonthRow(month: string, value: number) {
  const [y, m] = month.split('-')
  return {
    month,
    date: new Date(Number(y), Number(m) - 1, 1),
    values: {
      hydro: value, biomass: value, wind_offshore: value,
      wind_onshore: value, pv: value, nuclear: value,
      gas: value, other_fossil: value, hardcoal: value, lignite: value,
    },
  }
}

vi.mock('~/composables/useMixData', () => ({
  useMixData: () => ({
    monthRows: { value: [createMonthRow('2024-01', 10), createMonthRow('2024-02', 12)] },
    yearRows: {
      value: [
        { year: 2015, values: { hydro: 10, biomass: 10, wind_offshore: 10, wind_onshore: 10, pv: 10, nuclear: 10, gas: 10, other_fossil: 10, hardcoal: 10, lignite: 10 } },
        { year: 2024, values: { hydro: 10, biomass: 10, wind_offshore: 10, wind_onshore: 10, pv: 40, nuclear: 5, gas: 10, other_fossil: 10, hardcoal: 1, lignite: 10 } },
      ],
    },
    pending: { value: false },
    error: { value: null },
    loadData: async () => {},
  }),
}))

const mockAnnotations = [
  { id: 1, date: '2024-01', title: 'Test Event', text: 'Test text', highlight: ['pv' as const] },
]

beforeEach(() => {
  const { setMode, setHighlighted, setSelectedAnnotation } = useMixSelection()
  setMode('absolute')
  setHighlighted(null)
  setSelectedAnnotation(null)

  // Mock fetch for annotations
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockAnnotations),
  }))
})

describe('StackedArea', () => {
  it('shows title', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()
    expect(wrapper.find('.chart-container svg').exists()).toBe(true)
  })

  it('renders SVG with 10 layers', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()
    expect(wrapper.findAll('.layer').length).toBe(10)
  })

  it('shows mode buttons', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()
    expect(wrapper.text()).toContain('TWh')
    expect(wrapper.text()).toContain('Prozent')
  })

  it('toggles mode on button click', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()
    const shareBtn = wrapper.findAll('button').find((b) => b.text().includes('Prozent'))
    await shareBtn?.trigger('click')
    await flushPromises()
    expect(shareBtn?.attributes('aria-pressed')).toBe('true')
  })

  it('shows legend with energy sources', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()
    expect(wrapper.text()).toContain('Photovoltaik')
    expect(wrapper.text()).toContain('Braunkohle')
    expect(wrapper.findAll('.layer').length).toBe(10)
  })

  it('toggles highlight on legend chip click', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const pvBtn = wrapper.findAll('button').find((b) => b.text().includes('Photovoltaik'))

    await pvBtn?.trigger('click')
    await flushPromises()
    expect(pvBtn?.attributes('aria-pressed')).toBe('true')

    await pvBtn?.trigger('click')
    await flushPromises()
    expect(pvBtn?.attributes('aria-pressed')).toBe('false')
  })

  it('renders hover overlay and guide', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const overlay = wrapper.find('.hover-overlay')
    const guide = wrapper.find('.hover-guide')

    expect(overlay.exists()).toBe(true)
    expect(guide.exists()).toBe(true)
  })

  it('does not show tooltip initially', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    expect(wrapper.find('.mix-tooltip').exists()).toBe(false)
  })

  it('zeigt einen Marker nach dem Laden (nur statisch, kein Punkt 6 mehr)', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    // Marker sind jetzt in der Sidebar als .annotation-button
    expect(wrapper.findAll('.annotation-button').length).toBe(1)
  })

  it('selektiert Annotation bei Klick auf Marker', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const markers = wrapper.findAll('.annotation-button')
    const firstMarker = markers[0]!
    await firstMarker.trigger('click')
    await flushPromises()

    expect(firstMarker.attributes('aria-pressed')).toBe('true')
  })

  it('deselektiert Annotation bei erneutem Klick', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const markers = wrapper.findAll('.annotation-button')
    const firstMarker = markers[0]!
    await firstMarker.trigger('click')
    await flushPromises()
    await firstMarker.trigger('click')
    await flushPromises()

    expect(firstMarker.attributes('aria-pressed')).toBe('false')
  })

  it('zeigt feste Guide-Linie bei ausgewählter Annotation', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const markers = wrapper.findAll('.annotation-button')
    const firstMarker = markers[0]!
    await firstMarker.trigger('click')
    await flushPromises()

    const guide = wrapper.find('.fixed-annotation-guide')
    expect(guide.exists()).toBe(true)
  })

  it('zeigt Default-Sidebar mit Übersicht', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    expect(wrapper.text()).toContain('Veränderungen 2015–2024')
  })

  it('zeigt Quellenzustand bei Legendenklick', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const pvButton = wrapper.findAll('button').find((button) => {
      return button.text().includes('Photovoltaik')
    })

    await pvButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Photovoltaik')
    expect(wrapper.text()).toContain('Jahressumme 2024')
    expect(wrapper.text()).toContain('Höchster Monatswert')
    expect(wrapper.text()).toContain('Niedrigster Monatswert')
  })

  it('zeigt wieder Übersicht nach erneutem Legendenklick', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const pvButton = wrapper.findAll('button').find((button) => {
      return button.text().includes('Photovoltaik')
    })

    await pvButton?.trigger('click')
    await flushPromises()
    await pvButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Veränderungen 2015–2024')
  })

  it('zeigt Annotation-Zustand bei Marker-Klick', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const markers = wrapper.findAll('.annotation-button')
    const firstMarker = markers[0]!
    await firstMarker.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Test Event')
    expect(wrapper.text()).toContain('Anteile im ausgewählten Monat')
  })

  it('Annotation hat Vorrang vor Quelle', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    // Erst Quelle auswählen
    const pvButton = wrapper.findAll('button').find((button) => {
      return button.text().includes('Photovoltaik')
    })

    await pvButton?.trigger('click')
    await flushPromises()

    // Dann Annotation auswählen
    const markers = wrapper.findAll('.annotation-button')
    const firstMarker = markers[0]!
    await firstMarker.trigger('click')
    await flushPromises()

    // Annotation-Text sichtbar
    expect(wrapper.text()).toContain('Test Event')
    expect(wrapper.text()).toContain('Anteile im ausgewählten Monat')
  })

  it('"Alle"-Button setzt Hervorhebung zurück', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    // Photovoltaik auswählen
    const pvButton = wrapper.findAll('button').find((button) => {
      return button.text().includes('Photovoltaik')
    })!

    await pvButton.trigger('click')
    await flushPromises()

    // Prüfe: pv-Layer opacity 1, gas-Layer opacity 0.15
    expect(
      wrapper.find('.layer-pv').attributes('opacity'),
    ).toBe('1')

    expect(
      wrapper.find('.layer-gas').attributes('opacity'),
    ).toBe('0.15')

    // "Alle"-Button anklicken
    const allButton = wrapper.findAll('button').find((button) => {
      return button.text().includes('Alle')
    })!

    await allButton.trigger('click')
    await flushPromises()

    // Prüfe: alle Layer wieder opacity 1
    expect(
      wrapper.find('.layer-pv').attributes('opacity'),
    ).toBe('1')

    expect(
      wrapper.find('.layer-gas').attributes('opacity'),
    ).toBe('1')

    // "Alle"-Button ist aktiv
    expect(allButton.attributes('aria-pressed')).toBe('true')

    // Photovoltaik-Button ist nicht mehr aktiv
    expect(pvButton.attributes('aria-pressed')).toBe('false')
  })

  it('hat keine permanente Ereignisliste (kein .annotation-list)', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    expect(wrapper.find('.annotation-list').exists()).toBe(false)
  })

  it('zeigt Datenstand-Metazeile nach dem Laden', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    expect(wrapper.text()).toContain('Quelle: SMARD')
    expect(wrapper.text()).toContain('Datenstand:')
  })

  it('Marker-Bereich enthält nicht "Aktueller Datenstand"', async () => {
    const wrapper = mount(StackedArea)
    await flushPromises()

    const markerSection = wrapper.find('.annotation-navigation')

    expect(markerSection.text()).not.toContain(
      'Aktueller Datenstand',
    )
  })
})

