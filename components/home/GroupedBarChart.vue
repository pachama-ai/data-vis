<script setup lang="ts">
/**
 * GroupedBarChart.vue – Gruppiertes Balkendiagramm für die Startseite.
 *
 * Zeigt den Wandel des deutschen Strommix 2015→2024 als zwei
 * horizontale Balken pro Energieträger (2015/2024 nebeneinander).
 *
 * Der Chart ist offline-fähig: alle Daten kommen als Prop.
 *
 * Interaktivität:
 *   - Tooltip bei Hover auf Balken
 *   - Klick auf Zeilenbeschriftung filtert nach Kategorie
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import {
  formatDelta,
  formatPercent,
  getBarOpacity,
  getLabelData,
  toggleCategoryFilter as toggleCategoryFilterPure,
} from '~/components/home/groupedBarUtils'
import type { EnergyDataPoint, FlatBarItem, EnergyCategory } from '~/components/home/groupedBarUtils'

// =========================================================================
// Typdefinitionen
// =========================================================================
// Die Typen EnergyDataPoint, FlatBarItem, EnergyCategory werden aus
// GroupedBarChart.utils.ts importiert (dort definiert, damit sie auch
// in Tests verwendet werden können).
// EnergyDataPoint wird zusätzlich exportiert für pages/index.vue.
export type { EnergyDataPoint } from '~/components/home/groupedBarUtils'

/** Zustand des Vue-HTML-Tooltips. */
interface TooltipState {
  visible: boolean
  label: string
  category: string
  year: '2015' | '2024'
  value: string
  delta: string
  clientX: number
  clientY: number
}

// =========================================================================
// Props und reaktiver Zustand
// =========================================================================

const props = defineProps<{
  data: EnergyDataPoint[]
}>()

/** Aktuell ausgewählte Kategorie oder null (kein Filter aktiv). */
const activeCategory = ref<EnergyCategory | null>(null)

/**
 * Gefilterte Daten – abgeleitet aus Props und Filter.
 * Wenn kein Filter aktiv ist, werden alle Daten zurückgegeben.
 */
const filteredData = computed<EnergyDataPoint[]>(function () {
  if (activeCategory.value === null) {
    return props.data
  }
  return props.data.filter(function (dataPoint) {
    return dataPoint.category === activeCategory.value
  })
})

/** Tooltip-Zustand (Vue, nicht D3). */
const tooltip = ref<TooltipState | null>(null)

/**
 * Passt den Klick-Hinweistext an den aktuellen Filter-Zustand an.
 * Ohne Filter: Aufforderung zum Filtern. Mit Filter: Rückkehr-Hinweis.
 */
const chartHintText = computed<string>(function () {
  if (activeCategory.value === null) {
    return 'Energieträger anklicken, um die zugehörige Kategorie hervorzuheben.'
  }
  return 'Erneut klicken, um den Filter zurückzusetzen.'
})

/**
 * Liefert das Vergleichsjahr für die Delta-Beschriftung im Tooltip.
 * Wenn 2024 gehovert wird, wird gegen 2015 verglichen und umgekehrt.
 */
const tooltipComparisonYear = computed<number>(function () {
  if (tooltip.value === null) {
    return 2015
  }
  if (tooltip.value.year === '2024') {
    return 2015
  }
  return 2024
})

// =========================================================================
// d3.locale für deutsche Zahlenformatierung
// =========================================================================

const germanNumberFormat = d3.formatLocale({
  decimal: ',',
  thousands: '.',
  grouping: [3],
  currency: ['', ' €'],
})

// =========================================================================
// SVG-Container (Template-Ref)
// =========================================================================

const svgRef = ref<SVGSVGElement | null>(null)
let svgElement: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null

// =========================================================================
// Layout-Konstanten
// =========================================================================

/** Vertikaler Abstand zwischen den Energieträger-Zeilen.
 *  Höherer Wert = mehr Luft, aber weniger nutzbare Balkenhöhe. */
const OUTER_BAND_PADDING = 0.45

/** Abstand zwischen den beiden Balken einer Zeile (2015 und 2024).
 *  Bewusst klein gewählt, damit die Balken als Paar wahrgenommen werden. */
const INNER_BAND_PADDING = 0.08



const CHART_WIDTH = 900
const CHART_MARGIN = { top: 40, right: 80, bottom: 86, left: 200 }

/** Dauer der Balken-Animation in Millisekunden. */
const ANIMATION_DURATION_MS = 500

/** Verzögerung der Label-Animation nach dem Balken-Wachstum. */
const LABEL_DELAY_MS = 300

/** Horizontale Werte für die X-Achse, bei denen Ticks gezeichnet werden. */
const X_AXIS_TICK_VALUES = [0, 5, 10, 15, 20, 25, 30]

/** Abstand zwischen Balkenende und Prozent-Label. */
const BAR_LABEL_OFFSET_X = 4

/** Abstand zwischen rechtem Plot-Rand und Delta-Label. */
const DELTA_LABEL_OFFSET_X = 8

/** Deckkraft für 2015-Balken (Vergangenheit, gedämpft). */
const OPACITY_YEAR_2015 = 0.45
/** Deckkraft für 2024-Balken (Gegenwart, voll). */
const OPACITY_YEAR_2024 = 1.0

/** Feste Höhe pro Energieträger-Zeile inklusive Padding.
 *  Grund: Auch bei Filterung sitzt der Balken mittig. */
const ROW_HEIGHT = 64

/** Berechnet die Innenhöhe (ohne Margin) aus der Zeilenanzahl. */
function calculateInnerHeight(visibleRowCount: number): number {
  return visibleRowCount * ROW_HEIGHT
}

/** Berechnet die gesamte viewBox-Höhe aus der Innenhöhe. */
function calculateChartHeight(innerH: number): number {
  return innerH + CHART_MARGIN.top + CHART_MARGIN.bottom
}

// =========================================================================
// Farbcodierung nach Kategorie
// =========================================================================

const CATEGORY_COLORS: Record<EnergyCategory, string> = {
  erneuerbar: '#7a9e6e',
  fossil: '#a67c52',
  kernkraft: '#b56b8a',
}

/** Kräftigere Varianten für den Kontrastmodus – pro Jahr. */
const CATEGORY_COLORS_CONTRAST: Record<EnergyCategory, { year2015: string; year2024: string }> = {
  erneuerbar: { year2015: '#9CBE7E', year2024: '#33612A' },
  fossil:      { year2015: '#D2A25C', year2024: '#6F3F12' },
  kernkraft:   { year2015: '#D18BAF', year2024: '#84265A' },
}

/**
 * Wählt die Farbe je nach Kontrastmodus.
 * Im Kontrastmodus wird pro Jahr eine eigene Farbe verwendet (kräftiger),
 * im Normalmodus dieselbe Farbe mit unterschiedlicher Deckkraft.
 */
function getCategoryColor(category: EnergyCategory, year?: '2015' | '2024'): string {
  const isContrast = typeof document !== 'undefined'
    && document.documentElement.dataset.contrast === 'on'
  if (isContrast && year) {
    return CATEGORY_COLORS_CONTRAST[category][year === '2015' ? 'year2015' : 'year2024']
  }
  return CATEGORY_COLORS[category]
}

const CATEGORY_LABELS: Record<EnergyCategory, string> = {
  erneuerbar: 'Erneuerbare Energien',
  fossil: 'Fossile Energieträger',
  kernkraft: 'Kernenergie',
}

// =========================================================================
// Hilfsfunktionen für Berechnung und Darstellung
//
// Die meisten Hilfsfunktionen (formatDelta, formatPercent, getBarOpacity,
// getLabelData, toggleCategoryFilter) sind in GroupedBarChart.utils.ts
// ausgelagert, damit sie in Unit-Tests getestet werden können.
// =========================================================================

/**
 * Schaltet den Kategoriefilter um.
 */
function toggleCategoryFilter(clickedCategory: EnergyCategory): void {
  activeCategory.value = toggleCategoryFilterPure(activeCategory.value, clickedCategory)
}

/**
 * Textfarbe für Balken-Labels: 2015 gedämpft, 2024 kräftig.
 */
function getBarLabelColor(year: '2015' | '2024'): string {
  if (year === '2015') {
    return '#8a8a85'
  }
  return 'var(--text-color)'
}

// Dunkelgraue Textfarbe für alle Delta-Labels.
// Bewusst neutral gehalten – keine Wertung durch Grün/Rot.
const DELTA_LABEL_COLOR = '#4a4a45'

/** Berechnet das Maximum beider Jahreswerte eines Datenpunkts. */
function getMaxValueOfDataPoint(dataPoint: EnergyDataPoint): number {
  return Math.max(dataPoint.value2015, dataPoint.value2024)
}

// =========================================================================
// Haupt-Zeichenfunktion
// =========================================================================

/**
 * Rendert das gesamte Diagramm in das bestehende SVG.
 * Beim ersten Aufruf werden die festen <g>-Gruppen angelegt.
 * Bei späteren Aufrufen (nach Filter-Wechsel) laufen nur die Daten-Joins.
 */
function renderChart(): void {
  const currentData = filteredData.value
  if (currentData.length === 0) {
    return
  }

  // SVG initialisieren (nur beim ersten Aufruf)
  if (svgElement === null) {
    if (svgRef.value === null) {
      return
    }
    svgElement = d3.select(svgRef.value)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Gruppiertes Balkendiagramm: Stromerzeugungsanteile 2015 und 2024')

    // Feste SVG-Gruppen (einmalig angelegt, danach immer vorhanden)
    svgElement.append('g').attr('class', 'chart-legend')
    svgElement.append('g').attr('class', 'grid')
    svgElement.append('g').attr('class', 'y-axis')
    svgElement.append('g').attr('class', 'chart-content')
    svgElement.append('g').attr('class', 'x-axis')
    svgElement.append('g').attr('class', 'axis-label')
  }

  const currentInnerHeight = calculateInnerHeight(currentData.length)
  const currentChartHeight = calculateChartHeight(currentInnerHeight)

  // viewBox-Höhe dynamisch an Zeilenanzahl anpassen
  svgElement.attr('viewBox', `0 0 ${CHART_WIDTH} ${currentChartHeight}`)

  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right

  // -----------------------------------------------------------------------
  // Skalen
  //
  // Äußere y-Skala: positioniert jeden Energieträger in einer eigenen Zeile.
  // Innere y-Skala: teilt jede Zeile in zwei Balken (2015 und 2024).
  //
  // Zwei scaleBand-Instanzen sind nötig, weil wir zwei Verschachtelungs-
  // ebenen haben: Energieträger → Jahr.
  // -----------------------------------------------------------------------
  const outerScale = d3.scaleBand<string>()
    .domain(currentData.map(function (d) { return d.id }))
    .range([0, currentInnerHeight])
    .padding(OUTER_BAND_PADDING)

  const innerScale = d3.scaleBand<string>()
    .domain(['2015', '2024'])
    .range([0, outerScale.bandwidth()])
    .padding(INNER_BAND_PADDING)

  // Lokale Hilfsfunktion: berechnet die Y-Koordinate der Oberkante
  // eines Balkens. Nutzt die Skalen aus dem umgebenden Scope,
  // deshalb ist sie hier innen definiert.
  function getBarTopY(bar: FlatBarItem): number {
    const rowTop = outerScale(bar.parent.id) ?? 0
    const withinRow = innerScale(bar.year) ?? 0
    return CHART_MARGIN.top + rowTop + withinRow
  }

  // x-Skala (linear, für Prozentwerte von 0 bis maximaler Wert)
  const maxValue = d3.max(currentData, getMaxValueOfDataPoint) ?? 30
  const xScale = d3.scaleLinear()
    .domain([0, Math.max(maxValue * 1.1, 30)])
    .nice()
    .range([0, innerWidth])

  // -----------------------------------------------------------------------
  // Flaches Array für das Join-Pattern
  //
  // Jeder EnergyDataPoint erzeugt zwei FlatBarItem-Einträge:
  // einen für 2015 und einen für 2024. So können wir über ein
  // flaches Array alle Balken mit einem einzigen Join zeichnen.
  // -----------------------------------------------------------------------
  const flatBars: FlatBarItem[] = []
  for (const dataPoint of currentData) {
    flatBars.push(
      { id: dataPoint.id + '-2015', parent: dataPoint, year: '2015', value: dataPoint.value2015 },
    )
    flatBars.push(
      { id: dataPoint.id + '-2024', parent: dataPoint, year: '2024', value: dataPoint.value2024 },
    )
  }

  // Vorab: Array für Wertelabels filtern (ohne Nullwerte)
  const labelBars = getLabelData(flatBars)

  // -----------------------------------------------------------------------
  // Legende oberhalb des Charts
  // -----------------------------------------------------------------------
  const legendGroup = svgElement.select<SVGGElement>('.chart-legend')
  legendGroup.html('')
  const legendX = CHART_MARGIN.left + innerWidth / 2 - 60
  const isContrast = typeof document !== 'undefined' && document.documentElement.dataset.contrast === 'on'
  legendGroup.append('rect')
    .attr('x', legendX).attr('y', 14)
    .attr('width', 12).attr('height', 12).attr('rx', 2).attr('ry', 2)
    .attr('fill', isContrast ? '#6F3F12' : '#8a8a85')
    .attr('opacity', isContrast ? 1 : OPACITY_YEAR_2015)
  legendGroup.append('text')
    .attr('x', legendX + 18).attr('y', 24)
    .attr('font-size', '11px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em').style('text-transform', 'uppercase')
    .text('2015')
  legendGroup.append('rect')
    .attr('x', legendX + 66).attr('y', 14)
    .attr('width', 12).attr('height', 12).attr('rx', 2).attr('ry', 2)
    .attr('fill', isContrast ? '#33612A' : '#8a8a85')
    .attr('opacity', isContrast ? 1 : OPACITY_YEAR_2024)
  legendGroup.append('text')
    .attr('x', legendX + 84).attr('y', 24)
    .attr('font-size', '11px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em').style('text-transform', 'uppercase')
    .text('2024')

  // -----------------------------------------------------------------------
  // Vertikale Rasterlinien (hinter den Balken)
  //
  // Jeweils bei 0, 5, 10, 15, 20, 25 und 30 Prozent.
  // Sehr helle Farbe, damit sie den Chart nicht optisch dominieren.
  // -----------------------------------------------------------------------
  const gridGroup = svgElement.select<SVGGElement>('.grid')
  gridGroup.selectAll<SVGLineElement, number>('.grid-line')
    .data(X_AXIS_TICK_VALUES)
    .join(
      function (enter) { return enter.append('line').attr('class', 'grid-line')
        .attr('y1', CHART_MARGIN.top)
        .attr('y2', CHART_MARGIN.top + currentInnerHeight)
        .attr('stroke', '#f0ede8').attr('stroke-width', 1) },
      function (update) { return update },
      function (exit) { return exit.remove() },
    )
    .attr('x1', function (tickValue) { return CHART_MARGIN.left + xScale(tickValue) })
    .attr('x2', function (tickValue) { return CHART_MARGIN.left + xScale(tickValue) })

  // -----------------------------------------------------------------------
  // y-Achse (links)
  //
  // Die Domain-Linie wird ausgeblendet, nur die Ticks bleiben sichtbar.
  // Die Tick-Format-Funktion gibt einen leeren String zurück, weil wir
  // eigene Zeilenbeschriftungen links rendern.
  // -----------------------------------------------------------------------
  const yAxis = d3.axisLeft(outerScale).tickSize(0).tickFormat(function () { return '' })
  const yAxisGroup = svgElement.select<SVGGElement>('.y-axis')
    .attr('transform', `translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`)
  yAxisGroup.call(yAxis)
  yAxisGroup.select('.domain').remove()

  // -----------------------------------------------------------------------
  // x-Achse (unten)
  //
  // Explizite Tick-Positionen bei 0, 5, 10, …, 30 Prozent.
  // Domain-Linie entfernt, nur Ticks und Tick-Beschriftung sichtbar.
  // -----------------------------------------------------------------------
  const xAxis = d3.axisBottom(xScale)
    .tickValues(X_AXIS_TICK_VALUES)
    .tickFormat(function (tickValue) {
      return germanNumberFormat.format('.0f')(Number(tickValue)) + ' %'
    })
    .tickSize(4)
  const xAxisGroup = svgElement.select<SVGGElement>('.x-axis')
    .attr('transform', `translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top + currentInnerHeight})`)
  xAxisGroup.call(xAxis)
  xAxisGroup.select('.domain').remove()
  xAxisGroup.selectAll('.tick text')
    .attr('font-size', '11px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')

  // -----------------------------------------------------------------------
  // Achsentitel unter der x-Achse
  // -----------------------------------------------------------------------
  const axisLabelGroup = svgElement.select<SVGGElement>('.axis-label')
  axisLabelGroup.html('')
  axisLabelGroup.append('text')
    .attr('x', CHART_MARGIN.left + innerWidth / 2)
    .attr('y', CHART_MARGIN.top + currentInnerHeight + 52)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px').attr('fill', '#8a8a85')
    .attr('font-family', 'var(--sans-font)')
    .style('letter-spacing', '0.05em').style('text-transform', 'uppercase')
    .text('Anteil an der öffentlichen Nettostromerzeugung')

  // -----------------------------------------------------------------------
  // Balken via Join-Pattern
  //
  // Jeder Balken ist ein <rect>-Element. Das Join-Pattern erlaubt uns,
  // auf Datenänderungen (Filter) mit fließenden Übergängen zu reagieren:
  //
  // - Enter:   neuer Balken erscheint mit Breite 0 und wächst ein
  // - Update:  bestehender Balken ändert seine Breite
  // - Exit:    verschwindender Balken schrumpft auf Breite 0
  //
  // Alle Übergänge sind mit .transition().duration(500) animiert.
  // -----------------------------------------------------------------------
  const chartContent = svgElement.select<SVGGElement>('.chart-content')
  chartContent.selectAll<SVGRectElement, FlatBarItem>('.bar')
    .data(flatBars, function (flatBar: FlatBarItem) { return flatBar.id })
    .join(
      function (enter) {
        const newBars = enter.append('rect')
          .attr('class', 'bar')
          .attr('x', CHART_MARGIN.left)
          .attr('y', getBarTopY)
          .attr('height', innerScale.bandwidth())
          .attr('width', 0)
          .attr('fill', function (bar) { return getCategoryColor(bar.parent.category, bar.year) })
          .attr('opacity', getBarOpacity)
          .attr('rx', 2).attr('ry', 2)

        // Breite direkt setzen (keine Transition beim ersten Rendern,
        // weil D3-Transitions im join-Enter-Kontext nicht stabil laufen)
        newBars.attr('width', function (bar) { return xScale(bar.value) })

        return newBars
      },
      function (update) { return update
        .attr('fill', function (bar) { return getCategoryColor(bar.parent.category, bar.year) })
        .attr('opacity', getBarOpacity)
        .call(function (updateSelection) { return updateSelection.transition().duration(ANIMATION_DURATION_MS)
          .attr('y', getBarTopY)
          .attr('height', innerScale.bandwidth())
          .attr('width', function (bar) { return xScale(bar.value) }) },
        ) },
      function (exit) { return exit
        .call(function (exitSelection) { return exitSelection.transition().duration(ANIMATION_DURATION_MS)
          .attr('width', 0)
          .remove() },
        ) },
    )

  // -----------------------------------------------------------------------
  // Tooltip-Events auf Balken
  // -----------------------------------------------------------------------
  chartContent.selectAll<SVGRectElement, FlatBarItem>('.bar')
    .on('mouseenter', function (event: MouseEvent, flatBar: FlatBarItem) {
      const deltaText = formatDelta(flatBar.parent.displayedDelta)
      tooltip.value = {
        visible: true,
        label: flatBar.parent.label,
        category: CATEGORY_LABELS[flatBar.parent.category],
        year: flatBar.year,
        value: formatPercent(flatBar.value),
        delta: deltaText,
        clientX: event.clientX,
        clientY: event.clientY,
      }
    })
    .on('mousemove', function (event: MouseEvent) {
      if (tooltip.value !== null) {
        tooltip.value.clientX = event.clientX
        tooltip.value.clientY = event.clientY
      }
    })
    .on('mouseleave', function () {
      tooltip.value = null
    })

  // -----------------------------------------------------------------------
  // Wertelabels auf Balken
  //
  // Verwendet labelBars (gefiltert: keine Nullwerte). Gleiches
  // Join-Muster wie bei den Balken, aber mit Opacity-Transition.
  // -----------------------------------------------------------------------
  chartContent.selectAll<SVGTextElement, FlatBarItem>('.bar-label')
    .data(labelBars, function (flatBar: FlatBarItem) { return flatBar.id })
    .join(
      function (enter) { return enter.append('text')
        .attr('class', 'bar-label')
        .attr('x', CHART_MARGIN.left)
        .attr('y', function (bar) { return getBarTopY(bar) + innerScale.bandwidth() / 2 })
        .attr('opacity', 0)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('fill', function (bar) { return getBarLabelColor(bar.year) })
        .attr('font-family', 'var(--sans-font)')
        .style('font-variant-numeric', 'tabular-nums')
        .text(function (bar) { return formatPercent(bar.value) })
        .call(function (enterSelection) { return enterSelection.transition().duration(ANIMATION_DURATION_MS).delay(LABEL_DELAY_MS)
          .attr('opacity', 1)
          .attr('x', function (bar) { return CHART_MARGIN.left + xScale(bar.value) + BAR_LABEL_OFFSET_X }) },
        ) },
      function (update) { return update
        .call(function (updateSelection) { return updateSelection.transition().duration(ANIMATION_DURATION_MS)
          .attr('y', function (bar) { return getBarTopY(bar) + innerScale.bandwidth() / 2 })
          .attr('x', function (bar) { return CHART_MARGIN.left + xScale(bar.value) + BAR_LABEL_OFFSET_X })
          .text(function (bar) { return formatPercent(bar.value) }) },
        )
        .attr('fill', function (bar) { return getBarLabelColor(bar.year) }) },
      function (exit) { return exit
        .call(function (exitSelection) { return exitSelection.transition().duration(300)
          .attr('opacity', 0)
          .remove() },
        ) },
    )

  // -----------------------------------------------------------------------
  // Zeilenbeschriftung links: Energieträger-Name und Kategorie
  //
  // Jeder Energieträger bekommt eine <g>-Gruppe mit zwei <text>-Elementen:
  // - .row-label-name:  der Name (Kernenergie, Wind an Land, …)
  // - .row-label-cat:   die Kategorie (Kernkraft, Erneuerbar, Fossil)
  //
  // Das Transform-Attribut wird nach dem .join() gesetzt,
  // damit es sowohl auf neue als auch auf bestehende Gruppen angewendet wird.
  // -----------------------------------------------------------------------
  // Zeilenbeschriftung links: eine Gruppe pro Energieträger.
  // Jede Gruppe enthält zwei Texte: Name (oben) und Kategorie (unten).
  // Position der Gruppe wird über transform gesetzt, damit die
  // Text-Koordinaten innerhalb der Gruppe konstant bleiben.
  //
  // Wir bauen die Text-Elemente bei jedem Rendering neu, statt sie zu
  // updaten. Das ist bei nur 10 Zeilen unproblematisch und macht den
  // Code deutlich verständlicher als das klassische Enter/Update/Exit-
  // Muster mit vier Hilfsfunktionen.
  const rowLabelGroups = chartContent
    .selectAll<SVGGElement, EnergyDataPoint>('.row-label-group')
    .data(currentData, function (dataPoint) { return dataPoint.id })
    .join('g')
    .attr('class', 'row-label-group')
    .attr('transform', function (dataPoint) {
      const yTop = CHART_MARGIN.top + (outerScale(dataPoint.id) ?? 0)
      return `translate(0, ${yTop})`
    })

  // Für jede Gruppe die zwei Text-Elemente neu bauen
  rowLabelGroups.each(function renderOneRowLabel(this: SVGGElement, dataPoint: EnergyDataPoint) {
    const groupElement = d3.select(this)
    const bandCenter = outerScale.bandwidth() / 2

    // Alte Texte entfernen, damit wir sauber neu bauen
    groupElement.selectAll('text').remove()

    // Energieträger-Name (obere Zeile)
    groupElement.append('text')
      .attr('class', 'row-label-name')
      .attr('x', CHART_MARGIN.left - 12)
      .attr('y', bandCenter - 3)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'alphabetic')
      .attr('font-size', '14px')
      .attr('fill', 'var(--text-color)')
      .attr('font-family', 'var(--sans-font)')
      .style('cursor', 'pointer')
      .text(dataPoint.label)
      .on('click', function () { toggleCategoryFilter(dataPoint.category) })

    // Kategorie-Untertitel (untere Zeile)
    groupElement.append('text')
      .attr('class', 'row-label-cat')
      .attr('x', CHART_MARGIN.left - 12)
      .attr('y', bandCenter + 4)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'hanging')
      .attr('font-size', '11px')
      .attr('fill', '#8a8a85')
      .attr('font-family', 'var(--sans-font)')
      .style('cursor', 'pointer')
      .text(CATEGORY_LABELS[dataPoint.category])
      .on('click', function () { toggleCategoryFilter(dataPoint.category) })
  })

  // -----------------------------------------------------------------------
  // Delta-Label rechts
  //
  // Zeigt die Veränderung von 2015 auf 2024 in Prozentpunkten.
  // Positioniert auf derselben y-Höhe wie die Zeilenbeschriftung,
  // aber am rechten Rand des Plots.
  // -----------------------------------------------------------------------
  chartContent.selectAll<SVGTextElement, EnergyDataPoint>('.delta-label')
    .data(currentData, function (dataPoint: EnergyDataPoint) { return dataPoint.id })
    .join(
      function (enter) { return enter.append('text').attr('class', 'delta-label') },
      function (update) { return update },
      function (exit) { return exit.remove() },
    )
    .attr('x', CHART_MARGIN.left + innerWidth + DELTA_LABEL_OFFSET_X)
    .attr('y', function (dataPoint) {
      const bandTop = outerScale(dataPoint.id) ?? 0
      const rowCenter = bandTop + outerScale.bandwidth() / 2
      return CHART_MARGIN.top + rowCenter
    })
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px')
    .attr('font-family', "'SFMono-Regular', Consolas, monospace")
    .style('font-variant-numeric', 'tabular-nums')
    .text(function (dataPoint) { return formatDelta(dataPoint.displayedDelta) })
    .attr('fill', DELTA_LABEL_COLOR)
}

// =========================================================================
// Vue-Lifecycle
// =========================================================================

let contrastObserver: MutationObserver | null = null

onMounted(function () {
  renderChart()

  // Neu zeichnen, wenn sich der Kontrastmodus ändert
  contrastObserver = new MutationObserver(function () {
    renderChart()
  })

  contrastObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-contrast'],
  })
})

onBeforeUnmount(function () {
  contrastObserver?.disconnect()
  contrastObserver = null

  if (svgElement !== null) {
    svgElement.selectAll('*').remove()
    svgElement.remove()
    svgElement = null
  }
})

watch(filteredData, function () { renderChart() }, { flush: 'post', deep: true })
</script>

<template>
  <div class="grouped-bar-wrapper">
    <div class="chart-hint">
      <span class="chart-hint-icon" aria-hidden="true">↳</span>
      {{ chartHintText }}
    </div>
    <svg ref="svgRef" class="grouped-bar-svg"></svg>

    <div
      v-if="tooltip?.visible"
      class="bar-tooltip"
      :style="{
        left: (tooltip.clientX + 14) + 'px',
        top: Math.max(8, tooltip.clientY - 72) + 'px',
      }"
    >
      <div class="bar-tt-label">{{ tooltip.label }}</div>
      <div class="bar-tt-row">
        <span class="bar-tt-year">{{ tooltip.year }}:</span>
        <span class="bar-tt-val">{{ tooltip.value }}</span>
      </div>
      <div class="bar-tt-cat">{{ tooltip.category }}</div>
      <div class="bar-tt-delta">Veränderung zu {{ tooltipComparisonYear }}: {{ tooltip.delta }}</div>
    </div>
  </div>
</template>

<style scoped>
.grouped-bar-wrapper {
  position: relative;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.chart-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans-font);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--muted-text-color);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  margin-bottom: 24px;
  font-style: normal;
}

.chart-hint-icon {
  font-size: 11px;
  opacity: 0.6;
}

.grouped-bar-svg {
  width: 100%;
  height: auto;
  display: block;
}

.bar-tooltip {
  position: fixed;
  pointer-events: none;
  background: rgba(42, 42, 38, 0.92);
  color: #f0f0ea;
  font-family: var(--sans-font);
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  line-height: 1.5;
  z-index: 1000;
  white-space: nowrap;
}

.bar-tt-label {
  font-weight: 600;
  margin-bottom: 2px;
}

.bar-tt-row {
  display: flex;
  gap: 6px;
}

.bar-tt-year {
  opacity: 0.7;
}

.bar-tt-val {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bar-tt-cat {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 1px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bar-tt-delta {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

:deep(.x-axis .tick text),
:deep(.y-axis .tick text) {
  font-family: var(--sans-font);
  font-size: 11px;
  fill: #8a8a85;
}

:deep(.x-axis .tick line) {
  stroke: #d0cec8;
}

/* SVG-Text-Elemente */
:deep(.bar-label),
:deep(.delta-label) {
  font-size: 12px;
}

:deep(.row-label-name) {
  font-size: 14px;
}

:deep(.row-label-cat),
:deep(.groupled-bar-legend text) {
  font-size: 11px;
}
</style>
