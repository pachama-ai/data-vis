/**
 * Hilfsfunktionen für das gestapelte Flächendiagramm.
 *
 * Enthält zustandslose Funktionen und Typen, die für die
 * StackedAreaChart-Klasse und die Vue-Anbindung gebraucht werden.
 *
 * Die ursprüngliche Chart-Datei war sehr lang. KI hat mir geholfen
 * zu erkennen, welche Funktionen und Typen keinen Zustand der
 * D3-Klasse brauchen. parseAnnotationDate und findNearestMonthRow
 * arbeiten nur mit ihren Parametern und können deshalb in einer
 * eigenen Datei stehen.
 *
 * @author Selina Schneider
 */

import * as d3 from 'd3'

import type { MixAnnotation, MixMonthRow } from '~/types/mix'

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
 * Bei einem Ereignis ohne Monatsangabe wird die Mitte des
 * Jahres als Position auf der Zeitachse verwendet.
 *
 * @param dateStr Datum als YYYY-MM oder YYYY
 * @returns Datum für die Position auf der Zeitachse
 */
export function parseAnnotationDate(dateStr: string): Date {
  const parts = dateStr.split('-')

  if (parts.length === 2) {
    const parsedYear = Number.parseInt(parts[0]!, 10)
    const parsedMonth = Number.parseInt(parts[1]!, 10)

    return new Date(parsedYear, parsedMonth - 1, 1)
  }

  const parsedYear = Number.parseInt(parts[0]!, 10)

  return new Date(parsedYear, 6, 1)
}

/**
 * Sucht den Monatswert, der einem Datum am nächsten liegt.
 *
 * KI hat mir bei d3.bisector geholfen. Die Einfügeposition
 * zwischen zwei Monaten war für mich zuerst nicht verständlich.
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

  const monthBisector = d3.bisector<MixMonthRow, Date>(function (monthRow) {
    return monthRow.date
  })

  const insertionIndex = monthBisector.left(monthlyRows, targetDate)

  if (insertionIndex === 0) {
    return monthlyRows[0] ?? null
  }

  if (insertionIndex >= monthlyRows.length) {
    return monthlyRows[monthlyRows.length - 1] ?? null
  }

  const previousMonth = monthlyRows[insertionIndex - 1]
  const nextMonth = monthlyRows[insertionIndex]

  if (!previousMonth || !nextMonth) {
    return previousMonth ?? nextMonth ?? null
  }

  const distanceToPrevious =
    targetDate.getTime() - previousMonth.date.getTime()

  const distanceToNext =
    nextMonth.date.getTime() - targetDate.getTime()

  if (distanceToPrevious <= distanceToNext) {
    return previousMonth
  }

  return nextMonth
}
