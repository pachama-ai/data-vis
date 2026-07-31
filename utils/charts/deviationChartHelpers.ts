/**
 * Hilfsfunktionen für das Abweichungsdiagramm.
 *
 * @author Selina Schneider
 */

import type * as d3 from 'd3'

import type { EmissionRow } from '~/types/emissions'

/** Abstand zwischen Balkenende und Wertelabel in Pixeln */
const LABEL_PADDING = 6

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Bestimmt, wo ein Balken auf der x-Achse beginnt.
 *
 * Negative Balken beginnen am (negativen) Wert und laufen zur Nulllinie.
 * Positive Balken beginnen an der Nulllinie und laufen nach rechts.
 * Diese Fallunterscheidung ist der Grund, warum das nicht einfach
 * xScale(deviationPp) ist.
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
 * Bestimmt die horizontale Position eines Wertelabels.
 *
 * Negative Werte bekommen das Label links vom Balkenende,
 * positive Werte (und 0) rechts. Zusammen mit labelAnchor ergibt
 * das eine saubere Ausrichtung an der jeweiligen Balkenkante.
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
 * Bestimmt die Textausrichtung eines Wertelabels passend zu labelX.
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
 * Verwendet ein echtes Minuszeichen (−) statt Bindestrich, damit die
 * Ausrichtung im SVG-Text nicht verrutscht.
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