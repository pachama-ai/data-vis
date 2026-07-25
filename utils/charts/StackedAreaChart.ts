/**
 * Zeichnet den Strommix als gestapeltes Flächendiagramm.
 *
 * Die Monatswerte der Energieträger liegen übereinander.
 * Das Diagramm zeigt entweder absolute Werte in TWh
 * oder prozentuale Anteile.
 *
 * Die Klasse übernimmt außerdem Hover, Hervorhebungen
 * und Linien für ausgewählte Ereignisse.
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
} from '~/types/mix'
import type { MixHoverPayload } from '~/utils/charts/stackedAreaHelpers'

/**
 * Funktion für eine Bewegung über dem Diagramm.
 */
interface HoverHandler {
  (payload: MixHoverPayload): void
}

/**
 * Funktion für das Verlassen des Diagramms.
 */
interface HoverEndHandler {
  (): void
}

/**
 * Funktion für einen Klick auf die freie Diagrammfläche.
 */
interface BackgroundClickHandler {
  (): void
}

/**
 * Vereinfachter Typ für eine gestapelte D3-Datenreihe.
 *
 * Jede Reihe gehört zu einem Energieträger und enthält für
 * jeden Monat eine Unterkante und eine Oberkante.
 */
type StackedSeries = d3.Series<MixMonthRow, string>

/**
 * Zeichnet den Strommix als gestapeltes Flächendiagramm.
 *
 * @author Selina Schneider
 */
export class StackedAreaChart extends BaseChart {
  /** Alle Monatswerte, die aktuell im Diagramm gezeigt werden. */
  #data: MixMonthRow[] = []

  /**
   * Bestimmt, ob TWh oder Anteile dargestellt werden.
   * Der Startwert ist die absolute Darstellung.
   */
  #mode: MixMode = 'absolute'

  /**
   * Enthält die Energieträger, die gerade hervorgehoben werden.
   * null bedeutet, dass alle Flächen normal dargestellt werden.
   */
  #highlightedSources: MixSourceKey[] | null = null

  /**
   * Das äußere SVG des Diagramms.
   * Vor render() ist noch kein SVG vorhanden.
   */
  #svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

  /**
   * Innere SVG-Gruppe für alle sichtbaren Diagrammelemente.
   * Sie wird um die festgelegten Ränder verschoben.
   */
  #chartGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null
  /**
   * Eigene Gruppe für Konturen über hervorgehobenen Flächen.
   * Dadurch werden Füllung und Kontur getrennt behandelt.
   */
  #outlineGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null
  /**
   * Aktuelle Zeitachse.
   * Sie wird später auch für Hover und Ereignisse gebraucht.
   */
  #xScale: d3.ScaleTime<number, number> | null = null

  /**
   * Aktuell verwendete Farben der Energieträger.
   * Standardmäßig wird die normale Farbpalette genutzt.
   */
  #colors: Record<MixSourceKey, string> = MIX_COLORS

  /**
   * Wird aufgerufen, wenn sich die Maus über dem Diagramm bewegt.
   * Vue bekommt damit Monatswert und Position für den Tooltip.
   */
  #hoverHandler: HoverHandler | null = null

  /**
   * Wird aufgerufen, wenn die Maus das Diagramm verlässt.
   * Vue kann damit den Tooltip wieder ausblenden.
   */
  #hoverEndHandler: HoverEndHandler | null = null

  /**
   * Wird bei einem Klick auf die freie Diagrammfläche ausgeführt.
   * Damit kann eine Auswahl außerhalb der D3-Klasse aufgehoben werden.
   */
  #backgroundClickHandler: BackgroundClickHandler | null = null

  /**
   * Alle Ereignisse, die mit einer Linie gezeigt werden können.
   */
  #annotations: MixAnnotation[] = []

  /**
   * ID des gerade ausgewählten Ereignisses.
   * null bedeutet, dass keine feste Ereignislinie sichtbar ist.
   */
  #selectedAnnotationId: number | null = null

  // Daten setzen

  /**
   * Setzt den Darstellungsmodus.
   *
   * Hier hat KI geholfen, weil ich zuerst nur den Wert von mode
   * geändert habe. Das sichtbare Diagramm blieb dadurch gleich.
   * Erst durch update() werden Flächen und Achse neu gezeichnet.
   *
   * @param mode Absolute Werte oder Anteile
   */
  setMode(mode: MixMode): void {
    this.#mode = mode
    this.update()
  }

  /**
   * Setzt die hervorgehobenen Energieträger.
   *
   * Hier hat KI geholfen, weil anfangs nur ein einzelner
   * Energieträger markiert werden konnte. Bei einem Ereignis
   * gehören aber oft mehrere Energieträger zusammen. Deshalb
   * wird hier eine Liste gespeichert.
   *
   * @param sourceKeys Energieträger oder null
   */
  setHighlightedSources(sourceKeys: MixSourceKey[] | null): void {
    this.#highlightedSources = sourceKeys
    this.#updateHighlight()
  }

  /**
   * Übernimmt neue Monatsdaten.
   *
   * Hier hat KI geholfen, weil neue Daten zuerst zwar gespeichert
   * wurden, das SVG aber die alten Werte behalten hat. Der Aufruf
   * von update() sorgt dafür, dass auch die Darstellung neu wird.
   *
   * @param data Monatswerte des Strommixes
   */
  setData(data: MixMonthRow[]): void {
    this.#data = data
    this.update()
  }

  /**
   * Speichert die Funktion für Mausbewegungen.
   *
   * @param handler Hover-Funktion oder null
   */
  setHoverHandler(handler: HoverHandler | null): void {
    this.#hoverHandler = handler
  }

  /**
   * Speichert die Funktion für das Verlassen des Diagramms.
   *
   * @param handler Funktion oder null
   */
  setHoverEndHandler(handler: HoverEndHandler | null): void {
    this.#hoverEndHandler = handler
  }

  /**
   * Speichert die Funktion für einen Hintergrundklick.
   *
   * @param handler Klickfunktion oder null
   */
  setBackgroundClickHandler(handler: BackgroundClickHandler | null): void {
    this.#backgroundClickHandler = handler
  }

  /**
   * Übernimmt die Ereignisse der Zeitreihe.
   *
   * KI hat mir bei der Reihenfolge. Die Ereignisse konnten schon
   * gesetzt sein, bevor die x-Skala vorhanden war. Der erneute
   * Aufruf von updateFixedAnnotationLine() zeigt die Linie später,
   * sobald Diagramm und Skala aufgebaut sind.
   *
   * @param annotations Ereignisse für das Diagramm
   */
  setAnnotations(annotations: MixAnnotation[]): void {
    this.#annotations = annotations
    this.#updateFixedAnnotationLine()
  }

  /**
   * Setzt das ausgewählte Ereignis.
   *
   * KI hat mir beim Zurücksetzen. Mit null wird die feste Linie
   * wieder ausgeblendet. In der ersten Version blieb die alte Linie
   * nach dem Abwählen im Diagramm stehen.
   *
   * @param annotationId ID des Ereignisses oder null
   */
  setSelectedAnnotation(annotationId: number | null): void {
    this.#selectedAnnotationId = annotationId
    this.#updateFixedAnnotationLine()
  }

  /**
   * Setzt die normale oder kontrastreiche Farbpalette.
   *
   * KI hat mir bei der Aktualisierung der bereits gezeichneten
   * Flächen. Ein Wechsel der Farbpalette änderte zuerst nur die
   * gespeicherten Farben. update() überträgt sie auf die SVG-Pfade.
   *
   * @param colorMode Gewählte Farbpalette
   */
  setColors(colorMode: 'default' | 'accessible'): void {
    this.#colors = colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
    this.update()
  }

  // render – SVG anlegen

  /**
   * Erstellt das SVG und die festen Diagrammelemente.
   *
   * KI hat mir beim Neuaufbau. Ohne destroy() entstanden beim
   * erneuten Rendern mehrere SVG-Elemente im gleichen Container.
   * Die alte Zeichnung wird deshalb zuerst vollständig entfernt.
   *
   * @param container HTML-Element für das Diagramm
   */
  override render(container: HTMLElement): void {
    // Vorhandenes SVG entfernen, damit kein Duplikat entsteht
    this.destroy()

    // Das SVG ist der äußere Zeichenbereich des Diagramms.
    const svg = d3
      .create('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr(
        'aria-label',
        'Gestapeltes Flächendiagramm zum deutschen Strommix von 2015 bis 2024',
      )

    // Die innere Gruppe hält Abstand zu den Rändern des SVG.
    const chartGroup = svg
      .append('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`)

    // Das fertige SVG wird in den übergebenen Container eingefügt.
    container.appendChild(svg.node()!)

    this.#svg = svg
    this.#chartGroup = chartGroup

    // Outline-Gruppe für Highlight-Kontur einmalig anlegen
    this.#outlineGroup = chartGroup.append('g').attr('class', 'highlight-outlines')

    // this.update() wird hier nicht aufgerufen, weil beim ersten render
    // noch keine Daten vorhanden sind. Der erste update() erfolgt aus setData().

    // Hover-Elemente einmalig anlegen
    this.#createHoverElements()
  }

  // update – gesamte Zeichenlogik

  /**
   * Aktualisiert Flächen, Achsen und Ereignislinie.
   *
   * KI hat mir bei der Reihenfolge der Schritte. Die x-Skala
   * muss gespeichert sein, bevor Hover und Ereignislinie berechnet
   * werden. Sonst lagen Führungslinie und Annotation an der falschen
   * Position oder wurden nicht angezeigt.
   */
  override update(): void {
    if (!this.#hasRequiredState()) {
      return
    }

    // Bei leeren Daten alte Darstellung entfernen
    if (this.#data.length === 0) {
      this.#clearChart()
      return
    }

    // Zuerst werden Daten und Skalen für die neue Darstellung erstellt.
    const stackedSeries = this.#createStackedSeries()
    const xScale = this.#createXScale()
    const yScale = this.#createYScale(stackedSeries)

    // Die Zeitachse wird gespeichert, weil Hover und Ereignisse sie brauchen.
    this.#xScale = xScale

    this.#renderAreas(stackedSeries, xScale, yScale)
    this.#updateHighlight()
    this.#renderXAxis(xScale)
    this.#renderYAxis(yScale)
    this.#updateFixedAnnotationLine()
  }

  // destroy – SVG entfernen

  /**
   * Entfernt das SVG und leert die gespeicherten Zustände.
   *
   * KI hat mir beim Aufräumen der Referenzen. Das SVG war zwar
   * entfernt, einige Handler und Annotationen blieben aber im
   * Objekt gespeichert. Beim nächsten Aufbau wurden dadurch alte
   * Zustände übernommen.
   */
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

  // Private Hilfsmethoden

  /**
   * Prüft, ob das SVG und die innere Gruppe vorhanden sind.
   *
   * @returns true bei vollständig aufgebautem Diagramm
   */
  #hasRequiredState(): boolean {
    if (!this.#svg || !this.#chartGroup) {
      return false
    }

    return true
  }

  /**
   * Entfernt Flächen und Achsen bei leeren Daten.
   *
   * KI hat mir bei einem Zustand ohne Daten. Die erste Version
   * zeigte weiterhin die Werte des vorherigen Zeitraums. Deshalb
   * werden auch Hover-Linie und Tooltip-Zustand zurückgesetzt.
   */
  #clearChart(): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('.chart-area').remove()
    this.#chartGroup.selectAll('.x-axis').remove()
    this.#chartGroup.selectAll('.y-axis').remove()

    // Hover-Elemente ausblenden
    this.#chartGroup.selectAll('.hover-guide').style('display', 'none')
    this.#chartGroup.selectAll('.hover-month-label').style('display', 'none')

    this.#hoverEndHandler?.()
  }

  /**
   * Erstellt die gestapelten Reihen aus den Monatsdaten.
   *
   * KI hat mir bei der Typisierung von d3.stack().
   * D3 behandelt die Schlüssel als string, die Daten verwenden
   * aber MixSourceKey. Der Zugriff führte vorher zu einem
   * TypeScript-Fehler.
   *
   * @returns Gestapelte Reihen in der festen Reihenfolge
   */
  #createStackedSeries(): StackedSeries[] {
    const stackGenerator = d3
      .stack<MixMonthRow>()
      .keys(STACK_ORDER)
      // d3.stack erwartet für jeden Key einen Zahlenwert aus dem Datenpunkt.
      // Der sourceKey ist vom Typ MixSourceKey, wird aber von D3 als string
      // behandelt – daher der Type-Zugriff über den Index.
      .value(function (monthRow, sourceKey) {
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
   * Erstellt die Zeitachse vom ersten Monat bis Januar
   * nach dem letzten Datenjahr.
   *
   * KI hat mir bei der rechten Grenze der Achse.
   * Die erste Fassung endete direkt am letzten Monatswert.
   * Dadurch fehlte der letzte Jahres-Tick.
   *
   * @returns Skala für die x-Achse
   * @throws Fehler, wenn kein Datumsbereich gefunden wird
   */
  #createXScale(): d3.ScaleTime<number, number> {
    const dateExtent = d3.extent(this.#data, function (row) { return row.date })

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
   * Erstellt die Skala für absolute Werte oder Anteile.
   *
   * KI hat mir bei den zwei unterschiedlichen Wertebereichen.
   * Im Anteilmodus darf nicht der größte Monatswert als Grenze
   * verwendet werden. Die Skala muss dort immer von 0 bis 1 reichen.
   * Im absoluten Modus wird dagegen die obere Kante aller Stapel gesucht.
   *
   * @param stackedSeries Gestapelte Datenreihen
   * @returns Skala der y-Achse
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
   * Zeichnet neue Flächen und aktualisiert vorhandene Flächen.
   *
   * KI hat mir beim D3-Join. Auswahl und neue Pfade
   * verwendeten zuerst unterschiedliche Klassen. Dadurch
   * fand D3 vorhandene Flächen beim Update nicht wieder.
   *
   * @param stackedSeries Gestapelte Datenreihen
   * @param xScale Skala der Zeitachse
   * @param yScale Skala der Werteachse
   */
  #renderAreas(
    stackedSeries: StackedSeries[],
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const self = this

    const areaGenerator = d3
      .area<d3.SeriesPoint<MixMonthRow>>()
      // X-Position aus dem Datum des Datenpunkts
      .x(function (point) {
        return xScale(point.data.date)
      })
      // Unterkante der Schicht
      .y0(function (point) {
        return yScale(point[0])
      })
      // Oberkante der Schicht
      .y1(function (point) {
        return yScale(point[1])
      })

    if (!this.#chartGroup) {
      return
    }

    // Daten-Join: Jede gestapelte Serie wird einem path-Element zugeordnet.
    // Der Key ist der Serien-Key (z. B. "pv", "gas").
    // Dadurch ist später für Highlight-Updates das Datenobjekt verfügbar.
    // Vorhandene Flächen werden über ihre Klasse wiedergefunden.
    const layers = this.#chartGroup
      .selectAll<SVGPathElement, StackedSeries>('path.chart-area')
      .data(stackedSeries, function (series) { return series.key })

    // enter erstellt neue Pfade, update ändert vorhandene Pfade
    // und exit entfernt Reihen, die nicht mehr gebraucht werden.
    layers.join(
      function (enter) {
        return enter
          .append('path')
          .attr('class', function (series) { return `chart-area layer layer-${series.key}` })
          .attr('data-series-key', function (series) { return series.key })
          .attr('fill', function (series) {
            const seriesKey = series.key as MixSourceKey
            return self.#colors[seriesKey]
          })
          .attr('d', function (series) { return areaGenerator(series) })
          .style('pointer-events', 'none')
      },
      function (update) {
        return update
          .attr('fill', function (series) {
            const seriesKey = series.key as MixSourceKey
            return self.#colors[seriesKey]
          })
          .attr('d', function (series) { return areaGenerator(series) })
          .style('pointer-events', 'none')
      },
      function (exit) { return exit.remove() },
    )
  }

  /**
   * Zeichnet die Jahreszahlen an der x-Achse.
   *
   * KI hat mir bei den festen Tickwerten. Die automatische
   * D3-Einteilung ließ je nach Breite einzelne Jahre aus oder setzte
   * zusätzliche Zwischenwerte. Die Jahre werden deshalb selbst erzeugt.
   *
   * @param xScale Skala der Zeitachse
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

    // Die Tickwerte werden selbst aufgebaut, damit jedes Jahr erscheint.
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

    this.#chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(xAxis)
  }

  /**
   * Zeichnet die y-Achse für TWh oder Prozentwerte.
   *
   * KI hat mir bei der Formatierung der beiden Modi. Die gleiche
   * Formatierung zeigte im Anteilmodus Werte wie 0,2 statt 20 %.
   * Deshalb erhält jeder Modus eine eigene Tickdarstellung.
   *
   * @param yScale Skala der Werteachse
   */
  #renderYAxis(yScale: d3.ScaleLinear<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    // Vorhandene Achse entfernen
    this.#chartGroup.selectAll('.y-axis').remove()

    // Fünf Tickwerte reichen für eine ruhige und lesbare Achse.
    const yAxis = d3.axisLeft<number>(yScale).ticks(5)

    // Unterschiedliche Formatierung je nach Modus
    if (this.#mode === 'share') {
      // d3.format('.0%'): 0.2 → "20%"
      yAxis.tickFormat(function (value: number) {
        return d3.format('.0%')(value)
      })
    } else {
      yAxis.tickFormat(function (value: number) {
        return `${value} TWh`
      })
    }

    this.#chartGroup
      .append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
  }

  /**
   * Passt die Sichtbarkeit der Flächen an.
   *
   * KI hat mir bei der Trennung von Fläche und Kontur. Ein Stroke
   * direkt auf dem gefüllten Pfad lag teilweise zwischen zwei
   * gestapelten Flächen und wirkte dadurch unruhig. Die Flächen
   * ändern nur ihre Deckkraft. Die Kontur wird getrennt gezeichnet.
   */
  #updateHighlight(): void {
    if (!this.#chartGroup) {
      return
    }

    const highlightedSources = this.#highlightedSources
    // Ein Highlight ist aktiv, sobald mindestens eine Quelle gesetzt ist.
    const hasActiveHighlight =
      highlightedSources !== null &&
      highlightedSources.length > 0

    // Layer-Opazität setzen, Stroke immer entfernen
    this.#chartGroup
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

    // Separate Konturlinien für hervorgehobene Quellen zeichnen
    this.#renderHighlightOutlines()
  }

  /**
   * Zeichnet die Konturen der hervorgehobenen Flächen.
   *
   * KI hat mir beim Ausschließen von Nullwerten.
   * Ohne defined() verband die Linie getrennte Bereiche
   * über Monate ohne Erzeugung.
   */
  #renderHighlightOutlines(): void {
    if (!this.#chartGroup || !this.#outlineGroup || !this.#xScale) {
      return
    }

    const self = this
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
      .data(stackedSeries, function (series) { return series.key })

    outlines.join(
      function (enterSelection) {
        return enterSelection
          .append('path')
          .attr('class', 'highlight-outline')
          .attr('fill', 'none')
          .attr('pointer-events', 'none')
      },
      function (updateSelection) {
        return updateSelection
      },
      function (exitSelection) {
        return exitSelection.remove()
      },
    )

    // Pfade nur für hervorgehobene Serien zeichnen
    outlines
      .attr('display', function (series) {
        const seriesKey = series.key as MixSourceKey

        if (highlightedSources!.includes(seriesKey)) {
          return null
        }

        return 'none'
      })
      .attr('stroke', function (series) {
        const seriesKey = series.key as MixSourceKey

        return MIX_COLORS[seriesKey]
      })
      .attr('stroke-width', 1.25)
      .attr('d', function (series) {
        const seriesKey = series.key as MixSourceKey

        const outlineLine = d3
          .line<d3.SeriesPoint<MixMonthRow>>()
          .defined(function (stackedPoint) {
            // Nur zeichnen, wenn der tatsächliche Wert > 0 ist
            const sourceValue =
              stackedPoint.data.values[seriesKey]

            return sourceValue > 0
          })
          .x(function (stackedPoint) {
            return self.#xScale!(stackedPoint.data.date)
          })
          .y(function (stackedPoint) {
            return yScale(stackedPoint[1])
          })

        return outlineLine(series)
      })
  }

  // Hover-Infrastruktur

  /**
   * Erstellt Führungslinie, Ereignislinie und Hover-Fläche.
   *
   * KI hat mir bei der unsichtbaren Hover-Fläche.
   * Pointer-Ereignisse direkt auf den gestapelten Pfaden
   * waren unzuverlässig, weil die Flächen übereinanderliegen.
   */
  #createHoverElements(): void {
    if (!this.#chartGroup) {
      return
    }

    const self = this

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
      .on('pointermove', function (event: PointerEvent) {
        self.#handlePointerMove(event)
      })
      .on('pointerleave', function () {
        self.#handlePointerLeave()
      })
      .on('click', function () {
        self.#backgroundClickHandler?.()
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
   * Zeigt die Führungslinie am nächstgelegenen Monat.
   *
   * KI hat mir beim Entfernen des doppelten Monatslabels. Der Monat
   * stand zuerst gleichzeitig über dem Diagramm und im Tooltip.
   * Deshalb bleibt an dieser Stelle nur die Linie sichtbar.
   *
   * @param monthRow Monatsdaten an der Position
   * @param monthX Horizontale Position des Monats
   */
  #showHoverGuide(monthRow: MixMonthRow, monthX: number): void {
    if (!this.#chartGroup) {
      return
    }

    // Nur die Linie anzeigen, kein Monatslabel mehr
    // (der Monat steht bereits im Tooltip)
    this.#chartGroup
      .selectAll('.hover-guide')
      .attr('x1', monthX)
      .attr('x2', monthX)
      .style('display', null)
  }

  /**
   * Bestimmt den nächsten Monat an der Mausposition.
   *
   * KI hat mir bei der Umrechnung zwischen Pixeln und Datum.
   * Die Mausposition wurde zuerst direkt verwendet und zeigte
   * dadurch den falschen Monat.
   *
   * @param event Pointer-Ereignis der Hover-Fläche
   */
  #handlePointerMove(event: PointerEvent): void {
    if (!this.#chartGroup || !this.#xScale) {
      return
    }

    // currentTarget ist hier das unsichtbare Rechteck über dem Diagramm.
    const overlay = event.currentTarget as SVGRectElement

    // d3.pointer liefert die Mausposition innerhalb dieses Rechtecks.
    const pointerPosition = d3.pointer(event, overlay)

    const pointerX = pointerPosition[0]

    const clampedX = Math.max(
      0,
      Math.min(this.innerWidth, pointerX),
    )

    // invert wandelt die Pixelposition zurück in ein Datum.
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
   * Blendet die Führungslinie aus und beendet den Hover-Zustand.
   *
   * KI hat mir beim Zurücksetzen der Vue-Anzeige. Die Linie
   * verschwand zuerst, der Tooltip blieb aber mit dem letzten Monat
   * sichtbar. Der Callback entfernt auch die Hover-Daten außerhalb
   * der D3-Klasse.
   */
  #handlePointerLeave(): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('.hover-guide').style('display', 'none')

    this.#hoverEndHandler?.()
  }

  // Annotationen

  /**
   * Zeigt die feste Linie für das ausgewählte Ereignis.
   *
   * KI hat mir bei der Suche nach der Annotation.
   * Die erste Version arbeitete mit dem Array-Index.
   * Nach einer anderen Reihenfolge zeigte die Linie dadurch
   * auf das falsche Ereignis.
   */
  #updateFixedAnnotationLine(): void {
    if (!this.#chartGroup || !this.#xScale) {
      return
    }

    const self = this
    // Linie und Datumslabel wurden schon beim render() angelegt.
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
      function (ann) { return ann.id === self.#selectedAnnotationId },
    )

    if (!matchingAnnotation) {
      line.style('display', 'none')
      label.style('display', 'none')
      return
    }

    // Das Ereignisdatum wird in eine Position auf der Zeitachse umgerechnet.
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