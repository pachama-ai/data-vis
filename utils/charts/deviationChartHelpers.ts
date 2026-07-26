/**
 * Hilfsfunktionen für das Abweichungsdiagramm.
 *
 * Alle Funktionen hier sind zustandslos – sie greifen nicht auf die
 * DeviationChart-Klasse zu und lassen sich einzeln testen.
 *
 * MIT KI: Die Auslagerung der zustandslosen Hilfsfunktionen in eine
 * eigene Datei wurde von KI empfohlen.
 * OHNE KI: Die grundlegende Idee, zustandslose Funktionen auszulagern,
 * ist ein allgemeines Programmierprinzip.
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
 * Negative Balken beginnen am (negativen) Wert und laufen zur Nulllinie.
 * Positive Balken beginnen an der Nulllinie und laufen nach rechts.
 * Diese Fallunterscheidung ist der Grund, warum das nicht einfach
 * xScale(deviationPp) ist.
 *
 * MIT KI: Die unterschiedliche Startposition für negative und positive
 * Balken (divergierendes Layout um die Nulllinie) wurde mit KI entwickelt.
 * OHNE KI: Die Verwendung von xScale zur Umrechnung von Werten in
 * Pixelpositionen ist eine Standard-D3-Technik aus dem Vorlesungsskript.
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
 * OHNE KI: Die Breitenberechnung mit Math.abs und xScale ist eine
 * einfache D3- und Mathematik-Grundlage aus dem Vorlesungsskript.
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
 * MIT KI: Die feste symmetrische Domain, die beim Jahreswechsel nicht
 * springt, sowie das Aufrunden auf den nächsten Zehnerwert
 * (Math.ceil(x / 10) * 10) wurden mit KI-Unterstützung entwickelt.
 * Den Sonderfall <= 0 habe ich danach ergänzt, damit der
 * Start-/Leerzustand vor dem ersten Datenladen sauber abgefangen ist.
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
 * Sucht die größte absolute Abweichung über alle Jahre hinweg.
 * Damit kann die x-Achse einmal fest gesetzt werden und springt
 * beim Jahreswechsel nicht.
 *
 * MIT KI: Die verschachtelten Schleifen über Jahre und Datenzeilen
 * sowie der Vergleich der absoluten Abweichungen wurden mit
 * KI-Unterstützung entwickelt.
 *
 * @param rowsByYear Datenzeilen nach Jahren
 * @returns Größte Abweichung ohne Vorzeichen
 */
export function findMaximumAbsoluteDeviation(
  rowsByYear: EmissionRow[][],
): number {
  let maximum = 0

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
 * Negative Werte bekommen das Label links vom Balkenende,
 * positive Werte (und 0) rechts. Zusammen mit labelAnchor ergibt
 * das eine saubere Ausrichtung an der jeweiligen Balkenkante.
 *
 * MIT KI: Die unterschiedliche Position und Textausrichtung von
 * Wertelabels außerhalb positiver und negativer Balken wurde mit
 * KI-Unterstützung entwickelt.
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
 * MIT KI: Die unterschiedliche Textausrichtung ('end' für negative,
 * 'start' für positive Werte) ist Teil der KI-gestützten
 * Labelpositionierung außerhalb der Balken.
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
 * MIT KI: Die spezielle Darstellung von Prozentpunkten mit '+' bei
 * positiven Werten, '−' bei negativen Werten, der Einheit 'pp' und
 * der Behandlung des Werts 0 wurde mit KI-Unterstützung entwickelt.
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