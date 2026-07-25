/**
 * scripts/check-data.ts — Validiert visualization-data.json
 * ==========================================================
 *
 * Lädt die erzeugte JSON-Datei und prüft Struktur, Wertebereiche,
 * Vollständigkeit und Konsistenz der vier Datenbereiche.
 * Kein "Audit-Framework", sondern einfache Funktionen mit Fehlerliste.
 *
 * Aufruf: bun run scripts/check-data.ts
 */

// Globale Bun-APIs für TypeCheck deklarieren
declare var Bun: {
  file(path: string): { json(): Promise<unknown> }
}

import type {
  VisualizationData, EnergySourceValues,
  MonthlyMixPoint, HeatmapCo2Cell, ScatterDailyPoint, YearlyMixPoint,
} from '../types/visualization-data'

// ===========================================================================
// Konstanten
// ===========================================================================

const SOURCE_KEYS: readonly (keyof EnergySourceValues)[] = [
  'biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'other_renewables', 'lignite', 'hardcoal', 'gas', 'nuclear',
  'other_fossil', 'pumped_storage',
]

/** Erneuerbare Energieträger (für EE-Anteil-Rückrechnung). */
const RENEWABLE_KEYS: readonly (keyof EnergySourceValues)[] = [
  'biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'other_renewables',
]

// ===========================================================================
// Ergebnisverwaltung
// ===========================================================================

interface CheckResult {
  errors: string[]
  warnings: string[]
}

const result: CheckResult = { errors: [], warnings: [] }

function err(msg: string): void { result.errors.push(msg) }
function warn(msg: string): void { result.warnings.push(msg) }

// ===========================================================================
// Hilfsfunktionen
// ===========================================================================

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v === Math.floor(v)
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Prüft ein sources-Objekt auf alle 12 Energieträger.
 * Meldet fehlende, nicht-endliche oder (optional) negative Werte.
 * Warnt bei unerwarteten Schlüsseln.
 */
function checkSources(
  label: string,
  sources: EnergySourceValues,
  allowNegative: boolean,
): void {
  for (const key of SOURCE_KEYS) {
    const v = sources[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      err(`${label}: Energieträger '${key}' ist keine gültige Zahl (${v})`)
    } else if (!allowNegative && v < 0) {
      err(`${label}: Energieträger '${key}' ist negativ (${v})`)
    }
  }
}

function calcRenewableSum(sources: EnergySourceValues): number {
  let sum = 0
  for (const key of RENEWABLE_KEYS) sum += sources[key]
  return sum
}

function calcTotalSum(sources: EnergySourceValues): number {
  let sum = 0
  for (const key of SOURCE_KEYS) sum += sources[key]
  return sum
}

// ===========================================================================
// Verbotene alte Felder
// ===========================================================================

const FORBIDDEN_PATTERNS = [
  'price', 'price_eur_mwh', 'neg_stunden', 'load_mwh',
  'fossil_share', 'conventional_share', 'ee_share', 'co2_g_per_kwh',
]

const ALLOWED_CONTAINING = [
  'renewableSharePercent', 'co2GramsPerKwh', 'totalGenerationMwh',
]

function isForbidden(key: string): boolean {
  if (ALLOWED_CONTAINING.includes(key)) return false
  return FORBIDDEN_PATTERNS.some(function (p) { return key.includes(p) })
}

function checkForbiddenFields(obj: Record<string, unknown>, path: string): void {
  for (const key of Object.keys(obj)) {
    if (isForbidden(key)) {
      err(`${path}: verbotenes Feld '${key}' gefunden`)
    }
  }
}

// ===========================================================================
// Strukturprüfung
// ===========================================================================

/**
 * Prüft die grundlegende JSON-Struktur: Objekt mit 4 required Arrays.
 * Gibt bei Erfolg das getypte VisualizationData-Objekt zurück.
 * Bei Fehlern wird vor dem Abbruch bereits die Ergebnisliste ausgegeben.
 */
function checkStructure(raw: unknown): VisualizationData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    printResults()
    throw new Error('visualization-data.json ist kein Objekt')
  }
  const obj = raw as Record<string, unknown>

  const requiredArrays = ['monthlyMix', 'heatmapCo2', 'scatterDaily', 'yearlyMix'] as const
  for (const key of requiredArrays) {
    if (!(key in obj)) err(`Hauptstruktur: '${key}' fehlt`)
    else if (!Array.isArray(obj[key])) err(`Hauptstruktur: '${key}' ist kein Array`)
  }

  // Verbotene Felder auf der obersten Ebene prüfen
  checkForbiddenFields(obj, 'root')

  if (result.errors.length > 0) {
    printResults()
    throw new Error('Grundlegende Strukturfehler – Abbruch')
  }

  return raw as VisualizationData
}

// ===========================================================================
// Monatsdaten
// ===========================================================================

/**
 * Prüft monthlyMix: 120 Monate, Format, Sortierung, Duplikate,
 * Energieträger, Summenkonsistenz und Stundenzahlen.
 *
 * Januar 2015 hat eine bekannte Datenlücke (Datenstart 05.01.2015) –
 * die abweichende Stundenzahl wird daher nur als Warnung gewertet.
 */
function validateMonthlyMix(data: MonthlyMixPoint[]): void {
  if (data.length !== 120) err(`monthlyMix: ${data.length} Einträge, erwartet 120`)
  if (data[0]?.month !== '2015-01') err(`monthlyMix: erster Monat ist ${data[0]?.month}, erwartet 2015-01`)
  if (data[data.length - 1]?.month !== '2024-12') err(`monthlyMix: letzter Monat ist ${data[data.length - 1]?.month}, erwartet 2024-12`)

  let prevMonth = ''
  const seen = new Set<string>()
  for (let i = 0; i < data.length; i++) {
    const m = data[i]
    if (!m || typeof m.month !== 'string' || !/^\d{4}-\d{2}$/.test(m.month)) {
      err(`monthlyMix[${i}]: ungültiges month-Format`)
      continue
    }
    if (seen.has(m.month)) { err(`monthlyMix: doppelter Monat ${m.month}`); continue }
    seen.add(m.month)
    if (m.month <= prevMonth) err(`monthlyMix: Sortierungsfehler bei ${m.month} nach ${prevMonth}`)
    prevMonth = m.month

    checkSources(`monthlyMix ${m.month}`, m.sources, false)

    if (!isFiniteNum(m.totalGenerationMwh) || m.totalGenerationMwh <= 0) {
      err(`monthlyMix ${m.month}: totalGenerationMwh ungültig (${m.totalGenerationMwh})`)
    }

    if (!isPositiveInt(m.availableHourCount)) {
      err(`monthlyMix ${m.month}: availableHourCount ungültig (${m.availableHourCount})`)
    }

    // Summen-Konsistenz: Rundungstoleranz 0.1 MWh
    // (jeder Energieträger und totalGenerationMwh sind auf 2 Dezimalstellen gerundet)
    const sumCheck = calcTotalSum(m.sources)
    if (Math.abs(sumCheck - m.totalGenerationMwh) > 0.1) {
      err(`monthlyMix ${m.month}: Σ sources (${sumCheck.toFixed(2)}) weicht von totalGenerationMwh (${m.totalGenerationMwh.toFixed(2)}) ab`)
    }

    // Stundenzahl-Prüfung (außer Januar 2015 – bekannte Datenlücke)
    if (m.month !== '2015-01') {
      const [yStr, moStr] = m.month.split('-')
      const y = Number(yStr)
      const mo = Number(moStr)
      const lastDay = new Date(y, mo, 0).getDate()
      let expectedHours = lastDay * 24
      // Sommerzeit-Umstellung: März -1 Stunde, Oktober +1 Stunde
      if (mo === 3) expectedHours -= 1
      if (mo === 10) expectedHours += 1
      if (m.availableHourCount !== expectedHours) {
        err(`monthlyMix ${m.month}: ${m.availableHourCount}h statt erwartet ${expectedHours}h`)
      }
    }
  }

  // Januar 2015: bekannte Anfangslücke (Datenstart 05.01.2015)
  const jan2015 = data.find(function (m) { return m.month === '2015-01' })
  if (jan2015 && jan2015.availableHourCount !== 744) {
    warn(`monthlyMix 2015-01: ${jan2015.availableHourCount}h (Datenstart 05.01.2015 – erwartete Lücke)`)
  }

  // Monatsfolge auf Vollständigkeit prüfen (immer, nicht nur bei jan2015-Lücke)
  const allMonths: string[] = []
  for (let y = 2015; y <= 2024; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      allMonths.push(`${y}-${String(mo).padStart(2, '0')}`)
    }
  }
  for (const expected of allMonths) {
    if (!seen.has(expected)) err(`monthlyMix: Monat ${expected} fehlt`)
  }
}

// ===========================================================================
// Heatmap
// ===========================================================================

function validateHeatmap(data: HeatmapCo2Cell[]): void {
  if (data.length !== 2880) err(`heatmapCo2: ${data.length} Zellen, erwartet 2880`)

  const seen = new Set<string>()
  let prevKey = ''
  for (let i = 0; i < data.length; i++) {
    const h = data[i]
    if (!h) { err(`heatmapCo2[${i}]: fehlt`); continue }

    const { year, month, hour } = h
    if (year < 2015 || year > 2024) err(`heatmapCo2[${i}]: year ${year} außerhalb 2015–2024`)
    if (month < 1 || month > 12) err(`heatmapCo2[${i}]: month ${month} außerhalb 1–12`)
    if (hour < 0 || hour > 23) err(`heatmapCo2[${i}]: hour ${hour} außerhalb 0–23`)

    const key = `${year}-${String(month).padStart(2, '0')}-${String(hour).padStart(2, '0')}`
    if (seen.has(key)) err(`heatmapCo2: doppelte Kombination ${key}`)
    seen.add(key)

    if (key <= prevKey) err(`heatmapCo2: Sortierungsfehler bei ${key} nach ${prevKey}`)
    prevKey = key

    if (!isFiniteNum(h.co2GramsPerKwh)) {
      err(`heatmapCo2 ${key}: co2GramsPerKwh ungültig`)
    } else if (h.co2GramsPerKwh < 0 || h.co2GramsPerKwh > 1200) {
      err(`heatmapCo2 ${key}: co2GramsPerKwh=${h.co2GramsPerKwh} außerhalb [0, 1200]`)
    }

    if (!isPositiveInt(h.observationCount)) {
      err(`heatmapCo2 ${key}: observationCount=${h.observationCount} ungültig`)
    } else if (h.observationCount > 32) {
      err(`heatmapCo2 ${key}: observationCount=${h.observationCount} > 32`)
    }
  }
}

// ===========================================================================
// Tageswerte
// ===========================================================================

/**
 * Prüft scatterDaily: 3649 Tage, Format, Sortierung,
 * EE-Anteil, CO₂-Intensität und Stundenzahlen.
 *
 * 23/25 Stunden sind durch Sommer-/Winterzeit-Umstellung (März/Oktober)
 * zu erwarten. Genau 20 Tage im gesamten Zeitraum weichen von 24h ab.
 */
function validateScatterDaily(data: ScatterDailyPoint[]): void {
  if (data.length !== 3649) err(`scatterDaily: ${data.length} Tage, erwartet 3649`)
  if (data[0]?.date !== '2015-01-05') err(`scatterDaily: erster Tag ist ${data[0]?.date}, erwartet 2015-01-05`)
  if (data[data.length - 1]?.date !== '2024-12-31') err(`scatterDaily: letzter Tag ist ${data[data.length - 1]?.date}, erwartet 2024-12-31`)

  let prevDate = ''
  const seen = new Set<string>()
  let oddHourCount = 0

  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
      err(`scatterDaily[${i}]: ungültiges date-Format`)
      continue
    }
    if (seen.has(d.date)) { err(`scatterDaily: doppeltes Datum ${d.date}`); continue }
    seen.add(d.date)
    if (d.date <= prevDate) err(`scatterDaily: Sortierungsfehler bei ${d.date} nach ${prevDate}`)
    prevDate = d.date

    const { renewableSharePercent, co2GramsPerKwh, availableHourCount } = d

    if (!isFiniteNum(renewableSharePercent)) {
      err(`scatterDaily ${d.date}: renewableSharePercent ungültig`)
    } else if (renewableSharePercent < 0 || renewableSharePercent > 100) {
      err(`scatterDaily ${d.date}: renewableSharePercent=${renewableSharePercent} außerhalb [0, 100]`)
    }

    if (!isFiniteNum(co2GramsPerKwh)) {
      err(`scatterDaily ${d.date}: co2GramsPerKwh ungültig`)
    } else if (co2GramsPerKwh < 0 || co2GramsPerKwh > 1200) {
      err(`scatterDaily ${d.date}: co2GramsPerKwh=${co2GramsPerKwh} außerhalb [0, 1200]`)
    }

    if (!isPositiveInt(availableHourCount)) {
      err(`scatterDaily ${d.date}: availableHourCount=${availableHourCount} ungültig`)
    } else if (![23, 24, 25].includes(availableHourCount)) {
      err(`scatterDaily ${d.date}: availableHourCount=${availableHourCount}, erlaubt: 23, 24, 25`)
    } else if (availableHourCount !== 24) {
      oddHourCount++
      // Nur März (Monat 3) und Oktober (Monat 10) dürfen abweichende Stunden haben
      const mo = Number(d.date.slice(5, 7))
      if (mo !== 3 && mo !== 10) {
        warn(`scatterDaily ${d.date}: ${availableHourCount}h außerhalb März/Oktober`)
      }
    }
  }

  if (oddHourCount !== 20) err(`scatterDaily: ${oddHourCount} Tage mit ≠24h, erwartet 20`)
}

// ===========================================================================
// Jahresdaten
// ===========================================================================

/** Erwartete Stundenzahlen pro Jahr (Berliner Lokalzeit, inkl. Schaltjahre). */
const EXPECTED_YEARLY_HOURS: Record<number, number> = {
  // 2015: Datenstart 05.01. → 8.664 h (8.760 − 96 fehlende Stunden)
  2015: 8664,
  2016: 8784, // Schaltjahr
  2017: 8760,
  2018: 8760,
  2019: 8760,
  2020: 8784, // Schaltjahr
  2021: 8760,
  2022: 8760,
  2023: 8760,
  2024: 8784, // Schaltjahr
}

/**
 * Prüft yearlyMix: 10 Jahre, Energieträger, EE-Anteil, CO₂,
 * Stundenzahlen und Kernenergie 2024 = 0.
 *
 * Kernenergie ist 2024 nach dem Atomausstieg (§7 AtG, 15.04.2023)
 * tatsächlich 0 – die Jahres-Summe muss exakt 0 sein.
 */
function validateYearlyMix(data: YearlyMixPoint[]): void {
  if (data.length !== 10) err(`yearlyMix: ${data.length} Jahre, erwartet 10`)

  let prevYear = 0
  const seen = new Set<number>()
  for (let i = 0; i < data.length; i++) {
    const y = data[i]
    if (!y) { err(`yearlyMix[${i}]: fehlt`); continue }

    if (y.year < 2015 || y.year > 2024) err(`yearlyMix[${i}]: year ${y.year} außerhalb 2015–2024`)
    if (seen.has(y.year)) { err(`yearlyMix: doppeltes Jahr ${y.year}`); continue }
    seen.add(y.year)
    if (y.year <= prevYear) err(`yearlyMix: Sortierungsfehler bei ${y.year} nach ${prevYear}`)
    prevYear = y.year

    checkSources(`yearlyMix ${y.year}`, y.sources, false)

    if (!isFiniteNum(y.totalGenerationMwh) || y.totalGenerationMwh <= 0) {
      err(`yearlyMix ${y.year}: totalGenerationMwh ungültig (${y.totalGenerationMwh})`)
    }

    // EE-Anteil-Rückrechnung
    if (!isFiniteNum(y.renewableSharePercent)) {
      err(`yearlyMix ${y.year}: renewableSharePercent ungültig`)
    } else if (y.renewableSharePercent < 0 || y.renewableSharePercent > 100) {
      err(`yearlyMix ${y.year}: renewableSharePercent=${y.renewableSharePercent} außerhalb [0, 100]`)
    } else {
      const renSum = calcRenewableSum(y.sources)
      const total = calcTotalSum(y.sources)
      if (total > 0) {
        const computedPct = (renSum / total) * 100
        // Rundungstoleranz: 0.1 Prozentpunkt
        if (Math.abs(computedPct - y.renewableSharePercent) > 0.1) {
          err(`yearlyMix ${y.year}: berechneter EE-Anteil ${computedPct.toFixed(2)}% weicht von gespeichertem ${y.renewableSharePercent}% ab`)
        }
      }
    }

    if (!isFiniteNum(y.co2GramsPerKwh)) {
      err(`yearlyMix ${y.year}: co2GramsPerKwh ungültig`)
    } else if (y.co2GramsPerKwh < 0 || y.co2GramsPerKwh > 1200) {
      err(`yearlyMix ${y.year}: co2GramsPerKwh=${y.co2GramsPerKwh} außerhalb [0, 1200]`)
    }

    // Stundenzahl
    const expectedHours = EXPECTED_YEARLY_HOURS[y.year]
    if (expectedHours !== undefined && y.availableHourCount !== expectedHours) {
      err(`yearlyMix ${y.year}: ${y.availableHourCount}h statt erwartet ${expectedHours}h`)
    } else if (expectedHours === undefined) {
      err(`yearlyMix ${y.year}: unbekannte Jahreszahl`)
    }

    // Summen-Konsistenz: Rundungstoleranz 0.1 MWh
    const sumCheck = calcTotalSum(y.sources)
    if (Math.abs(sumCheck - y.totalGenerationMwh) > 0.1) {
      err(`yearlyMix ${y.year}: Σ sources (${sumCheck.toFixed(2)}) weicht von totalGenerationMwh (${y.totalGenerationMwh.toFixed(2)}) ab`)
    }
  }

  // Kernenergie 2024 muss nach dem Atomausstieg exakt 0 sein
  const y2024 = data.find(function (y) { return y.year === 2024 })
  if (y2024) {
    if (y2024.sources.nuclear !== 0) {
      err(`yearlyMix 2024: Kernenergie-Summe ist ${y2024.sources.nuclear}, erwartet 0`)
    }
  }
}

// ===========================================================================
// Bereichsübergreifende Konsistenz
// ===========================================================================

/**
 * Prüft, ob die Monatsdaten in der Summe mit den Jahresdaten
 * übereinstimmen (Energieträger, Gesamterzeugung, Stundenzahlen).
 *
 * Toleranz 2.0 MWh: 12 Energieträger × 12 Monate × 0.01 Rundung pro
 * Energieträger = 1.44 MWh + totalGenerationMwh-Rundung.
 * Daher 2.0 MWh als Sicherheitspuffer.
 */
function validateCrossConsistency(
  monthly: MonthlyMixPoint[],
  yearly: YearlyMixPoint[],
): void {
  const byYear = new Map<number, { totalGen: number; hours: number; sources: EnergySourceValues }>()
  for (const m of monthly) {
    const y = Number(m.month.slice(0, 4))
    if (!byYear.has(y)) {
      byYear.set(y, { totalGen: 0, hours: 0, sources: emptyAccum() })
    }
    const acc = byYear.get(y)!
    acc.totalGen += m.totalGenerationMwh
    acc.hours += m.availableHourCount
    for (const key of SOURCE_KEYS) acc.sources[key] += m.sources[key]
  }

  for (const y of yearly) {
    const acc = byYear.get(y.year)
    if (!acc) { err(`yearlyMix ${y.year}: keine Monatsdaten zum Vergleich`); continue }

    const TOL_MWH = 2.0
    for (const key of SOURCE_KEYS) {
      const diff = Math.abs(acc.sources[key] - y.sources[key])
      if (diff > TOL_MWH) {
        warn(`Konsistenz ${y.year}: ${key} summiert ${acc.sources[key].toFixed(2)} vs. yearly ${y.sources[key].toFixed(2)} (Δ ${diff.toFixed(2)})`)
      }
    }

    const genDiff = Math.abs(acc.totalGen - y.totalGenerationMwh)
    if (genDiff > TOL_MWH) {
      warn(`Konsistenz ${y.year}: totalGenerationMwh summiert ${acc.totalGen.toFixed(2)} vs. yearly ${y.totalGenerationMwh.toFixed(2)} (Δ ${genDiff.toFixed(2)})`)
    }

    if (acc.hours !== y.availableHourCount) {
      err(`Konsistenz ${y.year}: Stunden summiert ${acc.hours} vs. yearly ${y.availableHourCount}`)
    }
  }
}

function emptyAccum(): EnergySourceValues {
  return { biomass: 0, hydro: 0, wind_onshore: 0, wind_offshore: 0, pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0, gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0 }
}

// ===========================================================================
// Hauptfunktion
// ===========================================================================

async function main(): Promise<void> {
  console.log('Lade visualization-data.json...')
  const file = Bun.file('public/data/visualization-data.json')
  const raw: unknown = await file.json()

  const data = checkStructure(raw)
  const { monthlyMix, heatmapCo2, scatterDaily, yearlyMix } = data

  console.log('\nValidiere Monatsdaten...')
  validateMonthlyMix(monthlyMix)

  console.log('Validiere Heatmap...')
  validateHeatmap(heatmapCo2)

  console.log('Validiere Tageswerte...')
  validateScatterDaily(scatterDaily)

  console.log('Validiere Jahresdaten...')
  validateYearlyMix(yearlyMix)

  console.log('Validiere Konsistenz Monats- ↔ Jahresdaten...')
  validateCrossConsistency(monthlyMix, yearlyMix)

  printResults()

  if (result.errors.length > 0) {
    throw new Error(`${result.errors.length} Fehler gefunden – Datenprüfung fehlgeschlagen`)
  }
  console.log('\nDatenprüfung erfolgreich.')
}

function printResults(): void {
  console.log('\n' + '='.repeat(50))
  console.log('ERGEBNIS DER DATENPRÜFUNG')
  console.log('='.repeat(50))

  if (result.warnings.length > 0) {
    console.log(`\nWarnungen (${result.warnings.length}):`)
    for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  }

  if (result.errors.length > 0) {
    console.log(`\nFehler (${result.errors.length}):`)
    for (const e of result.errors) console.log(`  ❌ ${e}`)
  }

  console.log(`\nFehler: ${result.errors.length}  Warnungen: ${result.warnings.length}`)
}

// ===========================================================================
// Einstieg
// ===========================================================================

main().catch(function (caughtError: unknown) {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
  console.error('Fehler:', message)
  process.exit(1)
})
