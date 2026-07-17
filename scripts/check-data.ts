/**
 * scripts/check-data.ts — Validiert visualization-data.json
 * ==========================================================
 *
 * Prüft Struktur, Wertebereiche, Vollständigkeit und Konsistenz
 * der vier Datenbereiche. Kein "Audit-Framework", sondern
 * einfache Funktionen mit sichtbarer Fehlerliste.
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

// ---------------------------------------------------------------------------
// Energie-Träger-Konstanten
// ---------------------------------------------------------------------------
const SOURCE_KEYS: readonly (keyof EnergySourceValues)[] = [
  'biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'other_renewables', 'lignite', 'hardcoal', 'gas', 'nuclear',
  'other_fossil', 'pumped_storage',
]

/** Erneuerbare Energieträger (für EE-Anteil-Rückrechnung) */
const RENEWABLE_KEYS: readonly (keyof EnergySourceValues)[] = [
  'biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'other_renewables',
]

// ---------------------------------------------------------------------------
// Fehler- / Warnungssammlung
// ---------------------------------------------------------------------------
const errors: string[] = []
const warnings: string[] = []

function err(msg: string): void { errors.push(msg) }
function warn(msg: string): void { warnings.push(msg) }

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v === Math.floor(v)
}

function checkSources(
  sources: unknown, label: string,
  allowNegative: boolean
): sources is EnergySourceValues {
  if (!sources || typeof sources !== 'object') {
    err(`${label}: sources ist kein Objekt`)
    return false
  }
  const s = sources as Record<string, unknown>
  let ok = true
  for (const key of SOURCE_KEYS) {
    if (!(key in s)) {
      err(`${label}: Energieträger '${key}' fehlt`)
      ok = false
      continue
    }
    const v = s[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      err(`${label}: Energieträger '${key}' ist keine gültige Zahl (${v})`)
      ok = false
    } else if (!allowNegative && v < 0) {
      err(`${label}: Energieträger '${key}' ist negativ (${v})`)
      ok = false
    }
  }
  // Unerwartete Schlüssel prüfen
  for (const key of Object.keys(s)) {
    if (!SOURCE_KEYS.includes(key as keyof EnergySourceValues)) {
      warn(`${label}: unerwarteter Energieträger '${key}'`)
    }
  }
  return ok
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

// ---------------------------------------------------------------------------
// Verbotene Felder
// ---------------------------------------------------------------------------
const FORBIDDEN_PATTERNS = [
  'price', 'price_eur_mwh', 'neg_stunden', 'load_mwh',
  'fossil_share', 'conventional_share', 'ee_share', 'co2_g_per_kwh',
]

const ALLOWED_CONTAINING = [
  'renewableSharePercent', 'co2GramsPerKwh', 'totalGenerationMwh',
]

function isForbidden(key: string): boolean {
  if (ALLOWED_CONTAINING.includes(key)) return false
  return FORBIDDEN_PATTERNS.some(p => key.includes(p))
}

function checkForbiddenFields(obj: unknown, path: string): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    if (obj.length > 0) checkForbiddenFields(obj[0], path)
    return
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (isForbidden(key)) {
      err(`${path}: verbotenes Feld '${key}' gefunden`)
    }
  }
}

// ---------------------------------------------------------------------------
// Monatsdaten
// ---------------------------------------------------------------------------
function validateMonthlyMix(data: MonthlyMixPoint[]): void {
  if (data.length !== 120) err(`monthlyMix: ${data.length} Einträge, erwartet 120`)
  if (data[0]?.month !== '2015-01') err(`monthlyMix: erster Monat ist ${data[0]?.month}, erwartet 2015-01`)
  if (data[data.length - 1]?.month !== '2024-12') err(`monthlyMix: letzter Monat ist ${data[data.length - 1]?.month}, erwartet 2024-12`)

  // Vollständigkeit und Sortierung
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

    checkSources(m.sources, `monthlyMix ${m.month}`, false)

    if (typeof m.totalGenerationMwh !== 'number' || !Number.isFinite(m.totalGenerationMwh) || m.totalGenerationMwh <= 0) {
      err(`monthlyMix ${m.month}: totalGenerationMwh ungültig (${m.totalGenerationMwh})`)
    }

    if (typeof m.availableHourCount !== 'number' || !Number.isFinite(m.availableHourCount) || m.availableHourCount <= 0 || m.availableHourCount !== Math.floor(m.availableHourCount)) {
      err(`monthlyMix ${m.month}: availableHourCount ungültig (${m.availableHourCount})`)
    }

    // Summen-Konsistenz
    if (m.sources && typeof m.sources === 'object') {
      const sumCheck = calcTotalSum(m.sources as EnergySourceValues)
      if (Math.abs(sumCheck - m.totalGenerationMwh) > 0.1) {
        err(`monthlyMix ${m.month}: Σ sources (${sumCheck.toFixed(2)}) weicht von totalGenerationMwh (${m.totalGenerationMwh.toFixed(2)}) ab`)
      }
    }

    // Stundenzahl-Prüfung (außer Januar 2015)
    if (m.month !== '2015-01') {
      const [yStr, moStr] = m.month.split('-')
      const y = Number(yStr)
      const mo = Number(moStr)
      const lastDay = new Date(y, mo, 0).getDate() // letzter Tag des Monats
      let expectedHours = lastDay * 24
      // Sommerzeit: März -1h, Oktober +1h
      if (mo === 3) expectedHours -= 1
      if (mo === 10) expectedHours += 1
      if (m.availableHourCount !== expectedHours) {
        err(`monthlyMix ${m.month}: ${m.availableHourCount}h statt erwartet ${expectedHours}h`)
      }
    }
  }

  // Januar 2015: bekannte Anfangslücke
  const jan2015 = data.find(m => m.month === '2015-01')
  if (jan2015 && jan2015.availableHourCount !== 744) {
    warn(`monthlyMix 2015-01: ${jan2015.availableHourCount}h (Datenstart 05.01.2015 – erwartete Lücke)`)

    // Prüfe Monatsfolge auf Vollständigkeit
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
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------
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

    if (typeof h.co2GramsPerKwh !== 'number' || !Number.isFinite(h.co2GramsPerKwh)) {
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

// ---------------------------------------------------------------------------
// Tageswerte (Scatter)
// ---------------------------------------------------------------------------
function validateScatterDaily(data: ScatterDailyPoint[]): void {
  if (data.length !== 3649) err(`scatterDaily: ${data.length} Tage, erwartet 3649`)
  if (data[0]?.date !== '2015-01-05') err(`scatterDaily: erster Tag ist ${data[0]?.date}, erwartet 2015-01-05`)
  if (data[data.length - 1]?.date !== '2024-12-31') err(`scatterDaily: letzter Tag ist ${data[data.length - 1]?.date}, erwartet 2024-12-31`)

  let prevDate = ''
  const seen = new Set<string>()
  let oddHourCount = 0
  const RENEWABLE_KEYS_SET = new Set(RENEWABLE_KEYS)
  // Erneuerbare Schlüssel als Set

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

    if (typeof renewableSharePercent !== 'number' || !Number.isFinite(renewableSharePercent)) {
      err(`scatterDaily ${d.date}: renewableSharePercent ungültig`)
    } else if (renewableSharePercent < 0 || renewableSharePercent > 100) {
      err(`scatterDaily ${d.date}: renewableSharePercent=${renewableSharePercent} außerhalb [0, 100]`)
    }

    if (typeof co2GramsPerKwh !== 'number' || !Number.isFinite(co2GramsPerKwh)) {
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
      const mo = Number(d.date.slice(5, 7))
      if (mo !== 3 && mo !== 10) {
        warn(`scatterDaily ${d.date}: ${availableHourCount}h außerhalb März/Oktober`)
      }
    }
  }

  if (oddHourCount !== 20) err(`scatterDaily: ${oddHourCount} Tage mit ≠24h, erwartet 20`)
}

// ---------------------------------------------------------------------------
// Jahresdaten
// ---------------------------------------------------------------------------
const EXPECTED_YEARLY_HOURS: Record<number, number> = {
  2015: 8664, 2016: 8784, 2017: 8760, 2018: 8760, 2019: 8760,
  2020: 8784, 2021: 8760, 2022: 8760, 2023: 8760, 2024: 8784,
}

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

    checkSources(y.sources, `yearlyMix ${y.year}`, false)

    if (typeof y.totalGenerationMwh !== 'number' || !Number.isFinite(y.totalGenerationMwh) || y.totalGenerationMwh <= 0) {
      err(`yearlyMix ${y.year}: totalGenerationMwh ungültig (${y.totalGenerationMwh})`)
    }

    if (typeof y.renewableSharePercent !== 'number' || !Number.isFinite(y.renewableSharePercent)) {
      err(`yearlyMix ${y.year}: renewableSharePercent ungültig`)
    } else if (y.renewableSharePercent < 0 || y.renewableSharePercent > 100) {
      err(`yearlyMix ${y.year}: renewableSharePercent=${y.renewableSharePercent} außerhalb [0, 100]`)
    } else {
      // Rückrechnung des EE-Anteils aus den Summen
      if (y.sources && typeof y.sources === 'object') {
        const s = y.sources as EnergySourceValues
        const renSum = calcRenewableSum(s)
        const total = calcTotalSum(s)
        if (total > 0) {
          const computedPct = (renSum / total) * 100
          if (Math.abs(computedPct - y.renewableSharePercent) > 0.1) {
            err(`yearlyMix ${y.year}: berechneter EE-Anteil ${computedPct.toFixed(2)}% weicht von gespeichertem ${y.renewableSharePercent}% ab`)
          }
        }
      }
    }

    if (typeof y.co2GramsPerKwh !== 'number' || !Number.isFinite(y.co2GramsPerKwh)) {
      err(`yearlyMix ${y.year}: co2GramsPerKwh ungültig`)
    } else if (y.co2GramsPerKwh < 0 || y.co2GramsPerKwh > 1200) {
      err(`yearlyMix ${y.year}: co2GramsPerKwh=${y.co2GramsPerKwh} außerhalb [0, 1200]`)
    }

    // Stundenanzahl
    const expectedHours = EXPECTED_YEARLY_HOURS[y.year]
    if (expectedHours !== undefined && y.availableHourCount !== expectedHours) {
      err(`yearlyMix ${y.year}: ${y.availableHourCount}h statt erwartet ${expectedHours}h`)
    } else if (expectedHours === undefined) {
      err(`yearlyMix ${y.year}: unbekannte Jahreszahl`)
    }

    // Summen-Konsistenz
    if (y.sources && typeof y.sources === 'object') {
      const sumCheck = calcTotalSum(y.sources as EnergySourceValues)
      if (Math.abs(sumCheck - y.totalGenerationMwh) > 0.1) {
        err(`yearlyMix ${y.year}: Σ sources (${sumCheck.toFixed(2)}) weicht von totalGenerationMwh (${y.totalGenerationMwh.toFixed(2)}) ab`)
      }
    }
  }

  // Kernenergie 2024 = 0
  const y2024 = data.find(y => y.year === 2024)
  if (y2024 && y2024.sources) {
    const nuclear = (y2024.sources as EnergySourceValues).nuclear
    if (nuclear !== 0) err(`yearlyMix 2024: Kernenergie-Summe ist ${nuclear}, erwartet 0`)
  }
}

// ---------------------------------------------------------------------------
// Konsistenz Monats- ↔ Jahresdaten
// ---------------------------------------------------------------------------
function validateMonthYearConsistency(
  monthly: MonthlyMixPoint[],
  yearly: YearlyMixPoint[]
): void {
  // Monatsdaten nach Jahr gruppieren
  const byYear = new Map<number, { totalGen: number; hours: number; sources: EnergySourceValues }>()
  for (const m of monthly) {
    const y = Number(m.month.slice(0, 4))
    if (!byYear.has(y)) {
      byYear.set(y, { totalGen: 0, hours: 0, sources: { biomass: 0, hydro: 0, wind_onshore: 0, wind_offshore: 0, pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0, gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0 } })
    }
    const acc = byYear.get(y)!
    acc.totalGen += m.totalGenerationMwh
    acc.hours += m.availableHourCount
    if (m.sources && typeof m.sources === 'object') {
      const s = m.sources as EnergySourceValues
      for (const key of SOURCE_KEYS) acc.sources[key] += s[key]
    }
  }

  for (const y of yearly) {
    const acc = byYear.get(y.year)
    if (!acc) { err(`yearlyMix ${y.year}: keine Monatsdaten zum Vergleich`); continue }

    // Toleranz: 0.1 MWh reicht nicht, weil 12 × monatliche Rundung (je 0.01)
    // pro Energieträger aufsummiert wird: 12 Träger × 12 Monate × 0.01 = 1.44
    // Zusätzlich totalGenerationMwh-Rundung. Daher 2.0 MWh Toleranz.
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

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Lade visualization-data.json...')
  const file = Bun.file('public/data/visualization-data.json')
  const raw: unknown = await file.json()

  // Grundlegende Strukturprüfung
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('visualization-data.json ist kein Objekt')
  }
  const obj = raw as Record<string, unknown>

  const requiredArrays = ['monthlyMix', 'heatmapCo2', 'scatterDaily', 'yearlyMix']
  for (const key of requiredArrays) {
    if (!(key in obj)) err(`Hauptstruktur: '${key}' fehlt`)
    else if (!Array.isArray(obj[key])) err(`Hauptstruktur: '${key}' ist kein Array`)
  }

  // Verbotene Felder prüfen
  checkForbiddenFields(obj, 'root')

  // Frühzeitig abbrechen, wenn Kern-Arrays fehlen
  if (errors.length > 0) {
    printResults()
    throw new Error('Grundlegende Strukturfehler – Abbruch')
  }

  const { monthlyMix, heatmapCo2, scatterDaily, yearlyMix } = obj as unknown as VisualizationData

  console.log('\nValidiere Monatsdaten...')
  validateMonthlyMix(monthlyMix)

  console.log('Validiere Heatmap...')
  validateHeatmap(heatmapCo2)

  console.log('Validiere Tageswerte...')
  validateScatterDaily(scatterDaily)

  console.log('Validiere Jahresdaten...')
  validateYearlyMix(yearlyMix)

  console.log('Validiere Konsistenz Monats- ↔ Jahresdaten...')
  validateMonthYearConsistency(monthlyMix, yearlyMix)

  printResults()

  if (errors.length > 0) {
    throw new Error(`${errors.length} Fehler gefunden – Datenprüfung fehlgeschlagen`)
  }
  console.log('\nDatenprüfung erfolgreich.')
}

function printResults(): void {
  console.log('\n' + '='.repeat(50))
  console.log('ERGEBNIS DER DATENPRÜFUNG')
  console.log('='.repeat(50))

  if (warnings.length > 0) {
    console.log(`\nWarnungen (${warnings.length}):`)
    for (const w of warnings) console.log(`  ⚠ ${w}`)
  }

  if (errors.length > 0) {
    console.log(`\nFehler (${errors.length}):`)
    for (const e of errors) console.log(`  ❌ ${e}`)
  }

  console.log(`\nFehler: ${errors.length}  Warnungen: ${warnings.length}`)
}

main().catch((err: Error) => {
  console.error('Fehler:', err.message)
})
