import { describe, it, expect } from 'vitest'

import { transformYearlyDataToChartData } from '~/pages/homeDataTransform'
import type { YearlyMixPoint } from '~/types/visualization-data'

describe('transformYearlyDataToChartData', () => {
  const year2015: YearlyMixPoint = {
    year: 2015,
    sources: {
      biomass: 0, hydro: 0, wind_onshore: 100, wind_offshore: 0,
      pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0,
      gas: 0, nuclear: 100, other_fossil: 0, pumped_storage: 0,
    },
    totalGenerationMwh: 200,
    renewableSharePercent: 50,
    co2GramsPerKwh: 400,
    availableHourCount: 8760,
  }

  const year2024: YearlyMixPoint = {
    year: 2024,
    sources: {
      biomass: 0, hydro: 0, wind_onshore: 150, wind_offshore: 0,
      pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0,
      gas: 0, nuclear: 50, other_fossil: 0, pumped_storage: 0,
    },
    totalGenerationMwh: 200,
    renewableSharePercent: 75,
    co2GramsPerKwh: 200,
    availableHourCount: 8784,
  }

  const result = transformYearlyDataToChartData(year2015, year2024)

  it('berechnet für Windenergie an Land das richtige Delta (2015: 50 %, 2024: 75 %)', () => {
    const windRow = result.find(item => item.id === 'wind_land')

    expect(windRow?.displayedDelta).toBe(25)
  })

  it('hat für jeden Eintrag aus ITEM_CONFIG genau ein Ergebnis (10 Energieträger)', () => {
    expect(result.length).toBe(10)
  })
})