/**
 * Hilfsfunktionen für das gestapelte Flächendiagramm.
 *
 * Enthält zustandslose Funktionen und Typen, die für die
 * StackedAreaChart-Klasse und die Vue-Anbindung gebraucht werden.
 *
 * OHNE KI: Das grundlegende Auslagern zustandsloser Funktionen in
 * eine eigene Datei ist ein allgemeines Strukturierungsprinzip.
 *
 * MIT KI: Die Idee, genau diese beiden Funktionen auszulagern, kam
 * aus einer KI-Antwort.
 *
 * @author Selina Schneider
 */

import * as d3 from 'd3'

import type { MixAnnotation, MixMonthRow } from '~/types/mix'


/**
 * Daten, die beim Bewegen der Maus an Vue weitergegeben werden.
 *
 * OHNE KI: Ein Interface mit drei Feldern – selbst erstellter Typ.
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
 * Wenn im String nur ein Jahr steht, setze ich das Ereignis absichtlich
 * auf den 1. Juli (Monat-Index 6) – also grob die Mitte des Jahres.
 * Dadurch springt die Linie im Diagramm nicht auf den 1. Januar, wo sie
 * für ein „irgendwann in dem Jahr"-Ereignis komisch aussehen würde.
 *
 * OHNE KI: Das Umwandeln eines Datumsstrings in ein Date-Objekt mit
 * String.split und Number.parseInt ist eine allgemeine
 * Programmiergrundlage. Die Platzierung in der Jahresmitte ist eine
 * eigene fachliche Entscheidung.
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

  // Jahresmitte als Fallback (Monat-Index 6 = Juli).
  return new Date(parsedYear, 6, 1)
}

/**
 * Sucht den Monatswert, der einem Datum am nächsten liegt.
 *
 * Die Einfügeposition, die d3.bisector zurückgibt, war für mich am
 * Anfang unklar – bisector liefert nämlich nicht direkt den nächsten
 * Wert, sondern die Stelle, an der man das gesuchte Datum einsortieren
 * müsste. Auf dieser Grundlage muss man dann selbst zwischen dem Wert
 * davor und dem Wert danach vergleichen. Dieses Muster habe ich mit
 * KI-Unterstützung verstanden und danach die drei Sonderfälle
 * (Anfang / Ende / Mitte) selbst aufgeteilt, damit man beim Lesen sieht,
 * welcher Fall greift.
 *
 * MIT KI: Die Suche nach dem nächstgelegenen Monatswert mit
 * d3.bisector wurde mit KI-Unterstützung entwickelt.
 * OHNE KI: Die einfachen Bedingungen und Arrayzugriffe habe ich
 * selbst geschrieben.
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

  // Fall 1: Datum liegt vor dem ersten Monat.
  if (insertionIndex === 0) {
    return monthlyRows[0] ?? null
  }

  // Fall 2: Datum liegt nach dem letzten Monat.
  if (insertionIndex >= monthlyRows.length) {
    return monthlyRows[monthlyRows.length - 1] ?? null
  }

  // Fall 3: Datum liegt zwischen zwei Monaten – der näher liegende gewinnt.
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