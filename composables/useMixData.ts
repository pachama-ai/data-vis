/**
 * Normalisiert die Rohdaten aus useVisualizationData für das
 * Stacked-Area-Chart: reduziert auf 10 Quellen, MWh → TWh,
 * Datumsparsing, Jahressummen.
 *
 * Keine eigene Fetch-Logik – nutzt useVisualizationData.
 */

import { ref, computed } from 'vue'
import { useVisualizationData } from '~/data/loadVisualizationData'
import { STACK_ORDER } from '~/components/generation/mixConfig'
import type { MixMonthRow, RawMixMonthPoint } from '~/types/energy-mix'
import type { VisualizationData } from '~/types/visualization-data'

type SourceValues = {
  hydro: number
  biomass: number
  wind_offshore: number
  wind_onshore: number
  pv: number
  nuclear: number
  gas: number
  other_fossil: number
  hardcoal: number
  lignite: number
}

export interface MixYearRow {
  year: number
  values: SourceValues
  /** Gesamterzeugung in TWh (alle SMARD-Kategorien inkl. Pumpspeicher) */
  totalTwh: number
}

/**
 * Erzeugt eine SourceValues-Struktur, bei der alle zehn Quellen auf 0 gesetzt sind.
 */
function createEmptySourceValues(): SourceValues {
  return {
    hydro: 0,
    biomass: 0,
    wind_offshore: 0,
    wind_onshore: 0,
    pv: 0,
    nuclear: 0,
    gas: 0,
    other_fossil: 0,
    hardcoal: 0,
    lignite: 0,
  }
}

/**
 * Wandelt einen Monatsstring "2015-01" in ein Date für den 1. des Monats um.
 */
function parseMonth(month: string): Date {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1

  return new Date(year, monthIndex, 1)
}

/**
 * Rechnet einen Wert in MWh in TWh um.
 */
function convertMwhToTwh(valueInMwh: number): number {
  return valueInMwh / 1_000_000
}

/**
 * Normalisiert einen einzelnen MonthlyMixPoint in eine MixMonthRow.
 */
export function normalizeMonth(
  monthPoint: RawMixMonthPoint,
): MixMonthRow {
  const parsedDate = parseMonth(monthPoint.month)

  const values = createEmptySourceValues()

  for (const sourceKey of STACK_ORDER) {
    values[sourceKey] = convertMwhToTwh(monthPoint.sources[sourceKey])
  }

  return {
    month: monthPoint.month,
    date: parsedDate,
    values,
    totalGenerationTwh: convertMwhToTwh(monthPoint.totalGenerationMwh),
  }
}

/**
 * Berechnet aus normalisierten Monatszeilen die Jahressummen.
 */
export function calculateYearRows(
  monthlyRows: MixMonthRow[],
): MixYearRow[] {
  const yearAccum = new Map<number, {
    values: SourceValues
    totalTwh: number
  }>()

  for (const monthRow of monthlyRows) {
    const year = monthRow.date.getFullYear()

    let accum = yearAccum.get(year)

    if (!accum) {
      accum = { values: createEmptySourceValues(), totalTwh: 0 }
      yearAccum.set(year, accum)
    }

    for (const sourceKey of STACK_ORDER) {
      accum.values[sourceKey] += monthRow.values[sourceKey]
    }

    accum.totalTwh += monthRow.totalGenerationTwh
  }

  const result: MixYearRow[] = []

  for (const [year, accum] of yearAccum) {
    result.push({
      year,
      values: accum.values,
      totalTwh: accum.totalTwh,
    })
  }

  result.sort(function (left, right) { return left.year - right.year })

  return result
}

/**
 * Stellt normalisierte Monats- und Jahresdaten für das Stacked-Area-Chart bereit.
 */
export function useMixData() {
  const rawData = ref<VisualizationData | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)

  async function loadData(): Promise<void> {
    pending.value = true
    error.value = null

    try {
      const { loadVisualizationData } = useVisualizationData()
      rawData.value = await loadVisualizationData()
    } catch (caughtError: unknown) {
      error.value =
        caughtError instanceof Error
          ? caughtError.message
          : 'Die Visualisierungsdaten konnten nicht geladen werden.'
    } finally {
      pending.value = false
    }
  }

  const monthRows = computed<MixMonthRow[]>(function () {
    const data = rawData.value

    if (!data) {
      return []
    }

    return data.monthlyMix.map(normalizeMonth)
  })

  const yearRows = computed<MixYearRow[]>(function () {
    return calculateYearRows(monthRows.value)
  })

  return {
    monthRows,
    yearRows,
    pending,
    error,
    loadData,
  }
}
