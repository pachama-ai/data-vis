/**
 * Berechnen der direkten CO₂-Emissionen
 *
 * Enthalten sind Funktionen für Emissionen,
 * Emissionsintensität und Abweichungen
 *
 * Die Emissionsfaktoren werden aus
 * public/data/emission-factors.json geladen
 */

/* Reihenfolge der Energieträger */
import { STACK_ORDER } from '~/components/generation/mixConfig'

import type {
  DeviationYear,
  EmissionFactorValues,
  EmissionFactorsFile,
  EmissionRow,
} from '~/types/emissions'

import type { MixYearRow } from '~/composables/useMixData'

/**
 * Laden der Emissionsfaktoren aus der JSON-Datei
 *
 * Bei einem Fehler wird eine Fehlermeldung ausgelöst,
 * damit die aufrufende Komponente darauf reagieren kann
 *
 * @returns Geladene Emissionsfaktoren
 */
export async function loadEmissionFactorsFile():
Promise<EmissionFactorsFile> {
  const response = await fetch(
    '/data/emission-factors.json',
  )

  if (!response.ok) {
    throw new Error(
      `Fehler beim Laden der Emissionsfaktoren: ${response.status} ${response.statusText}`,
    )
  }

  const data: EmissionFactorsFile =
    await response.json()

  return data
}

/**
 * Standardwerte für die direkten CO₂-Emissionen
 *
 * Die Werte werden verwendet, wenn keine anderen
 * Emissionsfaktoren übergeben werden
 */
export const DEFAULT_EMISSION_FACTORS:
EmissionFactorValues = {
  hydro: 0,
  biomass: 0,
  wind_offshore: 0,
  wind_onshore: 0,
  pv: 0,
  nuclear: 0,
  gas: 411,
  other_fossil: 750,
  hardcoal: 835,
  lignite: 1075,
}

/**
 * Berechnen der CO₂-Emissionen eines Energieträgers
 *
 * Für die Umrechnung gilt:
 * TWh × g/kWh ÷ 1000 = Mt
 *
 * @param generationTwh Erzeugung in TWh
 * @param factorGPerKwh Emissionsfaktor in g CO₂/kWh
 * @returns Emissionen in Millionen Tonnen CO₂
 */
export function calculateEmissionsMt(
  generationTwh: number,
  factorGPerKwh: number,
): number {
  if (
    generationTwh <= 0
    || factorGPerKwh <= 0
  ) {
    return 0
  }

  return (
    generationTwh
    * factorGPerKwh
  ) / 1000
}

/**
 * Berechnen der CO₂-Emissionsintensität
 *
 * Bei einer Erzeugung von 0 wird 0 zurückgegeben,
 * damit nicht durch 0 gerechnet wird
 *
 * @param emissionsMt Emissionen in Mt CO₂
 * @param generationTwh Erzeugung in TWh
 * @returns Emissionsintensität in g CO₂/kWh
 */
export function calculateEmissionIntensity(
  emissionsMt: number,
  generationTwh: number,
): number {
  if (generationTwh <= 0) {
    return 0
  }

  return (
    emissionsMt * 1000
  ) / generationTwh
}

/**
 * Berechnen eines Anteils
 *
 * Bei einer Gesamtsumme von 0 wird 0 zurückgegeben,
 * damit nicht durch 0 gerechnet wird
 *
 * @param value Einzelwert
 * @param total Gesamtsumme
 * @returns Anteil zwischen 0 und 1
 */
function calculateShare(
  value: number,
  total: number,
): number {
  if (total === 0) {
    return 0
  }

  return value / total
}

/**
 * Berechnen der Emissionswerte für ein Jahr
 *
 * Zuerst wird die gesamte Stromerzeugung berechnet
 * Danach werden die Emissionen je Energieträger bestimmt
 * und daraus die jeweiligen Anteile berechnet
 *
 * @param yearRow Erzeugungsdaten eines Jahres
 * @param emissionFactors Emissionsfaktoren der Energieträger
 * @returns Berechnete Emissionswerte oder null
 */
function calculateEmissionRows(
  yearRow: MixYearRow | null,
  emissionFactors: EmissionFactorValues =
    DEFAULT_EMISSION_FACTORS,
): EmissionRow[] | null {
  if (yearRow === null) {
    return null
  }

  let totalGenerationTwh = 0

  for (const sourceKey of STACK_ORDER) {
    totalGenerationTwh +=
      yearRow.values[sourceKey]
  }

  if (totalGenerationTwh === 0) {
    return null
  }

  const emissionsPerSource =
    {} as EmissionFactorValues

  let totalEmissionsMt = 0

  for (const sourceKey of STACK_ORDER) {
    const generationTwh =
      yearRow.values[sourceKey]

    const factor =
      emissionFactors[sourceKey] ?? 0

    const emissionsMt =
      calculateEmissionsMt(
        generationTwh,
        factor,
      )

    emissionsPerSource[sourceKey] =
      emissionsMt

    totalEmissionsMt += emissionsMt
  }

  const rows: EmissionRow[] = []

  for (const sourceKey of STACK_ORDER) {
    const generationTwh =
      yearRow.values[sourceKey]

    const emissionsMt =
      emissionsPerSource[sourceKey]

    const generationShare =
      calculateShare(
        generationTwh,
        totalGenerationTwh,
      )

    const emissionShare =
      calculateShare(
        emissionsMt,
        totalEmissionsMt,
      )

    const deviationPp =
      (emissionShare - generationShare) * 100

    rows.push({
      sourceKey,
      generationTwh,
      generationShare,
      emissionsMt,
      emissionShare,
      deviationPp,
    })
  }

  return rows
}

/**
 * Berechnen der gesamten Abweichungsdaten eines Jahres
 *
 * Die Summen werden aus den bereits berechneten
 * Zeilen zusammengesetzt
 *
 * @param yearRow Erzeugungsdaten eines Jahres
 * @param emissionFactors Emissionsfaktoren der Energieträger
 * @returns Berechnete Jahresdaten oder null
 */
export function calculateDeviationYear(
  yearRow: MixYearRow | null,
  emissionFactors: EmissionFactorValues =
    DEFAULT_EMISSION_FACTORS,
): DeviationYear | null {
  if (yearRow === null) {
    return null
  }

  const rows =
    calculateEmissionRows(
      yearRow,
      emissionFactors,
    )

  if (rows === null) {
    return null
  }

  let totalGenerationTwh = 0
  let totalEmissionsMt = 0

  for (const row of rows) {
    totalGenerationTwh +=
      row.generationTwh

    totalEmissionsMt +=
      row.emissionsMt
  }

  return {
    year: yearRow.year,
    rows,
    totalGenerationTwh,
    totalEmissionsMt,
  }
}