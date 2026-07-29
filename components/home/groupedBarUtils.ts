/**
 * Hilfsfunktionen für das gruppierte Balkendiagramm.
 *
 * Hier stehen die reinen Datentransformationen und Formatierungen –
 * bewusst ohne Vue oder D3, damit ich die Funktionen in vitest einzeln
 * testen kann.
 */

/* Kategorien der Energieträger */
export type EnergyCategory =
  'erneuerbar'
  | 'fossil'
  | 'kernkraft'

/**
 * Daten eines Energieträgers mit den Jahreswerten und der Veränderung.
 */
export interface EnergyDataPoint {
  id: string
  label: string

  /** Bestimmt Farbe und Filterverhalten im Diagramm. */
  category: EnergyCategory

  value2015: number
  value2024: number

  /** Auf eine Nachkommastelle gerundete Differenz value2024 − value2015. */
  displayedDelta: number
}

/**
 * Daten für einen einzelnen Balken im Diagramm.
 * Pro Energieträger gibt es zwei davon: einen für 2015 und einen für 2024.
 */
export interface FlatBarItem {
  id: string

  /** Zugehöriger Energieträger – ich brauche ihn beim Zeichnen für Label und Farbe. */
  parent: EnergyDataPoint

  year: '2015' | '2024'
  value: number
}

// 2015 wird gedämpft dargestellt, 2024 voll. So fällt das Auge auf die
// aktuellen Zahlen, ohne dass die Vergangenheit ganz verschwindet.
const OPACITY_YEAR_2015 = 0.45
const OPACITY_YEAR_2024 = 1

/**
 * Rundet eine Zahl auf eine Nachkommastelle.
 *
 * @param value Zu rundende Zahl
 * @returns Gerundete Zahl
 */
export function roundToOneDecimal(
  value: number,
): number {
  return Math.round(value * 10) / 10
}

/**
 * Formatiert eine Veränderung in Prozentpunkten mit Vorzeichen und
 * deutschem Dezimalkomma. Ich runde zuerst und entscheide dann anhand
 * des gerundeten Werts über das Vorzeichen, damit kein „+0,0 pp"
 * entstehen kann.
 *
 * @param delta Veränderung in Prozentpunkten
 * @returns Formatierter Wert, z. B. „+3,2 pp" oder „−1,5 pp"
 */
export function formatDelta(
  delta: number,
): string {
  const rounded = roundToOneDecimal(delta)
  const formatted =
    Math.abs(rounded).toFixed(1).replace('.', ',')

  if (rounded > 0) {
    return '+' + formatted + ' pp'
  }

  if (rounded < 0) {
    return '−' + formatted + ' pp'
  }

  return '0,0 pp'
}

/**
 * Formatiert einen Prozentwert mit einer Nachkommastelle und
 * deutschem Dezimalkomma.
 *
 * @param value Wert in Prozent
 * @returns Formatierter Wert, z. B. „12,3 %"
 */
export function formatPercent(
  value: number,
): string {
  const rounded = roundToOneDecimal(value)
  const formatted =
    rounded.toFixed(1).replace('.', ',')

  return formatted + ' %'
}

/**
 * Gibt die Deckkraft eines Balkens zurück.
 * 2015-Balken werden gedämpft, 2024-Balken voll dargestellt.
 *
 * @param bar Balkendaten mit Jahresangabe
 * @returns Deckkraft zwischen 0 und 1
 */
export function getBarOpacity(
  bar: FlatBarItem,
): number {
  if (bar.year === '2015') {
    return OPACITY_YEAR_2015
  }

  return OPACITY_YEAR_2024
}

/**
 * Filtert Balken mit dem Wert 0 aus den Beschriftungsdaten heraus.
 * Der Balken selbst bleibt im Diagramm – es wird nur kein Prozentwert
 * daneben angezeigt, weil „0,0 %" mehr verwirrt als erklärt.
 *
 * @param flatBars Alle Balken des Diagramms
 * @returns Nur die Balken, die eine Beschriftung erhalten sollen
 */
export function getLabelData(
  flatBars: FlatBarItem[],
): FlatBarItem[] {
  const result: FlatBarItem[] = []

  for (const bar of flatBars) {
    if (bar.value > 0) {
      result.push(bar)
    }
  }

  return result
}

/**
 * Schaltet den Kategoriefilter um. Wird dieselbe Kategorie erneut
 * angeklickt, wird der Filter zurückgesetzt.
 *
 * @param currentFilter Aktuell aktive Kategorie, oder null wenn kein Filter gesetzt ist
 * @param clickedCategory Angeklickte Kategorie
 * @returns Neue aktive Kategorie, oder null zum Zurücksetzen
 */
export function toggleCategoryFilter(
  currentFilter: EnergyCategory | null,
  clickedCategory: EnergyCategory,
): EnergyCategory | null {
  if (currentFilter === clickedCategory) {
    return null
  }

  return clickedCategory
}