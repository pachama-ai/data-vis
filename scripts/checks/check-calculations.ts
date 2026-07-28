/**
 * Führt Kontrollrechnungen für 2024 durch.
 *
 * @author Selina Schneider
 */

import fs from 'node:fs'

import type {
  MonthlyMixPoint,
  VisualizationData,
  YearlyMixPoint,
} from '../../types/visualization-data'

const RENEWABLE_SOURCES = [
  'hydro',
  'biomass',
  'wind_offshore',
  'wind_onshore',
  'pv',
  'other_renewables',
] as const

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/** Lädt die fertige visualization-data.json von der Festplatte. */
function loadData(): VisualizationData {
  const content = fs.readFileSync(
    'public/data/visualization-data.json',
    'utf-8',
  )

  return JSON.parse(content) as VisualizationData
}

/**
 * Sucht den Jahreseintrag für 2024 heraus, weil die folgenden Checks
 * sich alle auf dieses eine Jahr beziehen.
 *
 * @param yearlyData Alle Jahresdaten
 * @returns Jahreseintrag für 2024
 * @throws Fehler, wenn kein Eintrag für 2024 vorhanden ist
 */
function findYear2024(
  yearlyData: YearlyMixPoint[],
): YearlyMixPoint {
  const entry = yearlyData.find(function (yearEntry) {
    return yearEntry.year === 2024
  })

  if (!entry) {
    throw new Error('Jahresdaten für 2024 fehlen.')
  }

  return entry
}

/**
 * Vergleicht die Summe der Monatswerte 2024 mit dem gespeicherten
 * Jahreswert. Eine Abweichung bis 1 MWh toleriere ich als normale
 * Rundungsdifferenz aus der Aggregation.
 *
 * @param monthlyData Monatsdaten aus visualization-data.json
 * @param yearEntry Jahreseintrag für 2024
 * @throws Fehler, wenn die Differenz zu groß ist
 */
function checkYearlyTotal(
  monthlyData: MonthlyMixPoint[],
  yearEntry: YearlyMixPoint,
): void {
  let monthlyTotal = 0

  for (const monthEntry of monthlyData) {
    if (monthEntry.month.startsWith('2024-')) {
      monthlyTotal += monthEntry.totalGenerationMwh
    }
  }

  const difference = Math.abs(
    monthlyTotal - yearEntry.totalGenerationMwh,
  )

  console.log('\nJahressumme 2024')
  console.log(
    '  Monatswerte: '
      + roundToTwoDecimals(monthlyTotal / 1_000_000)
      + ' TWh',
  )
  console.log(
    '  Jahreswert:  '
      + roundToTwoDecimals(
        yearEntry.totalGenerationMwh / 1_000_000,
      )
      + ' TWh',
  )

  if (difference > 1) {
    throw new Error('Monats- und Jahressumme stimmen nicht überein.')
  }

  console.log('  Ergebnis: OK')
}

/**
 * Rechnet den Erneuerbarenanteil 2024 aus den einzelnen
 * Energieträgerwerten selbst nach und vergleicht ihn mit dem in
 * yearlyMix gespeicherten Wert.
 *
 * @param yearEntry Jahreseintrag für 2024
 * @throws Fehler, wenn die Differenz größer als 0,1 Prozentpunkte ist
 */
function checkRenewableShare(
  yearEntry: YearlyMixPoint,
): void {
  let renewableGeneration = 0

  for (const sourceKey of RENEWABLE_SOURCES) {
    renewableGeneration += yearEntry.sources[sourceKey]
  }

  const calculatedShare =
    renewableGeneration
    / yearEntry.totalGenerationMwh
    * 100

  const difference = Math.abs(
    calculatedShare - yearEntry.renewableSharePercent,
  )

  console.log('\nErneuerbarenanteil 2024')
  console.log(
    '  Gespeichert: '
      + roundToTwoDecimals(yearEntry.renewableSharePercent)
      + ' %',
  )
  console.log(
    '  Berechnet:   '
      + roundToTwoDecimals(calculatedShare)
      + ' %',
  )

  if (difference > 0.1) {
    throw new Error('Der Erneuerbarenanteil stimmt nicht überein.')
  }

  console.log('  Ergebnis: OK')
}

/**
 * Führt alle Kontrollrechnungen nacheinander aus. Bricht die Prüfung
 * für Kernenergie 2024 hier ab, weil sie nur aus einer
 * einzigen Bedingung besteht und daher keine eigene Funktion braucht.
 */
function main(): void {
  console.log('=== Kontrollrechnung ===')

  const data = loadData()
  const yearEntry = findYear2024(data.yearlyMix)

  checkYearlyTotal(data.monthlyMix, yearEntry)
  checkRenewableShare(yearEntry)

  if (yearEntry.sources.nuclear !== 0) {
    throw new Error('Kernenergie ist 2024 nicht 0.')
  }

  console.log('\nKernenergie 2024: OK')
  console.log('\n=== Kontrollrechnung erfolgreich ===')
}

try {
  main()
} catch (caughtError) {
  let message = String(caughtError)

  if (caughtError instanceof Error) {
    message = caughtError.message
  }

  console.error('\nFehler:', message)
  process.exit(1)
}