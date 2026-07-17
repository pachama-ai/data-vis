/**
 * scripts/build-data.ts — Erzeugt visualization-data.json aus SMARD-Daten
 * =======================================================================
 *
 * Liest SMARD-Erzeugungsdaten (public/data/smard.json) und
 * UBA-Emissionsfaktoren (emission_factors.json). Erzeugt four Arrays:
 * monthlyMix, heatmapCo2, scatterDaily, yearlyMix.
 *
 * Zeitzone: Europe/Berlin via Intl.DateTimeFormat mit hourCycle: 'h23'.
 * Filterung nach Berliner Jahr (2015–2024), nicht nach UTC.
 *
 * Kernenergie-Sonderbehandlung: Nach Abschaltung der letzten Kernkraftwerke
 * am 15. April 2023 liefert SMARD das Feld kernenergie nicht mehr.
 * Ab 2023-04-15 (Berliner Lokalzeit) wird fehlendes kernenergie als
 * struktureller Nullwert behandelt (Quelle: SMARD / Bundesnetzagentur,
 * §7 AtG – Abschaltung der letzten drei Kernkraftwerke).
 *
 * Aufruf: bun run scripts/build-data.ts
 */

// Globale Bun-APIs für TypeCheck deklarieren (Bun liefert die Runtime-Typen
// selbst, tsconfig.json des Projekts enthält keine @types/bun)
declare var Bun: {
  file(path: string): {
    exists(): Promise<boolean>
    json(): Promise<unknown>
  }
  write(path: string, data: string): Promise<number>
}

import type {
  HeatmapCo2Cell,
  MonthlyMixPoint,
  ScatterDailyPoint,
  YearlyMixPoint,
} from '../types/visualization-data'

// ===========================================================================
// Konstanten
// ===========================================================================

/** Mapping deutscher SMARD-Feldnamen → englische Energieträger-Kürzel. */
const GERMAN_TO_ENGLISH: Record<string, keyof EnergySourceAccum> = {
  braunkohle: 'lignite',
  kernenergie: 'nuclear',
  windOffshore: 'wind_offshore',
  wasserkraft: 'hydro',
  sonstigeKonventionelle: 'other_fossil',
  sonstigeErneuerbare: 'other_renewables',
  biomasse: 'biomass',
  windOnshore: 'wind_onshore',
  solar: 'pv',
  steinkohle: 'hardcoal',
  pumpspeicher: 'pumped_storage',
  erdgas: 'gas',
}

const GENERATION_FIELDS = Object.keys(GERMAN_TO_ENGLISH)

/** Erneuerbare Energieträger für EE-Anteil-Berechnung. */
const RENEWABLE_FIELDS = new Set([
  'biomasse', 'wasserkraft', 'windOnshore', 'windOffshore',
  'solar', 'sonstigeErneuerbare',
])

/**
 * Datum des Kernenergie-Ausstiegs (Berliner Lokalzeit).
 * Letzte drei Kernkraftwerke (Emsland, Isar 2, Neckarwestheim 2)
 * wurden am 15.04.2023 endgültig abgeschaltet. SMARD liefert das Feld
 * kernenergie danach nicht mehr – die Erzeugung ist tatsächlich 0.
 */
const NUCLEAR_PHASEOUT_DATE = '2023-04-15'

/** Maximaler Anteil übersprungener Stunden vor Abbruch. */
const MAX_SKIP_FRACTION = 0.10

// ===========================================================================
// Typen
// ===========================================================================

/** 12 Energieträger in MWh (englische Kürzel). */
interface EnergySourceAccum {
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

/** Emissionsfaktoren (g CO₂/kWh) – Schlüssel sind deutsche SMARD-Feldnamen. */
interface EmissionFactors {
  biomasse: number
  wasserkraft: number
  windOnshore: number
  windOffshore: number
  solar: number
  sonstigeErneuerbare: number
  kernenergie: number
  braunkohle: number
  steinkohle: number
  erdgas: number
  sonstigeKonventionelle: number
  pumpspeicher: number
}

/** Aus Intl.DateTimeFormat extrahierte Berliner Datumsteile. */
interface BerlinDateParts {
  year: number
  month: number
  day: number
  hour: number
  /** Format "YYYY-MM-DD". */
  dateKey: string
  /** Format "YYYY-MM". */
  monthKey: string
}

// ---------------------------------------------------------------------------
// Aggregations-Buckets (Zwischenspeicher während der Schleife)
// ---------------------------------------------------------------------------

interface MonthBucket {
  sources: EnergySourceAccum
  totalGen: number
  co2Weighted: number
  count: number
}

interface HeatmapBucket {
  co2Weighted: number
  totalGen: number
  count: number
}

interface DayBucket {
  renewableGen: number
  totalGen: number
  co2Weighted: number
  count: number
}

interface YearBucket {
  sources: EnergySourceAccum
  totalGen: number
  renewableGen: number
  co2Weighted: number
  count: number
}

// ===========================================================================
// Hilfsfunktionen
// ===========================================================================

function emptySources(): EnergySourceAccum {
  return {
    biomass: 0, hydro: 0, wind_onshore: 0, wind_offshore: 0,
    pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0,
    gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0,
  }
}

/** Rundung auf zwei Nachkommastellen. Erst nach Aggregation anwenden. */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// ===========================================================================
// Berliner Zeitzone (zentral, einheitlich über Intl.DateTimeFormat)
// ===========================================================================

const berlinDateFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
})
const berlinHourFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23',
})

/**
 * Extrahiert Jahr, Monat, Tag, Stunde sowie dateKey/monthKey
 * aus einem Unix-Timestamp in Berliner Lokalzeit (Europe/Berlin).
 * Sommer-/Winterzeit-Umstellung wird automatisch über Intl.DateTimeFormat
 * berücksichtigt – kein manueller Offset.
 */
function getBerlinDateParts(ts: number): BerlinDateParts {
  const dateParts = berlinDateFmt.formatToParts(ts)
  let year = 0, month = 0, day = 0
  for (const p of dateParts) {
    if (p.type === 'year') year = Number(p.value)
    if (p.type === 'month') month = Number(p.value)
    if (p.type === 'day') day = Number(p.value)
  }
  let hour = 0
  for (const p of berlinHourFmt.formatToParts(ts)) {
    if (p.type === 'hour') hour = Number(p.value)
  }
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return {
    year, month, day, hour,
    dateKey: `${year}-${mm}-${dd}`,
    monthKey: `${year}-${mm}`,
  }
}

// ===========================================================================
// Rohdaten aus SMARD-Zeile extrahieren
// ===========================================================================

/**
 * Extrahiert die 12 Energieträger aus einer SMARD-Rohdatenzeile.
 *
 * Kernenergie-Sonderfall: Fehlt das Feld nach dem 15.04.2023 (Berliner
 * Lokalzeit), wird es als 0 gesetzt – die Erzeugung ist seit der
 * endgültigen Abschaltung tatsächlich 0 (§7 AtG). Fehlt kernenergie
 * vor diesem Datum, gilt die Stunde als unvollständig.
 *
 * Fehlt ein anderer Energieträger (null/undefined/NaN), wird die gesamte
 * Stunde übersprungen.
 *
 * @returns Objekt mit sources (oder null bei Fehler) und Kernenergie-Status.
 */
function extractSources(
  row: Record<string, unknown>,
  berlinDate: string
): { sources: EnergySourceAccum | null; nuclearFilled: boolean } {
  const sources = emptySources()
  let nuclearFilled = false

  for (const deField of GENERATION_FIELDS) {
    const raw = row[deField]
    const enField = GERMAN_TO_ENGLISH[deField] as keyof EnergySourceAccum

    if (deField === 'kernenergie' && (raw === undefined || raw === null)) {
      if (berlinDate > NUCLEAR_PHASEOUT_DATE) {
        // Nach Abschaltdatum: struktureller Nullwert
        sources[enField] = 0
        nuclearFilled = true
        continue
      }
      // Kernenergie fehlt vor Abschaltdatum → unplausibel
      return { sources: null, nuclearFilled: false }
    }

    if (raw === null || raw === undefined) {
      return { sources: null, nuclearFilled: false }
    }
    if (typeof raw !== 'number' || isNaN(raw)) {
      return { sources: null, nuclearFilled: false }
    }

    sources[enField] = raw
  }

  return { sources, nuclearFilled }
}

// ===========================================================================
// Reine Berechnungsfunktionen (kein Dateizugriff, kein Zustand)
// ===========================================================================

/**
 * CO₂-gewichtete Summe einer Stunde in g CO₂.
 *
 * Formel: Σ(Erzeugung_Energieträger × Emissionsfaktor_Energieträger)
 * Werden über den gesamten Akkumulationszeitraum aufsummiert; die Division
 * durch die Gesamterzeugung erfolgt erst nach Aggregation (finalize*).
 */
function calcCo2Weighted(sources: EnergySourceAccum, factors: EmissionFactors): number {
  let sum = 0
  for (const deField of GENERATION_FIELDS) {
    const enField = GERMAN_TO_ENGLISH[deField] as keyof EnergySourceAccum
    const mwh = sources[enField]
    const factor = factors[deField as keyof EmissionFactors]
    sum += mwh * factor
  }
  return sum
}

/** Summe der erneuerbaren Erzeugung in MWh. */
function calcRenewableSum(sources: EnergySourceAccum): number {
  let sum = 0
  for (const deField of GENERATION_FIELDS) {
    if (RENEWABLE_FIELDS.has(deField)) {
      const enField = GERMAN_TO_ENGLISH[deField] as keyof EnergySourceAccum
      sum += sources[enField]
    }
  }
  return sum
}

/** Summe aller Energieträger (Gesamterzeugung) in MWh. */
function calcTotalSum(sources: EnergySourceAccum): number {
  return (Object.values(sources) as number[]).reduce<number>((a, b) => a + b, 0)
}

// ===========================================================================
// Aggregations-Finalisierung (Erzeugung der finalen Arrays)
// ===========================================================================

function finalizeMonthlyMix(buckets: Map<string, MonthBucket>): MonthlyMixPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      sources: b.sources,
      totalGenerationMwh: round2(b.totalGen),
      availableHourCount: b.count,
    }))
}

function finalizeHeatmapCo2(buckets: Map<string, HeatmapBucket>): HeatmapCo2Cell[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const [yearStr, monthStr, hourStr] = key.split('-')
      return {
        year: Number(yearStr),
        month: Number(monthStr),
        hour: Number(hourStr),
        // CO₂-Intensität = Summe(gewichtete Emissionen) / Gesamterzeugung
        co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
        observationCount: b.count,
      }
    })
}

function finalizeScatterDaily(buckets: Map<string, DayBucket>): ScatterDailyPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      // EE-Anteil in % = Σ EE-Erzeugung / Σ Gesamterzeugung × 100
      renewableSharePercent: round2((b.renewableGen / b.totalGen) * 100),
      // CO₂-Intensität = Σ(gewichtete Emissionen) / Σ Gesamterzeugung
      co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
      availableHourCount: b.count,
    }))
}

function finalizeYearlyMix(buckets: Map<string, YearBucket>): YearlyMixPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearStr, b]) => ({
      year: Number(yearStr),
      sources: b.sources,
      totalGenerationMwh: round2(b.totalGen),
      // EE-Anteil in % = Σ EE-Erzeugung / Σ Gesamterzeugung × 100
      renewableSharePercent: round2((b.renewableGen / b.totalGen) * 100),
      // CO₂-Intensität = Σ(gewichtete Emissionen) / Σ Gesamterzeugung
      co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
      availableHourCount: b.count,
    }))
}

// ===========================================================================
// Ein- und Ausgabe (Dateisystem)
// ===========================================================================

async function loadSmardData(): Promise<Record<string, unknown>[]> {
  const file = Bun.file('public/data/smard.json')
  if (!await file.exists()) {
    throw new Error('public/data/smard.json nicht gefunden. Führe zuerst download-smard.ts aus.')
  }
  const data: unknown = await file.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('public/data/smard.json enthält keine gültigen Daten.')
  }
  return data as Record<string, unknown>[]
}

async function loadEmissionFactors(): Promise<EmissionFactors> {
  const file = Bun.file('emission_factors.json')
  const raw: unknown = await file.json()
  if (!raw || typeof raw !== 'object') {
    throw new Error('emission_factors.json enthält kein gültiges Objekt.')
  }
  const obj = raw as Record<string, unknown>
  const factors: Record<string, number> = {}
  for (const deField of GENERATION_FIELDS) {
    const v = obj[deField]
    if (typeof v !== 'number' || !isFinite(v)) {
      throw new Error(
        `emission_factors.json: '${deField}' fehlt oder ist keine gültige Zahl (${v}).`,
      )
    }
    factors[deField] = v
  }
  return factors as unknown as EmissionFactors
}

/** Rekursive Prüfung auf nicht-endliche Werte vor dem Schreiben. */
function deepCheckFinite(obj: unknown, path: string): void {
  if (obj === null || obj === undefined) {
    throw new Error(`Null/undefined gefunden in ${path}`)
  }
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) {
      throw new Error(`Nicht-endlicher Wert (${obj}) in ${path}`)
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => deepCheckFinite(item, `${path}[${i}]`))
  } else if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      deepCheckFinite(val, `${path}.${key}`)
    }
  }
}

// ===========================================================================
// Hauptfunktion
// ===========================================================================

async function main(): Promise<void> {
  console.log('Lade SMARD-Daten...')
  const smard = await loadSmardData()
  console.log(`${smard.length} Rohdatensätze geladen`)

  console.log('Lade Emissionsfaktoren...')
  const factors = await loadEmissionFactors()
  console.log('Emissionsfaktoren geladen:', GENERATION_FIELDS.length, 'Träger')

  let validCount = 0
  let skippedOutside = 0
  let skippedNonNumeric = 0
  let skippedZeroTotal = 0
  let skippedNegative = 0
  let nuclearFilledCount = 0
  const negativeExamples: string[] = []

  const monthBuckets = new Map<string, MonthBucket>()
  const heatmapBuckets = new Map<string, HeatmapBucket>()
  const dayBuckets = new Map<string, DayBucket>()
  const yearBuckets = new Map<string, YearBucket>()

  for (const row of smard) {
    const ts = row.timestamp

    // Timestamp muss eine Zahl sein (Sekunden oder Millisekunden)
    if (typeof ts !== 'number') {
      skippedOutside++
      continue
    }

    // Berliner Datumsteile – zentral über Intl.DateTimeFormat
    const bp = getBerlinDateParts(ts)

    // Zeitraum-Filter anhand Berliner Jahr: nur 2015–2024
    if (bp.year < 2015 || bp.year > 2024) {
      skippedOutside++
      continue
    }

    // Energieträger extrahieren (mit Kernenergie-Sonderbehandlung)
    const { sources, nuclearFilled } = extractSources(row, bp.dateKey)
    if (sources === null) {
      skippedNonNumeric++
      continue
    }
    if (nuclearFilled) nuclearFilledCount++

    // Negative Erzeugungswerte erkennen und überspringen
    let hasNegative = false
    const sourceKeys = Object.keys(sources) as (keyof EnergySourceAccum)[]
    for (const key of sourceKeys) {
      if (sources[key] < -0.001) {
        hasNegative = true
        if (negativeExamples.length < 5) {
          negativeExamples.push(
            `  ${bp.dateKey} ${String(bp.hour).padStart(2, '0')}:00 – ${key} = ${sources[key]} MWh`,
          )
        }
      }
    }
    if (hasNegative) {
      skippedNegative++
      continue
    }

    // Gesamterzeugung – falls ≤ 0 ist die Stunde nicht verwertbar
    const totalGen = calcTotalSum(sources)
    if (totalGen <= 0) {
      skippedZeroTotal++
      continue
    }

    validCount++

    // Fachliche Kennzahlen pro Stunde (erzeugungsgewichtet, ungerundet)
    const co2Weighted = calcCo2Weighted(sources, factors)
    const renewableGen = calcRenewableSum(sources)

    // --- monthlyMix (Bucket: YYYY-MM) ---
    let mb = monthBuckets.get(bp.monthKey)
    if (!mb) {
      mb = { sources: emptySources(), totalGen: 0, co2Weighted: 0, count: 0 }
      monthBuckets.set(bp.monthKey, mb)
    }
    for (const key of sourceKeys) mb.sources[key] += sources[key]
    mb.totalGen += totalGen
    mb.co2Weighted += co2Weighted
    mb.count++

    // --- heatmapCo2 (Bucket: YYYY-MM-HH) ---
    const heatKey = `${bp.year}-${String(bp.month).padStart(2, '0')}-${String(bp.hour).padStart(2, '0')}`
    let hb = heatmapBuckets.get(heatKey)
    if (!hb) {
      hb = { co2Weighted: 0, totalGen: 0, count: 0 }
      heatmapBuckets.set(heatKey, hb)
    }
    hb.co2Weighted += co2Weighted
    hb.totalGen += totalGen
    hb.count++

    // --- scatterDaily (Bucket: YYYY-MM-DD) ---
    let db = dayBuckets.get(bp.dateKey)
    if (!db) {
      db = { renewableGen: 0, totalGen: 0, co2Weighted: 0, count: 0 }
      dayBuckets.set(bp.dateKey, db)
    }
    db.renewableGen += renewableGen
    db.totalGen += totalGen
    db.co2Weighted += co2Weighted
    db.count++

    // --- yearlyMix (Bucket: YYYY) ---
    const yearKey = String(bp.year)
    let yb = yearBuckets.get(yearKey)
    if (!yb) {
      yb = { sources: emptySources(), totalGen: 0, renewableGen: 0, co2Weighted: 0, count: 0 }
      yearBuckets.set(yearKey, yb)
    }
    for (const key of sourceKeys) yb.sources[key] += sources[key]
    yb.totalGen += totalGen
    yb.renewableGen += renewableGen
    yb.co2Weighted += co2Weighted
    yb.count++
  }

  // Auswertung der Skip-Statistiken
  console.log(`\nAuswertung:`)
  console.log(`  Gültige Stunden (Berlin 2015–2024):     ${validCount}`)
  console.log(`  Außerhalb Berliner Jahre 2015–2024:    ${skippedOutside}`)
  console.log(`  Unvollständige Datensätze:             ${skippedNonNumeric}`)
  console.log(`  Negative Erzeugungswerte:              ${skippedNegative}`)
  console.log(`  Gesamterzeugung <= 0:                  ${skippedZeroTotal}`)
  console.log(`  Strukturell ergänzte Kernenergie-Nullen: ${nuclearFilledCount}`)

  if (negativeExamples.length > 0) {
    console.log(`\nBeispiele negativer Werte:`)
    for (const ex of negativeExamples) console.log(ex)
  }

  const totalSkipped = skippedNonNumeric + skippedNegative + skippedZeroTotal
  const totalProcessed = validCount + totalSkipped
  const skipFraction = totalProcessed > 0 ? totalSkipped / totalProcessed : 0

  if (totalSkipped > 0) {
    console.log(`\nWirklich übersprungene Stunden: ${totalSkipped} (${(skipFraction * 100).toFixed(2)} %)`)
    if (skipFraction > MAX_SKIP_FRACTION) {
      throw new Error(
        `Mehr als ${MAX_SKIP_FRACTION * 100}% der Stunden übersprungen (${(skipFraction * 100).toFixed(1)}%). ` +
        'Abbruch, um keine irreführende Datei zu erzeugen.',
      )
    }
  }

  // Finale Arrays: erst nach vollständiger Akkumulation runden
  const monthlyMix = finalizeMonthlyMix(monthBuckets)
  const heatmapCo2 = finalizeHeatmapCo2(heatmapBuckets)
  const scatterDaily = finalizeScatterDaily(dayBuckets)
  const yearlyMix = finalizeYearlyMix(yearBuckets)

  // Qualitätsprüfung vor dem Schreiben
  console.log('\nPrüfe finale Daten auf nicht-endliche Werte...')
  const output = { monthlyMix, heatmapCo2, scatterDaily, yearlyMix }
  deepCheckFinite(output, 'output')

  // Ausgabe
  const json = JSON.stringify(output, null, 2)
  await Bun.write('public/data/visualization-data.json', json)

  const fileSizeMB = (new TextEncoder().encode(json).length / 1024 / 1024).toFixed(2)
  console.log(`\nGespeichert: visualization-data.json (${fileSizeMB} MB)`)
  console.log(`  monthlyMix:     ${monthlyMix.length} Monate`)
  console.log(`  heatmapCo2:     ${heatmapCo2.length} Zellen`)
  console.log(`  scatterDaily:   ${scatterDaily.length} Tage`)
  console.log(`  yearlyMix:      ${yearlyMix.length} Jahre`)
}

// ===========================================================================
// Einstieg
// ===========================================================================

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Fehler:', message)
  process.exit(1)
})
