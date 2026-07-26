/**
 * Kontrollrechnung für die wichtigsten Werte des Projekts.
 *
 * Aufruf: bun run scripts/checks/check-calculations.ts
 *
 * Erwartet: public/data/visualization-data.json (aus build-data.ts)
 *           public/data/emission-factors.json (Emissionsfaktoren)
 *
 * @author Selina Schneider
 */

import * as fs from 'node:fs'

/** Eigene Liste – unabhängig von mixConfig. */
const SOURCES = [
  'hydro', 'biomass', 'wind_offshore', 'wind_onshore', 'pv',
  'other_renewables', 'nuclear', 'gas', 'other_fossil', 'hardcoal', 'lignite',
]

const RENEWABLE_SOURCES = [
  'hydro', 'biomass', 'wind_offshore', 'wind_onshore', 'pv', 'other_renewables',
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function loadInput() {
  const rawData = JSON.parse(fs.readFileSync('public/data/visualization-data.json', 'utf-8'))
  const rawFactors = JSON.parse(fs.readFileSync('public/data/emission-factors.json', 'utf-8'))
  const factorData = rawFactors.factors || {}
  const factorMap: Record<string, number> = {}
  for (const source of SOURCES) { factorMap[source] = factorData[source] ?? 0 }
  return { monthlyMix: rawData.monthlyMix, yearlyMix: rawData.yearlyMix, factorMap }
}

function find2024(data: any[]): any {
  const entry = data.find(function (e: any) { return e.year === 2024 })
  if (!entry) { console.error('2024 nicht gefunden'); process.exit(1) }
  return entry
}

function checkYearlyTotal(monthly: any[], yearly: any[]): void {
  console.log('\nJahressumme 2024')
  let monthlySum = 0
  for (const month of monthly) {
    if (month.month.startsWith('2024')) { monthlySum += month.totalGenerationMwh }
  }
  const yearEntry = find2024(yearly)
  const diff = Math.abs(monthlySum - yearEntry.totalGenerationMwh) / 1_000_000
  console.log('  Monatswerte: ' + round2(monthlySum / 1_000_000) + ' TWh')
  console.log('  Jahreswert:  ' + round2(yearEntry.totalGenerationMwh / 1_000_000) + ' TWh')
  console.log('  Abweichung:  ' + round2(diff) + ' TWh')
  if (diff > 0.000001) { console.error('  Ergebnis: FEHLER'); process.exit(1) }
  console.log('  Ergebnis: OK')
}

function checkRenewableShare2024(yearly: any[]): void {
  console.log('\nErneuerbarenanteil 2024')
  const yearEntry = find2024(yearly)
  let renewableSum = 0
  for (const source of RENEWABLE_SOURCES) { renewableSum += yearEntry.sources[source] ?? 0 }
  const calculated = renewableSum / yearEntry.totalGenerationMwh * 100
  const diff = Math.abs(calculated - yearEntry.renewableSharePercent)
  console.log('  Gespeichert: ' + round2(yearEntry.renewableSharePercent) + ' %')
  console.log('  Neu berechnet: ' + round2(calculated) + ' %')
  console.log('  Abweichung: ' + round2(diff) + ' Prozentpunkte')
  if (diff > 0.1) { console.error('  Ergebnis: FEHLER'); process.exit(1) }
  console.log('  Ergebnis: OK')
}

/**
 * CO₂-Intensität 2024. Herleitung:
 * Erzeugung in TWh (= 10^9 kWh), Faktor in g/kWh.
 * Mt CO₂ = TWh × g/kWh / 1000. Mix-Faktor = Mt / TWh × 1000.
 */
function checkCo2Intensity2024(yearly: any[], factorMap: Record<string, number>): void {
  console.log('\nCO\u2082-Intensit\u00e4t 2024')
  const yearEntry = find2024(yearly)
  let totalEmissionsMt = 0
  for (const source of SOURCES) {
    const genTwh = (yearEntry.sources[source] ?? 0) / 1_000_000
    totalEmissionsMt += genTwh * (factorMap[source] ?? 0) / 1000
  }
  const totalGenTwh = yearEntry.totalGenerationMwh / 1_000_000
  const calculated = totalEmissionsMt / totalGenTwh * 1000
  const diff = Math.abs(calculated - yearEntry.co2GramsPerKwh)
  console.log('  Gespeichert:   ' + round2(yearEntry.co2GramsPerKwh) + ' g CO\u2082/kWh')
  console.log('  Neu berechnet: ' + round2(calculated) + ' g CO\u2082/kWh')
  console.log('  Abweichung: ' + round2(diff) + ' g CO\u2082/kWh')
  if (diff > 25.0) { console.error('  Ergebnis: FEHLER'); process.exit(1) }
  console.log('  Ergebnis: OK')
}

function main(): void {
  console.log('=== Kontrollrechnung ===')
  const data = loadInput()
  checkYearlyTotal(data.monthlyMix, data.yearlyMix)
  checkRenewableShare2024(data.yearlyMix)
  checkCo2Intensity2024(data.yearlyMix, data.factorMap)
  const year2024 = find2024(data.yearlyMix)
  if (year2024.sources.nuclear !== 0) {
    console.error('Kernenergie 2024: ' + year2024.sources.nuclear + ' MWh (erwartet 0)')
    process.exit(1)
  }
  console.log('\n=== Kontrollrechnung erfolgreich ===')
}

main()