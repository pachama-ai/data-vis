<script setup lang="ts">
/**
 * Gruppiertes Balkendiagramm für die Startseite.
 *
 * Zeigt für jeden Energieträger zwei Balken pro Zeile: einen für
 * 2015 und einen für 2024. Rechts daneben die Veränderung in Prozent-
 * punkten. Ein Klick auf einen Namen oder eine Gruppe links filtert
 * das Diagramm auf die zugehörige Kategorie.
 *
 * D3 zeichnet direkt in das SVG. Vue verwaltet drumherum nur den Filter
 * und den Tooltip.
 *
 * @author Selina Schneider
 */

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import * as d3 from 'd3'

import {
  formatDelta,
  formatPercent,
  getBarOpacity,
  getLabelData,
  toggleCategoryFilter as toggleCategoryFilterPure,
} from '~/components/home/groupedBarUtils'

import type {
  EnergyCategory,
  EnergyDataPoint,
  FlatBarItem,
} from '~/components/home/groupedBarUtils'

export type {
  EnergyDataPoint,
} from '~/components/home/groupedBarUtils'

interface TooltipState {
  label: string
  category: string
  year: '2015' | '2024'
  value: string
  delta: string
  // Mausposition in Fenster-Koordinaten, damit ich den Tooltip per
  // position: fixed direkt an den Cursor hängen kann.
  clientX: number
  clientY: number
}

interface GroupedBarChartProps {
  data: EnergyDataPoint[]
}

const props = defineProps<GroupedBarChartProps>()

// null heißt: kein Filter, alle Energieträger anzeigen.
const activeCategory =
  ref<EnergyCategory | null>(null)

const filteredData = computed<EnergyDataPoint[]>(
  function (): EnergyDataPoint[] {
    if (activeCategory.value === null) {
      return props.data
    }

    return props.data.filter(
      function (dataPoint): boolean {
        return (
          dataPoint.category
          === activeCategory.value
        )
      },
    )
  },
)

const tooltip = ref<TooltipState | null>(null)

// Der Hinweis über dem Diagramm ändert sich, sobald ein Filter aktiv ist,
// damit klar ist, wie man ihn wieder loswird.
const chartHintText = computed<string>(
  function (): string {
    if (activeCategory.value === null) {
      return 'Energieträger anklicken, um nur diese Kategorie anzuzeigen.'
    }

    return 'Erneut klicken, um den Filter zurückzusetzen.'
  },
)

// Der Tooltip zeigt immer die Veränderung von 2015 zu 2024.
// Das Vorzeichen ist immer 2024 minus 2015, unabhängig vom Jahr
// des Balkens, über dem der Mauszeiger gerade steht.


// Deutsche Zahlenformatierung für die Achsenbeschriftung
// (Komma als Dezimaltrennzeichen, Punkt als Tausendertrennzeichen).
const germanNumberFormat = d3.formatLocale({
  decimal: ',',
  thousands: '.',
  grouping: [3],
  currency: ['', ' €'],
})

const svgRef = ref<SVGSVGElement | null>(null)

// Feste Diagrammgrößen. Der linke Rand ist bewusst breit, damit die
// zweizeiligen Beschriftungen (Name + Gruppe) daneben Platz haben.
const CHART_WIDTH = 900

const CHART_MARGIN = {
  top: 40,
  right: 80,
  bottom: 86,
  left: 200,
}

const ROW_HEIGHT = 64
const OUTER_BAND_PADDING = 0.45
const INNER_BAND_PADDING = 0.08

// Feste Tick-Werte statt automatischer d3-Ticks, damit die Rasterlinien
// bei jedem Filter-Zustand an denselben Prozentmarken sitzen.
const X_AXIS_TICK_VALUES = [
  0,
  5,
  10,
  15,
  20,
  25,
  30,
]

// Gruppenfarben für den normalen Modus. Beide Jahre einer Gruppe teilen
// sich dieselbe Farbe; unterschieden werden sie über die Deckkraft.
const CATEGORY_COLORS: {
  erneuerbar: string
  fossil: string
  kernkraft: string
} = {
  erneuerbar: '#7a9e6e',
  fossil: '#a67c52',
  kernkraft: '#b56b8a',
}

// Farben für den Kontrastmodus.
const CATEGORY_COLORS_CONTRAST: {
  erneuerbar: {
    year2015: string
    year2024: string
  }
  fossil: {
    year2015: string
    year2024: string
  }
  kernkraft: {
    year2015: string
    year2024: string
  }
} = {
  erneuerbar: {
    year2015: '#9CBE7E',
    year2024: '#33612A',
  },
  fossil: {
    year2015: '#D2A25C',
    year2024: '#6F3F12',
  },
  kernkraft: {
    year2015: '#D18BAF',
    year2024: '#84265A',
  },
}

/**
 * Gibt die Balkenfarbe für einen Energieträger und ein Jahr zurück.
 * Ob der Kontrastmodus aktiv ist, lese ich am data-contrast-Attribut
 * des <html>-Elements ab. Das setzt das useHighContrast-Composable
 * global.
 *
 * @param category Gruppe des Energieträgers
 * @param year Jahr des Balkens
 * @returns Farbwert als Hex-String
 */
function getCategoryColor(
  category: EnergyCategory,
  year: '2015' | '2024',
): string {
  const isContrast =
    document.documentElement.dataset.contrast === 'on'

  if (!isContrast) {
    return CATEGORY_COLORS[category]
  }

  if (year === '2015') {
    return CATEGORY_COLORS_CONTRAST[category].year2015
  }

  return CATEGORY_COLORS_CONTRAST[category].year2024
}

const CATEGORY_LABELS: {
  erneuerbar: string
  fossil: string
  kernkraft: string
} = {
  erneuerbar: 'Erneuerbare Energien',
  fossil: 'Fossile Energieträger',
  kernkraft: 'Kernenergie',
}

/**
 * Wechselt die aktive Kategorie oder setzt den Filter zurück.
 * Die Logik habe ich in groupedBarUtils ausgelagert, damit sie
 * für sich testbar bleibt. Hier nur die Anbindung an den Ref.
 *
 * @param clickedCategory Angeklickte Gruppe
 */
function toggleCategoryFilter(
  clickedCategory: EnergyCategory,
): void {
  activeCategory.value =
    toggleCategoryFilterPure(
      activeCategory.value,
      clickedCategory,
    )
}

/**
 * Liefert die Textfarbe für einen Balkenwert.
 *
 * @param year Jahr des Balkens
 * @returns Farbwert als CSS-Wert oder Custom-Property
 */
function getBarLabelColor(
  year: '2015' | '2024',
): string {
  if (year === '2015') {
    return '#8a8a85'
  }

  return 'var(--text-color)'
}

const DELTA_LABEL_COLOR = '#4a4a45'

/**
 * Zeichnet oder aktualisiert das Balkendiagramm.
 *
 * Beim ersten Aufruf lege ich die Rahmen-Gruppen an (Raster, Inhalt,
 * Achse, Achsenbeschriftung). Bei jedem weiteren Aufruf werden nur die
 * Kinder dieser Gruppen per Data-Join aktualisiert.
 */
function renderChart(): void {
  const currentData = filteredData.value

  if (
    currentData.length === 0
    || svgRef.value === null
  ) {
    return
  }

  const svg = d3.select(svgRef.value)

  // Die Diagrammhöhe hängt an der Anzahl der Zeilen. Beim Filtern
  // schrumpft das SVG entsprechend mit.
  const currentInnerHeight =
    currentData.length * ROW_HEIGHT

  const currentChartHeight =
    currentInnerHeight
    + CHART_MARGIN.top
    + CHART_MARGIN.bottom

  const innerWidth =
    CHART_WIDTH
    - CHART_MARGIN.left
    - CHART_MARGIN.right

  // Beim ersten Rendern lege ich die Struktur an. Bei den folgenden
  // Rendern nur noch die Höhe anpassen, sonst würden Achsen und
  // Rasterlinien jedes Mal neu gestapelt.
  const isFirstRender =
    svg.select('.chart-content').empty()

  if (isFirstRender) {
    svg
      .attr(
        'viewBox',
        `0 0 ${CHART_WIDTH} ${currentChartHeight}`,
      )
      .attr('width', '100%')
      .attr('height', currentChartHeight)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('role', 'img')
      .attr(
        'aria-label',
        'Gruppiertes Balkendiagramm: Stromerzeugungsanteile 2015 und 2024',
      )

    svg
      .append('g')
      .attr('class', 'grid')

    svg
      .append('g')
      .attr('class', 'chart-content')

    svg
      .append('g')
      .attr('class', 'x-axis')

    svg
      .append('g')
      .attr('class', 'axis-label')
  } else {
    svg
      .attr('viewBox', `0 0 ${CHART_WIDTH} ${currentChartHeight}`)
      .attr('width', '100%')
      .attr('height', currentChartHeight)
  }

  // Zwei geschachtelte Bandskalen: außen für die Energieträger
  // (eine Zeile pro Träger), innen für die beiden Jahre übereinander.
  const outerScale = d3
    .scaleBand<string>()
    .domain(
      currentData.map(
        function (dataPoint): string {
          return dataPoint.id
        },
      ),
    )
    .range([0, currentInnerHeight])
    .padding(OUTER_BAND_PADDING)

  const innerScale = d3
    .scaleBand<string>()
    .domain(['2015', '2024'])
    .range([0, outerScale.bandwidth()])
    .padding(INNER_BAND_PADDING)

  /**
   * Berechnet die y-Position eines einzelnen Balkens im SVG.
   * Setzt sich zusammen aus dem oberen Rand, der Zeilenposition
   * des Energieträgers und dem Versatz für 2015 bzw. 2024.
   *
   * @param bar Balken-Eintrag mit Energieträger und Jahr
   * @returns y-Koordinate im SVG
   */
  function getBarTopY(
    bar: FlatBarItem,
  ): number {
    const rowTop =
      outerScale(bar.parent.id) ?? 0

    const positionInRow =
      innerScale(bar.year) ?? 0

    return (
      CHART_MARGIN.top
      + rowTop
      + positionInRow
    )
  }

  // Für die x-Skala nehme ich den größten Wert plus 10 % Luft, aber
  // mindestens 30 Prozent. Sonst würden die kleinen Restposten beim
  // Filtern die Skala übernehmen und die Balken zu lang wirken.
  let maximumValue = 0

  for (const dataPoint of currentData) {
    const largestValue = Math.max(
      dataPoint.value2015,
      dataPoint.value2024,
    )

    if (largestValue > maximumValue) {
      maximumValue = largestValue
    }
  }

  const xMaximum = Math.max(
    maximumValue * 1.1,
    30,
  )

  const xScale = d3
    .scaleLinear()
    .domain([0, xMaximum])
    .nice()
    .range([0, innerWidth])

  // Geschachtelte Struktur wird zu einer flachen Liste: pro
  // Energieträger zwei Balken. Damit kann ich die Balken in einem
  // einzigen Data-Join zeichnen, statt für jedes Jahr ein eigenes
  // selectAll.
  const flatBars: FlatBarItem[] = []

  for (const dataPoint of currentData) {
    flatBars.push({
      id: dataPoint.id + '-2015',
      parent: dataPoint,
      year: '2015',
      value: dataPoint.value2015,
    })

    flatBars.push({
      id: dataPoint.id + '-2024',
      parent: dataPoint,
      year: '2024',
      value: dataPoint.value2024,
    })
  }

  const labelBars = getLabelData(flatBars)

  // Senkrechte Rasterlinien an den festen Tick-Werten.
  const gridGroup =
    svg.select<SVGGElement>('.grid')

  gridGroup
    .selectAll<SVGLineElement, number>(
      '.grid-line',
    )
    .data(X_AXIS_TICK_VALUES)
    .join('line')
    .attr('class', 'grid-line')
    .attr('y1', CHART_MARGIN.top)
    .attr(
      'y2',
      CHART_MARGIN.top + currentInnerHeight,
    )
    .attr(
      'x1',
      function (tickValue): number {
        return (
          CHART_MARGIN.left
          + xScale(tickValue)
        )
      },
    )
    .attr(
      'x2',
      function (tickValue): number {
        return (
          CHART_MARGIN.left
          + xScale(tickValue)
        )
      },
    )
    .attr('stroke', '#f0ede8')
    .attr('stroke-width', 1)

  // Horizontale Achse mit deutscher Formatierung und Prozentzeichen.
  const xAxis = d3
    .axisBottom(xScale)
    .tickValues(X_AXIS_TICK_VALUES)
    .tickFormat(function (tickValue): string {
      const formattedValue =
        germanNumberFormat
          .format('.0f')(Number(tickValue))

      return formattedValue + ' %'
    })
    .tickSize(4)

  const axisY =
    CHART_MARGIN.top + currentInnerHeight

  const xAxisGroup =
    svg.select<SVGGElement>('.x-axis')

  xAxisGroup
    .attr(
      'transform',
      'translate('
      + CHART_MARGIN.left
      + ', '
      + axisY
      + ')',
    )

  xAxisGroup.call(xAxis)

  // Weil durchgehende Achsenlinie stört, entfernen.
  xAxisGroup
    .select('.domain')
    .remove()

  xAxisGroup
    .selectAll('.tick text')
    .attr('font-size', '11px')
    .attr('fill', '#8a8a85')
    .attr(
      'font-family',
      'var(--sans-font)',
    )

  // Achsentitel unter der x-Achse.
  const axisLabelGroup =
    svg.select<SVGGElement>('.axis-label')

  axisLabelGroup.html('')

  axisLabelGroup
    .append('text')
    .attr(
      'x',
      CHART_MARGIN.left + innerWidth / 2,
    )
    .attr(
      'y',
      CHART_MARGIN.top
      + currentInnerHeight
      + 52,
    )
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#8a8a85')
    .attr(
      'font-family',
      'var(--sans-font)',
    )
    .style('letter-spacing', '0.05em')
    .style('text-transform', 'uppercase')
    .text(
      'Anteil an der öffentlichen Nettostromerzeugung',
    )

  const chartContent =
    svg.select<SVGGElement>('.chart-content')

  // Balken zeichnen. Die Key-Funktion in .data(...) sorgt dafür, dass
  // D3 vorhandene Balken bei einem Filterwechsel wiederverwendet,
  // statt sie zu löschen und neu zu erzeugen, damit Breiten-Transition weiterläuft.
  chartContent
    .selectAll<SVGRectElement, FlatBarItem>(
      '.bar',
    )
    .data(
      flatBars,
      function (flatBar: FlatBarItem): string {
        return flatBar.id
      },
    )
    .join('rect')
    .attr('class', 'bar')
    .attr('x', CHART_MARGIN.left)
    .attr('y', getBarTopY)
    .attr('height', innerScale.bandwidth())
    .attr(
      'fill',
      function (bar): string {
        return getCategoryColor(
          bar.parent.category,
          bar.year,
        )
      },
    )
    .attr('opacity', getBarOpacity)
    .attr('rx', 2)
    .attr('ry', 2)
    .on(
      'mouseenter',
      function (
        event: MouseEvent,
        flatBar: FlatBarItem,
      ): void {
        tooltip.value = {
          label: flatBar.parent.label,
          category:
            CATEGORY_LABELS[
              flatBar.parent.category
            ],
          year: flatBar.year,
          value: formatPercent(flatBar.value),
          delta: formatDelta(
            flatBar.parent.displayedDelta,
          ),
          clientX: event.clientX,
          clientY: event.clientY,
        }
      },
    )
    .on(
      'mousemove',
      function (event: MouseEvent): void {
        if (tooltip.value === null) {
          return
        }

        tooltip.value.clientX = event.clientX
        tooltip.value.clientY = event.clientY
      },
    )
    .on(
      'mouseleave',
      function (): void {
        tooltip.value = null
      },
    )
    .transition()
    .duration(400)
    .attr(
      'width',
      function (bar): number {
        return xScale(bar.value)
      },
    )

  // Prozentwert am Ende jedes Balkens. labelBars ist gefiltert, damit
  // sich Werte in engen Balkenpaaren nicht überdecken.
  chartContent
    .selectAll<SVGTextElement, FlatBarItem>(
      '.bar-label',
    )
    .data(
      labelBars,
      function (flatBar: FlatBarItem): string {
        return flatBar.id
      },
    )
    .join('text')
    .attr('class', 'bar-label')
    .attr(
      'x',
      function (bar): number {
        return (
          CHART_MARGIN.left
          + xScale(bar.value)
          + 4
        )
      },
    )
    .attr(
      'y',
      function (bar): number {
        return (
          getBarTopY(bar)
          + innerScale.bandwidth() / 2
        )
      },
    )
    .attr('opacity', 1)
    .attr('text-anchor', 'start')
    .attr(
      'dominant-baseline',
      'middle',
    )
    .attr('font-size', '12px')
    .attr(
      'fill',
      function (bar): string {
        return getBarLabelColor(bar.year)
      },
    )
    .attr(
      'font-family',
      'var(--sans-font)',
    )
    .style(
      'font-variant-numeric',
      'tabular-nums',
    )
    .text(
      function (bar): string {
        return formatPercent(bar.value)
      },
    )

  // Links neben den Balken: pro Energieträger eine <g>-Gruppe mit
  // zwei Textzeilen (Name und Gruppe). Beide sind klickbar.
  const rowLabelGroups = chartContent
    .selectAll<SVGGElement, EnergyDataPoint>('.row-label-group')
    .data(
      currentData,
      function (
        dataPoint: EnergyDataPoint,
      ): string {
        return dataPoint.id
      },
    )
    .join('g')
    .attr('class', 'row-label-group')
    .attr(
      'transform',
      function (
        dataPoint: EnergyDataPoint,
      ): string {
        const rowPosition =
          outerScale(dataPoint.id) ?? 0

        const yTop =
          CHART_MARGIN.top + rowPosition

        return (
          'translate(0, '
          + yTop
          + ')'
        )
      },
    )

  // Innerhalb jeder Gruppe die beiden Textzeilen neu setzen.
  rowLabelGroups.each(
    function renderOneRowLabel(
      this: SVGGElement,
      dataPoint: EnergyDataPoint,
    ): void {
      const groupElement =
        d3.select(this)

      const bandCenter =
        outerScale.bandwidth() / 2

      groupElement
        .selectAll('text')
        .remove()

      groupElement
        .append('text')
        .attr('class', 'row-label-name')
        .attr('x', CHART_MARGIN.left - 12)
        .attr('y', bandCenter - 3)
        .attr('text-anchor', 'end')
        .attr(
          'dominant-baseline',
          'alphabetic',
        )
        .attr('font-size', '14px')
        .attr(
          'fill',
          'var(--text-color)',
        )
        .attr(
          'font-family',
          'var(--sans-font)',
        )
        .style('cursor', 'pointer')
        .text(dataPoint.label)
        .on(
          'click',
          function (): void {
            toggleCategoryFilter(
              dataPoint.category,
            )
          },
        )

      groupElement
        .append('text')
        .attr('class', 'row-label-cat')
        .attr('x', CHART_MARGIN.left - 12)
        .attr('y', bandCenter + 4)
        .attr('text-anchor', 'end')
        .attr(
          'dominant-baseline',
          'hanging',
        )
        .attr('font-size', '11px')
        .attr('fill', '#8a8a85')
        .attr(
          'font-family',
          'var(--sans-font)',
        )
        .style('cursor', 'pointer')
        .text(
          CATEGORY_LABELS[
            dataPoint.category
          ],
        )
        .on(
          'click',
          function (): void {
            toggleCategoryFilter(
              dataPoint.category,
            )
          },
        )
    },
  )

  // Rechts neben den Balken: die Veränderung in Prozentpunkten zwischen 2015 und 2024.
  chartContent
    .selectAll<SVGTextElement, EnergyDataPoint>('.delta-label')
    .data(
      currentData,
      function (
        dataPoint: EnergyDataPoint,
      ): string {
        return dataPoint.id
      },
    )
    .join('text')
    .attr('class', 'delta-label')
    .attr(
      'x',
      CHART_MARGIN.left + innerWidth + 8,
    )
    .attr(
      'y',
      function (
        dataPoint: EnergyDataPoint,
      ): number {
        const bandTop =
          outerScale(dataPoint.id) ?? 0

        return (
          CHART_MARGIN.top
          + bandTop
          + outerScale.bandwidth() / 2
        )
      },
    )
    .attr('text-anchor', 'start')
    .attr(
      'dominant-baseline',
      'middle',
    )
    .attr('font-size', '12px')
    .attr(
      'font-family',
      "'SFMono-Regular', Consolas, monospace",
    )
    .style(
      'font-variant-numeric',
      'tabular-nums',
    )
    .text(
      function (
        dataPoint: EnergyDataPoint,
      ): string {
        return formatDelta(
          dataPoint.displayedDelta,
        )
      },
    )
    .attr('fill', DELTA_LABEL_COLOR)

  // Legende oben über dem Diagramm. Sie hat genau eine Instanz,
  // damit reicht ein Data-Join mit [null] als Konstant-Selektion.
  const legendSelection = svg
    .selectAll<SVGGElement, null>(
      '.chart-legend',
    )
    .data([null])

  const legendGroup = legendSelection
    .join('g')
    .attr('class', 'chart-legend')

  legendGroup.html('')

  const legendX =
    CHART_MARGIN.left
    + innerWidth / 2
    - 60

  const isContrast =
    document.documentElement.dataset.contrast
    === 'on'

  // Im normalen Modus unterscheide ich "2015 vs 2024" über die
  // Deckkraft. Im Kontrastmodus über zwei getrennte Farben.
  const color2015 = isContrast
    ? '#6F3F12'
    : '#8a8a85'

  const color2024 = isContrast
    ? '#33612A'
    : '#8a8a85'

  const opacity2015 = isContrast
    ? 1
    : 0.45

  legendGroup
    .append('rect')
    .attr('x', legendX)
    .attr('y', 14)
    .attr('width', 12)
    .attr('height', 12)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('fill', color2015)
    .attr('opacity', opacity2015)

  legendGroup
    .append('text')
    .attr('x', legendX + 18)
    .attr('y', 24)
    .attr('font-size', '11px')
    .attr('fill', '#8a8a85')
    .attr(
      'font-family',
      'var(--sans-font)',
    )
    .style('letter-spacing', '0.05em')
    .style('text-transform', 'uppercase')
    .text('2015')

  legendGroup
    .append('rect')
    .attr('x', legendX + 66)
    .attr('y', 14)
    .attr('width', 12)
    .attr('height', 12)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('fill', color2024)
    .attr('opacity', 1)

  legendGroup
    .append('text')
    .attr('x', legendX + 84)
    .attr('y', 24)
    .attr('font-size', '11px')
    .attr('fill', '#8a8a85')
    .attr(
      'font-family',
      'var(--sans-font)',
    )
    .style('letter-spacing', '0.05em')
    .style('text-transform', 'uppercase')
    .text('2024')
}

// Der Kontrastmodus wird global über data-contrast am <html>-Element gesteuert. 
let contrastObserver:
  MutationObserver | null = null

onMounted(function (): void {
  renderChart()

  contrastObserver =
    new MutationObserver(
      function (): void {
        renderChart()
      },
    )

  contrastObserver.observe(
    document.documentElement,
    {
      attributes: true,
      attributeFilter: ['data-contrast'],
    },
  )
})

// Beobachter abmelden, damit keine Callbacks im Speicher
// zurückbleiben.
onBeforeUnmount(function (): void {
  if (contrastObserver !== null) {
    contrastObserver.disconnect()
    contrastObserver = null
  }

  if (svgRef.value === null) {
    return
  }

  const svg = d3.select(svgRef.value)

  svg
    .selectAll('*')
    .remove()

  svg
    .attr('width', null)
    .attr('height', null)
})

// flush: 'post' sorgt dafür, dass renderChart erst läuft, nachdem Vue
// das DOM aktualisiert hat.
watch(
  filteredData,
  function (): void {
    renderChart()
  },
  {
    flush: 'post',
    deep: true,
  },
)
</script>

<template>
  <div class="grouped-bar-wrapper">
    <!-- Hinweistext oberhalb; wechselt je nach Filterzustand. -->
    <div class="chart-hint">
      <span
        class="chart-hint-icon"
        aria-hidden="true"
      >
        ↳
      </span>

      {{ chartHintText }}
    </div>

    <!-- Zeichenfläche für D3. -->
    <svg
      ref="svgRef"
      class="grouped-bar-svg"
    ></svg>

    <!-- Tooltip, folgt dem Cursor. -->
    <div
      v-if="tooltip"
      class="bar-tooltip"
      :style="{
        left: (tooltip.clientX + 14) + 'px',
        top:
          Math.max(8, tooltip.clientY - 72)
          + 'px',
      }"
    >
      <div class="bar-tt-label">
        {{ tooltip.label }}
      </div>

      <div class="bar-tt-row">
        <span class="bar-tt-year">
          {{ tooltip.year }}:
        </span>

        <span class="bar-tt-val">
          {{ tooltip.value }}
        </span>
      </div>

      <div class="bar-tt-cat">
        {{ tooltip.category }}
      </div>

      <div class="bar-tt-delta">
        Veränderung 2015–2024:
        {{ tooltip.delta }}
      </div>
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

/* Hinweistext platziert mit leichtem Rahmen über dem Diagramm. */
.chart-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 6px 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.03);
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 12px;
  font-style: normal;
  letter-spacing: 0.03em;
}

.chart-hint-icon {
  font-size: 11px;
  opacity: 0.6;
}

/* Das SVG skaliert per width/height responsiv im Wrapper mit. */
.grouped-bar-svg {
  display: block;
  width: 100%;
  height: auto;
}

/*
 * Der Tooltip liegt über allem und ignoriert Maus-Events, damit der
 * Cursor weiter den darunterliegenden Balken erreicht.
 */
.bar-tooltip {
  position: fixed;
  z-index: 1000;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(42, 42, 38, 0.92);
  color: #f0f0ea;
  font-family: var(--sans-font);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
}

.bar-tt-label {
  margin-bottom: 2px;
  font-weight: 600;
}

.bar-tt-row {
  display: flex;
  gap: 6px;
}

.bar-tt-year {
  opacity: 0.7;
}

/* tabular-nums, damit sich die Zahl beim Wechsel nicht verschiebt. */
.bar-tt-val {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bar-tt-cat {
  margin-top: 1px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.6;
}

.bar-tt-delta {
  margin-top: 2px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

/*
 * ::v-deep, weil D3 die SVG-Elemente ohne das data-v-Attribut
 * von Vue einhängt und Scoped-CSS sie sonst nicht erreicht.
 */
:deep(.x-axis .tick text) {
  fill: #8a8a85;
  font-family: var(--sans-font);
  font-size: 11px;
}

:deep(.x-axis .tick line) {
  stroke: #d0cec8;
}

:deep(.bar-label),
:deep(.delta-label) {
  font-size: 12px;
}

:deep(.row-label-name) {
  font-size: 14px;
}

:deep(.row-label-cat),
:deep(.chart-legend text) {
  font-size: 11px;
}
</style>