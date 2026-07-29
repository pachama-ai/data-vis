/**
 * Zeichnet den Strommix als gestapeltes Flächendiagramm.
 *
 * Die Monatswerte der Energieträger liegen übereinander. Das Diagramm
 * kann entweder absolute Werte in TWh oder prozentuale Anteile zeigen.
 * Zusätzlich übernimmt die Klasse Hover, Hervorhebungen und die feste
 * Linie für ausgewählte Ereignisse.
 *
 * @author Selina Schneider
 */

import * as d3 from 'd3'

import { BaseChart } from '~/utils/charts/BaseChart'
import {
  MIX_COLORS,
  MIX_COLORS_ACCESSIBLE,
  STACK_ORDER,
} from '~/components/generation/mixConfig'
import {
  findNearestMonthRow,
  parseAnnotationDate,
} from '~/utils/charts/stackedAreaHelpers'

import type {
  MixAnnotation,
  MixMode,
  MixMonthRow,
  MixSourceKey,
} from '~/types/energy-mix'
import type { MixHoverPayload } from '~/utils/charts/stackedAreaHelpers'


/**
 * Jede Reihe gehört zu einem Energieträger und enthält für
 * jeden Monat eine Unterkante und eine Oberkante.
 */
type StackedSeries = d3.Series<MixMonthRow, string>


export class StackedAreaChart extends BaseChart {
  /** Alle Monatswerte, die aktuell im Diagramm gezeigt werden. */
  private data: MixMonthRow[] = []

  /**
   * Bestimmt, ob TWh oder Anteile dargestellt werden.
   * Der Startwert ist die absolute Darstellung.
   */
  private mode: MixMode = 'absolute'

  /**
   * Enthält die Energieträger, die gerade hervorgehoben werden.
   * null bedeutet, dass alle Flächen normal dargestellt werden.
   */
  private highlightedSources: MixSourceKey[] | null = null

  /**
   * Das äußere SVG des Diagramms.
   * Vor render() ist noch kein SVG vorhanden.
   */
  private svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

  /**
   * Innere SVG-Gruppe für alle sichtbaren Diagrammelemente.
   * Sie wird um die festgelegten Ränder verschoben.
   */
  private chartGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /**
   * Eigene Gruppe für Konturen über hervorgehobenen Flächen.
   * Dadurch bleiben Füllung und Kontur sauber getrennt.
   */
  private outlineGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /**
   * Aktuelle Zeitachse.
   * Sie wird später auch für Hover und Ereignisse gebraucht.
   */
  private xScale: d3.ScaleTime<number, number> | null = null

  /**
   * Aktuell verwendete Farben der Energieträger.
   * Standardmäßig wird die normale Farbpalette genutzt.
   */
  private colors: {
    hydro: string
    biomass: string
    wind_offshore: string
    wind_onshore: string
    pv: string
    nuclear: string
    gas: string
    other_fossil: string
    hardcoal: string
    lignite: string
  } = MIX_COLORS

  /**
   * Wird aufgerufen, wenn sich die Maus über dem Diagramm bewegt.
   * Vue bekommt damit Monatswert und Position für den Tooltip.
   */
  private hoverHandler: ((payload: MixHoverPayload) => void) | null = null

  /**
   * Wird aufgerufen, wenn die Maus das Diagramm verlässt.
   * Vue kann damit den Tooltip wieder ausblenden.
   */
  private hoverEndHandler: (() => void) | null = null

  /** Funktion für einen Klick auf den freien Bereich */
  private backgroundClickHandler: (() => void) | null = null

  /** Alle Ereignisse, die mit einer Linie gezeigt werden können. */
  private annotations: MixAnnotation[] = []

  /**
   * ID des gerade ausgewählten Ereignisses.
   * null bedeutet, dass keine feste Ereignislinie sichtbar ist.
   */
  private selectedAnnotationId: number | null = null


  // Setter

  /**
   * Setzt den Darstellungsmodus.
   *
   * @param mode Absolute Werte oder Anteile
   */
  setMode(mode: MixMode): void {
    this.mode = mode
    this.update()
  }

  /**
   * Setzt die hervorgehobenen Energieträger.
   *
   * @param sourceKeys Energieträger oder null
   */
  setHighlightedSources(sourceKeys: MixSourceKey[] | null): void {
    this.highlightedSources = sourceKeys
    this.updateHighlight()
  }

  /**
   * Übernimmt neue Monatsdaten.
   *
   * @param data Monatswerte des Strommixes
   */
  setData(data: MixMonthRow[]): void {
    this.data = data
    this.update()
  }

  /**
   * Speichert die Funktion für Mausbewegungen.
   *
   * @param handler Hover-Funktion oder null
   */
  setHoverHandler(handler: ((payload: MixHoverPayload) => void) | null): void {
    this.hoverHandler = handler
  }

  /**
   * Speichert die Funktion für das Verlassen des Diagramms.
   *
   * @param handler Funktion oder null
   */
  setHoverEndHandler(handler: (() => void) | null): void {
    this.hoverEndHandler = handler
  }

  /**
   * Speichert die Funktion für einen Hintergrundklick.
   *
   * @param handler Funktion oder null
   */
  setBackgroundClickHandler(handler: (() => void) | null): void {
    this.backgroundClickHandler = handler
  }

  /**
   * Übernimmt die Ereignisse der Zeitreihe.
   * Ruft updateFixedAnnotationLine() erneut auf, weil Ereignisse
   * auch vor der x-Skala gesetzt werden können.
   *
   * @param annotations Ereignisse für das Diagramm
   */
  setAnnotations(annotations: MixAnnotation[]): void {
    this.annotations = annotations
    this.updateFixedAnnotationLine()
  }

  /**
   * Setzt das ausgewählte Ereignis.
   * Die alte Linie bleibt stehen, solange sie nicht explizit über
   * den Reset-Zweig in updateFixedAnnotationLine zurückgesetzt wird.
   *
   * @param annotationId ID des Ereignisses oder null
   */
  setSelectedAnnotation(annotationId: number | null): void {
    this.selectedAnnotationId = annotationId
    this.updateFixedAnnotationLine()
  }

  /**
   * Setzt die normale oder kontrastreiche Farbpalette.
   *
   * @param colorMode Gewählte Farbpalette
   */
  setColors(colorMode: 'default' | 'accessible'): void {
    this.colors = colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
    this.update()
  }


  // render

  /**
   * Erstellt das SVG und die festen Diagrammelemente.
   * Ruft zuerst destroy() auf, damit bei einem erneuten render()
   * kein doppeltes SVG entsteht.
   *
   * @param container HTML-Element für das Diagramm
   */
  override render(container: HTMLElement): void {
    // Vorhandenes SVG wird zuerst weggeräumt, sonst entstehen Duplikate.
    this.destroy()

    // SVG mit den festen Abmessungen aus der Basisklasse erstellen.
    const svg = d3
      .create('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('role', 'img')
      .attr(
        'aria-label',
        'Gestapeltes Flächendiagramm zum deutschen Strommix von 2015 bis 2024',
      )

    // Innere Gruppe hält Abstand zu den Rändern.
    const chartGroup = svg
      .append('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`)

    container.appendChild(svg.node()!)

    this.svg = svg
    this.chartGroup = chartGroup

    // Outline-Gruppe für Highlight-Konturen einmalig anlegen.
    // Sie liegt über den Flächen, damit die Konturen nicht überdeckt werden.
    this.outlineGroup = chartGroup.append('g').attr('class', 'highlight-outlines')

    // Hover-Elemente einmalig aufbauen.
    this.createHoverElements()
  }


  // update

  /**
   * Aktualisiert Flächen, Achsen und Ereignislinie.
   * Die x-Skala wird zuerst gespeichert, bevor Hover und Annotation
   * aktualisiert werden – sonst würden Linien an der alten Position
   * gezeichnet.
   */
  override update(): void {
    if (!this.svg || !this.chartGroup) {
      return
    }

    // Bei leeren Daten die alte Darstellung wegräumen.
    if (this.data.length === 0) {
      this.clearChart()
      return
    }

    // Erst Daten und Skalen für die neue Darstellung erstellen.
    const stackedSeries = this.createStackedSeries()
    const xScale = this.createXScale()
    const yScale = this.createYScale(stackedSeries)

    // Zeitachse merken, weil Hover und Ereignisse sie brauchen.
    this.xScale = xScale

    this.renderAreas(stackedSeries, xScale, yScale)
    this.updateHighlight()
    this.renderXAxis(xScale)
    this.renderYAxis(yScale)
    this.updateFixedAnnotationLine()

    // Hover-Linie und Annotationen nach vorne holen (über den Flächen)
    this.chartGroup.select('.hover-guide').raise()
    this.chartGroup.select('.fixed-annotation-guide').raise()
    this.chartGroup.select('.fixed-annotation-label').raise()
  }


  // destroy

  /**
   * Entfernt das SVG und leert die gespeicherten Zustände.
   * Wichtig ist die Reihenfolge: erst das SVG entfernen, dann die
   * Referenzen leeren – sonst bleiben alte Zustände hängen.
   */
  override destroy(): void {
    if (this.svg) {
      this.svg.remove()
      this.svg = null
      this.chartGroup = null
      this.outlineGroup = null
    }

    this.xScale = null
    this.annotations = []
    this.selectedAnnotationId = null
  }


  // Zustands- und Aufräumhilfen

  /**
   * Entfernt Flächen und Achsen bei leeren Daten.
   * Ruft zusätzlich den Hover-Handler nach außen auf, damit der
   * Vue-Tooltip nicht mit veralteten Werten stehen bleibt.
   */
  private clearChart(): void {
    if (!this.chartGroup) {
      return
    }

    this.chartGroup.selectAll('.chart-area').remove()
    this.chartGroup.selectAll('.x-axis').remove()
    this.chartGroup.selectAll('.y-axis').remove()

    this.chartGroup.selectAll('.hover-guide').style('display', 'none')
    this.chartGroup.selectAll('.highlight-outline').remove()
    this.chartGroup.selectAll('.fixed-annotation-guide').style('display', 'none')
    this.chartGroup.selectAll('.fixed-annotation-label').style('display', 'none')

    this.hoverEndHandler?.()
  }


  // Daten und Skalen

  /**
   * Erstellt die gestapelten Reihen aus den Monatsdaten.
   *
   * @returns Gestapelte Reihen in der festen Reihenfolge
   */
  private createStackedSeries(): StackedSeries[] {
    const stackGenerator = d3
      .stack<MixMonthRow>()
      .keys(STACK_ORDER)
      // D3 arbeitet mit `string`-Keys, ich mit MixSourceKey – daher der Cast.
      .value(function (monthRow, sourceKey) {
        return monthRow.values[sourceKey as MixSourceKey]
      })

    if (this.mode === 'share') {
      stackGenerator.offset(d3.stackOffsetExpand)
    }

    const stackedSeries = stackGenerator(this.data)

    return stackedSeries
  }

  /**
   * Erstellt die Zeitachse vom ersten Monat bis Januar
   * nach dem letzten Datenjahr.
   *
   * @returns Skala für die x-Achse
   * @throws Fehler, wenn kein Datumsbereich gefunden wird
   */
  private createXScale(): d3.ScaleTime<number, number> {
    const dateExtent = d3.extent(this.data, function (row) { return row.date })

    // Domain bis Januar des Folgejahres erweitern, damit der letzte
    // Jahres-Tick sichtbar ist und kein zweiter Tick am Domainende sitzt.
    const lastYear = dateExtent[1]!.getFullYear()
    const domainEnd = new Date(lastYear + 1, 0, 1)

    const xScale = d3
      .scaleTime()
      .domain([dateExtent[0]!, domainEnd])
      .range([0, this.innerWidth])

    return xScale
  }

  /**
   * Erstellt die Skala für absolute Werte oder Anteile.
   *
   * @param stackedSeries Gestapelte Datenreihen
   * @returns Skala der y-Achse
   */
  private createYScale(stackedSeries: StackedSeries[]): d3.ScaleLinear<number, number> {
    if (this.mode === 'share') {
      return d3
        .scaleLinear()
        .domain([0, 1])
        .range([this.innerHeight, 0])
    }

    // Absoluter Modus: höchste obere Kante über alle Serien suchen.
    let maximumStackValue = 0

    for (const series of stackedSeries) {
      for (const point of series) {
        // point[1] ist die obere Kante der Stapelschicht.
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


  // Flächen zeichnen

  /**
   * Zeichnet neue Flächen und aktualisiert vorhandene Flächen.
   *
   * @param stackedSeries Gestapelte Datenreihen
   * @param xScale Skala der Zeitachse
   * @param yScale Skala der Werteachse
   */
  private renderAreas(
    stackedSeries: StackedSeries[],
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const self = this

    const areaGenerator = d3
      .area<d3.SeriesPoint<MixMonthRow>>()
      .x(function (point) { return xScale(point.data.date) })
      .y0(function (point) { return yScale(point[0]) })
      .y1(function (point) { return yScale(point[1]) })

    if (!this.chartGroup) {
      return
    }

    // Data-Join mit Key-Funktion: sorgt dafür, dass jede Serie beim Modus- oder Farbwechsel 
    // an demselben Pfad-Element hängen bleibt
    this.chartGroup
      .selectAll<SVGPathElement, StackedSeries>('path.chart-area')
      .data(stackedSeries, function (series) { return series.key })
      .join('path')
      .attr('class', function (series) { return `chart-area layer layer-${series.key}` })
      .attr('data-series-key', function (series) { return series.key })
      .attr('fill', function (series) {
        const seriesKey = series.key as MixSourceKey
        return self.colors[seriesKey]
      })
      .attr('d', function (series) { return areaGenerator(series) })
      .style('pointer-events', 'none')
  }


  // Achsen

  /**
   * Zeichnet die Jahreszahlen an der x-Achse.
   * Die Ticks werden über eine feste Liste selbst gebaut, weil D3
   * bei Zeitachsen sonst einzelne Jahre weglassen kann.
   *
   * @param xScale Skala der Zeitachse
   */
  private renderXAxis(xScale: d3.ScaleTime<number, number>): void {
    if (!this.chartGroup) {
      return
    }

    this.chartGroup.selectAll('.x-axis').remove()

    // Feste Tickwerte vom ersten Datenjahr bis lastYear + 1,
    // damit auch der Dezember→Januar-Übergang beschriftet wird.
    const firstYear = this.data[0]?.date.getFullYear() ?? 2015
    const lastYear = this.data[this.data.length - 1]?.date.getFullYear() ?? 2024

    const yearTicks: Date[] = []

    for (let year = firstYear; year <= lastYear + 1; year += 1) {
      yearTicks.push(new Date(year, 0, 1))
    }

    const xAxis = d3
      .axisBottom<Date>(xScale)
      .tickValues(yearTicks)
      .tickFormat(function (date) {
        return d3.timeFormat('%Y')(date)
      })

    this.chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(xAxis)
  }

  /**
   * Zeichnet die y-Achse für TWh oder Prozentwerte.
   *
   * @param yScale Skala der Werteachse
   */
  private renderYAxis(yScale: d3.ScaleLinear<number, number>): void {
    if (!this.chartGroup) {
      return
    }

    this.chartGroup.selectAll('.y-axis').remove()

    const yAxis = d3.axisLeft<number>(yScale).ticks(5)

    if (this.mode === 'share') {
      // d3.format('.0%'): 0.2 → "20%"
      yAxis.tickFormat(function (value: number) {
        return d3.format('.0%')(value)
      })
    } else {
      yAxis.tickFormat(function (value: number) {
        return `${value} TWh`
      })
    }

    this.chartGroup
      .append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
  }


  // Hervorhebung

  /**
   * Passt die Sichtbarkeit der Flächen an.
   * Die Kontur für hervorgehobene Flächen läuft komplett über eine
   * separate Outline-Ebene, weil ein Stroke direkt auf der gefüllten
   * Fläche zwischen gestapelten Schichten unruhig wirkte.
   */
  private updateHighlight(): void {
    if (!this.chartGroup) {
      return
    }

    const highlightedSources = this.highlightedSources
    const hasActiveHighlight =
      highlightedSources !== null &&
      highlightedSources.length > 0

    // Layer-Deckkraft setzen, Stroke bewusst immer wegnehmen –
    // die Kontur läuft komplett über die Outline-Ebene.
    this.chartGroup
      .selectAll<SVGPathElement, StackedSeries>('path.chart-area')
      .attr('opacity', function (series) {
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

    this.renderHighlightOutlines()
  }

  /**
   * Zeichnet die Konturen der hervorgehobenen Flächen.
   * Nutzt eine eigene Outline-Ebene mit eigenem join() und
   * unterbricht die Linie über d3.line().defined(), damit Monate
   * ohne Erzeugung nicht künstlich verbunden werden.
   */
  private renderHighlightOutlines(): void {
    if (!this.chartGroup || !this.outlineGroup || !this.xScale) {
      return
    }

    const self = this
    const highlightedSources = this.highlightedSources
    const hasActiveHighlight =
      highlightedSources !== null &&
      highlightedSources.length > 0

    // Kein Highlight oder keine Daten → alle Konturen weg.
    if (!hasActiveHighlight || this.data.length === 0) {
      this.outlineGroup.selectAll('path.highlight-outline').remove()
      return
    }

    // y-Skala noch einmal berechnen, weil sich Modus/Daten geändert haben können.
    const stackedSeries = this.createStackedSeries()
    const yScale = this.createYScale(stackedSeries)

    // Eine Konturlinie pro Serie – auch für nicht hervorgehobene Serien
    // wird ein Pfad angelegt, aber gleich per display: none ausgeblendet.
    // So kann ich beim Wechsel des Highlights nur die Sichtbarkeit toggeln.
    this.outlineGroup
      .selectAll<SVGPathElement, StackedSeries>('path.highlight-outline')
      .data(stackedSeries, function (series) { return series.key })
      .join('path')
      .attr('class', 'highlight-outline')
      .attr('fill', 'none')
      .attr('pointer-events', 'none')
      .attr('display', function (series) {
        const seriesKey = series.key as MixSourceKey

        if (highlightedSources!.includes(seriesKey)) {
          return null
        }

        return 'none'
      })
      .attr('stroke', function (series) {
        const seriesKey = series.key as MixSourceKey

        return self.colors[seriesKey]
      })
      .attr('stroke-width', 1.25)
      .attr('d', function (series) {
        const seriesKey = series.key as MixSourceKey

        // d3.line pro Serie, weil defined() den Rohwert der jeweiligen
        // Quelle braucht – nicht den Stapelwert.
        const outlineLine = d3
          .line<d3.SeriesPoint<MixMonthRow>>()
          .defined(function (stackedPoint) {
            const sourceValue = stackedPoint.data.values[seriesKey]

            // Nur zeichnen, wenn die Quelle in dem Monat auch produziert hat.
            return sourceValue > 0
          })
          .x(function (stackedPoint) {
            return self.xScale!(stackedPoint.data.date)
          })
          .y(function (stackedPoint) {
            return yScale(stackedPoint[1])
          })

        return outlineLine(series)
      })
  }


  // Hover

  /**
   * Erstellt Führungslinie, Ereignislinie und Hover-Fläche.
   * Das transparente Overlay (hover-overlay) ist nötig, weil
   * pointer-events auf gestapelten Pfaden unzuverlässig reagieren.
   */
  private createHoverElements(): void {
    if (!this.chartGroup) {
      return
    }

    const self = this

    // Vertikale Führungslinie beim Hover.
    this.chartGroup
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

    // Transparentes Overlay als Klick- und Pointer-Fläche.
    this.chartGroup
      .append('rect')
      .attr('class', 'hover-overlay')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('pointermove', function (event: PointerEvent) {
        self.handlePointerMove(event)
      })
      .on('pointerleave', function () {
        self.handlePointerLeave()
      })
      .on('click', function () {
        self.backgroundClickHandler?.()
      })

    // Feste vertikale Linie für die ausgewählte Annotation.
    this.chartGroup
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

    // Datumslabel über der festen Ereignislinie.
    this.chartGroup
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
   * Zeigt die Führungslinie am nächstgelegenen Monat.
   * Ein eigenes Monatslabel ist hier nicht nötig, weil der Monat
   * bereits im Vue-Tooltip angezeigt wird.
   *
   * @param monthX Horizontale Position des Monats
   */
  private showHoverGuide(monthX: number): void {
    if (!this.chartGroup) {
      return
    }

    this.chartGroup
      .selectAll('.hover-guide')
      .attr('x1', monthX)
      .attr('x2', monthX)
      .style('display', null)
  }

  /**
   * Bestimmt den nächsten Monat an der Mausposition.
   * Ablauf: d3.pointer ermittelt die Mausposition, xScale.invert
   * wandelt sie in ein Datum um, findNearestMonthRow sucht dazu den
   * passenden Monatswert.
   *
   * @param event Pointer-Ereignis der Hover-Fläche
   */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.chartGroup || !this.xScale) {
      return
    }

    // currentTarget ist das unsichtbare Overlay-Rechteck.
    const overlay = event.currentTarget as SVGRectElement

    // d3.pointer liefert die Mausposition innerhalb dieses Rechtecks.
    const pointerPosition = d3.pointer(event, overlay)

    const pointerX = pointerPosition[0]

    // invert wandelt die Pixelposition zurück in ein Datum.
    const hoveredDate = this.xScale.invert(pointerX)
    const nearestMonth = findNearestMonthRow(this.data, hoveredDate)

    if (!nearestMonth) {
      return
    }

    const monthX = this.xScale(nearestMonth.date)

    this.showHoverGuide(monthX)

    this.hoverHandler?.({
      monthRow: nearestMonth,
      chartX: monthX + this.margin.left,
      chartY: pointerPosition[1] + this.margin.top,
    })
  }

  /**
   * Blendet die Führungslinie aus und beendet den Hover-Zustand.
   * Ruft zusätzlich den Hover-End-Callback nach außen auf, damit der
   * Vue-Tooltip nicht hängen bleibt.
   */
  private handlePointerLeave(): void {
    if (!this.chartGroup) {
      return
    }

    this.chartGroup.selectAll('.hover-guide').style('display', 'none')

    this.hoverEndHandler?.()
  }


  // Annotationen

  /**
   * Zeigt die feste Linie für das ausgewählte Ereignis.
   * Die Suche läuft über die stabile ID und nicht über den
   * Array-Index, weil sich die Reihenfolge der Ereignisse ändern kann.
   */
  private updateFixedAnnotationLine(): void {
    if (!this.chartGroup || !this.xScale) {
      return
    }

    const self = this

    // Linie und Datumslabel wurden schon beim render() angelegt.
    const line = this.chartGroup.select('.fixed-annotation-guide')
    const label = this.chartGroup.select('.fixed-annotation-label')

    // Kein Ereignis ausgewählt oder gar keine Ereignisse vorhanden → verstecken.
    if (
      this.selectedAnnotationId === null ||
      this.annotations.length === 0
    ) {
      line.style('display', 'none')
      label.style('display', 'none')
      return
    }

    const matchingAnnotation = this.annotations.find(
      function (ann) { return ann.id === self.selectedAnnotationId },
    )

    if (!matchingAnnotation) {
      line.style('display', 'none')
      label.style('display', 'none')
      return
    }

    // Ereignisdatum in Position auf der Zeitachse umrechnen.
    const date = parseAnnotationDate(matchingAnnotation.date)
    const x = this.xScale(date)

    // Monat + Jahr auf Deutsch für das Label.
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
