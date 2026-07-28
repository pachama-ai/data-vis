/**
 * types/visualization-data.ts
 *
 * Daten-Interfaces für die zentrale visualization-data.json,
 * die von build-data.ts erzeugt und von check-data.ts
 * validiert wird.
 *
 * Alle Erzeugungswerte sind in MWh gespeichert – SMARD liefert
 * Stundenwerte in MWh, und die Aggregation im Build-Skript ändert
 * daran nichts. Umrechnung nach TWh passiert erst im Frontend, wenn
 * die Werte fürs Diagramm aufbereitet werden.
 *
 * Zeitangaben sind in Berliner Lokalzeit ausgewertet (per
 * Intl.DateTimeFormat mit timeZone: 'Europe/Berlin').
 *
 * @author Selina Schneider
 */


/**
 * Die 12 Energieträger aus SMARD, jeweils in MWh.
 *
 * Ich habe hier bewusst kein `Record<string, number>` genommen,
 * sondern jeden Träger als eigenes Feld aufgeschrieben. Dadurch
 * bekomme ich Autovervollständigung im Editor und TypeScript merkt
 * sofort, wenn ich mich beim Feldnamen vertippe.
 */
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

/** Ein Monat Erzeugungsmix – Grundlage für das Stacked-Area-Chart. */
export interface MonthlyMixPoint {
  /** Format "YYYY-MM" in Berliner Lokalzeit. */
  month: string

  sources: EnergySourceValues

  /** Summe aller Energieträger in MWh. */
  totalGenerationMwh: number

  /**
   * Anzahl vorhandener Stunden im Monat (erwartet ~730).
   * Weicht bei März und Oktober um 1 Stunde ab (Zeitumstellung) und
   * bei Januar 2015 wegen des Datenstarts am 05.01.2015.
   */
  availableHourCount: number
}

/** Ein Tageswert für das Streudiagramm. */
export interface ScatterDailyPoint {
  /** Format "YYYY-MM-DD" in Berliner Lokalzeit. */
  date: string

  /** Erzeugungsgewichteter EE-Anteil in % (0–100). */
  renewableSharePercent: number

  /** Erzeugungsgewichtete CO₂-Intensität in g CO₂/kWh. */
  co2GramsPerKwh: number

  /**
   * Anzahl Stunden an diesem Tag.
   * Normal 24; an den beiden Zeitumstellungs-Tagen im März und Oktober
   * jeweils 23 bzw. 25.
   */
  availableHourCount: number
}

/**
 * Ein Jahr als Zusammenfassung – für KPI-Zahlen und die
 * Jahresübersicht im Frontend.
 */
export interface YearlyMixPoint {
  year: number

  sources: EnergySourceValues

  /** Summe aller Energieträger in MWh. */
  totalGenerationMwh: number

  /** Erzeugungsgewichteter EE-Anteil in % (0–100). */
  renewableSharePercent: number

  /** Erzeugungsgewichtete CO₂-Intensität in g CO₂/kWh. */
  co2GramsPerKwh: number

  /** Anzahl Stunden im Jahr (erwartet ~8760, Schaltjahre 8784). */
  availableHourCount: number
}

/** Gesamtstruktur der visualization-data.json. */
export interface VisualizationData {
  monthlyMix: MonthlyMixPoint[]
  scatterDaily: ScatterDailyPoint[]
  yearlyMix: YearlyMixPoint[]
}