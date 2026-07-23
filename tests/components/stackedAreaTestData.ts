/**
 * tests/components/stackedAreaTestData.ts
 *
 * Gemeinsame Testdaten für StackedArea-Komponententests.
 * Stellt eine einfache Funktion zur Erzeugung von MixMonthRow-Objekten bereit.
 */

import type { MixMonthRow } from '~/types/mix'

export function createMonthRow(month: string, sourceValue: number): MixMonthRow {
  const [yearText, monthText] = month.split('-')

  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  return {
    month,
    date: new Date(year, monthIndex, 1),
    values: {
      hydro: sourceValue,
      biomass: sourceValue,
      wind_offshore: sourceValue,
      wind_onshore: sourceValue,
      pv: sourceValue,
      nuclear: sourceValue,
      gas: sourceValue,
      other_fossil: sourceValue,
      hardcoal: sourceValue,
      lignite: sourceValue,
    },
    totalGenerationTwh: sourceValue * 10,
  }
}
