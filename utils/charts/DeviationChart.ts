/**
 * Zeichnet das Abweichungsdiagramm für den CO₂-Vergleich.
 *
 * Für jeden Energieträger vergleicht ein Balken den Anteil an der
 * Stromerzeugung mit dem Anteil an den direkten CO₂-Emissionen.
 * Negative Balken bedeuten „weniger CO₂-Anteil als Erzeugungsanteil",
 * positive Balken das Gegenteil.
 *
 * Das Grundgerüst (SVG-Aufbau, Skalen, Achsen, Balken, Farben, Hover
 * und Auswahl) baut auf dem BaseChart-Muster aus dem Vorlesungsskript
 * auf.
 *
 * Über das Skript hinaus ging es an mehreren Stellen, an denen ich mit
 * KI gearbeitet habe: das responsive Verhalten des SVGs (viewBox statt
 * fester Pixelgrößen), die join()-Variante mit Enter/Update/Exit-Callbacks,
 * der Data-Join mit Key-Funktion für stabile Übergänge,
 * das divergierende Balkenlayout um die Nulllinie
 * und das Zusammenspiel von Hover und fester Auswahl. Die konkreten
 * Stellen sind unten direkt an der jeweiligen Methode kommentiert.
 *
 * @author Selina Schneider
 */

import * as d3 from 'd3'

import { BaseChart } from '~/utils/charts/BaseChart'
import {
  MIX_COLORS,
  MIX_COLORS_ACCESSIBLE,
  MIX_LABELS,
  STACK_ORDER,
} from '~/components/generation/mixConfig'
import {
  formatPercentagePoints,
  getDeviationBarWidth,
  getDeviationBarX,
  labelAnchor,
  labelX,
} from '~/utils/charts/deviationChartHelpers'

import type { EmissionRow, MixSourceKey } from '~/types/mix'


/** Daten, die beim Überfahren eines Balkens weitergegeben werden. */
export interface DeviationHoverPayload {
  /** Daten des Balkens */
  row: EmissionRow

  /** Horizontale Position im Diagramm */
  chartX: number

  /** Vertikale Position im Diagramm */
  chartY: number
}

/*
 * Callback-Typen für die Chart-Interaktionen.
 *
 * Die Form „aufrufbares Interface" (also ein Interface, das nur eine
 * Aufrufsignatur enthält) habe ich mit KI-Hilfe gewählt. Ich hatte
 * zuerst normale Funktions-Aliase geschrieben, war mir aber unsicher,
 * was im D3-Kontext lesbarer ist. Nach der Empfehlung habe ich die
 * Version übernommen, weil jeder Handler damit einen sprechenden Namen
 * bekommt und man an der Signatur direkt sieht, was reinkommt und was
 * rauskommt. Umgestellt und im Chart geprüft habe ich das selbst.
 */

/** Funktion für das Überfahren eines Balkens. */
interface HoverHandler {
  (payload: DeviationHoverPayload): void
}

/** Funktion für das Verlassen eines Balkens. */
interface HoverEndHandler {
  (): void
}

/** Funktion für eine geänderte Balkenauswahl. */
interface SelectionHandler {
  (sourceKey: MixSourceKey | null): void
}

/** Funktion für einen Klick auf die freie Diagrammfläche. */
interface BackgroundClickHandler {
  (): void
}

/** Verfügbare Sortierungen des Diagramms. */
type SortMode = 'category' | 'impact'

// Dauer der Übergänge in ms. Gleicher Wert für Balken und Labels, damit alles synchron läuft.
const TRANSITION_DURATION_MS = 600

// Opacity-Stufen für Hervorhebung, siehe #updateHighlight.
const OPACITY_ACTIVE = 1
const OPACITY_SELECTED_WHILE_HOVER = 0.7
const OPACITY_INACTIVE = 0.55

// Ersatzfarbe und Höhe für Energieträger ohne Erzeugung.
const NO_GENERATION_COLOR = '#c0c0c0'
const NO_GENERATION_BAR_HEIGHT = 1
const NO_GENERATION_OPACITY = 0.4


export class DeviationChart extends BaseChart {
  // Zustand

  /** Daten des aktuell dargestellten Jahres */
  #data: EmissionRow[] = []

  /** Wertebereich der x-Achse */
  #xDomain: [number, number] = [-1, 1]

  /** Energieträger unter dem Mauszeiger */
  #highlightedSource: MixSourceKey | null = null

  /** SVG des Diagramms */
  #svg: d3.Selection<SVGSVGElement, undefined, null, undefined> | null = null

  /** Innere Gruppe mit den eingerechneten Rändern */
  #chartGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Gruppe für die Balken */
  #barsGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Gruppe für die Wertelabels */
  #labelsGroup: d3.Selection<SVGGElement, undefined, null, undefined> | null =
    null

  /** Funktion für das Überfahren eines Balkens */
  #hoverHandler: HoverHandler | null = null

  /** Funktion für das Verlassen eines Balkens */
  #hoverEndHandler: HoverEndHandler | null = null

  /** Funktion für eine geänderte Auswahl */
  #selectionHandler: SelectionHandler | null = null

  /** Durch Klick ausgewählter Energieträger */
  #selectedSource: MixSourceKey | null = null

  /** Funktion für einen Klick auf die freie Diagrammfläche */
  #backgroundClickHandler: BackgroundClickHandler | null = null

  /** Farben der Energieträger */
  #colors: Record<MixSourceKey, string> = MIX_COLORS

  /** Aktuelle Reihenfolge der Balken */
  #sortMode: SortMode = 'category'


  /**
   * Erstellt das Diagramm mit fester Größe und festen Rändern.
   */
  constructor() {
    super(860, 540, { top: 44, right: 82, bottom: 72, left: 170 })
  }


  // Öffentliche Setter

  /**
   * Übernimmt neue Daten und bringt sie in die gewählte Reihenfolge.
   *
   * @param rows Daten des ausgewählten Jahres
   */
  setData(rows: EmissionRow[]): void {
    this.#data = this.#orderRows(rows)
    this.#highlightedSource = null
    this.update()
  }

  /**
   * Setzt den Wertebereich der x-Achse.
   *
   * @param domain Untere und obere Grenze
   */
  setXDomain(domain: [number, number]): void {
    this.#xDomain = domain
    this.update()
  }

  /**
   * Setzt die Hervorhebung für einen Energieträger.
   *
   * @param sourceKey Energieträger oder null für keine Hervorhebung
   */
  setHighlight(sourceKey: MixSourceKey | null): void {
    this.#highlightedSource = sourceKey
    this.#updateHighlight()
  }

  /**
   * Setzt die durch Klick gewählte Quelle.
   *
   * @param sourceKey Energieträger oder null für keine Auswahl
   */
  setSelectedSource(sourceKey: MixSourceKey | null): void {
    this.#selectedSource = sourceKey
    this.#updateHighlight()
    this.#selectionHandler?.(sourceKey)
  }

  /**
   * Speichert die Funktion für das Überfahren eines Balkens.
   *
   * @param handler Hover-Funktion oder null
   */
  setHoverHandler(handler: HoverHandler | null): void {
    this.#hoverHandler = handler
  }

  /**
   * Speichert die Funktion für das Verlassen eines Balkens.
   *
   * @param handler Funktion oder null
   */
  setHoverEndHandler(handler: HoverEndHandler | null): void {
    this.#hoverEndHandler = handler
  }

  /**
   * Speichert die Funktion für eine geänderte Auswahl.
   *
   * @param handler Auswahlfunktion oder null
   */
  setSelectionHandler(handler: SelectionHandler | null): void {
    this.#selectionHandler = handler
  }

  /**
   * Speichert die Funktion für einen Klick auf den Hintergrund.
   *
   * @param handler Klickfunktion oder null
   */
  setBackgroundClickHandler(handler: BackgroundClickHandler | null): void {
    this.#backgroundClickHandler = handler
  }

  /**
   * Setzt die normale oder kontrastreiche Farbpalette.
   *
   * @param colorMode Gewählte Farbpalette
   */
  setColors(colorMode: 'default' | 'accessible'): void {
    this.#colors = colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
    this.update()
  }

  /**
   * Setzt die Reihenfolge der Balken.
   *
   * @param mode Sortierung nach Kategorie oder Klimawirkung
   */
  setSortMode(mode: SortMode): void {
    this.#sortMode = mode
    this.#data = this.#orderRows(this.#data)
    this.update()
  }


  // Aufbau und Aktualisierung

  /**
   * Erstellt das SVG und die festen Gruppen des Diagramms.
   *
   * @param container HTML-Element für das Diagramm
   */
  override render(container: HTMLElement): void {
    // Zuerst eine ggf. vorhandene Zeichnung wegräumen, bevor ich neu aufbaue.
    this.destroy()
    // Responsives Verhalten: viewBox + preserveAspectRatio kommen aus dem
    // KI-Vorschlag zum Thema „mach das Diagramm auf allen Bildschirmgrößen
    // nutzbar". Im Vorlesungsskript werden Diagramme mit festen width/height
    // gebaut – das war mein Ausgangspunkt, danach habe ich es auf viewBox
    // umgestellt, damit die CSS-Regeln (width: 100%, height: auto) greifen.
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

    // Feste Gruppen für Balken und Labels – so bleibt die Zeichenreihenfolge
    // erhalten: Balken hinten, Labels vorne.
    this.#barsGroup = chartGroup.append('g').attr('class', 'bars-group')
    this.#labelsGroup = chartGroup.append('g').attr('class', 'labels-group')

    const self = this

    // Transparenter Hintergrund als Klickfläche für „Auswahl aufheben".
    // Muss hinter den Balken liegen, damit die Balken weiter klickbar bleiben.
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
      .on('click', function () {
        self.#handleBackgroundClick()
      })

    // Feste Orientierungslinie bei 0.
    this.#renderZeroLine()

    // Feste Trennung der Energieträgergruppen (erneuerbar / nuklear / fossil).
    this.#renderGroupSeparators()

    // Hinweistexte links/rechts/mittig unter der x-Achse.
    this.#renderDirectionLabels()

    // Die eigentlichen Daten kommen nach dem Aufbau über setData().
  }


  /**
   * Aktualisiert alle Teile, die von Daten oder Einstellungen abhängen.
   */
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


  /**
   * Entfernt das Diagramm und leert die gespeicherten Referenzen.
   */
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


  // Hilfsmethoden für Daten und Skalen

  /**
   * Sortiert die Daten nach Kategorie oder Abweichung.
   * Das übergebene Array bleibt unverändert.
   *
   * @param rows Datenzeilen des Diagramms
   * @returns Neues Array in der gewählten Reihenfolge
   */
  #orderRows(rows: EmissionRow[]): EmissionRow[] {
    if (this.#sortMode === 'impact') {
      // Reihenfolge von der kleinsten bis zur größten Abweichung.
      return [...rows].sort(function (a, b) { return a.deviationPp - b.deviationPp })
    }

    // Sonst feste Reihenfolge nach Energieträgergruppen (STACK_ORDER).
    const orderedRows: EmissionRow[] = []

    for (const sourceKey of STACK_ORDER) {
      const matchingRow = rows.find(function (row) {
        return row.sourceKey === sourceKey
      })

      if (matchingRow) {
        orderedRows.push(matchingRow)
      }
    }

    return orderedRows
  }

  /**
   * Erstellt die lineare Skala für die Prozentpunkte.
   *
   * @returns Skala der x-Achse
   */
  #createXScale(): d3.ScaleLinear<number, number> {
    return d3.scaleLinear().domain(this.#xDomain).range([0, this.innerWidth])
  }

  /**
   * Erstellt die Band-Skala für die Energieträger.
   *
   * @returns Skala der y-Achse
   */
  #createYScale(): d3.ScaleBand<MixSourceKey> {
    // Bei Sortierung nach Klimawirkung folgt die Reihenfolge den Daten,
    // sonst die feste STACK_ORDER.
    const domain = this.#sortMode === 'impact'
      ? this.#data.map(function (row) { return row.sourceKey })
      : STACK_ORDER

    return d3
      .scaleBand<MixSourceKey>()
      .domain(domain)
      .range([0, this.innerHeight])
      .paddingInner(0.28)
      .paddingOuter(0.12)
  }


  // Statische Elemente: Nulllinie, Gruppentrenner, Richtungslabels

  /**
   * Zeichnet die senkrechte Nulllinie einmalig.
   * Die eigentliche x-Position kommt später über #updateZeroLine.
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
   * Setzt die Nulllinie an die Position des Werts 0.
   * Wichtig, weil sich xScale(0) bei geänderter Domain verschieben kann.
   *
   * Beim Zusammenspiel Balken – Nulllinie – Labels hat mir KI geholfen,
   * die Aufteilung „einmal zeichnen, dann nur x1/x2 nachziehen" sauber
   * hinzubekommen. 
   *
   * @param xScale Aktuelle Skala der x-Achse
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
   * Zeichnet die Trennlinien zwischen erneuerbaren, nuklearen und fossilen
   * Energieträgern einmalig. Positionen werden über #updateGroupSeparators
   * nachgezogen, wenn sich die Sortierung ändert.
   */
  #renderGroupSeparators(): void {
    if (!this.#chartGroup) {
      return
    }

    const yScale = this.#createYScale()

    // Trennung vor der Kernenergie.
    const nuclearTop = yScale('nuclear') ?? 0
    const nuclearHeight = yScale.bandwidth()

    this.#chartGroup
      .append('line')
      .attr('class', 'group-separator')
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', nuclearTop - nuclearHeight * 0.14)
      .attr('y2', nuclearTop - nuclearHeight * 0.14)

    // Trennung vor den fossilen Energieträgern.
    const fossilTop = yScale('other_fossil') ?? 0
    const fossilBandHeight = yScale.bandwidth()

    this.#chartGroup
      .append('line')
      .attr('class', 'group-separator')
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', fossilTop - fossilBandHeight * 0.14)
      .attr('y2', fossilTop - fossilBandHeight * 0.14)
  }

  /**
   * Setzt die Trennlinien an die aktuellen Positionen.
   *
   * @param yScale Aktuelle Skala der y-Achse
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

    // Die Trenner unterscheide ich hier bewusst über den Index, weil sie
    // sonst nichts haben, woran ich sie festmachen könnte. Bei zwei Linien
    // ist das noch überschaubar.
    separators.each(function (_, index: number) {
      const element = d3.select(this)

      if (index === 0) {
        element.attr('y1', nuclearTop - nuclearBandHeight * 0.14)
        element.attr('y2', nuclearTop - nuclearBandHeight * 0.14)
      } else if (index === 1) {
        // Gleiche Rechnung wie beim ersten Zeichnen (Zeile ~518).
        element.attr('y1', fossilTop - nuclearBandHeight * 0.14)
        element.attr('y2', fossilTop - nuclearBandHeight * 0.14)
      }
    })
  }


  // Achsen

  /**
   * Zeichnet die x-Achse mit Werten in Prozentpunkten.
   *
   * @param xScale Skala der x-Achse
   */
  #renderXAxis(xScale: d3.ScaleLinear<number, number>): void {
    if (!this.#chartGroup) {
      return
    }

    this.#chartGroup.selectAll('g.x-axis').remove()

    this.#chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat(function (domainValue) {
            return formatPercentagePoints(domainValue as number)
          })
          .tickSizeOuter(0),
      )
  }

  /**
   * Zeichnet die Namen der Energieträger an der y-Achse.
   *
   * @param yScale Skala der y-Achse
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
          .tickFormat(function (sourceKey) {
            return MIX_LABELS[sourceKey as MixSourceKey]
          })
          .tickSize(0),
      )
  }


  // Balken und Labels

  /**
   * Kleine Hilfsprüfung: Gibt es für diesen Energieträger Erzeugung?
   * Energieträger ohne Erzeugung werden als schmaler grauer Strich dargestellt.
   *
   * @param row Datenzeile
   * @returns true, wenn Erzeugung > 0 TWh
   */
  #hasGeneration(row: EmissionRow): boolean {
    return row.generationTwh > 0
  }

  /**
   * Berechnet die Attribute, die Balken bei Enter und Update gleich brauchen.
   * Ich habe das ausgelagert, damit ich nicht zweimal denselben Attribut-Block
   * pflegen muss (Farbe, Höhe, Opacity, Position, Breite).
   * 
   * Die Auslagerung dieser Methode kam aus einem KI-Refactoring-Vorschlag,
   * damit die Attribute nicht in Enter und Update doppelt stehen.
   *
   * @param selection D3-Selektion der Balken (mit oder ohne Transition)
   * @param xScale Aktuelle x-Skala
   * @param yScale Aktuelle y-Skala
   */
  #applyBarAttributes(
    selection:
      | d3.Selection<SVGRectElement, EmissionRow, SVGGElement, undefined>
      | d3.Transition<SVGRectElement, EmissionRow, SVGGElement, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    const self = this

    selection
      .attr('y', function (row) { return yScale(row.sourceKey) ?? 0 })
      .attr('height', function (row) {
        return self.#hasGeneration(row) ? yScale.bandwidth() : NO_GENERATION_BAR_HEIGHT
      })
      .attr('fill', function (row) {
        if (!self.#hasGeneration(row)) return NO_GENERATION_COLOR
        return self.#colors[row.sourceKey]
      })
      .attr('opacity', function (row) {
        return self.#hasGeneration(row) ? OPACITY_ACTIVE : NO_GENERATION_OPACITY
      })
      .attr('x', function (row) {
        return self.#hasGeneration(row)
          ? getDeviationBarX(row.deviationPp, xScale)
          // Bei fehlender Erzeugung setze ich die Kante minimal links von der
          // Nulllinie, damit der 1px-Strich sichtbar bleibt.
          : xScale(0) - 0.5
      })
      .attr('width', function (row) {
        return self.#hasGeneration(row)
          ? getDeviationBarWidth(row.deviationPp, xScale)
          : NO_GENERATION_BAR_HEIGHT
      })
  }

  /**
   * Zeichnet neue Balken und aktualisiert vorhandene Balken.
   *
   * Das Skript zeigt join() nur in der Kurzform (Kap. 11.2.2). Die
   * ausführliche Variante mit drei Callback-Funktionen (enter/update/exit)
   * und dem zusätzlichen Key-Argument im .data(...)-Aufruf für stabile
   * Übergänge beim Sortierwechsel habe ich mit KI-Hilfe erarbeitet.
   * Vorher hatte ich Typfehler und doppelte Balken beim Jahreswechsel.
   * Nach dem Vorschlag habe ich Sortierung und Übergänge selbst
   * durchgetestet und die gemeinsamen Attribute in #applyBarAttributes
   * zusammengezogen – auch dieses Zusammenlegen war ein KI-Vorschlag,
   * den ich übernommen habe, weil es doppelten Code spart.
   *
   * @param xScale Skala für Position und Breite der Balken
   * @param yScale Skala für die Reihenfolge der Energieträger
   */
  #renderBars(
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    if (!this.#barsGroup) {
      return
    }

    const self = this

    const bars = this.#barsGroup
      .selectAll<SVGRectElement, EmissionRow>('rect.deviation-bar')
      .data(this.#data, function (row) { return row.sourceKey })

    bars.join(
      function (enter) {
        // Neue Balken: erst „leer" an der Nulllinie anlegen, damit sie
        // gleich aus der Mitte heraus animieren können.
        const enterBars = enter
          .append('rect')
          .attr('class', 'deviation-bar')
          .attr('data-source-key', function (row) { return row.sourceKey })
          .attr('y', function (row) { return yScale(row.sourceKey) ?? 0 })
          .attr('height', function (row) {
            return self.#hasGeneration(row) ? yScale.bandwidth() : NO_GENERATION_BAR_HEIGHT
          })
          .attr('fill', function (row) {
            if (!self.#hasGeneration(row)) return NO_GENERATION_COLOR
            return self.#colors[row.sourceKey]
          })
          .attr('x', xScale(0))
          .attr('width', 0)
          .attr('opacity', function (row) {
            return self.#hasGeneration(row) ? OPACITY_ACTIVE : NO_GENERATION_OPACITY
          })
          .style('cursor', 'pointer')
          .on('click', function (_event: PointerEvent, row: EmissionRow) {
            self.#handleBarClick(row)
          })
          .on('mouseenter', function (_event: PointerEvent, row: EmissionRow) {
            self.#highlightedSource = row.sourceKey
            self.#updateHighlight()
            self.#hoverHandler?.({ row, chartX: 0, chartY: 0 })
          })
          .on('mouseleave', function () {
            self.#highlightedSource = null
            self.#updateHighlight()
            self.#hoverEndHandler?.()
          })

        // Auf die Zielposition/-breite animieren.
        self.#applyBarAttributes(
          enterBars.transition().duration(TRANSITION_DURATION_MS),
          xScale,
          yScale,
        )

        return enterBars
      },
      function (update) {
        // Bestehende Balken: gleiche Ziel-Attribute wie enter, nur ohne
        // Startzustand an der Nulllinie.
        self.#applyBarAttributes(
          update.transition().duration(TRANSITION_DURATION_MS),
          xScale,
          yScale,
        )
        return update
      },
      function (exit) {
        return exit.remove()
      },
    )
  }

  /**
   * Berechnet die Attribute, die Wertelabels bei Enter und Update gleich brauchen.
   *
   * @param selection D3-Selektion der Labels (mit oder ohne Transition)
   * @param xScale Aktuelle x-Skala
   * @param yScale Aktuelle y-Skala
   */
  #applyLabelAttributes(
    selection:
      | d3.Selection<SVGTextElement, EmissionRow, SVGGElement, undefined>
      | d3.Transition<SVGTextElement, EmissionRow, SVGGElement, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    selection
      .attr('x', function (row) { return labelX(row.deviationPp, xScale) })
      .attr('text-anchor', function (row) { return labelAnchor(row.deviationPp) })
      .attr('y', function (row) {
        // Vertikal in der Bandmitte platzieren.
        const bandTop = yScale(row.sourceKey) ?? 0
        return bandTop + yScale.bandwidth() / 2
      })
      .text(function (row) {
        if (row.generationTwh === 0) return 'keine Erzeugung'
        return formatPercentagePoints(row.deviationPp)
      })
  }

  /**
   * Zeichnet neue Wertelabels und aktualisiert vorhandene Labels.
   *
   * Die Positionierung neben dem Balkenende (negative Werte links, positive
   * rechts) war zusammen mit dem Wechsel des text-anchor ein Punkt, an dem
   * KI mir den Ansatz gezeigt hat. Ich habe die Logik danach in
   * labelX / labelAnchor ausgelagert und mit verschiedenen Domains geprüft.
   *
   * @param xScale Skala für die horizontale Position
   * @param yScale Skala für die vertikale Position
   */
  #renderValueLabels(
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<MixSourceKey>,
  ): void {
    if (!this.#labelsGroup) {
      return
    }

    const self = this

    const labels = this.#labelsGroup
      .selectAll<SVGTextElement, EmissionRow>('text.deviation-label')
      .data(this.#data, function (row) { return row.sourceKey })

    labels.join(
      function (enter) {
        const enterLabels = enter
          .append('text')
          .attr('class', 'deviation-label')
          .attr('dy', '0.35em')
          .attr('font-size', '12px')
          .attr('font-family', 'var(--font-sans, sans-serif)')
          .attr('fill', 'currentColor')
          .attr('pointer-events', 'none')

        // Beim ersten Zeichnen direkt (ohne Transition) an die Zielposition.
        self.#applyLabelAttributes(enterLabels, xScale, yScale)
        return enterLabels
      },
      function (update) {
        // Bestehende Labels animiert nachziehen.
        self.#applyLabelAttributes(
          update.transition().duration(TRANSITION_DURATION_MS),
          xScale,
          yScale,
        )
        return update
      },
      function (exit) {
        return exit.remove()
      },
    )
  }


  // Richtungslabels und Hervorhebung

  /**
   * Zeichnet die Hinweise links, mittig und rechts unter der x-Achse.
   */
  #renderDirectionLabels(): void {
    if (!this.#chartGroup) {
      return
    }

    const labelY = this.innerHeight + this.margin.bottom - 8

    // Linke Seite der Skala.
    this.#chartGroup
      .append('text')
      .attr('class', 'axis-direction-label')
      .attr('x', 0)
      .attr('y', labelY)
      .attr('text-anchor', 'start')
      .attr('font-size', '11px')
      .attr('letter-spacing', '0.03em')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.55)
      .text('← geringerer CO₂-Anteil')

    // Rechte Seite der Skala.
    this.#chartGroup
      .append('text')
      .attr('class', 'axis-direction-label')
      .attr('x', this.innerWidth)
      .attr('y', labelY)
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('letter-spacing', '0.03em')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.55)
      .text('höherer CO₂-Anteil →')

    // Mitte der Skala.
    this.#chartGroup
      .append('text')
      .attr('class', 'zero-line-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.5)
      .text('gleicher Anteil')
  }

  /**
   * Berechnet die Opacity für ein einzelnes Element (Balken, Label,
   * Achsen-Tick) je nach aktuellem Hover- und Auswahlzustand.
   *
   * Regel:
   * - Nichts hervorgehoben → alles voll sichtbar.
   * - Aktives Element (Hover oder ohne Hover die Auswahl) → voll sichtbar.
   * - Sonderfall: Wenn gerade gehovert wird UND parallel etwas ausgewählt
   *   ist, bleibt die Auswahl schwach sichtbar, damit sie nicht verloren geht.
   * - Alles andere → gedämpft.
   *
   * @param sourceKey Energieträger des Elements
   * @returns Opacity zwischen 0 und 1
   */
  #opacityFor(sourceKey: MixSourceKey): number {
    const hoverKey = this.#highlightedSource
    const selectedKey = this.#selectedSource

    // Hover schlägt Auswahl, wenn beides existiert.
    const highlightKey = hoverKey ?? selectedKey

    if (highlightKey === null) return OPACITY_ACTIVE
    if (sourceKey === highlightKey) return OPACITY_ACTIVE

    if (hoverKey !== null && selectedKey !== null && sourceKey === selectedKey) {
      return OPACITY_SELECTED_WHILE_HOVER
    }

    return OPACITY_INACTIVE
  }

  /**
   * Passt die Sichtbarkeit von Balken, Labels und Achsentexten an.
   *
   * Das Zusammenspiel von Hover-Zustand und fester Auswahl ist eine der
   * Stellen, an denen mir KI beim Modell geholfen hat (welcher Zustand
   * hat Vorrang, was passiert, wenn beide gleichzeitig aktiv sind).
   * Umgesetzt habe ich das über #opacityFor, damit die Regel nur einmal
   * geschrieben ist und alle drei Selections konsistent bleiben.
   */
  #updateHighlight(): void {
    if (!this.#barsGroup || !this.#labelsGroup || !this.#chartGroup) {
      return
    }

    const self = this

    this.#barsGroup
      .selectAll<SVGRectElement, EmissionRow>('rect.deviation-bar')
      .attr('opacity', function (row) { return self.#opacityFor(row.sourceKey) })

    this.#labelsGroup
      .selectAll<SVGTextElement, EmissionRow>('text.deviation-label')
      .attr('opacity', function (row) { return self.#opacityFor(row.sourceKey) })

    this.#chartGroup
      .selectAll<SVGTextElement, MixSourceKey>('g.y-axis .tick text')
      .attr('opacity', function (sourceKey) { return self.#opacityFor(sourceKey) })
  }


  // Klick-Handling

  /**
   * Wählt einen Balken aus oder hebt die Auswahl auf, wenn derselbe
   * Balken erneut angeklickt wird.
   *
   * @param row Angeklickte Datenzeile
   */
  #handleBarClick(row: EmissionRow): void {
    const alreadySelected = this.#selectedSource === row.sourceKey
    const newSelection = alreadySelected ? null : row.sourceKey

    this.#selectedSource = newSelection
    this.#updateHighlight()
    this.#selectionHandler?.(newSelection)
  }

  /**
   * Hebt die Auswahl nach einem Klick auf die freie Fläche auf.
   */
  #handleBackgroundClick(): void {
    this.#selectedSource = null
    this.#updateHighlight()
    this.#selectionHandler?.(null)
    this.#backgroundClickHandler?.()
  }
}