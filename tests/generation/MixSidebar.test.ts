/**
 * tests/components/MixSidebar.test.ts
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MixSidebar from '~/components/generation/MixSidebar.vue'
import type { MixSourceKey } from '~/types/mix'
import type {
  OverviewMetrics,
  SourceMetrics,
  AnnotationContext,
} from '~/composables/useMixMetrics'

// =========================================================================
// Testdaten
// =========================================================================

const testOverviewMetrics: OverviewMetrics = {
  groups: [
    {
      group: 'renewable',
      value2015: 50,
      value2024: 80,
      share2015: 0.5,
      share2024: 0.66,
      percentagePointChange: 16,
    },
    {
      group: 'nuclear',
      value2015: 20,
      value2024: 5,
      share2015: 0.2,
      share2024: 0.04,
      percentagePointChange: -16,
    },
    {
      group: 'fossil',
      value2015: 30,
      value2024: 36,
      share2015: 0.3,
      share2024: 0.3,
      percentagePointChange: 0,
    },
  ],
  largestIncrease: {
    sourceKey: 'pv' as MixSourceKey,
    changeTwh: 30,
  },
  largestDecrease: {
    sourceKey: 'hardcoal' as MixSourceKey,
    changeTwh: -9,
  },
}

const testSourceMetrics: SourceMetrics = {
  sourceKey: 'pv' as MixSourceKey,
  value2015: 10,
  value2024: 40,
  share2015: 0.1,
  share2024: 0.33,
  changeTwh: 30,
  percentagePointChange: 23,
  maximumMonth: {
    monthRow: {
      month: '2024-06',
      date: new Date(2024, 5, 1),
      values: {} as Record<MixSourceKey, number>,
      totalGenerationTwh: 10,
    },
    valueTwh: 5,
  },
  minimumMonth: {
    monthRow: {
      month: '2024-01',
      date: new Date(2024, 0, 1),
      values: {} as Record<MixSourceKey, number>,
      totalGenerationTwh: 10,
    },
    valueTwh: 1,
  },
}

const testAnnotationContext: AnnotationContext = {
  annotation: {
    id: 5,
    date: '2023-04',
    title: 'Atomausstieg wurde abgeschlossen',
    text: 'Am 15. April 2023 sind die letzten drei deutschen Kernkraftwerke Isar 2, Emsland und Neckarwestheim 2 abgeschaltet worden.',
    highlight: ['nuclear' as MixSourceKey],
  },
  monthRow: {
    month: '2023-04',
    date: new Date(2023, 3, 1),
    values: {} as Record<MixSourceKey, number>,
    totalGenerationTwh: 10,
  },
  groupShares: [
    { group: 'renewable', valueTwh: 6, share: 0.6 },
    { group: 'nuclear', valueTwh: 1, share: 0.1 },
    { group: 'fossil', valueTwh: 3, share: 0.3 },
  ],
}

// =========================================================================
// Tests
// =========================================================================

describe('MixSidebar', () => {
  it('zeigt Übersicht mit Gruppen und Veränderungen', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: testOverviewMetrics,
        sourceMetrics: null,
        annotationContext: null,
        highlighted: null,
        annotations: [],
        selectedAnnotation: null,
      },
    })

    expect(wrapper.text()).toContain('Vergleich zwischen 2015 und 2024')
    expect(wrapper.text()).toContain('Größter absoluter Zuwachs')
    expect(wrapper.text()).toContain('Größter absoluter Rückgang')
  })

  it('zeigt Energieträger-Details bei sourceMetrics', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: testOverviewMetrics,
        sourceMetrics: testSourceMetrics,
        annotationContext: null,
        highlighted: 'pv',
        annotations: [],
        selectedAnnotation: null,
      },
    })

    expect(wrapper.text()).toContain('Photovoltaik')
    expect(wrapper.text()).toContain('Jahressumme 2024')
    expect(wrapper.text()).toContain('Anteil am Jahresmix 2024')
    expect(wrapper.text()).toContain('Höchster Monatswert')
    expect(wrapper.text()).toContain('Niedrigster Monatswert')
  })

  it('zeigt Annotation-Kontext bei annotationContext', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: null,
        sourceMetrics: null,
        annotationContext: testAnnotationContext,
        highlighted: null,
        annotations: [testAnnotationContext.annotation],
        selectedAnnotation: null,
      },
    })

    expect(wrapper.text()).toContain('Atomausstieg wurde abgeschlossen')
    expect(wrapper.text()).toContain('Anteile im ausgewählten Monat')
    expect(wrapper.text()).toContain('Erneuerbare')
    expect(wrapper.text()).toContain('Fossile')
    expect(wrapper.text()).toContain('Kernenergie')
  })

  it('Annotation hat Vorrang vor Energieträger', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: null,
        sourceMetrics: testSourceMetrics,
        annotationContext: testAnnotationContext,
        highlighted: 'pv',
        annotations: [testAnnotationContext.annotation],
        selectedAnnotation: null,
      },
    })

    // Annotation wird angezeigt
    expect(wrapper.text()).toContain('Atomausstieg wurde abgeschlossen')

    // Energieträger-Zustand nicht sichtbar
    expect(wrapper.text()).not.toContain('Photovoltaik')
  })

  it('zeigt Fehlermeldung bei fehlenden Daten', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: null,
        sourceMetrics: null,
        annotationContext: null,
        highlighted: null,
        annotations: [],
        selectedAnnotation: null,
      },
    })

    expect(wrapper.text()).toContain('Kennzahlen sind nicht verfügbar')
  })

  it('Sidebar enthält keine Quellenangabe', () => {
    const wrapper = mount(MixSidebar, {
      props: {
        overviewMetrics: null,
        sourceMetrics: null,
        annotationContext: null,
        highlighted: null,
        annotations: [],
        selectedAnnotation: null,
      },
    })

    expect(wrapper.text()).not.toContain('Quelle:')
  })
})
