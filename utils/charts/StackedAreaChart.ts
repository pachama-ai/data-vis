/**
 * utils/charts/StackedAreaChart.ts – D3-Stacked-Area-Chart (absolute Werte).
 *
 * Erbt von BaseChart und rendert zehn gestapelte Flächen für den
 * deutschen Strommix 2015–2024. Keine Interaktion, keine Animation.
 */

import * as d3 from 'd3'

import { BaseChart } from '~/utils/charts/BaseChart'
import { MIX_COLORS, MIX_COLORS_ACCESSIBLE, STACK_ORDER } from '~/utils/mix-config'

import type { MixMode, MixMonthRow, MixSourceKey, MixAnnotation } from '~/types/mix'

// =========================================================================
// Exportierte Typen für die Hover-Kommunikation mit Vue
// =========================================================================

export interface MixHoverPayload {
  monthRow: MixMonthRow
  chartX: number
  chartY: number
}

type HoverHandler = (payload: MixHoverPayload) => void
type HoverEndHandler = () => void

// =========================================================================
// Exportierter Annotationstyp
// =========================================================================

export interface AnnotationPosition {
  annotation: MixAnnotation
  x: number
}

/**
 * Parst ein Annotation-Datum "YYYY-MM" oder "YYYY" in ein Date-Objekt.
 * Bei Monatsangabe wird der 1. des Monats verwendet,
 * bei Jahresangabe der 1. Juli.
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

// =========================================================================
// Exportierte Hilfsfunktion: nächsten Monat per Bisector bestimmen
// =========================================================================

export function findNearestMonthRow(
  monthlyRows: MixMonthRow[],
  targetDate: Date,
): MixMonthRow | null {
  if (monthlyRows.length === 0) {
    return null
  }

  const monthBisector = d3.bisector<MixMonthRow, Date>((monthRow) => {
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

// =========================================================================
// Privater Typ für eine gestapelte Serie (vereinfacht D3-Typen)
// =========================================================================

type StackedSeries = d3.Series<MixMonthRow, string>

// =========================================================================
// Chart-Klasse
// =========================================================================

export class StackedAreaChart extends BaseChart {
  /** Normalisierte Monatsdaten (in TWh, mit Date-Objekt) */
  #data: MixMonthRow[] = []

  /** Aktueller Darstellungsmodus (absolute TWh oder prozentuale Anteile) */
  #mode: MixMode = 'absolute'

  /** Hervorzuhebende Quellen oder null (keine Hervorhebung) */
  #highlightedSources: MixSourceKey[] | null = null

  /** Das SVG-Element */
  #svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

  /** Innere Gruppe, die um margin.left/margin.top verschoben ist */
  #chartGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null
  /** Gruppe für Highlight-Konturlinien */
  #outlineGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null
  /** Aktuelle x-Skala für Hover-Berechnungen */
  #xScale: d3.ScaleTime<number, number> | null = null

  /** Aktive Farbpalette (kann über setColors gewechselt werden) */
  #colors: Record<MixSourceKey, string> = MIX_COLORS

  /** Externer Callback für Pointer-Bewegung */
  #hoverHandler: HoverHandler | null = null

  /** Externer Callback für Pointer-Verlassen */
  #hoverEndHandler: HoverEndHandler | null = null

  /** Externer Callback für Hintergrundklick */
  #backgroundClickHandler: (() => void) | null = null

  /** Subtitle-Text (wird im SVG gerendert) */
  #subtitle: string = ''

  /** Geladene Annotationen */
  #annotations: MixAnnotation[] = []

  /** Aktuell ausgewählte Annotation (id) oder null */
  #selectedAnnotationId: number | null = null

  // =======================================================================
  // Daten setzen
  // =======================================================================

  setMode(mode: MixMode): void {
    this.#mode = mode
    this.update()
  }

  setHighlightedSources(sourceKeys: MixSourceKey[] | null): void {
    this.#highlightedSources = sourceKeys
    this.#updateHighlight()
  }

  setData(data: MixMonthRow[]): void {
    this.#data = data
    this.update()
  }

  setHoverHandler(handler: HoverHandler | null): void {
    this.#hoverHandler = handler
  }

  setHoverEndHandler(handler: HoverEndHandler | null): void {
    this.#hoverEndHandler = handler
  }

  setBackgroundClickHandler(handler: (() => void) | null): void {
    this.#backgroundClickHandler = handler
  }

  setAnnotations(annotations: MixAnnotation[]): void {
    this.#annotations = annotations
    this.#updateFixedAnnotationLine()
  }

  setSelectedAnnotation(annotationId: number | null): void {
    this.#selectedAnnotationId = annotationId
    this.#updateFixedAnnotationLine()
  }

  setColors(colorMode: 'default' | 'accessible'): void {
    this.#colors = colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
    this.update()
  }

  setSubtitle(text: string): void {
    this.#subtitle = text
    this.#renderSubtitle()
  }

  // =======================================================================
  // render – SVG anlegen
  // =======================================================================

  override render(container: HTMLElement): void {
    // Vorhandenes SVG entfernen, damit kein Duplikat entsteht
    this.destroy()

    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr(
        'aria-label',
        'Gestapeltes Flächendiagramm zum deutschen Strommix von 2015 bis 2024',
      )

    const chartGroup = svg
      .append('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`)

    container.appendChild(svg.node()!)

    this.#svg = svg
    this.#chartGroup = chartGroup

    // Outline-Gruppe für Highlight-Kontur einmalig anlegen
    this.#outlineGroup = chartGroup.append('g').attr('class', 'highlight-outlines')

    // Subtitle einmalig anlegen
    this.#renderSubtitle()

    // Hover-Elemente einmalig anlegen
    this.#createHoverElements()

    this.update()
  }

  // =======================================================================
  // update – gesamte Zeichenlogik
  // =======================================================================

  override update(): void {
    if (!this.#hasRequiredState()) {
      return
    }

    // Bei leeren Daten alte Darstellung entfernen
    if (this.#data.length === 0) {
      this.#clearChart()
      return
    }

    const stackedSeries = this.#createStackedSeries()
    const xScale = this.#createXScale()
    const yScale = this.#createYScale(stackedSeries)

    this.#xScale = xScale

    this.#renderAreas(stackedSeries, xScale, yScale)
    this.#updateHighlight()
    this.#renderXAxis(xScale)
    this.#renderYAxis(yScale)
    this.#updateFixedAnnotationLine()
  }

  // =======================================================================
  // destroy – SVG entfernen
  // =======================================================================

  override destroy(): void {
    if (this.#svg) {
      this.#svg.remove()
      this.#svg = null
      this.#chartGroup = null
      this.#outlineGroup = null
    }

    this.#xScale = null
    this.#hoverHandler = null
    this.#hoverEndHandler = null
    this.#backgroundClickHandler = null
    this.#annotations = []
    this.#selectedAnnotationId = null
  }

  // =======================================================================
  // Private Hilfsmethoden
  // =======================================================================

  /**
   * Prüft, ob SVG, Chart-Gruppe und Daten vorhanden sind.
   * Wird am Beginn von update() aufgerufen.
   */
  #hasRequiredState(): boolean {
    if (!this.#svg || !this.#chartGroup) {
      return false
    }

    return true
  }

  /**
   * Entfernt alle Layer und Achsen aus der Chart-Gruppe.
   * Wird bei leeren Daten aufgerufen. Blendet auch Hover-Elemente aus.
   */
  #clearChart(): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('.layer').remove()
    this.#chartGroup.selectAll('.x-axis').remove()
    this.#chartGroup.selectAll('.y-axis').remove()

    // Hover-Elemente ausblenden
    this.#chartGroup.selectAll('.hover-guide').style('display', 'none')
    this.#chartGroup.selectAll('.hover-month-label').style('display', 'none')

    this.#hoverEndHandler?.()
  }

  /**
   * Erzeugt aus den Monatsdaten die gestapelten Serien mit d3.stack.
   * Die Reihenfolge der Schichten folgt STACK_ORDER (von unten nach oben).
   */
  #createStackedSeries(): StackedSeries[] {
    const stackGenerator = d3
      .stack<MixMonthRow>()
      .keys(STACK_ORDER)
      // d3.stack erwartet für jeden Key einen Zahlenwert aus dem Datenpunkt.
      // Der sourceKey ist vom Typ MixSourceKey, wird aber von D3 als string
      // behandelt – daher der Type-Zugriff über den Index.
      .value((monthRow, sourceKey) => {
        return monthRow.values[sourceKey as MixSourceKey]
      })

    // Im Share-Modus werden die Werte auf 0–1 normalisiert
    if (this.#mode === 'share') {
      stackGenerator.offset(d3.stackOffsetExpand)
    }

    const stackedSeries = stackGenerator(this.#data)

    return stackedSeries
  }

  /**
   * Erzeugt die X-Skala (Zeit) vom ersten bis zum letzten Monat.
   */
  #createXScale(): d3.ScaleTime<number, number> {
    const dateExtent = d3.extent(this.#data, (row) => row.date)

    // d3.extent kann bei leeren Daten undefined zurückgeben,
    // aber update() stellt sicher, dass Daten vorhanden sind.
    if (!dateExtent[0] || !dateExtent[1]) {
      throw new Error(
        'StackedAreaChart: Datumsextent konnte nicht bestimmt werden.',
      )
    }

    // Domain bis Januar des Folgejahres erweitern,
    // damit der 2025-Tick sichtbar ist und kein zweiter
    // Tick am Domain-Ende entsteht.
    const lastYear = dateExtent[1].getFullYear()
    const domainEnd = new Date(lastYear + 1, 0, 1)

    const xScale = d3
      .scaleTime()
      .domain([dateExtent[0], domainEnd])
      .range([0, this.innerWidth])

    return xScale
  }

  /**
   * Erzeugt die Y-Skala (linear) von 0 bis zum maximalen Stack-Wert.
   * Der Maximalwert wird durch eine Schleife über alle Serien ermittelt.
   */
  #createYScale(stackedSeries: StackedSeries[]): d3.ScaleLinear<number, number> {
    // Im Share-Modus ist die Skala immer 0 bis 1 (= 0 % bis 100 %)
    if (this.#mode === 'share') {
      return d3
        .scaleLinear()
        .domain([0, 1])
        .range([this.innerHeight, 0])
    }

    // Absoluter Modus: Maximalwert aus den gestapelten Daten ermitteln
    let maximumStackValue = 0

    for (const series of stackedSeries) {
      for (const point of series) {
        // point[1] ist der obere Wert der gestapelten Fläche
        const upperValue = point[1]

        if (upperValue > maximumStackValue) {
          maximumStackValue = upperValue
        }
      }
    }

    const yScale = d3
      .scaleLinear()
      .domain([0, maximumStackValue])
      .range([this.innerHeight, 0])
      .nice()

    return yScale
  }

  /**
   * Erzeugt den Area-Generator und rendert alle gestapelten Flächen.
   * Jede Fläche erhält die Klasse 'layer' und eine data-series-key-Klasse.
   */
  #renderAreas(
    stackedSeries: StackedSeries[],
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const areaGenerator = d3
      .area<d3.SeriesPoint<MixMonthRow>>()
      // X-Position aus dem Datum des Datenpunkts
      .x((point) => {
        return xScale(point.data.date)
      })
      // Unterkante der Schicht
      .y0((point) => {
        return yScale(point[0])
      })
      // Oberkante der Schicht
      .y1((point) => {
        return yScale(point[1])
      })

    if (!this.#chartGroup) {
      return
    }

    // Daten-Join: Jede gestapelte Serie wird einem path-Element zugeordnet.
    // Der Key ist der Serien-Key (z. B. "pv", "gas").
    // Dadurch ist später für Highlight-Updates das Datenobjekt verfügbar.
    const layers = this.#chartGroup
      .selectAll<SVGPathElement, StackedSeries>('path.layer')
      .data(stackedSeries, (series) => series.key)

    layers.join(
      (enter) =>
        enter
          .append('path')
          .attr('class', (series) => `layer layer-${series.key}`)
          .attr('data-series-key', (series) => series.key)
          .attr('fill', (series) => {
            const seriesKey = series.key as MixSourceKey
            return this.#colors[seriesKey]
          })
          .attr('d', (series) => areaGenerator(series)),
      (update) =>
        update
          .attr('fill', (series) => {
            const seriesKey = series.key as MixSourceKey
            return this.#colors[seriesKey]
          })
          .attr('d', (series) => areaGenerator(series)),
      (exit) => exit.remove(),
    )
  }

  /**
   * Rendert die X-Achse (unten) mit Jahreszahlen.
   */
  #renderXAxis(xScale: d3.ScaleTime<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    // Vorhandene Achse entfernen
    this.#chartGroup.selectAll('.x-axis').remove()

    // Feste Tickwerte vom ersten bis zum letzten Datenjahr + 1
    // Damit auch der letzte Tick (Dez→Jan Übergang) beschriftet wird
    const firstYear = this.#data[0]?.date.getFullYear() ?? 2015
    const lastYear = this.#data[this.#data.length - 1]?.date.getFullYear() ?? 2024

    const yearTicks: Date[] = []

    for (let year = firstYear; year <= lastYear + 1; year += 1) {
      yearTicks.push(new Date(year, 0, 1))
    }

    const xAxis = d3
      .axisBottom<Date>(xScale)
      .tickValues(yearTicks)
      .tickFormat(d3.timeFormat('%Y') as unknown as (date: Date) => string)

    this.#chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(xAxis)
  }

  /**
   * Rendert den Subtitle-Text im SVG (oberhalb der Zeichenfläche).
   */
  #renderSubtitle(): void {
    if (!this.#svg) {
      return
    }

    this.#svg.selectAll('.chart-subtitle-svg').remove()

    this.#svg
      .append('text')
      .attr('class', 'chart-subtitle-svg')
      .attr('x', this.margin.left)
      .attr('y', this.margin.top - 22)
      .attr('font-family', 'var(--font-sans)')
      .attr('font-size', '13px')
      .attr('fill', '#8a8a85')
      .text(this.#subtitle)
  }

  /**
   * Rendert die Y-Achse (links) mit Werten in TWh.
   */
  #renderYAxis(yScale: d3.ScaleLinear<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    // Vorhandene Achse entfernen
    this.#chartGroup.selectAll('.y-axis').remove()

    const yAxis = d3.axisLeft<number>(yScale).ticks(5)

    // Unterschiedliche Formatierung je nach Modus
    if (this.#mode === 'share') {
      // d3.format('.0%'): 0.2 → "20%"
      yAxis.tickFormat(d3.format('.0%') as unknown as (value: number) => string)
    } else {
      yAxis.tickFormat((value: number) => {
        return `${value} TWh`
      })
    }

    this.#chartGroup
      .append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
  }

  /**
   * Aktualisiert Opazität und Kontur aller Layer je nach Highlight-Zustand.
   *
   * Bei aktivem Highlight:
   * - betroffene Layer: opacity 1, stroke mit eigener Farbe
   * - andere Layer: opacity 0.15, kein stroke
   *
   * Ohne Highlight:
   * - alle Layer: opacity 1, kein stroke
   */
  #updateHighlight(): void {
    if (!this.#chartGroup) {
      return
    }

    const highlightedSources = this.#highlightedSources
    const hasActiveHighlight =
      highlightedSources !== null &&
      highlightedSources.length > 0

    // Layer-Opazität setzen, Stroke immer entfernen
    this.#chartGroup
      .selectAll<SVGPathElement, StackedSeries>('path.layer')
      .attr('opacity', (series) => {
        if (!hasActiveHighlight) {
          return 1
        }

        if (highlightedSources!.includes(series.key as MixSourceKey)) {
          return 1
        }

        return 0.15
      })
      .attr('stroke', 'none')
      .attr('stroke-width', 0)

    // Separate Konturlinien für hervorgehobene Quellen zeichnen
    this.#renderHighlightOutlines()
  }

  /**
   * Zeichnet oder aktualisiert die Konturlinien für hervorgehobene Layer.
   * Verwendet d3.line mit .defined(), um Nullwerte auszuschließen.
   */
  #renderHighlightOutlines(): void {
    if (!this.#chartGroup || !this.#outlineGroup || !this.#xScale) {
      return
    }

    const highlightedSources = this.#highlightedSources
    const hasActiveHighlight =
      highlightedSources !== null &&
      highlightedSources.length > 0

    if (!hasActiveHighlight || this.#data.length === 0) {
      this.#outlineGroup.selectAll('path.highlight-outline').remove()
      return
    }

    // y-Skala aus vorhandenen Daten neu berechnen
    const stackedSeries = this.#createStackedSeries()
    const yScale = this.#createYScale(stackedSeries)

    // Konturlinie pro Serie
    const outlines = this.#outlineGroup
      .selectAll<SVGPathElement, StackedSeries>('path.highlight-outline')
      .data(stackedSeries, (series) => series.key)

    outlines.join(
      (enterSelection) => {
        return enterSelection
          .append('path')
          .attr('class', 'highlight-outline')
          .attr('fill', 'none')
          .attr('pointer-events', 'none')
      },
      (updateSelection) => {
        return updateSelection
      },
      (exitSelection) => {
        return exitSelection.remove()
      },
    )

    // Pfade nur für hervorgehobene Serien zeichnen
    outlines
      .attr('display', (series) => {
        const seriesKey = series.key as MixSourceKey

        if (highlightedSources!.includes(seriesKey)) {
          return null
        }

        return 'none'
      })
      .attr('stroke', (series) => {
        const seriesKey = series.key as MixSourceKey

        return MIX_COLORS[seriesKey]
      })
      .attr('stroke-width', 1.25)
      .attr('d', (series) => {
        const seriesKey = series.key as MixSourceKey

        const outlineLine = d3
          .line<d3.SeriesPoint<MixMonthRow>>()
          .defined((stackedPoint) => {
            // Nur zeichnen, wenn der tatsächliche Wert > 0 ist
            const sourceValue =
              stackedPoint.data.values[seriesKey]

            return sourceValue > 0
          })
          .x((stackedPoint) => {
            return this.#xScale!(stackedPoint.data.date)
          })
          .y((stackedPoint) => {
            return yScale(stackedPoint[1])
          })

        return outlineLine(series)
      })
  }

  // =======================================================================
  // Hover-Infrastruktur
  // =======================================================================

  /**
   * Erzeugt die drei Hover-Elemente (Führungslinie, Monatslabel, Overlay)
   * in der Chart-Gruppe. Wird einmalig in render() aufgerufen.
   */
  #createHoverElements(): void {
    if (!this.#chartGroup) {
      return
    }

    // Vertikale Führungslinie
    this.#chartGroup
      .append('line')
      .attr('class', 'hover-guide')
      .attr('y1', 0)
      .attr('y2', this.innerHeight)
      .attr('stroke', '#8a8a85')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
      .attr('opacity', 0.7)
      .style('display', 'none')
      .style('pointer-events', 'none')

    // Monatslabel oberhalb der Führungslinie
    this.#chartGroup
      .append('text')
      .attr('class', 'hover-month-label')
      .attr('text-anchor', 'middle')
      .attr('y', -6)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#4a4a45')
      .style('display', 'none')
      .style('pointer-events', 'none')

    // Transparentes Overlay für Pointer-Events
    this.#chartGroup
      .append('rect')
      .attr('class', 'hover-overlay')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('pointermove', (event: PointerEvent) => {
        this.#handlePointerMove(event)
      })
      .on('pointerleave', () => {
        this.#handlePointerLeave()
      })
      .on('click', () => {
        this.#backgroundClickHandler?.()
      })

    // Feste vertikale Linie für ausgewählte Annotation
    this.#chartGroup
      .append('line')
      .attr('class', 'fixed-annotation-guide')
      .attr('y1', 0)
      .attr('y2', this.innerHeight)
      .attr('stroke', '#2D6A4F')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5 3')
      .attr('opacity', 0.8)
      .style('display', 'none')
      .style('pointer-events', 'none')

    // Monatslabel für die feste Ereignislinie
    this.#chartGroup
      .append('text')
      .attr('class', 'fixed-annotation-label')
      .attr('text-anchor', 'middle')
      .attr('y', -6)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#2D6A4F')
      .style('display', 'none')
      .style('pointer-events', 'none')
  }

  /**
   * Zeigt Führungslinie und Monatslabel an der x-Position des nächstgelegenen
   * Monats an.
   */
  #showHoverGuide(monthRow: MixMonthRow, monthX: number): void {
    if (!this.#chartGroup) {
      return
    }

    const germanMonthFormatter = new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
    })

    const formattedMonth = germanMonthFormatter.format(monthRow.date)

    this.#chartGroup
      .selectAll('.hover-guide')
      .attr('x1', monthX)
      .attr('x2', monthX)
      .style('display', null)

    this.#chartGroup
      .selectAll('.hover-month-label')
      .attr('x', monthX)
      .text(formattedMonth)
      .style('display', null)
  }

  /**
   * Verarbeitet Pointer-Bewegungen: Bestimmt den nächstgelegenen Monat
   * und aktualisiert Führungslinie, Label und Hover-Callback.
   */
  #handlePointerMove(event: PointerEvent): void {
    if (!this.#chartGroup || !this.#xScale) {
      return
    }

    const overlay = event.currentTarget as SVGRectElement
    const pointerPosition = d3.pointer(event, overlay)

    const pointerX = pointerPosition[0]

    const clampedX = Math.max(
      0,
      Math.min(this.innerWidth, pointerX),
    )

    const hoveredDate = this.#xScale.invert(clampedX)
    const nearestMonth = findNearestMonthRow(
      this.#data,
      hoveredDate,
    )

    if (!nearestMonth) {
      return
    }

    const monthX = this.#xScale(nearestMonth.date)

    this.#showHoverGuide(nearestMonth, monthX)

    this.#hoverHandler?.({
      monthRow: nearestMonth,
      chartX: monthX + this.margin.left,
      chartY: pointerPosition[1] + this.margin.top,
    })
  }

  /**
   * Blendet Führungslinie und Monatslabel aus und benachrichtigt Vue.
   */
  #handlePointerLeave(): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('.hover-guide').style('display', 'none')
    this.#chartGroup.selectAll('.hover-month-label').style('display', 'none')

    this.#hoverEndHandler?.()
  }

  // =======================================================================
  // Annotationen
  // =======================================================================

  /**
   * Zeigt oder verbirgt die feste vertikale Linie für die aktuell
   * ausgewählte Annotation.
   */
  #updateFixedAnnotationLine(): void {
    if (!this.#chartGroup || !this.#xScale) {
      return
    }

    const line = this.#chartGroup.select('.fixed-annotation-guide')
    const label = this.#chartGroup.select('.fixed-annotation-label')

    if (
      this.#selectedAnnotationId === null ||
      this.#annotations.length === 0
    ) {
      line.style('display', 'none')
      label.style('display', 'none')
      return
    }

    const matchingAnnotation = this.#annotations.find(
      (ann) => ann.id === this.#selectedAnnotationId,
    )

    if (!matchingAnnotation) {
      line.style('display', 'none')
      label.style('display', 'none')
      return
    }

    const date = parseAnnotationDate(matchingAnnotation.date)
    const x = this.#xScale(date)

    // Deutsches Monats- und Jahresformat
    const monthFormatter = new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
    })

    const formattedDate = monthFormatter.format(date)

    line
      .attr('x1', x)
      .attr('x2', x)
      .style('display', null)

    label
      .attr('x', x)
      .text(formattedDate)
      .style('display', null)
  }
}
