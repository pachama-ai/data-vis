/**
 * types/mix.ts – Typdefinitionen für die Mix-Diagramme.
 *
 * Enthält die Typen, die sowohl im Stacked-Area-Chart als auch im
 * Deviation-Chart verwendet werden. Die Rohdaten (alle 12 SMARD-Keys)
 * liegen in EnergySourceValues aus types/visualization-data.ts – hier
 * sind die Typen definiert, die im Frontend tatsächlich benutzt werden.
 *
 * @author Selina Schneider
 */

import type {
  EnergySourceValues,
  MonthlyMixPoint,
} from '~/types/visualization-data'


// =========================================================================
// Grundlegende Union-Typen
// =========================================================================

/**
 * Die 10 Energieträger, die in beiden Charts jeweils als eigener
 * Balken oder Layer erscheinen. Die Keys sind eine Teilmenge von
 * EnergySourceValues – ohne `other_renewables` und `pumped_storage`,
 * weil ich die beiden im Frontend nicht separat darstelle.
 */
export type MixSourceKey =
  | 'hydro'
  | 'biomass'
  | 'wind_offshore'
  | 'wind_onshore'
  | 'pv'
  | 'nuclear'
  | 'gas'
  | 'other_fossil'
  | 'hardcoal'
  | 'lignite'

/** Gruppenzugehörigkeit eines Energieträgers (nutze ich für Farbgruppen und Trennlinien). */
export type MixGroup = 'renewable' | 'nuclear' | 'fossil'

/** Anzeigemodus im Stacked-Area-Chart: absolute Werte (TWh) oder prozentuale Anteile. */
export type MixMode = 'absolute' | 'share'

/** Farbmodus: Standardpalette oder kontrastreiche Palette. */
export type ColorMode = 'default' | 'accessible'


// =========================================================================
// Stacked-Area-Chart
// =========================================================================

/**
 * Eine bereits normalisierte Monatszeile für die Chart-Klasse.
 *
 * Wichtig für später: `values` enthält nur die 10 Layer-Keys aus
 * MixSourceKey, `totalGenerationTwh` bezieht sich dagegen auf ALLE
 * SMARD-Kategorien (inklusive der beiden, die ich im Chart nicht
 * separat zeige). Die Summe der 10 Layer-Werte ist deshalb bewusst
 * NICHT gleich totalGenerationTwh – das habe ich anfangs selbst
 * verwechselt.
 */
export interface MixMonthRow {
  /** Monat als "YYYY-MM" */
  month: string

  /** Geparstes Datum (1. des Monats) – wird von D3 für die Zeitachse gebraucht. */
  date: Date

  /** Werte der 10 im Chart dargestellten Energieträger. */
  values: Record<MixSourceKey, number>

  /**
   * Gesamterzeugung in TWh über ALLE SMARD-Kategorien
   * (inkl. `other_renewables` und `pumped_storage`).
   * Wichtig für den Share-Modus, damit sich alle Anteile auf die
   * tatsächliche Gesamterzeugung beziehen und nicht nur auf die 10 Layer.
   */
  totalGenerationTwh: number
}

/**
 * Alias für den Rohdaten-Typ aus visualization-data.
 * Ich hatte den Alias eingeführt, damit spätere Imports lesbarer sind
 * („RawMixMonthPoint" macht direkt klar, dass das noch nicht die
 * normalisierte Fassung ist).
 */
export type RawMixMonthPoint = MonthlyMixPoint


// =========================================================================
// Annotationen (Ereignisse auf der Zeitachse)
// =========================================================================

/**
 * Ein Ereignis, das im Stacked-Area-Chart als vertikale Linie mit
 * Datum eingeblendet werden kann (z. B. „Atomausstieg", „Nord Stream").
 *
 * `highlight` steuert, welche Energieträger beim Auswählen des
 * Ereignisses hervorgehoben werden – bei einigen Ereignissen betrifft
 * das mehrere Träger gleichzeitig (deshalb ein Array, keine
 * Einzel-ID).
 */
export interface MixAnnotation {
  /** Stabile ID, damit ich das Ereignis nicht über den Array-Index suchen muss. */
  id: number

  /** Datum als "YYYY-MM" oder "YYYY" (Jahresmitte wird als Fallback interpretiert). */
  date: string

  /** Kurztitel für die Legende / den Tooltip. */
  title: string

  /** Ausführlicher Text unter dem Titel. */
  text: string

  /** Energieträger, die bei diesem Ereignis hervorgehoben werden. */
  highlight: MixSourceKey[]
}


// =========================================================================
// Deviation-Chart (Strombeitrag vs. Emissionsanteil)
// =========================================================================

/**
 * Quelle eines Emissionsfaktors (z. B. UBA-Report, GEMIS).
 * Wird in der Doku und ggf. im Tooltip als Nachweis gezeigt.
 */
export interface EmissionFactorSource {
  title: string
  publisher: string
  authors: string
  publication: string
  url: string
  note: string
}

/**
 * Gesamtstruktur der emission-factors.json.
 * `unit` ist der Text zur Einheit (z. B. „g CO₂ / kWh"), damit die
 * Einheit im UI mit angezeigt werden kann, ohne sie zu hardcoden.
 */
export interface EmissionFactorsFile {
  source: EmissionFactorSource
  factors: Record<MixSourceKey, number>
  unit: string
}

/**
 * Eine Zeile im Deviation-Chart für einen einzelnen Energieträger.
 *
 * `deviationPp` ist der zentrale Wert des Diagramms: er sagt, um wie
 * viele Prozentpunkte der Emissionsanteil vom Erzeugungsanteil
 * abweicht. Positiv → Träger verursacht mehr CO₂-Anteil als seinen
 * Erzeugungsanteil (z. B. Braunkohle), negativ → umgekehrt (z. B. Wind).
 */
export interface EmissionRow {
  sourceKey: MixSourceKey

  /** Erzeugung des Jahres in TWh */
  generationTwh: number

  /** Anteil an der Gesamterzeugung (0–1) */
  generationShare: number

  /** CO₂-Emissionen des Jahres in Mt */
  emissionsMt: number

  /** Anteil an den Gesamtemissionen (0–1) */
  emissionShare: number

  /** Abweichung = emissionShare − generationShare, in Prozentpunkten (z. B. 26,9) */
  deviationPp: number
}

/** Ein Jahr mit allen Abweichungswerten. */
export interface DeviationYear {
  year: number
  rows: EmissionRow[]

  /** Gesamterzeugung in TWh */
  totalGenerationTwh: number

  /** Gesamtemissionen in Mt CO₂ */
  totalEmissionsMt: number
}