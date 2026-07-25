/**
 * Hilfsfunktionen für das Abweichungsdiagramm.
 *
 * Enthält zustandslose Berechnungen für Balkenpositionen,
 * Labelpositionen, den Achsenbereich und die Textformatierung.
 * Keine dieser Funktionen greift auf den Zustand der
 * DeviationChart-Klasse zu.
 *
 * @author Selina Schneider
 */

import * as d3 from 'd3'

import type { EmissionRow } from '~/types/mix'

/** Abstand zwischen Balkenende und Wertelabel in Pixeln */
const LABEL_PADDING = 6

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Bestimmt, wo ein Balken auf der x-Achse beginnt.
 *
 * Negative Balken beginnen am Wert und enden an der Nulllinie.
 * Positive Balken beginnen an der Nulllinie.
 *
 * @param deviationPp Abweichung in Prozentpunkten
 * @param xScale Skala der x-Achse
 * @returns Linke Kante des Balkens in Pixeln
 */
export function getDeviationBarX(
  deviationPp: number,
  xScale: d3.ScaleLinear<number, number>,
): number {
  const zeroPosition = xScale(0)

  if (deviationPp < 0) {
    return xScale(deviationPp)
  }

  return zeroPosition
}

/**
 * Berechnet die Breite eines Balkens bis zur Nulllinie.
 *
 * @param deviationPp Abweichung in Prozentpunkten
 * @param xScale Skala der x-Achse
 * @returns Breite des Balkens in Pixeln
 */
export function getDeviationBarWidth(
  deviationPp: number,
  xScale: d3.ScaleLinear<number, number>,
): number {
  const zeroPosition = xScale(0)
  const valuePosition = xScale(deviationPp)

  return Math.abs(valuePosition - zeroPosition)
}

/**
 * Erstellt einen symmetrischen Wertebereich um die Nulllinie.
 *
 * @param maximumDeviation Größte absolute Abweichung
 * @returns Untere und obere Grenze der x-Achse
 */
export function createSymmetricDomain(
  maximumDeviation: number,
): [number, number] {
  if (maximumDeviation <= 0) {
    return [-1, 1]
  }

  const roundedMaximum = Math.ceil(maximumDeviation / 10) * 10

  return [-roundedMaximum, roundedMaximum]
}

/**
 * Sucht die größte absolute Abweichung in allen Jahren.
 *
 * @param rowsByYear Datenzeilen nach Jahren
 * @returns Größte Abweichung ohne Vorzeichen
 */
export function findMaximumAbsoluteDeviation(
  rowsByYear: EmissionRow[][],
): number {
  let maximum: number = 0

  for (const rows of rowsByYear) {
    for (const row of rows) {
      const absoluteDeviation = Math.abs(row.deviationPp)

      if (absoluteDeviation > maximum) {
        maximum = absoluteDeviation
      }
    }
  }

  return maximum
}

/**
 * Bestimmt die horizontale Position eines Wertelabels.
 *
 * Negative Werte: Label links vom Balkenende.
 * Positive Werte und 0: Label rechts vom Balkenende.
 *
 * @param value Abweichung in Prozentpunkten
 * @param xScale Skala der x-Achse
 * @returns X-Position des Labels in Pixeln
 */
export function labelX(
  value: number,
  xScale: d3.ScaleLinear<number, number>,
): number {
  if (value < 0) {
    return xScale(value) - LABEL_PADDING
  }

  return xScale(value) + LABEL_PADDING
}

/**
 * Bestimmt die Textausrichtung eines Wertelabels.
 *
 * @param value Abweichung in Prozentpunkten
 * @returns Ausrichtung des SVG-Texts
 */
export function labelAnchor(value: number): 'start' | 'end' {
  if (value < 0) {
    return 'end'
  }

  return 'start'
}

/**
 * Formatiert Prozentpunkte für Achse und Wertelabels.
 *
 * @param value Wert in Prozentpunkten
 * @returns Formatierter Wert mit Vorzeichen und Einheit
 */
export function formatPercentagePoints(value: number): string {
  if (value === 0) {
    return '0 pp'
  }

  const formattedValue = percentFormatter.format(Math.abs(value))
  const sign = value > 0 ? '+' : '−'

  return `${sign}${formattedValue} pp`
}
