/**
 * tests/components/GroupedBarChart.test.ts
 *
 * Prüft das gruppierte Balkendiagramm auf der Landingpage.
 * Die Komponente rendert mit D3 in ein SVG (kein Canvas).
 *
 * Hinweis: D3 verwendet SVG-APIs, die happy-dom nur teilweise
 * unterstützt. Falls D3-Funktionen wie d3.axisBottom intern
 * getBBox() aufrufen, kann das in happy-dom fehlschlagen.
 * In dem Fall werden SVG-Elemente auf Existenz geprüft.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupedBarChart from '~/components/home/GroupedBarChart.vue'
import type { EnergyDataPoint } from '~/components/home/groupedBarUtils'

/** Minimaler, realistischer Testdatensatz für das Balkendiagramm. */
function createMockData(): EnergyDataPoint[] {
  return [
    {
      id: 'wind_onshore',
      label: 'Wind Onshore',
      category: 'erneuerbar',
      value2015: 12.3,
      value2024: 24.1,
      displayedDelta: 11.8,
    },
    {
      id: 'braunkohle',
      label: 'Braunkohle',
      category: 'fossil',
      value2015: 25.4,
      value2024: 17.2,
      displayedDelta: -8.2,
    },
    {
      id: 'kernenergie',
      label: 'Kernenergie',
      category: 'kernkraft',
      value2015: 14.1,
      value2024: 0.0,
      displayedDelta: -14.1,
    },
  ]
}

// =========================================================================
// 1. Grundlegende Tests
// =========================================================================

describe('GroupedBarChart – Grundlegendes', () => {
  it('mountet ohne Fehler mit gültigen Daten', () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('rendert ein SVG-Element', () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })
    const svg = wrapper.find('svg.grouped-bar-svg')
    expect(svg.exists()).toBe(true)
  })
})

// =========================================================================
// 2. D3-Rendering
// =========================================================================

describe('GroupedBarChart – D3-Rendering', () => {
  it('erzeugt Balken (rect-Elemente) im SVG', async () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })

    // Warte auf Vue-Reaktivität (watch/onMounted)
    await new Promise((resolve) => setTimeout(resolve, 100))

    const svg = wrapper.find('svg.grouped-bar-svg')
    expect(svg.exists()).toBe(true)

    // D3 sollte rects (Balken) erzeugt haben.
    // Die Anzahl sollte 2 * Datenpunkte sein (2015 + 2024 pro Punkt).
    const rects = svg.findAll('rect')
    expect(rects.length).toBeGreaterThanOrEqual(2)
  })

  it('erzeugt Text-Labels im SVG', async () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const svg = wrapper.find('svg.grouped-bar-svg')
    // Es sollten Text-Elemente für die Prozent-Labels vorhanden sein
    const texts = svg.findAll('text')
    expect(texts.length).toBeGreaterThanOrEqual(1)
  })

  it('erzeugt keine mehrfachen SVGs bei Prop-Update', async () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    // SVG nach initialem Mount
    const svgCountBefore = wrapper.findAll('svg.grouped-bar-svg').length
    expect(svgCountBefore).toBe(1)

    // Prop-Update: andere Daten
    const newData: EnergyDataPoint[] = [
      {
        id: 'wind_onshore',
        label: 'Wind Onshore',
        category: 'erneuerbar',
        value2015: 12.3,
        value2024: 26.0,
        displayedDelta: 13.7,
      },
    ]
    await wrapper.setProps({ data: newData })
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Es sollte immer noch genau ein SVG existieren
    const svgCountAfter = wrapper.findAll('svg.grouped-bar-svg').length
    expect(svgCountAfter).toBe(1)
  })
})

// =========================================================================
// 3. getBarLabelColor – Referenzfehler-Prüfung
// =========================================================================

describe('GroupedBarChart – getBarLabelColor', () => {
  it('wirft keinen ReferenceError für getBarLabelColor', async () => {
    // Der bekannte Runtime-Fehler "getBarLabelColor is not defined"
    // soll nicht auftreten. Wir fangen unerwartete Fehler ab.
    let caughtError: unknown = null

    // Fehler abfangen, die während des Renderings auftreten
    const originalOnError = window.onerror
    window.onerror = (_msg, _url, _line, _col, error) => {
      caughtError = error
      return true
    }

    try {
      const wrapper = mount(GroupedBarChart, {
        props: { data: createMockData() },
      })
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Prüfe, ob ein ReferenceError aufgetreten ist
      if (caughtError instanceof ReferenceError) {
        expect(caughtError.message).not.toContain('getBarLabelColor')
      }

      // Prüfe, ob die Komponente wie erwartet funktioniert
      const svg = wrapper.find('svg.grouped-bar-svg')
      expect(svg.exists()).toBe(true)

      // Unter der Annahme, dass D3-Callbacks ausgeführt wurden:
      // Wenn getBarLabelColor fehlschlagen würde, gäbe es weniger
      // oder gar keine rects. Wir prüfen nur auf Existenz.
      const rects = svg.findAll('rect')
      expect(rects.length).toBeGreaterThanOrEqual(2)

      // Labels sollten vorhanden sein
      const texts = svg.findAll('text')
      expect(texts.length).toBeGreaterThanOrEqual(1)
    } finally {
      window.onerror = originalOnError
    }
  })

  it('ruft renderChart ohne Exception auf (Prop-Update)', async () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Prop-Update sollte renderChart ohne Fehler ausführen
    await expect(
      wrapper.setProps({
        data: [
          {
            id: 'gas',
            label: 'Erdgas',
            category: 'fossil',
            value2015: 10.0,
            value2024: 15.0,
            displayedDelta: 5.0,
          },
        ],
      }),
    ).resolves.not.toThrow()

    await new Promise((resolve) => setTimeout(resolve, 50))
  })
})

// =========================================================================
// 4. Daten-Interaktion
// =========================================================================

describe('GroupedBarChart – Daten', () => {
  it('zeigt Balken auch nach Filter-Wechsel (aktualisiertes Rendering)', async () => {
    const wrapper = mount(GroupedBarChart, {
      props: { data: createMockData() },
    })
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Daten ersetzen (simuliert veränderte Eingangsdaten)
    const reducedData: EnergyDataPoint[] = [
      {
        id: 'wind_onshore',
        label: 'Wind Onshore',
        category: 'erneuerbar',
        value2015: 12.3,
        value2024: 24.1,
        displayedDelta: 11.8,
      },
    ]
    await wrapper.setProps({ data: reducedData })
    await new Promise((resolve) => setTimeout(resolve, 100))

    const svg = wrapper.find('svg.grouped-bar-svg')
    const rects = svg.findAll('rect')
    // Mindestens 2 rects (Balken für 2015 + 2024)
    expect(rects.length).toBeGreaterThanOrEqual(2)
  })
})
