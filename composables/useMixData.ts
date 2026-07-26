/**
 * composables/useMixData.ts
 *
 * Normalisiert die Rohdaten aus useVisualizationData für das
 * Stacked-Area-Chart: reduziert auf 10 Quellen, MWh → TWh,
 * Datumsparsing, Jahressummen.
 *
 * Keine eigene Fetch-Logik – nutzt useVisualizationData.
 */

import { ref, computed } from 'vue'
import { useVisualizationData } from '~/data/loadVisualizationData'
import { STACK_ORDER } from '~/components/generation/mixConfig'
import type { MixSourceKey, MixMonthRow, RawMixMonthPoint } from '~/types/mix'
import type { VisualizationData } from '~/types/visualization-data'

// =========================================================================
// Typ für eine berechnete Jahreszeile (nur hier definiert, da Phase 2
// keine neuen globalen Typdateien anlegt).
// =========================================================================

export interface MixYearRow {
  year: number
  values: Record<MixSourceKey, number>
  /** Gesamterzeugung in TWh (alle SMARD-Kategorien inkl. Pumpspeicher) */
  totalTwh: number
}

// =========================================================================
// Hilfsfunktionen
// =========================================================================

/**
 * Wandelt einen Monatsstring "2015-01" in ein Date für den 1. des Monats um.
 * Wir erzeugen ein lokales Datum, damit die Zeitzone keine Rolle spielt.
 */
function parseMonth(month: string): Date {
  const parts = month.split('-')

  if (parts.length !== 2) {
    throw new Error(
      `Ungültiges Monatsformat: "${month}". Erwartet wird "YYYY-MM".`,
    )
  }

  const yearText = parts[0]!
  const monthText = parts[1]!

  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  if (isNaN(year) || isNaN(monthIndex)) {
    throw new Error(
      `Monatsstring "${month}" enthält keine gültigen Zahlen.`,
    )
  }

  return new Date(year, monthIndex, 1)
}

/**
 * Rechnet einen Wert in MWh in TWh um.
 * 1 TWh = 1 000 000 MWh.
 */
function convertMwhToTwh(valueInMwh: number): number {
  return valueInMwh / 1_000_000
}

/**
 * Erzeugt einen leeren Values-Record, bei dem alle zehn Quellen auf 0 gesetzt sind.
 * Wird für die Jahressummen-Vorbereitung verwendet.
 */
function createEmptySourceValues(): Record<MixSourceKey, number> {
  const emptyValues = {} as Record<MixSourceKey, number>

  for (const sourceKey of STACK_ORDER) {
    emptyValues[sourceKey] = 0
  }

  return emptyValues
}

// =========================================================================
// Normalisierung eines Rohdatenpunktes
// =========================================================================

/**
 * Normalisiert einen einzelnen MonthlyMixPoint in eine MixMonthRow.
 *
 * Schritte:
 * 1. Datum parsen
 * 2. Nur die zehn Quellen aus STACK_ORDER übernehmen
 * 3. Werte von MWh in TWh umrechnen
 */
export function normalizeMonth(
  monthPoint: RawMixMonthPoint,
): MixMonthRow {
  const parsedDate = parseMonth(monthPoint.month)

  const values = {} as Record<MixSourceKey, number>

  for (const sourceKey of STACK_ORDER) {
    const valueInMwh = monthPoint.sources[sourceKey]
    const valueInTwh = convertMwhToTwh(valueInMwh)

    values[sourceKey] = valueInTwh
  }

  return {
    month: monthPoint.month,
    date: parsedDate,
    values,
    totalGenerationTwh: convertMwhToTwh(monthPoint.totalGenerationMwh),
  }
}

// =========================================================================
// Jahressummen aus Monatsdaten
// =========================================================================

/**
 * Berechnet aus normalisierten Monatszeilen die Jahressummen.
 * Die Jahre werden aufsteigend sortiert zurückgegeben.
 *
 * Diese Funktion ist rein – sie verändert keine externen Daten.
 */
export function calculateYearRows(
  monthlyRows: MixMonthRow[],
): MixYearRow[] {
  // 1. Monate nach Jahr gruppieren und Quellenwerte aufsummieren
  const yearTotals = new Map<number, Record<MixSourceKey, number>>()
  const yearFullTotals = new Map<number, number>()

  for (const monthRow of monthlyRows) {
    const year = monthRow.date.getFullYear()

    // Fehlendes Jahr initialisieren
    if (!yearTotals.has(year)) {
      yearTotals.set(year, createEmptySourceValues())
      yearFullTotals.set(year, 0)
    }

    const yearlyValues = yearTotals.get(year)!

    // Quellenwerte des Monats zur Jahressumme addieren
    for (const sourceKey of STACK_ORDER) {
      yearlyValues[sourceKey] += monthRow.values[sourceKey]
    }

    // Gesamterzeugung inkl. aller SMARD-Kategorien aufsummieren
    yearFullTotals.set(year, (yearFullTotals.get(year) ?? 0) + monthRow.totalGenerationTwh)
  }

  // 2. Map in ein Array umwandeln
  const result: MixYearRow[] = []

  for (const [year, values] of yearTotals) {
    result.push({ year, values, totalTwh: yearFullTotals.get(year) ?? 0 })
  }

  // 3. Aufsteigend nach Jahr sortieren
  result.sort(function (left, right) { return left.year - right.year })

  return result
}

// =========================================================================
// Composable
// =========================================================================

/**
 * Stellt normalisierte Monats- und Jahresdaten für das Stacked-Area-Chart bereit.
 *
 * Nutzt useVisualizationData für den Fetch und wandelt die Rohdaten
 * in das MixMonthRow-Format um.
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

      const data = await loadVisualizationData()

      rawData.value = data
    } catch (caughtError: unknown) {
      if (caughtError instanceof Error) {
        error.value = caughtError.message
      } else {
        error.value =
          'Die Visualisierungsdaten konnten nicht geladen werden.'
      }
    } finally {
      pending.value = false
    }
  }

  /**
   * Normalisierte Monatszeilen: reduziert auf 10 Quellen, Werte in TWh.
   * Solange keine Daten geladen sind, wird ein leeres Array zurückgegeben.
   */
  const monthRows = computed<MixMonthRow[]>(function () {
    const data = rawData.value

    if (!data) {
      return []
    }

    const rawMonths = data.monthlyMix
    const normalizedMonths: MixMonthRow[] = []

    for (const rawMonth of rawMonths) {
      const normalized = normalizeMonth(rawMonth)

      normalizedMonths.push(normalized)
    }

    return normalizedMonths
  })

  /**
   * Berechnete Jahressummen aus den normalisierten Monatsdaten.
   * Aktualisiert sich automatisch, wenn sich monthRows ändert.
   */
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
