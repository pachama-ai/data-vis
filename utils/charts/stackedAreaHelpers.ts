/**
 * Hilfsfunktionen für das gestapelte Flächendiagramm.
 *
 * @author Selina Schneider
 */

import type { MixMonthRow } from '~/types/energy-mix'


/**
 * Daten, die beim Bewegen der Maus an Vue weitergegeben werden.
 */
export interface MixHoverPayload {
  /** Monatswerte an der aktuellen Position */
  monthRow: MixMonthRow

  /** Horizontale Position im SVG */
  chartX: number

  /** Vertikale Position im SVG */
  chartY: number
}

/**
 * Wandelt ein Ereignisdatum in ein Date-Objekt um.
 *
 * @param dateStr Datum als YYYY-MM
 * @returns Datum für die Position auf der Zeitachse
 */
export function parseAnnotationDate(dateStr: string): Date {
  const parts = dateStr.split('-')
  const yearText = parts[0]
  const monthText = parts[1]

  if (yearText === undefined || monthText === undefined) {
    return new Date(NaN, NaN, 1)
  }

  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  return new Date(year, monthIndex, 1)
}

/**
 * Sucht den Monatswert, der einem Datum am nächsten liegt.
 *
 * @param monthlyRows Monatswerte in zeitlicher Reihenfolge
 * @param targetDate Datum an der Mausposition
 * @returns Nächster Monatswert oder null
 */
export function findNearestMonthRow(
  monthlyRows: MixMonthRow[],
  targetDate: Date,
): MixMonthRow | null {
  if (monthlyRows.length === 0) {
    return null
  }

  const firstRow = monthlyRows[0]

  if (firstRow === undefined) {
    return null
  }

  let nearest = firstRow
  let smallestDiff = Math.abs(
    targetDate.getTime() - nearest.date.getTime(),
  )

  for (const row of monthlyRows) {
    const diff = Math.abs(targetDate.getTime() - row.date.getTime())

    if (diff < smallestDiff) {
      nearest = row
      smallestDiff = diff
    }
  }

  return nearest
}