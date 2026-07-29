/**
 * Bereitet die Rohdaten aus useVisualizationData für das Strommix-
 * Diagramm auf. Konkret: Reduzieren auf die 10 im Diagramm gezeigten
 * Energieträger, Umrechnung MWh → TWh, Parsen der Monatsstrings zu
 * Date-Objekten und Aggregation zu Jahressummen.
 *
 * Die eigentliche Fetch-Logik liegt in useVisualizationData – dieses
 * Composable ruft sie nur auf und normalisiert das Ergebnis.
 *
 * @author Selina Schneider
 */

import { ref, computed } from 'vue'
import { useVisualizationData } from '~/data/loadVisualizationData'
import { STACK_ORDER } from '~/components/generation/mixConfig'
import type { MixMonthRow, RawMixMonthPoint } from '~/types/energy-mix'
import type { VisualizationData } from '~/types/visualization-data'


/** Die 10 Energieträger, die im Diagramm dargestellt werden. */
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

/** Zusammengefasste Jahreswerte pro Energieträger. */
export interface MixYearRow {
  year: number
  values: SourceValues
  totalTwh: number
}


/**
 * Erzeugt ein SourceValues-Objekt mit allen zehn Trägern auf 0.
 * Nutze ich als Startwert, wenn ich Monats- oder Jahres-Aggregate
 * aufbaue.
 *
 * @returns Leeres SourceValues-Objekt
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
 * Wandelt einen Monatsstring in ein Date-Objekt um.
 *
 * @param month Monat im Format "YYYY-MM"
 * @returns Date für den 1. des Monats
 */
function parseMonth(month: string): Date {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1

  return new Date(year, monthIndex, 1)
}

/**
 * Rechnet MWh in TWh um.
 *
 * @param valueInMwh Wert in Megawattstunden
 * @returns Wert in Terawattstunden
 */
function convertMwhToTwh(valueInMwh: number): number {
  return valueInMwh / 1_000_000
}

/**
 * Normalisiert einen einzelnen Rohdatensatz aus der JSON in eine
 * MixMonthRow. Filtert dabei die zehn Träger aus STACK_ORDER.
 *
 * @param monthPoint Rohdatensatz aus visualization-data.json
 * @returns Normalisierte Monatszeile
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
 * Baut aus den Monatszeilen die Jahressummen. Sammlung in einer Map
 * über das Jahr, addiert werden pro Energieträger die Monatswerte auf und
 * sortiert am Ende einmal aufsteigend nach Jahr, damit die Reihenfolge
 * fürs Diagramm stimmt.
 *
 * @param monthlyRows Alle Monatszeilen
 * @returns Nach Jahr sortierte Jahreszeilen
 */
function calculateYearRows(
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

  // Aufsteigend nach Jahr sortieren, weil die Map die Reihenfolge nicht garantiert.
  result.sort(function (left, right) { return left.year - right.year })

  return result
}

/**
 * Stellt die normalisierten Monats- und Jahresdaten für das Strommix-
 * Diagramm als reactive computed-Werte bereit. Die eigentliche
 * Ladelogik läuft in loadData() über useVisualizationData; die
 * computed-Werte transformieren die geladenen Rohdaten bei jeder
 * Änderung.
 *
 * @returns Objekt mit monthRows, yearRows, pending, error und loadData
 */
export function useMixData() {
  const rawData = ref<VisualizationData | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)

  /**
   * Lädt die Rohdaten und legt sie in rawData ab. Der catch-Zweig
   * unterscheidet zwischen Error-Instanzen (übernehmen der Message)
   * und allem anderen (dann ein fester Fallback-Text).
   */
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

  // Monatszeilen: leeres Array, solange noch nichts geladen ist.
  const monthRows = computed<MixMonthRow[]>(function () {
    const data = rawData.value

    if (!data) {
      return []
    }

    return data.monthlyMix.map(normalizeMonth)
  })

  // Jahresrows aus den bereits normalisierten Monatsrows ableiten.
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