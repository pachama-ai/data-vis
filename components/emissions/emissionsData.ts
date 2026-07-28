/**
 * components/emissions/emissionsData.ts – Reine Berechnungsfunktionen für CO₂-Emissionen.
 *
 * Enthält kein Vue und keinen eigenen State.
 * Alle Berechnungsfunktionen sind rein und geben bei fehlenden/ungültigen
 * Eingaben null zurück. Einzige Ausnahme ist loadEmissionFactorsFile, die
 * die Emissionsfaktoren per fetch lädt.
 *
 * Die Emissionsfaktoren (g CO₂/kWh) stammen aus public/data/emission-factors.json
 * (UBA, Climate Change 16/2026). Sie bilden die direkten CO₂-Emissionen ab
 * (ohne Vorketten). Erneuerbare und Kernenergie haben in dieser Bilanz 0 g/kWh.
 */

import { STACK_ORDER } from '~/components/generation/mixConfig'

import type { EmissionRow, DeviationYear, EmissionFactorsFile, EmissionFactorValues } from '~/types/emissions'
import type { MixYearRow } from '~/composables/useMixData'

// Konstanten

/**
 * Lädt die Emissionsfaktoren aus der JSON-Datei.
 * Verwendet die globale fetch-Funktion (nicht Nuxts $fetch).
 */
export async function loadEmissionFactorsFile(): Promise<EmissionFactorsFile> {
  const response = await fetch('/data/emission-factors.json')

  if (!response.ok) {
    throw new Error(
      `Fehler beim Laden der Emissionsfaktoren: ${response.status} ${response.statusText}`,
    )
  }

  const data: EmissionFactorsFile = await response.json()

  return data
}

/**
 * Standard-Emissionsfaktoren in g CO₂/kWh (direkte Emissionen).
 * Werte aus UBA Climate Change 16/2026.
 * Werden verwendet, falls emission-factors.json nicht geladen werden kann.
 */
export const DEFAULT_EMISSION_FACTORS: EmissionFactorValues = {
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

// Hilfsfunktionen

/**
 * Berechnet die CO₂-Emissionen eines Jahres für einen einzelnen Energieträger.
 *
 * @param generationTwh – Erzeugung in TWh
 * @param factorGPerKwh – Emissionsfaktor in g CO₂/kWh
 * @returns Emissionen in Millionen Tonnen CO₂ (Mt)
 *
 * Umrechnung: 1 TWh = 10⁹ kWh
 *  Emission (g) = generation_kWh × factor_g/kWh
 *  Emission (Mt) = g ÷ 10¹² = TWh × 10⁹ × factor ÷ 10¹² = TWh × factor ÷ 10³
 *  Kurz: TWh × g/kWh ÷ 1000 = Mt
 */
export function calculateEmissionsMt(
  generationTwh: number,
  factorGPerKwh: number,
): number {
  if (generationTwh <= 0 || factorGPerKwh <= 0) {
    return 0
  }

  return (generationTwh * factorGPerKwh) / 1000
}

/**
 * Berechnet die CO₂-Emissionsintensität eines Energieträgers.
 *
 * @param emissionsMt – Emissionen in Mt CO₂
 * @param generationTwh – Erzeugung in TWh
 * @returns Emissionsintensität in g CO₂/kWh oder 0 bei fehlender Erzeugung
 *
 * Umrechnung: emissions_g / generation_kWh
 *  = (emissionsMt × 10¹²) / (generationTwh × 10⁹)
 *  = emissionsMt × 10³ / generationTwh
 */
export function calculateEmissionIntensity(
  emissionsMt: number,
  generationTwh: number,
): number {
  if (generationTwh <= 0) {
    return 0
  }

  return (emissionsMt * 1000) / generationTwh
}

/**
 * Berechnet einen Anteil sicher ohne Division durch null.
 */
function calculateShare(value: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return value / total
}

// Hauptfunktionen

/**
 * Berechnet für ein einzelnes Jahr die Emissionszeilen (EmissionRow) aus
 * den Jahres-Erzeugungswerten und Emissionsfaktoren.
 *
 * @param yearRow – Erzeugungsdaten eines Jahres (MixYearRow)
 * @param emissionFactors – Emissionsfaktoren in g CO₂/kWh
 * @returns Berechnete EmissionRows oder null, wenn yearRow ungültig ist
 */
export function calculateEmissionRows(
  yearRow: MixYearRow | null,
  emissionFactors: EmissionFactorValues = DEFAULT_EMISSION_FACTORS,
): EmissionRow[] | null {
  if (!yearRow) {
    return null
  }

  // 1. Erzeugungssumme berechnen
  let totalGenerationTwh = 0

  for (const sourceKey of STACK_ORDER) {
    totalGenerationTwh += yearRow.values[sourceKey]
  }

  if (totalGenerationTwh === 0) {
    return null
  }

  // 2. Emissionen pro Quelle berechnen und Gesamtemissionen ermitteln
  const emissionsPerSource = {} as EmissionFactorValues
  let totalEmissionsMt = 0

  for (const sourceKey of STACK_ORDER) {
    const generationTwh = yearRow.values[sourceKey]
    const factor = emissionFactors[sourceKey] ?? 0
    const emissionsMt = calculateEmissionsMt(generationTwh, factor)

    emissionsPerSource[sourceKey] = emissionsMt
    totalEmissionsMt += emissionsMt
  }

  // 3. Ergebniszeilen bauen
  const rows: EmissionRow[] = []

  for (const sourceKey of STACK_ORDER) {
    const generationTwh = yearRow.values[sourceKey]
    const emissionsMt = emissionsPerSource[sourceKey]

    rows.push({
      sourceKey,
      generationTwh,
      generationShare: calculateShare(generationTwh, totalGenerationTwh),
      emissionsMt,
      emissionShare: calculateShare(emissionsMt, totalEmissionsMt),
      deviationPp:
        (calculateShare(emissionsMt, totalEmissionsMt) -
          calculateShare(generationTwh, totalGenerationTwh)) *
        100,
    })
  }

  return rows
}

/**
 * Berechnet ein vollständiges DeviationYear-Objekt.
 *
 * @param yearRow – Erzeugungsdaten eines Jahres
 * @param emissionFactors – Emissionsfaktoren in g CO₂/kWh
 * @returns DeviationYear oder null bei ungültigen Eingaben
 */
export function calculateDeviationYear(
  yearRow: MixYearRow | null,
  emissionFactors: EmissionFactorValues = DEFAULT_EMISSION_FACTORS,
): DeviationYear | null {
  if (!yearRow) {
    return null
  }

  const rows = calculateEmissionRows(yearRow, emissionFactors)

  if (!rows) {
    return null
  }

  // Erzeugungs- und Emissionssummen aus den Zeilen ermitteln
  let totalGenerationTwh = 0
  let totalEmissionsMt = 0

  for (const row of rows) {
    totalGenerationTwh += row.generationTwh
    totalEmissionsMt += row.emissionsMt
  }

  return {
    year: yearRow.year,
    rows,
    totalGenerationTwh,
    totalEmissionsMt,
  }
}
