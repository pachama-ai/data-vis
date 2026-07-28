/**
 * Typdefinitionen für das Stacked-Area-Chart (Strommix).
 *
 * Enthält die Union-Typen für Energieträger, Gruppen und Modi sowie
 * die Interfaces für Monatsdaten und Ereignis-Annotationen.
 *
 * @author Selina Schneider
 */

import type { MonthlyMixPoint } from '~/types/visualization-data'


// Grundlegende Union-Typen

/**
 * Die 10 Energieträger, die im Strommix-Diagramm als eigene Fläche
 * und im Abweichungsdiagramm als eigener Balken erscheinen.
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

/** Gruppenzugehörigkeit eines Energieträgers – für Farbgruppen und Trennlinien. */
export type MixGroup = 'renewable' | 'nuclear' | 'fossil'

/** Anzeigemodus im Strommix-Diagramm: absolute Werte (TWh) oder Anteile. */
export type MixMode = 'absolute' | 'share'

/** Farbmodus: Standardpalette oder kontrastreich. */
export type ColorMode = 'default' | 'accessible'


// Stacked-Area-Chart

/**
 * Eine bereits normalisierte Monatszeile für die Chart-Klasse.
 *
 * Wichtig: `values` enthält nur die 10 Layer-Keys aus MixSourceKey,
 * `totalGenerationTwh` bezieht sich dagegen auf alle SMARD-Kategorien
 * (inklusive der beiden, die ich im Chart nicht separat zeige). Die
 * Summe der 10 Layer-Werte ist deshalb nicht gleich totalGenerationTwh
 * (das habe ich anfangs verwechselt).
 */
export interface MixMonthRow {
  /** Monat als "YYYY-MM". */
  month: string

  /** Geparstes Datum (1. des Monats). Wird von D3 für die Zeitachse gebraucht. */
  date: Date

  /** Werte der 10 im Chart dargestellten Energieträger. */
  values: {
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
   * Gesamterzeugung in TWh über alle SMARD-Kategorien
   * (inkl. `other_renewables` und `pumped_storage`).
   * Wichtig für den Share-Modus, damit sich die Anteile auf die
   * tatsächliche Gesamterzeugung beziehen und nicht nur auf die
   * 10 dargestellten Träger.
   */
  totalGenerationTwh: number
}

/**
 * Alias für den Rohdaten-Typ aus visualization-data.
 * Ich habe den Alias eingeführt, damit spätere Imports lesbarer sind.
 */
export type RawMixMonthPoint = MonthlyMixPoint


// Annotationen (Ereignisse auf der Zeitachse)

/**
 * Ein Ereignis, das im Strommix-Diagramm als vertikale Linie mit
 * Datum eingeblendet werden kann (z. B. Atomausstieg).
 *
 * `highlight` ist ein Array, weil manche Ereignisse mehrere
 * Energieträger gleichzeitig betreffen.
 */
export interface MixAnnotation {
  /** ID, damit ich das Ereignis nicht über den Array-Index suchen muss. */
  id: number

  /** Datum als "YYYY-MM". */
  date: string

  /** Kurztitel für die Legende/den Tooltip. */
  title: string

  /** Text unter dem Titel. */
  text: string

  /** Energieträger, die bei diesem Ereignis hervorgehoben werden. */
  highlight: MixSourceKey[]
}