// ============================================================
// types/visualization-data.ts
// Daten-Interfaces für die zentrale visualization-data.json.
// Alle Erzeugungswerte in MWh (bestätigt anhand build_hourly.ts
// und level1-integrity.ts – SMARD liefert MWh pro Stunde).
// Zeitzone: Europe/Berlin (via Intl.DateTimeFormat).
// ============================================================

/** 12 Energieträger – alle Werte in MWh. Kein Record-String-Index. */
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

/** Ein Monat Erzeugungsmix – für StackedArea. */
export interface MonthlyMixPoint {
  /** Format "YYYY-MM" in Berliner Lokalzeit. */
  month: string
  sources: EnergySourceValues
  /** Summe aller Energieträger in MWh. */
  totalGenerationMwh: number
  /** Anzahl vorhandener Stunden im Monat (erwartet ~730). */
  availableHourCount: number
}

/** Ein Tageswert für das Streudiagramm – für ScatterSimple. */
export interface ScatterDailyPoint {
  /** Format "YYYY-MM-DD" in Berliner Lokalzeit. */
  date: string
  /** Erzeugungsgewichteter EE-Anteil in % (Wertebereich 0–100). */
  renewableSharePercent: number
  /** Erzeugungsgewichtete CO₂-Intensität in g CO₂/kWh. */
  co2GramsPerKwh: number
  /** Anzahl Stunden an diesem Tag (erwartet 24 oder weniger). */
  availableHourCount: number
}

/** Ein Jahr als Zusammenfassung – für KPI-Zahlen und IntroBarbellChart. */
export interface YearlyMixPoint {
  year: number
  sources: EnergySourceValues
  /** Summe aller Energieträger in MWh. */
  totalGenerationMwh: number
  /** Erzeugungsgewichteter EE-Anteil in % (Wertebereich 0–100). */
  renewableSharePercent: number
  /** Erzeugungsgewichtete CO₂-Intensität in g CO₂/kWh. */
  co2GramsPerKwh: number
  /** Anzahl Stunden im Jahr (erwartet ~8760). */
  availableHourCount: number
}

/** Gesamtstruktur der visualization-data.json. */
export interface VisualizationData {
  monthlyMix: MonthlyMixPoint[]
  scatterDaily: ScatterDailyPoint[]
  yearlyMix: YearlyMixPoint[]
}
