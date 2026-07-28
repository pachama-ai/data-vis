/**
 * Typdefinitionen für das Abweichungsdiagramm.
 *
 * Enthält die Typen für das Abweichungsdiagramm und die
 * Emissionsfaktoren. MixSourceKey wird aus energy-mix importiert,
 * weil es dort als gemeinsamer Grundtyp definiert ist.
 *
 * @author Selina Schneider
 */

import type { MixSourceKey } from '~/types/energy-mix'

// Re-Export, damit importierende Dateien MixSourceKey direkt aus
// diesem Modul beziehen können und nicht zusätzlich energy-mix
// einbinden müssen.
export type { MixSourceKey }


// Abweichungsdiagramm

/**
 * Emissionsfaktoren je Energieträger in g CO₂ pro kWh.
 */
export interface EmissionFactorValues {
  hydro: number
  biomass: number
  wind_offshore: number
  wind_onshore: number
  pv: number
  nuclear: number
  gas: number
  other_fossil: number
  hardcoal: number
  lignite: number
}

/**
 * Struktur der emission-factors.json.
 */
export interface EmissionFactorsFile {
  factors: EmissionFactorValues
}

/**
 * Ein Balken im Abweichungsdiagramm für einen Energieträger.
 *
 * `deviationPp` ist der zentrale Wert: er zeigt, um wie viele
 * Prozentpunkte der Emissionsanteil vom Erzeugungsanteil abweicht.
 * Positiv bedeutet: mehr CO₂-Anteil als Erzeugungsanteil, negativ das Gegenteil.
 */
export interface EmissionRow {
  sourceKey: MixSourceKey

  /** Erzeugung des Jahres in TWh. */
  generationTwh: number

  /** Anteil an der Gesamterzeugung (0–1). */
  generationShare: number

  /** CO₂-Emissionen des Jahres in Mt. */
  emissionsMt: number

  /** Anteil an den Gesamtemissionen (0–1). */
  emissionShare: number

  /** Abweichung in Prozentpunkten (Emissionsanteil minus Erzeugungsanteil). */
  deviationPp: number
}

/**
 * Alle Werte eines Jahres für das Abweichungsdiagramm.
 * Enthält pro Energieträger eine Zeile und dazu die Jahressummen,
 * die für die Anteilsberechnung gebraucht werden.
 */
export interface DeviationYear {
  year: number
  rows: EmissionRow[]

  /** Gesamterzeugung in TWh. */
  totalGenerationTwh: number

  /** Gesamtemissionen in Mt CO₂. */
  totalEmissionsMt: number
}