/**
 * scripts/checks/check-calculations.ts
 *
 * Unabhängige Kontrollrechnung für die wichtigsten Werte des Projekts.
 *
 * Das Skript importiert NICHT die produktiven Berechnungsfunktionen,
 * sondern berechnet alle Werte eigenständig neu.
 * Dadurch werden gemeinsame Fehler in Produktivcode und Tests erkannt.
 *
 * Aufruf mit: bun run scripts/checks/check-calculations.ts
 *
 * Erwartet: public/data/visualization-data.json (wird von build-data.ts erzeugt)
 *           public/data/emission-factors.json (Emissionsfaktoren)
 */

import * as fs from 'node:fs'

// =========================================================================
// Typen (eigene, minimale Version – nicht aus dem Projekt importiert)
// =========================================================================

interface AuditMonth {
  month: string
  /** Erzeugung in MWh je Energieträger */
  sources: Record<string, number>
  totalGenerationMwh: number
}

interface AuditEmissionFactor {
  source: string
  factor: number
  unit: string
  reference: string
}

interface AuditYearlyMix {
  year: number
  /** Erzeugung in MWh */
  totalGenerationMwh: number
  /** g CO₂/kWh */
  co2GramsPerKwh: number
  /** Prozent 0–100 */
  renewableShare: number
  sources: Record<string, number>
}

// =========================================================================
// Konstanten (eigene Liste, unabhängig von mixConfig)
// =========================================================================

var TEN_SOURCES = [
  'hydro', 'biomass', 'wind_offshore', 'wind_onshore', 'pv',
  'nuclear', 'gas', 'other_fossil', 'hardcoal', 'lignite',
]

var RENEWABLE_SOURCES = ['hydro', 'biomass', 'wind_offshore', 'wind_onshore', 'pv']

var FOSSIL_SOURCES = ['gas', 'hardcoal', 'lignite', 'other_fossil']

// =========================================================================
// Hilfsfunktionen
// =========================================================================

/**
 * Rundet auf zwei Dezimalstellen.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Berechnet den Anteil in Prozent.
 *
 * @param value Teilwert.
 * @param total Gesamtwert.
 * @returns Prozent oder 0 bei Division durch null.
 */
function getShare(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}

/**
 * Erzeugung von MWh in TWh umrechnen.
 */
function mwhToTwh(mwh: number): number {
  return mwh / 1_000_000
}

// =========================================================================
// Hauptprüfung
// =========================================================================

var dataPath = 'public/data/visualization-data.json'
var factorsPath = 'public/data/emission-factors.json'

if (!fs.existsSync(dataPath)) {
  console.error('Datendatei nicht gefunden:', dataPath)
  process.exit(1)
}

if (!fs.existsSync(factorsPath)) {
  console.error('Emissionsfaktoren nicht gefunden:', factorsPath)
  process.exit(1)
}

var rawFactors = JSON.parse(
  fs.readFileSync(factorsPath, 'utf-8'),
)
var rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
var monthlyMix = rawData.monthlyMix
var yearlyMix = rawData.yearlyMix

console.log('=== Unabhängige Kontrollrechnung ===\n')

// -----------------------------------------------------------------------
// 1. Datenvollständigkeit prüfen
// -----------------------------------------------------------------------

console.log('--- 1. Datenvollständigkeit ---')

// Jahre 2015–2024
var expectedYears = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
var foundYears: number[] = []

for (var entry of monthlyMix) {
  var year = Number(entry.month.slice(0, 4))
  if (!foundYears.includes(year)) foundYears.push(year)
}

for (var y of expectedYears) {
  var status = foundYears.includes(y) ? 'OK' : 'FEHLT'
  var monthsInYear = monthlyMix.filter(function (m) { return m.month.startsWith(String(y)) }).length
  if (status === 'OK' && monthsInYear !== 12) {
    status = 'NUR ' + monthsInYear + ' Monate'
  }
  console.log('  Jahr ' + y + ': ' + status + ' (' + monthsInYear + ' Monate)')
}

// -----------------------------------------------------------------------
// 2. Jahressummen prüfen: Summe der Monatswerte vs yearlyMix
// -----------------------------------------------------------------------

console.log('\n--- 2. Jahressummen (Monatssumme vs yearlyMix) ---')

for (var year of expectedYears) {
  var yearMonths = monthlyMix.filter(function (m) { return m.month.startsWith(String(year)) })
  var yearData = yearlyMix.find(function (y) { return y.year === year })

  if (!yearData) {
    console.log('  ' + year + ': yearlyMix fehlt')
    continue
  }

  // Gesamterzeugung: verwende totalGenerationMwh aus den Daten
  var monthlyTotal = 0
  for (var month of yearMonths) {
    monthlyTotal += month.totalGenerationMwh
  }

  var yearlyTotal = yearData.totalGenerationMwh
  var diff = Math.abs(monthlyTotal - yearlyTotal)
  var status = diff < 1 ? 'OK' : 'ABWEICHUNG'

  console.log(
    '  ' + year +
    ': Monatssumme=' + round2(mwhToTwh(monthlyTotal)) + ' TWh' +
    ' yearlyMix=' + round2(mwhToTwh(yearlyTotal)) + ' TWh' +
    ' Diff=' + round2(mwhToTwh(diff)) + ' TWh ' + status,
  )
}

// -----------------------------------------------------------------------
// 3. Erzeugungsanteile pro Energieträger prüfen (2015 und 2024)
// -----------------------------------------------------------------------

console.log('\n--- 3. Erzeugungsanteile 2015 und 2024 ---')

for (var year of [2015, 2024]) {
  var yearData = yearlyMix.find(function (y) { return y.year === year })
  if (!yearData) continue

  var total = yearData.totalGenerationMwh

  console.log('\n  ' + year + ' (Gesamt: ' + round2(mwhToTwh(total)) + ' TWh):')

  for (var source of TEN_SOURCES) {
    var value = yearData.sources[source] ?? 0
    var share = getShare(value, total)
    console.log(
      '    ' + source.padEnd(16) +
      ' ' + round2(mwhToTwh(value)).toString().padStart(8) + ' TWh' +
      ' ' + round2(share).toString().padStart(6) + ' %',
    )
  }

  // Erneuerbare gesamt
  var renewableTotal = 0
  for (var src of RENEWABLE_SOURCES) {
    renewableTotal += yearData.sources[src] ?? 0
  }
  var renewableShare = getShare(renewableTotal, total)
  console.log(
    '    ' + 'Erneuerbar gesamt'.padEnd(16) +
    ' ' + round2(mwhToTwh(renewableTotal)).toString().padStart(8) + ' TWh' +
    ' ' + round2(renewableShare).toString().padStart(6) + ' %',
  )

  // Summe aller 10 Anteile
  var shareSum = 0
  for (var s of TEN_SOURCES) {
    shareSum += getShare(yearData.sources[s] ?? 0, total)
  }
  console.log('    Summe der 10 Anteile: ' + round2(shareSum) + ' %')
}

// -----------------------------------------------------------------------
// 4. Emissionen pro Energieträger prüfen
// -----------------------------------------------------------------------

console.log('\n--- 4. Emissionen pro Energieträger ---')

// Emissionsfaktoren als einfaches Objekt
var factorMap: Record<string, number> = {}

var rawFactors = JSON.parse(fs.readFileSync(factorsPath, 'utf-8'))
var factorData = rawFactors.factors || {}

for (var source of TEN_SOURCES) {
  factorMap[source] = factorData[source] ?? 0
}

console.log('  Verwendete Emissionsfaktoren (g CO₂/kWh):')
for (var source of TEN_SOURCES) {
  var factor = factorMap[source] ?? 0
  console.log('    ' + source.padEnd(16) + ' ' + factor + ' g/kWh')
}

// Emissionen berechnen: Mt CO₂ = TWh × g/kWh / 1000
console.log('\n  Berechnete Emissionen 2024 (Mt CO₂):')
var year2024 = yearlyMix.find(function (y) { return y.year === 2024 })
if (year2024) {
  var totalEmissionsMt = 0
  for (var source of TEN_SOURCES) {
    var genTwh = mwhToTwh(year2024.sources[source] ?? 0)
    var factor = factorMap[source] ?? 0
    var emissionsMt = (genTwh * factor) / 1000
    totalEmissionsMt += emissionsMt
    console.log(
      '    ' + source.padEnd(16) +
      ' ' + round2(genTwh).toString().padStart(8) + ' TWh × ' +
      factor.toString().padStart(4) + ' g/kWh = ' +
      round2(emissionsMt).toString().padStart(8) + ' Mt CO₂',
    )
  }
  console.log('    ' + 'Summe'.padEnd(16) + ' ' + round2(totalEmissionsMt) + ' Mt CO₂')

  // Strommix-Emissionsfaktor: g/kWh = Mt CO₂ / TWh * 1000
  var totalGenTwh = mwhToTwh(year2024.totalGenerationMwh)
  var mixFactor = (totalEmissionsMt / totalGenTwh) * 1000
  console.log('    Strommix-Emissionsfaktor: ' + round2(mixFactor) + ' g CO₂/kWh')
}

// -----------------------------------------------------------------------
// 5. Emissionsanteile und Abweichungen prüfen
// -----------------------------------------------------------------------

console.log('\n--- 5. Emissionsanteile und Abweichungen 2024 ---')

if (year2024) {
  var totalGen = year2024.totalGenerationMwh

  // Emissionen für alle 10 Quellen berechnen
  var sourceEmissions: Record<string, number> = {}
  var totalEmissions = 0
  for (var source of TEN_SOURCES) {
    var genTwh = mwhToTwh(year2024.sources[source] ?? 0)
    var factor = factorMap[source] ?? 0
    var emMt = (genTwh * factor) / 1000
    sourceEmissions[source] = emMt
    totalEmissions += emMt
  }

  for (var source of TEN_SOURCES) {
    var genShare = getShare(year2024.sources[source] ?? 0, totalGen)
    var emShare = getShare(sourceEmissions[source], totalEmissions)
    var deviation = emShare - genShare
    console.log(
      '    ' + source.padEnd(16) +
      ' EA=' + round2(genShare).toString().padStart(6) + ' %' +
      ' EM=' + round2(emShare).toString().padStart(6) + ' %' +
      ' Abw=' + round2(deviation).toString().padStart(7) + ' pp',
    )
  }

  // Summe der Emissionsanteile
  var emShareSum = 0
  for (var s of TEN_SOURCES) {
    emShareSum += getShare(sourceEmissions[s], totalEmissions)
  }
  console.log('    Summe Emissionsanteile: ' + round2(emShareSum) + ' %')
}

// -----------------------------------------------------------------------
// 6. Plausibilitätsprüfung: bekannte Entwicklungen
// -----------------------------------------------------------------------

console.log('\n--- 6. Plausibilitätsprüfung ---')

for (var year of expectedYears) {
  var yearData = yearlyMix.find(function (y) { return y.year === year })
  if (!yearData) continue

  var nuclearGen = yearData.sources['nuclear'] ?? 0
  var co2Intensity = yearData.co2GramsPerKwh
  var renewableShare = yearData.renewableSharePercent ?? 0

  console.log(
    '  ' + year +
    ' Kernenergie=' + round2(mwhToTwh(nuclearGen)) + ' TWh' +
    ' CO₂=' + round2(co2Intensity) + ' g/kWh' +
    ' EE=' + round2(renewableShare) + ' %',
  )
}

// Kernenergie: 2024 muss 0 sein
var nuclear2024 = yearlyMix.find(function (y) { return y.year === 2024 })
if (nuclear2024) {
  var nuke2024 = nuclear2024.sources['nuclear'] ?? 0
  console.log('\n  Kernenergie 2024: ' + nuke2024 + ' MWh ' + (nuke2024 === 0 ? '(OK – abgeschaltet)' : '(FEHLER – sollte 0 sein)'))
}

console.log('\n=== Kontrollrechnung abgeschlossen ===')
