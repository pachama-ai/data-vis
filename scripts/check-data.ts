/**
 * Prüft die erzeugte Datei visualization-data.json.
 *
 * Das Skript kontrolliert, ob die benötigten Datenbereiche
 * vorhanden sind und ob wichtige Werte gültig sind. Die Prüfungen
 * sind bewusst einfach gehalten: Zahl gültig? Wert im plausiblen
 * Bereich? Summe der Energieträger passt zur Gesamterzeugung?
 *
 * Aufruf: bun run scripts/check-data.ts
 *
 * @author Selina Schneider
 */

declare var Bun: { file(path: string): { json(): Promise<unknown> } }
import type { VisualizationData, EnergySourceValues, MonthlyMixPoint, ScatterDailyPoint, YearlyMixPoint } from '../types/visualization-data'
const SOURCE_KEYS: (keyof EnergySourceValues)[] = [
  'biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'other_renewables', 'lignite', 'hardcoal', 'gas', 'nuclear',
  'other_fossil', 'pumped_storage',
]
const errors: string[] = []

/** Prüft, ob ein Wert eine echte, endliche Zahl ist (kein NaN/Infinity). */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Prüft die 12 Energieträgerwerte eines Eintrags auf Gültigkeit und
 * gibt ihre Summe zurück, damit der Aufrufer sie mit dem gespeicherten
 * Gesamtwert vergleichen kann.
 *
 * @param label Bezeichner für die Fehlermeldung (z. B. Monat oder Jahr)
 * @param sources Erzeugungswerte der Energieträger
 * @returns Summe aller (gültigen) Energieträgerwerte
 */
function checkSources(label: string, sources: EnergySourceValues): number {
  let sum = 0

  for (const key of SOURCE_KEYS) {
    const value = sources[key]

    if (!isValidNumber(value)) {
      errors.push(`${label}: ${key} ungültig (${value})`)
      continue
    }

    sum += value
  }

  return sum
}

/**
 * Prüft die Monatsdaten. Die Quellensumme darf höchstens 1 MWh von
 * totalGenerationMwh abweichen - kleine Rundungsdifferenzen aus der
 * Aggregation toleriere ich, größere Abweichungen wären ein Zeichen
 * für einen Fehler im Build-Skript.
 *
 * @param data Monatsdaten aus visualization-data.json
 */
function checkMonthlyData(data: MonthlyMixPoint[]): void {
  if (data.length === 0) {
    errors.push('monthlyMix ist leer')
    return
  }
  for (const entry of data) {
    const label = `monthlyMix ${entry.month}`
    const sumCalculated = checkSources(label, entry.sources)

    if (!isValidNumber(entry.totalGenerationMwh) || entry.totalGenerationMwh <= 0) {
      errors.push(`${label}: totalGenerationMwh ungültig (${entry.totalGenerationMwh})`)
    } else if (Math.abs(sumCalculated - entry.totalGenerationMwh) > 1.0) {
      errors.push(`${label}: Quellensumme (${sumCalculated.toFixed(2)}) != totalGenerationMwh (${entry.totalGenerationMwh.toFixed(2)})`)
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(`${label}: availableHourCount ungültig (${entry.availableHourCount})`)
    }
  }
}

/**
 * Prüft die Tagesdaten fürs Streudiagramm. Der CO₂-Wert darf laut
 * meiner Erfahrung mit den Emissionsfaktoren nicht über 1200 g/kWh
 * liegen - das ist großzügig genug für auch für seltene Extremtage.
 *
 * @param data Tagesdaten aus visualization-data.json
 */
function checkDailyData(data: ScatterDailyPoint[]): void {
  if (data.length === 0) {
    errors.push('scatterDaily ist leer')
    return
  }
  for (const entry of data) {
    const label = `scatterDaily ${entry.date}`
    const share = entry.renewableSharePercent

    if (!isValidNumber(share)) {
      errors.push(`${label}: renewableSharePercent ungültig`)
    } else if (share < 0 || share > 100) {
      errors.push(`${label}: renewableSharePercent nicht 0–100`)
    }

    const co2 = entry.co2GramsPerKwh

    if (!isValidNumber(co2)) {
      errors.push(`${label}: co2GramsPerKwh ungültig`)
    } else if (co2 < 0 || co2 > 1200) {
      errors.push(`${label}: co2GramsPerKwh nicht 0–1200`)
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(`${label}: availableHourCount ungültig (${entry.availableHourCount})`)
    }
  }
}

/**
 * Prüft die Jahresdaten. Zusätzlich zu den Prüfungen aus
 * checkMonthlyData/checkDailyData wird hier noch geprüft, ob das
 * Jahr im erwarteten Bereich 2015-2024 liegt.
 *
 * @param data Jahresdaten aus visualization-data.json
 */
function checkYearlyData(data: YearlyMixPoint[]): void {
  if (data.length === 0) {
    errors.push('yearlyMix ist leer')
    return
  }
  for (const entry of data) {
    const label = `yearlyMix ${entry.year}`

    if (!isValidNumber(entry.year) || entry.year < 2015 || entry.year > 2024) {
      errors.push(`${label}: year ungültig (${entry.year})`)
    }

    const sumCalculated = checkSources(label, entry.sources)

    if (!isValidNumber(entry.totalGenerationMwh) || entry.totalGenerationMwh <= 0) {
      errors.push(`${label}: totalGenerationMwh ungültig (${entry.totalGenerationMwh})`)
    } else if (Math.abs(sumCalculated - entry.totalGenerationMwh) > 1.0) {
      errors.push(`${label}: Quellensumme (${sumCalculated.toFixed(2)}) != totalGenerationMwh (${entry.totalGenerationMwh.toFixed(2)})`)
    }

    const share = entry.renewableSharePercent

    if (!isValidNumber(share)) {
      errors.push(`${label}: renewableSharePercent ungültig`)
    } else if (share < 0 || share > 100) {
      errors.push(`${label}: renewableSharePercent nicht 0–100`)
    }

    const co2 = entry.co2GramsPerKwh

    if (!isValidNumber(co2)) {
      errors.push(`${label}: co2GramsPerKwh ungültig`)
    } else if (co2 < 0 || co2 > 1200) {
      errors.push(`${label}: co2GramsPerKwh nicht 0–1200`)
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(`${label}: availableHourCount ungültig (${entry.availableHourCount})`)
    }
  }
}

/**
 * Läuft alle Prüfungen der Reihe nach durch und bricht mit Fehler ab,
 * sobald irgendwo ein Problem gefunden wurde.
 *
 * @throws Fehler, wenn die Grundstruktur fehlt oder Prüfungen fehlschlagen
 */
async function main(): Promise<void> {
  console.log('Lade visualization-data.json...')
  const raw: unknown = await Bun.file('public/data/visualization-data.json').json()

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('visualization-data.json ist kein Objekt')
  }

  const data = raw as Record<string, unknown>
  const dataFields = ['monthlyMix', 'scatterDaily', 'yearlyMix']

  for (const fieldName of dataFields) {
    if (!(fieldName in data)) {
      errors.push(`${fieldName} fehlt`)
    } else if (!Array.isArray(data[fieldName])) {
      errors.push(`${fieldName} ist kein Array`)
    }
  }

  if (errors.length > 0) {
    printErrors()
    throw new Error('Grundlegende Strukturfehler')
  }

  const typedData = raw as VisualizationData

  console.log('Validiere Monatsdaten...')
  checkMonthlyData(typedData.monthlyMix)

  console.log('Validiere Tageswerte...')
  checkDailyData(typedData.scatterDaily)

  console.log('Validiere Jahresdaten...')
  checkYearlyData(typedData.yearlyMix)

  printErrors()

  if (errors.length > 0) {
    throw new Error(`${errors.length} Fehler gefunden`)
  }

  console.log('Datenprüfung erfolgreich.')
}

function printErrors(): void {
  if (errors.length === 0) {
    return
  }

  console.log('')
  console.log('GEFUNDENE FEHLER')
  console.log('')
  for (const message of errors) {
    console.log(`  - ${message}`)
  }
}

main().catch(function (caughtError: unknown) {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
  console.error('Fehler:', message)
  process.exit(1)
})