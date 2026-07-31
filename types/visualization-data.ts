/**
 * Typen für die visualization-data.json.
 *
 * Die Datei wird von build-data.ts erzeugt und von check-data.ts
 * geprüft. Sie enthält alle Werte, die die Anwendung im Browser lädt.
 *
 * Alle Erzeugungswerte sind in MWh. Die Umrechnung nach TWh passiert
 * erst im Frontend. Zeitangaben sind in Berliner Lokalzeit.
 *
 * @author Selina Schneider
 */


/** Die 12 Energieträger aus SMARD, jeweils in MWh. */
export interface EnergySourceValues {
  biomass: number
  hydro: number
  wind_onshore: number
  wind_offshore: number
  pv: number
  other_renewables: number
  lignite: number
  hardcoal: number
  gas: number
  nuclear: number
  other_fossil: number
  pumped_storage: number
}

/** Ein Monat für das Strommix-Diagramm. */
export interface MonthlyMixPoint {
  /** Format "YYYY-MM" */
  month: string

  sources: EnergySourceValues

  /** Summe aller Energieträger in MWh */
  totalGenerationMwh: number

  /**
   * Anzahl Stunden im Monat.
    * Weicht bei März und Oktober um 1 Stunde ab (Zeitumstellung).
   */
  availableHourCount: number
}

/** Ein Jahr für die Jahresübersicht */
export interface YearlyMixPoint {
  year: number

  sources: EnergySourceValues

  /** Summe aller Energieträger in MWh */
  totalGenerationMwh: number

  /** EE-Anteil in Prozent */
  renewableSharePercent: number

  /** CO₂-Intensität in g CO₂/kWh */
  co2GramsPerKwh?: number

  /** Anzahl Stunden im Jahr (normal 8760, Schaltjahre 8784) */
  availableHourCount: number
}

/** Struktur der visualization-data.json. */
export interface VisualizationData {
  monthlyMix: MonthlyMixPoint[]
  yearlyMix: YearlyMixPoint[]
}