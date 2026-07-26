/**
 * Prüft die erzeugte Datei visualization-data.json.
 *
 * Das Skript kontrolliert, ob die benötigten Datenbereiche
 * vorhanden sind und ob wichtige Werte gültig sind.
 *
 * Bei dieser Datei wurde viel mit KI gearbeitet. Die KI half
 * vor allem bei der Struktur der Prüfungen, bei TypeScript-Typen
 * und bei der Fehlerbehandlung. Die Prüfungen wurden anschließend
 * vereinfacht und an die Daten des Projekts angepasst.
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
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function checkSources(label: string, sources: EnergySourceValues): number {
  let sum = 0

  for (const key of SOURCE_KEYS) {
    const value = sources[key]

    if (!isValidNumber(value)) {
      errors.push(label + ': ' + key + ' ungültig (' + value + ')')
      continue
    }

    if (value < 0) {
      errors.push(label + ': ' + key + ' negativ (' + value + ')')
    }

    sum += value
  }

  return sum
}

function checkMonthlyData(data: MonthlyMixPoint[]): void {
  if (data.length === 0) {
    errors.push('monthlyMix ist leer')
    return
  }
  for (let index = 0; index < data.length; index++) {
    const entry = data[index]
    if (!entry) {
      continue
    }

    const label = 'monthlyMix ' + entry.month
    const sumCalculated = checkSources(label, entry.sources)

    if (!isValidNumber(entry.totalGenerationMwh) || entry.totalGenerationMwh <= 0) {
      errors.push(label + ': totalGenerationMwh ungültig (' + entry.totalGenerationMwh + ')')
    } else if (Math.abs(sumCalculated - entry.totalGenerationMwh) > 1.0) {
      errors.push(label + ': Quellensumme (' + sumCalculated.toFixed(2) + ') != totalGenerationMwh (' + entry.totalGenerationMwh.toFixed(2) + ')')
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(label + ': availableHourCount ungültig (' + entry.availableHourCount + ')')
    }
  }
}

function checkDailyData(data: ScatterDailyPoint[]): void {
  if (data.length === 0) {
    errors.push('scatterDaily ist leer')
    return
  }
  for (let index = 0; index < data.length; index++) {
    const entry = data[index]
    if (!entry) {
      continue
    }

    const label = 'scatterDaily ' + entry.date
    const share = entry.renewableSharePercent

    if (!isValidNumber(share)) {
      errors.push(label + ': renewableSharePercent ungültig')
    } else if (share < 0 || share > 100) {
      errors.push(label + ': renewableSharePercent nicht 0–100')
    }

    const co2 = entry.co2GramsPerKwh

    if (!isValidNumber(co2)) {
      errors.push(label + ': co2GramsPerKwh ungültig')
    } else if (co2 < 0 || co2 > 1200) {
      errors.push(label + ': co2GramsPerKwh nicht 0–1200')
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(label + ': availableHourCount ungültig (' + entry.availableHourCount + ')')
    }
  }
}

function checkYearlyData(data: YearlyMixPoint[]): void {
  if (data.length === 0) {
    errors.push('yearlyMix ist leer')
    return
  }
  for (let index = 0; index < data.length; index++) {
    const entry = data[index]
    if (!entry) {
      continue
    }

    const label = 'yearlyMix ' + entry.year

    if (!isValidNumber(entry.year) || entry.year < 2015 || entry.year > 2024) {
      errors.push(label + ': year ungültig (' + entry.year + ')')
    }

    const sumCalculated = checkSources(label, entry.sources)

    if (!isValidNumber(entry.totalGenerationMwh) || entry.totalGenerationMwh <= 0) {
      errors.push(label + ': totalGenerationMwh ungültig (' + entry.totalGenerationMwh + ')')
    } else if (Math.abs(sumCalculated - entry.totalGenerationMwh) > 1.0) {
      errors.push(label + ': Quellensumme (' + sumCalculated.toFixed(2) + ') != totalGenerationMwh (' + entry.totalGenerationMwh.toFixed(2) + ')')
    }

    const share = entry.renewableSharePercent

    if (!isValidNumber(share)) {
      errors.push(label + ': renewableSharePercent ungültig')
    } else if (share < 0 || share > 100) {
      errors.push(label + ': renewableSharePercent nicht 0–100')
    }

    const co2 = entry.co2GramsPerKwh

    if (!isValidNumber(co2)) {
      errors.push(label + ': co2GramsPerKwh ungültig')
    } else if (co2 < 0 || co2 > 1200) {
      errors.push(label + ': co2GramsPerKwh nicht 0–1200')
    }

    if (!isValidNumber(entry.availableHourCount) || entry.availableHourCount <= 0) {
      errors.push(label + ': availableHourCount ungültig (' + entry.availableHourCount + ')')
    }
  }
}

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
      errors.push(fieldName + ' fehlt')
    } else if (!Array.isArray(data[fieldName])) {
      errors.push(fieldName + ' ist kein Array')
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
    throw new Error(errors.length + ' Fehler gefunden')
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
  for (let index = 0; index < errors.length; index++) {
    console.log('  - ' + errors[index])
  }
}

main().catch(function (caughtError: unknown) {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
  console.error('Fehler:', message)
  process.exit(1)
})