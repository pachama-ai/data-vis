/**
 * utils/charts/DeviationChart.ts – D3-Klasse für das divergierende
 * Abweichungsdiagramm (Strombeitrag vs. Emissionsanteil).
 *
 * Zeigt für ein Jahr zehn horizontale Balken. Die Balkenlänge zeigt die
 * Abweichung zwischen Emissionsanteil und Erzeugungsanteil in Prozentpunkten.
 *
 * Negative Abweichung: Balken nach links (emissionsärmer als Stromanteil)
 * Positive Abweichung: Balken nach rechts (emissionsreicher als Stromanteil)
 *
 * Erbt von BaseChart. Enthält kein Vue, keine Sidebar, keinen Slider.
 */

import * as d3 from 'd3'

import { BaseChart } from '~/utils/charts/BaseChart'
import { MIX_COLORS, MIX_COLORS_ACCESSIBLE, MIX_LABELS, STACK_ORDER } from '~/utils/mix-config'

import type { EmissionRow, MixSourceKey } from '~/types/mix'

// =========================================================================
// Hover-Typen
// =========================================================================

export interface DeviationHoverPayload {
  row: EmissionRow
  chartX: number
  chartY: number
}

type HoverHandler = (payload: DeviationHoverPayload) => void
type HoverEndHandler = () => void

// =========================================================================
// Hilfsfunktionen (rein, direkt testbar)
// =========================================================================

/**
 * Berechnet die x-Position eines Balkens anhand der Abweichung.
 *
 * Positive Werte beginnen an der Nulllinie (xScale(0)) und verlaufen nach rechts.
 * Negative Werte beginnen am skalierten negativen Wert und verlaufen nach links.
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
 * Berechnet die Breite eines Balkens aus der Abweichung.
 * Der Betrag wird verwendet, da die Breite immer positiv ist.
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
 * Erzeugt eine symmetrische Domain um null, aufgerundet auf die nächste
 * Zehnerstufe.
 *
 * Beispiele:
 *   0   → [-1,  1]
 *   7.3 → [-10, 10]
 *  26.9 → [-30, 30]
 *  31.2 → [-40, 40]
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
 * Findet die maximale absolute Abweichung über mehrere Jahre.
 * Wird verwendet, um eine gemeinsame Domain für den Chart zu berechnen.
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

// =========================================================================
// Formatierung für die x-Achse
// =========================================================================

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formatiert einen Prozentpunkt-Wert für die Achsenbeschriftung.
 *
 * Beispiele:
 *   0  → "0 pp"
 *  10  → "+10 pp"
 * -20  → "−20 pp"
 */
export function formatPercentagePoints(value: number): string {
  if (value === 0) {
    return '0 pp'
  }

  const formattedValue = percentFormatter.format(Math.abs(value))
  const sign = value > 0 ? '+' : '−'

  return `${sign}${formattedValue} pp`
}

// =========================================================================
// Chart-Klasse
// =========================================================================

export class DeviationChart extends BaseChart {
  /** Aktuelle Daten (EmissionRows) */
  #data: EmissionRow[] = []

  /** Symmetrische x-Domain (z. B. [-30, 30]) */
  #xDomain: [number, number] = [-1, 1]

  /** Aktuell hervorgehobene Quelle oder null */
  #highlightedSource: MixSourceKey | null = null

  /** SVG-Element */
  #svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

  /** Innere, um margin verschobene Gruppe */
  #chartGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Gruppe für Balken */
  #barsGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Gruppe für Wertelabel */
  #labelsGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Externer Hover-Callback */
  #hoverHandler: HoverHandler | null = null

  /** Externer Hover-Ende-Callback */
  #hoverEndHandler: HoverEndHandler | null = null

  /** Externer Klick-Callback für Balkenauswahl */
  #selectionHandler: ((sourceKey: MixSourceKey | null) => void) | null = null

  /** Aktuell ausgewählte Quelle (Klick) */
  #selectedSource: MixSourceKey | null = null

  /** Background-Klick-Handler */
  #backgroundClickHandler: (() => void) | null = null

  /** Aktive Farbpalette (Standard oder kontrastreich) */
  #colors: Record<MixSourceKey, string> = MIX_COLORS

  /** Subtitle-Text (wird im SVG gerendert) */
  #subtitle: string = ''

  // =======================================================================
  // Konstruktor
  // =======================================================================

  constructor() {
    super(860, 520, { top: 44, right: 82, bottom: 72, left: 170 })
  }

  // =======================================================================
  // Öffentliche Setter
  // =======================================================================

  setData(rows: EmissionRow[]): void {
    this.#data = this.#orderRows(rows)
    this.#highlightedSource = null
    this.update()
  }

  setXDomain(domain: [number, number]): void {
    this.#xDomain = domain
    this.update()
  }

  setHighlight(sourceKey: MixSourceKey | null): void {
    this.#highlightedSource = sourceKey
    this.#updateHighlight()
  }

  setSelectedSource(sourceKey: MixSourceKey | null): void {
    this.#selectedSource = sourceKey
    this.#updateHighlight()
    this.#selectionHandler?.(sourceKey)
  }

  setHoverHandler(handler: HoverHandler | null): void {
    this.#hoverHandler = handler
  }

  setHoverEndHandler(handler: HoverEndHandler | null): void {
    this.#hoverEndHandler = handler
  }

  setSelectionHandler(handler: ((sourceKey: MixSourceKey | null) => void) | null): void {
    this.#selectionHandler = handler
  }

  setBackgroundClickHandler(handler: (() => void) | null): void {
    this.#backgroundClickHandler = handler
  }

  setColors(colorMode: 'default' | 'accessible'): void {
    this.#colors = colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
    this.update()
  }

  setSubtitle(text: string): void {
    this.#subtitle = text
    this.#renderYAxisLabel()
  }

  // =======================================================================
  // render – SVG anlegen
  // =======================================================================

  override render(container: HTMLElement): void {
    // Vorhandenes SVG entfernen
    this.destroy()

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr(
        'aria-label',
        'Abweichung zwischen Emissionsanteil und Erzeugungsanteil nach Energieträgern',
      )

    const chartGroup = svg
      .append('g')
      .attr('class', 'chart-group')
      .attr(
        'transform',
        `translate(${this.margin.left},${this.margin.top})`,
      )

    container.appendChild(svg.node()!)

    this.#svg = svg
    this.#chartGroup = chartGroup

    // Untergruppen einmalig anlegen
    this.#barsGroup = chartGroup.append('g').attr('class', 'bars-group')
    this.#labelsGroup = chartGroup.append('g').attr('class', 'labels-group')

    // Klick auf leere Fläche (Hintergrund) — per .lower() hinter die Balken
    chartGroup
      .append('rect')
      .attr('class', 'chart-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .lower()
      .on('click', () => { this.#handleBackgroundClick() })

    // Nulllinie einmalig anlegen
    this.#renderZeroLine()

    // Gruppentrennlinien einmalig anlegen
    this.#renderGroupSeparators()

    // y-Achsenbeschriftung einmalig anlegen
    this.#renderYAxisLabel()

    // Richtungsbeschriftungen einmalig anlegen
    this.#renderDirectionLabels()

    // this.update() wird hier nicht aufgerufen, weil beim ersten render
    // noch keine Daten vorhanden sind. Der erste update() erfolgt aus setData().
  }

  // =======================================================================
  // update – Zeichenlogik bei Datenänderung
  // =======================================================================

  override update(): void {
    if (!this.#svg || !this.#chartGroup) {
      return
    }

    const xScale = this.#createXScale()
    const yScale = this.#createYScale()

    this.#renderBars(xScale, yScale)
    this.#renderValueLabels(xScale, yScale)
    this.#renderXAxis(xScale)
    this.#renderYAxis(yScale)
    this.#updateHighlight()
    this.#updateZeroLine(xScale)
    this.#updateGroupSeparators(yScale)
  }

  // =======================================================================
  // destroy – SVG entfernen und Referenzen löschen
  // =======================================================================

  override destroy(): void {
    if (this.#svg) {
      this.#svg.remove()
      this.#svg = null
      this.#chartGroup = null
      this.#barsGroup = null
      this.#labelsGroup = null
    }

    this.#data = []
    this.#xDomain = [-1, 1]
    this.#highlightedSource = null
    this.#hoverHandler = null
    this.#hoverEndHandler = null
  }

  // =======================================================================
  // Private Methoden
  // =======================================================================

  /**
   * Ordnet die Datenzeilen nach STACK_ORDER an.
   * Das Eingabearray wird nicht verändert.
   */
  #orderRows(rows: EmissionRow[]): EmissionRow[] {
    const orderedRows: EmissionRow[] = []

    for (const sourceKey of STACK_ORDER) {
      const matchingRow = rows.find((row) => {
        return row.sourceKey === sourceKey
      })

      if (matchingRow) {
        orderedRows.push(matchingRow)
      }
    }

    return orderedRows
  }

  /**
   * Erzeugt die lineare x-Skala mit der aktuellen Domain.
   */
  #createXScale(): d3.ScaleLinear<number, number> {
    return d3.scaleLinear().domain(this.#xDomain).range([0, this.innerWidth])
  }

  /**
   * Erzeugt die Band-Skala für die y-Achse.
   * Die Domain verwendet STACK_ORDER, nicht die aktuellen Daten,
   * damit die Zeilen auch bei leeren Daten stabil bleiben.
   */
  #createYScale(): d3.ScaleBand<MixSourceKey> {
    return d3
      .scaleBand<MixSourceKey>()
      .domain(STACK_ORDER)
      .range([0, this.innerHeight])
      .paddingInner(0.28)
      .paddingOuter(0.12)
  }

  /**
   * Zeichnet oder aktualisiert die Nulllinie.
   */
  #renderZeroLine(): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup
      .append('line')
      .attr('class', 'zero-line')
      .attr('y1', 0)
      .attr('y2', this.innerHeight)
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.75)
  }

  /**
   * Aktualisiert die Position der Nulllinie bei Skalenänderung.
   */
  #updateZeroLine(xScale: d3.ScaleLinear<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup
      .selectAll<SVGLineElement, unknown>('line.zero-line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
  }

  /**
   * Zeichnet zwei feine horizontale Trennlinien zwischen den Gruppen.
   * Die Linien sitzen zwischen PV und Kernenergie sowie zwischen
   * Kernenergie und den fossilen Quellen.
   */
  #renderGroupSeparators(): void {
    if (!this.#chartGroup) {
      return
    }

    const yScale = this.#createYScale()

    // Zwischen PV (Index 4) und Kernenergie (Index 5)
    const nuclearIndex = STACK_ORDER.indexOf('nuclear')
    const nuclearTop = yScale('nuclear') ?? 0
    const nuclearHeight = yScale.bandwidth()

    this.#chartGroup
      .append('line')
      .attr('class', 'group-separator')
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', nuclearTop - nuclearHeight * 0.14)
      .attr('y2', nuclearTop - nuclearHeight * 0.14)

    // Zwischen Kernenergie (Index 5) und Sonstige Konventionelle (Index 6)
    const fossilIndex = STACK_ORDER.indexOf('other_fossil')
    const fossilTop = yScale('other_fossil') ?? 0

    this.#chartGroup
      .append('line')
      .attr('class', 'group-separator')
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', fossilTop - fossilTop * 0.14)
      .attr('y2', fossilTop - fossilTop * 0.14)
  }

  /**
   * Aktualisiert die Position der Gruppentrennlinien.
   */
  #updateGroupSeparators(yScale: d3.ScaleBand<MixSourceKey>): void {
    if (!this.#chartGroup) {
      return
    }

    const nuclearBandHeight = yScale.bandwidth()
    const nuclearTop = yScale('nuclear') ?? 0
    const fossilTop = yScale('other_fossil') ?? 0

    const separators = this.#chartGroup.selectAll<SVGLineElement, unknown>(
      'line.group-separator',
    )

    separators.each(function (_, index: number) {
      const element = d3.select(this)

      if (index === 0) {
        // Erste Linie: zwischen PV und Kernenergie
        element.attr('y1', nuclearTop - nuclearBandHeight * 0.14)
        element.attr('y2', nuclearTop - nuclearBandHeight * 0.14)
      } else if (index === 1) {
        // Zweite Linie: zwischen Kernenergie und fossilen Quellen
        element.attr('y1', fossilTop - fossilTop * 0.14)
        element.attr('y2', fossilTop - fossilTop * 0.14)
      }
    })
  }

  /**
   * Zeichnet die x-Achse mit Prozentpunkt-Beschriftung.
   */
  #renderXAxis(xScale: d3.ScaleLinear<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('g.x-axis').remove()

    const xAxisGroup = this.#chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((domainValue) => {
            return formatPercentagePoints(domainValue as number)
          })
          .tickSizeOuter(0),
      )
  }

  /**
   * Zeichnet die y-Achse mit deutschen Energieträger-Bezeichnungen.
   */
  #renderYAxis(yScale: d3.ScaleBand<MixSourceKey>): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('g.y-axis').remove()

    this.#chartGroup
      .append('g')
      .attr('class', 'y-axis')
      .call(
        d3
          .axisLeft(yScale)
          .tickFormat((sourceKey) => {
            return MIX_LABELS[sourceKey as MixSourceKey]
          })
          .tickSize(0),
      )
  }

  /**
   * Zeichnet oder aktualisiert die Balken mit D3-Join.
   */
  #renderBars(
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    if (!this.#barsGroup) {
      return
    }

    const bars = this.#barsGroup
      .selectAll<SVGRectElement, EmissionRow>('rect.deviation-bar')
      .data(this.#data, (row) => row.sourceKey)

    bars.join(
      (enter) => {
        const hasGen = (row: EmissionRow) => row.generationTwh > 0

        const enterBars = enter
          .append('rect')
          .attr('class', 'deviation-bar')
          .attr('data-source-key', (row) => row.sourceKey)
          .attr('y', (row) => yScale(row.sourceKey) ?? 0)
          .attr('height', (row) => hasGen(row) ? yScale.bandwidth() : 1)
          .attr('fill', (row) => {
            if (!hasGen(row)) return '#c0c0c0'
            return this.#colors[row.sourceKey]
          })
          .attr('x', xScale(0))
          .attr('width', 0)
          .attr('opacity', (row) => hasGen(row) ? 1 : 0.4)
          .on('click', (_event: PointerEvent, row: EmissionRow) => {
            this.#handleBarClick(row)
          })

        enterBars
          .transition()
          .duration(600)
          .attr('x', (row) => hasGen(row) ? getDeviationBarX(row.deviationPp, xScale) : xScale(0) - 0.5)
          .attr('width', (row) =>
            hasGen(row) ? getDeviationBarWidth(row.deviationPp, xScale) : 1,
          )

        return enterBars
      },
      (update) => {
        const hasGen = (row: EmissionRow) => row.generationTwh > 0

        return update
          .transition()
          .duration(600)
          .attr('y', (row) => yScale(row.sourceKey) ?? 0)
          .attr('height', (row) => hasGen(row) ? yScale.bandwidth() : 1)
          .attr('fill', (row) => {
            if (!hasGen(row)) return '#c0c0c0'
            return this.#colors[row.sourceKey]
          })
          .attr('opacity', (row) => hasGen(row) ? 1 : 0.4)
          .attr('x', (row) => hasGen(row) ? getDeviationBarX(row.deviationPp, xScale) : xScale(0) - 0.5)
          .attr('width', (row) =>
            hasGen(row) ? getDeviationBarWidth(row.deviationPp, xScale) : 1,
          )
      },
      (exit) => {
        return exit.remove()
      },
    )
  }

  /**
   * Zeichnet oder aktualisiert die Wertelabels neben den Balken.
   */
  #renderValueLabels(
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    if (!this.#labelsGroup) {
      return
    }

    const labels = this.#labelsGroup
      .selectAll<SVGTextElement, EmissionRow>('text.deviation-value')
      .data(this.#data, (row) => row.sourceKey)

    labels.join(
      (enter) => {
        const enterLabels = enter
          .append('text')
          .attr('class', 'deviation-value')
          .attr('dy', '0.35em')
          .attr('font-size', '12px')
          .attr('font-family', 'var(--font-sans, sans-serif)')
          .attr('fill', 'currentColor')
          .attr('pointer-events', 'none')
          .attr('x', (row) => this.#getLabelX(row, xScale))
          .attr('y', (row) => {
            const bandCenter = yScale(row.sourceKey) ?? 0
            return bandCenter + yScale.bandwidth() / 2
          })
          .text((row) => {
            if (row.generationTwh === 0) return 'keine Erzeugung'
            return formatPercentagePoints(row.deviationPp)
          })

        enterLabels
          .transition()
          .duration(600)
          .attr('x', (row) => this.#getLabelX(row, xScale))
          .attr('y', (row) => {
            const bandCenter = yScale(row.sourceKey) ?? 0
            return bandCenter + yScale.bandwidth() / 2
          })
          .text((row) => {
            if (row.generationTwh === 0) return 'keine Erzeugung'
            return formatPercentagePoints(row.deviationPp)
          })

        return enterLabels
      },
      (update) => {
        return update
          .transition()
          .duration(600)
          .attr('x', (row) => this.#getLabelX(row, xScale))
          .attr('y', (row) => {
            const bandCenter = yScale(row.sourceKey) ?? 0
            return bandCenter + yScale.bandwidth() / 2
          })
          .text((row) => {
            if (row.generationTwh === 0) return 'keine Erzeugung'
            return formatPercentagePoints(row.deviationPp)
          })
      },
      (exit) => {
        return exit.remove()
      },
    )

    // Text-Ausrichtung nach der Transition setzen
    labels
      .attr('text-anchor', (row) => this.#getLabelAnchor(row))
  }

  /**
   * Bestimmt die x-Position des Wertelabels.
   * Positive Werte: rechts vom Balkenende.
   * Negative Werte: links vom Balkenanfang (negativer Wert).
   * Null: leicht rechts von der Nulllinie.
   */
  #getLabelX(
    row: EmissionRow,
    xScale: d3.ScaleLinear<number, number>,
  ): number {
    const deviationPp = row.deviationPp
    const zeroPosition = xScale(0)
    const valuePosition = xScale(deviationPp)

    if (deviationPp > 0) {
      return valuePosition + 6
    }

    if (deviationPp < 0) {
      return valuePosition - 6
    }

    return zeroPosition + 6
  }

  /**
   * Bestimmt die Textausrichtung des Wertelabels.
   * Positive Werte: linksbündig.
   * Negative Werte: rechtsbündig.
   * Null: linksbündig.
   */
  #getLabelAnchor(row: EmissionRow): 'start' | 'end' {
    if (row.deviationPp < 0) {
      return 'end'
    }

    return 'start'
  }

  /**
   * Rendert die y-Achsenbeschriftung als rotierten Text links neben der Achse.
   */
  #renderYAxisLabel(): void {
    if (!this.#svg) {
      return
    }

    this.#svg.selectAll('.y-axis-label').remove()

    this.#svg
      .append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', `rotate(-90)`)
      .attr('x', -(this.innerHeight / 2))
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-sans)')
      .attr('font-size', '13px')
      .attr('fill', '#8a8a85')
      .text(this.#subtitle)
  }

  /**
   * Zeichnet die Richtungsbeschriftungen unterhalb der x-Achse.
   * Wird einmalig in render() aufgerufen.
   */
  #renderDirectionLabels(): void {
    if (!this.#chartGroup) {
      return
    }

    const labelY =
      this.innerHeight + this.margin.bottom - 8

    // Links: emissionsärmer
    this.#chartGroup
      .append('text')
      .attr('class', 'direction-label')
      .attr('x', 8)
      .attr('y', labelY)
      .attr('text-anchor', 'start')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.6)
      .text('← Emissionsanteil niedriger als Stromanteil')

    // Rechts: emissionsreicher
    this.#chartGroup
      .append('text')
      .attr('class', 'direction-label')
      .attr('x', this.innerWidth - 8)
      .attr('y', labelY)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.6)
      .text('Emissionsanteil höher als Stromanteil →')

    // Erklärung der Nulllinie
    this.#chartGroup
      .append('text')
      .attr('class', 'zero-line-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', labelY + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.5)
      .text('0 pp = gleicher Anteil')
  }

  /**
   * Aktualisiert die Opazität aller Balken, Wertelabels und
   * y-Achsen-Beschriftungen basierend auf der Auswahl.
   */
  #updateHighlight(): void {
    if (!this.#barsGroup || !this.#labelsGroup || !this.#chartGroup) {
      return
    }

    // Sowohl per setHighlight (Hover) als auch per Klick (selected) dimmen
    const selectedKey = this.#selectedSource ?? this.#highlightedSource

    this.#barsGroup
      .selectAll<SVGRectElement, EmissionRow>('rect.deviation-bar')
      .attr('opacity', (row) => {
        if (selectedKey === null) return 1
        return row.sourceKey === selectedKey ? 1 : 0.3
      })

    this.#labelsGroup
      .selectAll<SVGTextElement, EmissionRow>('text.deviation-value')
      .attr('opacity', (row) => {
        if (selectedKey === null) return 1
        return row.sourceKey === selectedKey ? 1 : 0.3
      })

    this.#chartGroup
      .selectAll<SVGTextElement, MixSourceKey>('g.y-axis .tick text')
      .attr('opacity', (sourceKey) => {
        if (selectedKey === null) return 1
        return sourceKey === selectedKey ? 1 : 0.3
      })
  }

  /**
   * Behandelt Klick auf einen Balken.
   * Schaltet die Auswahl um oder setzt zurück.
   */
  #handleBarClick(row: EmissionRow): void {
    const alreadySelected = this.#selectedSource === row.sourceKey
    const newSelection = alreadySelected ? null : row.sourceKey

    this.#selectedSource = newSelection
    this.#updateHighlight()
    this.#selectionHandler?.(newSelection)
  }

  /**
   * Setzt die Auswahl zurück (bei Klick auf leere Fläche).
   */
  #handleBackgroundClick(): void {
    this.#selectedSource = null
    this.#updateHighlight()
    this.#selectionHandler?.(null)
    this.#backgroundClickHandler?.()
  }
}
