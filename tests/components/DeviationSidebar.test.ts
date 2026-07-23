/**
 * tests/components/DeviationSidebar.test.ts
 *
 * Testet die DeviationSidebar-Komponente.
 *
 * Aufruf: npx vitest run tests/components/DeviationSidebar.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import DeviationSidebar from '~/components/emissions/DeviationSidebar.vue'

import type { DeviationYear, EmissionRow } from '~/types/mix'
import type { MixSourceKey } from '~/types/mix'

// =========================================================================
// Hilfsfunktionen
// =========================================================================

function createEmissionRow(
  sourceKey: MixSourceKey,
  deviationPp: number,
  generationShare: number,
  emissionShare: number,
): EmissionRow {
  return {
    sourceKey,
    generationTwh: 10,
    generationShare,
    emissionsMt: 5,
    emissionShare,
    deviationPp,
  }
}

function createDeviationYear(year: number): DeviationYear {
  return {
    year,
    rows: [
      createEmissionRow('hydro', -4, 0.05, 0),
      createEmissionRow('biomass', -2, 0.03, 0),
      createEmissionRow('wind_offshore', -3, 0.04, 0),
      createEmissionRow('wind_onshore', -30, 0.35, 0),
      createEmissionRow('pv', -20, 0.25, 0),
      createEmissionRow('nuclear', -1, 0.02, 0),
      createEmissionRow('other_fossil', 3, 0.05, 0.08),
      createEmissionRow('gas', 5, 0.08, 0.13),
      createEmissionRow('hardcoal', 12, 0.06, 0.18),
      createEmissionRow('lignite', 30, 0.07, 0.37),
    ],
    totalGenerationTwh: 500,
    totalEmissionsMt: 100,
  }
}

// =========================================================================
// Tests
// =========================================================================

describe('DeviationSidebar', () => {
  const defaultProps = {
    activeYear: null as DeviationYear | null,
    baseYear: null as DeviationYear | null,
    hoveredRow: null as EmissionRow | null,
    selectedRow: null as EmissionRow | null,
    selectedRowBaseShare: null as number | null,
    largestMismatch: null as EmissionRow | null,
    emissionIntensity: 0,
    renewableShare: 0,
    baseRenewableShare: 0,
    baseEmissionIntensity: 0,
  }

  it('zeigt Standard-Überschrift-Elemente', () => {
    const activeYear = createDeviationYear(2022)

    const wrapper = mount(DeviationSidebar, {
      props: {
        ...defaultProps,
        activeYear,
        largestMismatch: activeYear.rows[activeYear.rows.length - 1]!,
        selectedRow: null,
        emissionIntensity: 412,
        renewableShare: 51,
        baseYear: createDeviationYear(2015),
        baseRenewableShare: 29,
        baseEmissionIntensity: 548,
      },
    })

    expect(wrapper.text()).toContain('Jahresüberblick')
    expect(wrapper.text()).toContain('CO₂-Emissionen je kWh')
    expect(wrapper.text()).toContain('Erneuerbaren-Anteil')
  })

  it('zeigt das Jahr im Standard-Zustand', () => {
    const activeYear = createDeviationYear(2022)

    // Lignite hat die größte positive Abweichung
    const ligniteRow = activeYear.rows.find(
      (r) => r.sourceKey === 'lignite',
    )!

    const wrapper = mount(DeviationSidebar, {
      props: {
        ...defaultProps,
        activeYear,
        largestMismatch: ligniteRow,        selectedRow: null,        emissionIntensity: 412,
        renewableShare: 51,
        baseYear: createDeviationYear(2015),
        baseRenewableShare: 29,
        baseEmissionIntensity: 548,
      },
    })

    expect(wrapper.text()).toContain('CO₂-Emissionen je kWh')
    expect(wrapper.text()).toContain('412 g CO₂/kWh')
  })

  it('zeigt Hover-Satz für positive Abweichung', () => {
    const activeYear = createDeviationYear(2022)
    const ligniteRow = activeYear.rows.find(
      (r) => r.sourceKey === 'lignite',
    )!

    const wrapper = mount(DeviationSidebar, {
      props: {
        ...defaultProps,
        activeYear,
        hoveredRow: ligniteRow,
        largestMismatch: ligniteRow,
        emissionIntensity: 412,
        renewableShare: 51,
        baseYear: createDeviationYear(2015),
        baseRenewableShare: 29,
        baseEmissionIntensity: 548,
      },
    })

    expect(wrapper.text()).toContain('Braunkohle verursacht einen deutlich größeren Anteil der direkten CO₂-Emissionen')
  })

  it('zeigt Hover-Satz für negative Abweichung', () => {
    const activeYear = createDeviationYear(2022)
    const pvRow = activeYear.rows.find((r) => r.sourceKey === 'pv')!

    const wrapper = mount(DeviationSidebar, {
      props: {
        ...defaultProps,
        activeYear,
        hoveredRow: pvRow,
        largestMismatch: null,
        emissionIntensity: 412,
        renewableShare: 51,
        baseYear: createDeviationYear(2015),
        baseRenewableShare: 29,
        baseEmissionIntensity: 548,
      },
    })

    expect(wrapper.text()).toContain('Photovoltaik verursacht einen deutlich geringeren Anteil der direkten CO₂-Emissionen')
  })

  it('zeigt Meldung bei fehlenden Daten', () => {
    const wrapper = mount(DeviationSidebar, {
      props: defaultProps,
    })

    expect(wrapper.text()).toContain(
      'Kennzahlen sind nicht verfügbar.',
    )
  })
})
