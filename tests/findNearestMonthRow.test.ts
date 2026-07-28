import { describe, it, expect } from 'vitest'

import { findNearestMonthRow } from '~/utils/charts/stackedAreaHelpers'

describe('findNearestMonthRow', () => {
  const rows = [
    {
      month: '2020-01', date: new Date(2020, 0, 1),
      values: {
        hydro: 0, biomass: 0, wind_offshore: 0, wind_onshore: 0,
        pv: 0, nuclear: 0, gas: 0, other_fossil: 0,
        hardcoal: 0, lignite: 0,
      },
      totalGenerationTwh: 0,
    },
    {
      month: '2020-02', date: new Date(2020, 1, 1),
      values: {
        hydro: 0, biomass: 0, wind_offshore: 0, wind_onshore: 0,
        pv: 0, nuclear: 0, gas: 0, other_fossil: 0,
        hardcoal: 0, lignite: 0,
      },
      totalGenerationTwh: 0,
    },
    {
      month: '2020-03', date: new Date(2020, 2, 1),
      values: {
        hydro: 0, biomass: 0, wind_offshore: 0, wind_onshore: 0,
        pv: 0, nuclear: 0, gas: 0, other_fossil: 0,
        hardcoal: 0, lignite: 0,
      },
      totalGenerationTwh: 0,
    },
  ]

  it('Zieldatum trifft genau einen Monat', () => {
    const result = findNearestMonthRow(rows, new Date(2020, 1, 1))

    expect(result?.month).toBe('2020-02')
  })

  it('Zieldatum vor dem ersten Monat liefert den ersten Monat', () => {
    const result = findNearestMonthRow(rows, new Date(2019, 0, 1))

    expect(result?.month).toBe('2020-01')
  })

  it('Zieldatum nach dem letzten Monat liefert den letzten Monat', () => {
    const result = findNearestMonthRow(rows, new Date(2021, 0, 1))

    expect(result?.month).toBe('2020-03')
  })
})
