/**
 * types/mix.ts – Typdefinitionen für das Stacked-Area-Chart.
 *
 * Enthält nur die 10 Energieträger, die im Stacked-Area-Chart
 * als eigene Layer dargestellt werden.
 *
 * Die Rohdaten (alle 12 Keys) liegen in EnergySourceValues
 * aus types/visualization-data.ts. Hier definieren wir einen
 * spezifischen Typ für die im Chart verwendete Teilmenge.
 */

import type {
  EnergySourceValues,
  MonthlyMixPoint,
  YearlyMixPoint,
} from '~/types/visualization-data'

/**
 * Die 10 Energieträger, die im Stacked-Area-Chart als eigene
 * Layer erscheinen. Die Keys sind eine Teilmenge von
 * EnergySourceValues (ohne other_renewables, pumped_storage).
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

/** Gruppenzugehörigkeit eines Energieträgers. */
export type MixGroup = 'renewable' | 'nuclear' | 'fossil'

/** Anzeigemodus: absolute Werte oder prozentuale Anteile. */
export type MixMode = 'absolute' | 'share'

/** Farbmodus: Standard oder kontrastreich. */
export type ColorMode = 'default' | 'accessible'

/**
 * Eine bereits normalisierte Monatszeile für die Chart-Klasse.
 * Die Werte liegen in der Einheit vor, die bei der späteren
 * Normalisierung festgelegt wird (MWh oder TWh).
 */
export interface MixMonthRow {
  /** Monat als "YYYY-MM" */
  month: string
  /** Geparstes Datum (1. des Monats) */
  date: Date
  /** Werte der 10 Energieträger */
  values: Record<MixSourceKey, number>
}

/**
 * Alias für den vorhandenen Rohdaten-Typ, damit spätere Imports
 * klarer benannt werden können.
 */
export type RawMixMonthPoint = MonthlyMixPoint

/** Alias für den vorhandenen Jahres-Rohdaten-Typ. */
export type RawMixYearPoint = YearlyMixPoint

// =========================================================================
// Annotationstyp
// =========================================================================

export interface MixAnnotation {
  id: number
  date: string
  title: string
  text: string
  highlight: MixSourceKey[]
}

// =========================================================================
// Deviation-Chart (Strombeitrag vs. Emissionsanteil)
// =========================================================================

/**
 * Quelle eines Emissionsfaktors (z. B. UBA-Report, GEMIS).
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
 */
export interface EmissionFactorsFile {
  source: EmissionFactorSource
  factors: Record<MixSourceKey, number>
  unit: string
}

/**
 * Eine Zeile des Deviation-Charts für einen Energieträger.
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
  /** Abweichung = emissionShare - generationShare in Prozentpunkten (z. B. 26,9) */
  deviationPp: number
}

/**
 * Ein Jahr mit allen Abweichungswerten.
 */
export interface DeviationYear {
  year: number
  rows: EmissionRow[]
  /** Gesamterzeugung in TWh */
  totalGenerationTwh: number
  /** Gesamtemissionen in Mt CO₂ */
  totalEmissionsMt: number
}
