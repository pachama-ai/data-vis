/**
 * Hilfsfunktionen für das Gruppierte-Balkendiagramm auf der Startseite.
 *
 * In einer eigenen Datei, damit sie unabhängig von Vue getestet werden können.
 */

// =========================================================================
// Typdefinitionen (exportiert für Tests und Komponente)
// =========================================================================

export type EnergyCategory = 'erneuerbar' | 'fossil' | 'kernkraft'

export interface EnergyDataPoint {
  /** Eindeutiger Schlüssel, zum Beispiel 'kernenergie' */
  id: string
  /** Anzeigename, zum Beispiel 'Kernenergie' */
  label: string
  /** Kategorie für Farbcodierung und Filter */
  category: EnergyCategory
  /** Anteil 2015 in Prozent (exakt, ungerundet) */
  value2015: number
  /** Anteil 2024 in Prozent (exakt, ungerundet) */
  value2024: number
  /** Differenz 2024 minus 2015, aus den gerundeten Anzeigewerten. */
  displayedDelta: number
}

export interface FlatBarItem {
  id: string
  parent: EnergyDataPoint
  year: '2015' | '2024'
  value: number
}

// =========================================================================
// Konstanten
// =========================================================================

/** Deckkraft für 2015-Balken (Vergangenheit, gedämpft). */
const OPACITY_YEAR_2015 = 0.45
/** Deckkraft für 2024-Balken (Gegenwart, voll). */
const OPACITY_YEAR_2024 = 1.0

// =========================================================================
// Rundungsfunktion
// =========================================================================

/**
 * Rundet auf eine Nachkommastelle.
 */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

// =========================================================================
// Formatierungsfunktionen
// =========================================================================

/**
 * Formatiert die Veränderung mit Vorzeichen und Einheit.
 * Beispiel: +11,8 pp oder −16,8 pp.
 */
export function formatDelta(delta: number): string {
  const roundedNumber = roundToOneDecimal(Math.abs(delta))
  const formattedNumber = roundedNumber.toFixed(1).replace('.', ',')
  if (delta > 0) {
    return '+' + formattedNumber + ' pp'
  }
  if (delta < 0) {
    return '\u2212' + formattedNumber + ' pp'
  }
  return '0,0 pp'
}

/**
 * Formatiert einen Prozentwert mit einer Nachkommastelle.
 * Beispiel: "16,8 %".
 */
export function formatPercent(value: number): string {
  const roundedValue = roundToOneDecimal(value)
  const formattedNumber = roundedValue.toFixed(1).replace('.', ',')
  return formattedNumber + ' %'
}

// =========================================================================
// Deckkraft
// =========================================================================

/**
 * Bestimmt die Deckkraft eines Balkens abhängig vom Jahr.
 * 2015 wird gedämpft dargestellt (Vergangenheit),
 * 2024 in voller Deckkraft (Gegenwart).
 */
export function getBarOpacity(bar: FlatBarItem): number {
  if (bar.year === '2015') {
    return OPACITY_YEAR_2015
  }
  return OPACITY_YEAR_2024
}

// =========================================================================
// Label-Filter
// =========================================================================

/**
 * Erzeugt aus dem geflachten Balken-Array die Untermenge, für die
 * ein Prozentwert-Label sinnvoll ist. Balken mit value === 0 werden
 * ausgeschlossen, damit auf leeren Werten (zum Beispiel Kernenergie 2024)
 * kein "0,0 %" steht. Der Balken selbst bleibt erhalten.
 */
export function getLabelData(flatBars: FlatBarItem[]): FlatBarItem[] {
  const result: FlatBarItem[] = []
  for (const bar of flatBars) {
    if (bar.value > 0) {
      result.push(bar)
    }
  }
  return result
}

// =========================================================================
// Kategoriefilter
// =========================================================================

/**
 * Schaltet den Kategoriefilter um.
 * Reine Funktion ohne Vue-Ref-Zugriff – nimmt den aktuellen Filter
 * und die geklickte Kategorie entgegen, gibt den neuen Filter zurück.
 * null bedeutet: kein Filter aktiv.
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
