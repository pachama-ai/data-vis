/**
 * scripts/build-data.ts — Neue Datenpipeline: Erzeugt visualization-data.json
 * ===========================================================================
 *
 * Liest ausschließlich SMARD-Erzeugungsdaten und UBA-Emissionsfaktoren.
 * Kein Preis-Join, keine Last-Daten, kein fossil_share.
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

// ---------------------------------------------------------------------------
// Feld-Mapping: Deutsch → Englisch
// Dieselbe Zuordnung wie in build_hourly.ts
// ---------------------------------------------------------------------------
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

/** Erneuerbare Energieträger (für EE-Anteil-Berechnung) */
const RENEWABLE_FIELDS = new Set([
  'biomasse', 'wasserkraft', 'windOnshore', 'windOffshore',
  'solar', 'sonstigeErneuerbare',
])

// ---------------------------------------------------------------------------
// Energie-Träger-Akkumulator (für Map-Werte)
// ---------------------------------------------------------------------------
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

function emptySources(): EnergySourceAccum {
  return {
    biomass: 0, hydro: 0, wind_onshore: 0, wind_offshore: 0,
    pv: 0, other_renewables: 0, lignite: 0, hardcoal: 0,
    gas: 0, nuclear: 0, other_fossil: 0, pumped_storage: 0,
  }
}

// ---------------------------------------------------------------------------
// Berliner Lokalzeit (entspricht utils/berlin.ts)
// ---------------------------------------------------------------------------
const berlinDateFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
})
const berlinYearFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' })
const berlinMonthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' })
const berlinHourFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23',
})

function berlinYear(ts: number): number {
  return Number(berlinYearFmt.format(ts))
}

function berlinMonth(ts: number): number {
  return Number(berlinMonthFmt.format(ts))
}

function berlinHour(ts: number): number {
  for (const part of berlinHourFmt.formatToParts(ts)) {
    if (part.type === 'hour') return Number(part.value)
  }
  return 0
}

/** Gibt "YYYY-MM-DD" in Berliner Lokalzeit zurück. */
function berlinDateKey(ts: number): string {
  const parts = berlinDateFmt.formatToParts(ts)
  let y = '', m = '', d = ''
  for (const p of parts) {
    if (p.type === 'year') y = p.value
    if (p.type === 'month') m = p.value
    if (p.type === 'day') d = p.value
  }
  return `${y}-${m}-${d}`
}

/** Gibt "YYYY-MM" in Berliner Lokalzeit zurück. */
function berlinMonthKey(ts: number): string {
  const y = berlinYear(ts)
  const m = String(berlinMonth(ts)).padStart(2, '0')
  return `${y}-${m}`
}

// ---------------------------------------------------------------------------
// Kernenergie-Abschaltdatum (15.04.2023, Berliner Lokalzeit)
// Letzte drei Kernkraftwerke (Emsland, Isar 2, Neckarwestheim 2)
// wurden an diesem Tag endgültig abgeschaltet. SMARD liefert das Feld
// kernenergie danach nicht mehr – die Erzeugung ist tatsächlich 0.
// ---------------------------------------------------------------------------
const NUCLEAR_PHASEOUT_DATE = '2023-04-15'

// ---------------------------------------------------------------------------
// Rundung (nur für finale Ausgabe, nicht während Akkumulation)
// ---------------------------------------------------------------------------
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// ---------------------------------------------------------------------------
// Rohdaten aus SMARD extrahieren
// ---------------------------------------------------------------------------
/**
 * Extrahiert die 12 Energieträger aus einem SMARD-Rohdatensatz.
 *
 * Kernenergie-Sonderfall: Fehlt das Feld nach dem 15.04.2023 (Berliner
 * Lokalzeit), wird es als 0 gesetzt – die Erzeugung ist seit der
 * endgültigen Abschaltung tatsächlich 0. Fehlt kernenergie vor diesem
 * Datum, gilt die Stunde als unvollständig.
 *
 * Fehlt ein anderer Energieträger (null/undefined/NaN), wird die gesamte
 * Stunde übersprungen.
 *
 * @returns Objekt mit sources (oder null bei Fehler) und Kernenergie-Status
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

// ---------------------------------------------------------------------------
// Emissionsfaktoren
// ---------------------------------------------------------------------------
interface EmissionFactors {
  [deField: string]: number
}

async function loadEmissionFactors(): Promise<EmissionFactors> {
  const file = Bun.file('emission_factors.json')
  const raw = (await file.json()) as Record<string, unknown>
  const factors: EmissionFactors = {}
  for (const deField of GENERATION_FIELDS) {
    const v = raw[deField]
    factors[deField] = typeof v === 'number' && isFinite(v) ? v : 0
  }
  return factors
}

// ---------------------------------------------------------------------------
// CO₂-Wert pro Stunde berechnen (erzeugungsgewichtet)
// ---------------------------------------------------------------------------
function calcCo2Weighted(sources: EnergySourceAccum, factors: EmissionFactors): number {
  let sum = 0
  for (const deField of GENERATION_FIELDS) {
    const enField = GERMAN_TO_ENGLISH[deField] as keyof EnergySourceAccum
    const mwh = sources[enField]
    const factor = factors[deField] ?? 0
    sum += mwh * factor
  }
  return sum
}

// ---------------------------------------------------------------------------
// EE-Summe berechnen
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Gesamtsumme berechnen
// ---------------------------------------------------------------------------
function calcTotalSum(sources: EnergySourceAccum): number {
  return Object.values(sources).reduce((a, b) => a + b, 0)
}

// ---------------------------------------------------------------------------
// Qualitätsprüfung für finale Werte
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// SMARD-Rohdaten laden
// ---------------------------------------------------------------------------
async function loadSmardData(): Promise<Record<string, unknown>[]> {
  const file = Bun.file('public/data/smard.json')
  if (!await file.exists()) {
    throw new Error('public/data/smard.json nicht gefunden. Führe zuerst download-smard.ts aus.')
  }
  const data = await file.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('public/data/smard.json enthält keine gültigen Daten.')
  }
  return data as Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// Plausibilitätsgrenze
// ---------------------------------------------------------------------------
const MAX_SKIP_FRACTION = 0.10

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Lade SMARD-Daten...')
  const smard = await loadSmardData()
  console.log(`${smard.length} Rohdatensätze geladen`)

  console.log('Lade Emissionsfaktoren...')
  const factors = await loadEmissionFactors()
  console.log('Emissionsfaktoren geladen:', Object.keys(factors).length, 'Träger')

  let validCount = 0
  let skippedOutside = 0
  let skippedNonNumeric = 0
  let skippedZeroTotal = 0
  let skippedNegative = 0
  let nuclearFilledCount = 0
  const negativeExamples: string[] = []

  // Akkumulatoren
  const monthBuckets = new Map<string, {
    sources: EnergySourceAccum; totalGen: number; co2Weighted: number; count: number
  }>()
  const heatmapBuckets = new Map<string, {
    co2Weighted: number; totalGen: number; count: number
  }>()
  const dayBuckets = new Map<string, {
    renewableGen: number; totalGen: number; co2Weighted: number; count: number
  }>()
  const yearBuckets = new Map<string, {
    sources: EnergySourceAccum; totalGen: number; renewableGen: number; co2Weighted: number; count: number
  }>()

  for (const row of smard) {
    const ts = row.timestamp

    // Timestamp muss eine Zahl sein (Sekunden oder Millisekunden)
    if (typeof ts !== 'number') {
      skippedOutside++
      continue
    }

    // Berliner Datumsteile berechnen – für Filter UND Gruppierung
    const year = berlinYear(ts)
    const month = berlinMonth(ts)
    const hour = berlinHour(ts)
    const dateKey = berlinDateKey(ts)
    const monthKey = berlinMonthKey(ts)

    // Zeitraum-Filter anhand Berliner Jahr: nur 2015–2024
    if (year < 2015 || year > 2024) {
      skippedOutside++
      continue
    }

    // Energieträger extrahieren (mit Kernenergie-Sonderbehandlung)
    const { sources, nuclearFilled } = extractSources(row, dateKey)
    if (sources === null) {
      skippedNonNumeric++
      continue
    }
    if (nuclearFilled) {
      nuclearFilledCount++
    }

    // Negative Werte erkennen
    let hasNegative = false
    for (const key of Object.keys(sources) as (keyof EnergySourceAccum)[]) {
      if (sources[key] < -0.001) {
        hasNegative = true
        if (negativeExamples.length < 5) {
          negativeExamples.push(
            `  ${dateKey} ${String(hour).padStart(2, '0')}:00 – ${key} = ${sources[key]} MWh`
          )
        }
      }
    }
    if (hasNegative) {
      skippedNegative++
      continue
    }

    // Gesamterzeugung berechnen
    const totalGen = calcTotalSum(sources)
    if (totalGen <= 0) {
      skippedZeroTotal++
      continue
    }

    validCount++

    // CO₂-gewichtete Erzeugung und EE-Summe
    const co2Weighted = calcCo2Weighted(sources, factors)
    const renewableGen = calcRenewableSum(sources)

    // --- monthlyMix ---
    let mb = monthBuckets.get(monthKey)
    if (!mb) {
      mb = { sources: emptySources(), totalGen: 0, co2Weighted: 0, count: 0 }
      monthBuckets.set(monthKey, mb)
    }
    for (const key of Object.keys(sources) as (keyof EnergySourceAccum)[]) {
      mb.sources[key] += sources[key]
    }
    mb.totalGen += totalGen
    mb.co2Weighted += co2Weighted
    mb.count++

    // --- heatmapCo2 ---
    const heatKey = `${year}-${String(month).padStart(2, '0')}-${String(hour).padStart(2, '0')}`
    let hb = heatmapBuckets.get(heatKey)
    if (!hb) {
      hb = { co2Weighted: 0, totalGen: 0, count: 0 }
      heatmapBuckets.set(heatKey, hb)
    }
    hb.co2Weighted += co2Weighted
    hb.totalGen += totalGen
    hb.count++

    // --- scatterDaily ---
    let db = dayBuckets.get(dateKey)
    if (!db) {
      db = { renewableGen: 0, totalGen: 0, co2Weighted: 0, count: 0 }
      dayBuckets.set(dateKey, db)
    }
    db.renewableGen += renewableGen
    db.totalGen += totalGen
    db.co2Weighted += co2Weighted
    db.count++

    // --- yearlyMix ---
    const yearKey = String(year)
    let yb = yearBuckets.get(yearKey)
    if (!yb) {
      yb = { sources: emptySources(), totalGen: 0, renewableGen: 0, co2Weighted: 0, count: 0 }
      yearBuckets.set(yearKey, yb)
    }
    for (const key of Object.keys(sources) as (keyof EnergySourceAccum)[]) {
      yb.sources[key] += sources[key]
    }
    yb.totalGen += totalGen
    yb.renewableGen += renewableGen
    yb.co2Weighted += co2Weighted
    yb.count++
  }

  // -----------------------------------------------------------------------
  // Zwischenergebnisse
  // -----------------------------------------------------------------------
  console.log(`\nAuswertung:`)
  console.log(`  Gültige Stunden (Berlin 2015–2024):     ${validCount}`)
  console.log(`  Außerhalb Berliner Jahre 2015–2024:    ${skippedOutside}`)
  console.log(`  Unvollständige Datensätze:             ${skippedNonNumeric}`)
  console.log(`  Negative Erzeugungswerte:              ${skippedNegative}`)
  console.log(`  Gesamterzeugung <= 0:                  ${skippedZeroTotal}`)
  console.log(`  Strukturell ergänzte Kernenergie-Nullen: ${nuclearFilledCount}`)

  if (negativeExamples.length > 0) {
    console.log(`\nBeispiele negativer Werte:`)
    for (const ex of negativeExamples) {
      console.log(ex)
    }
  }

  const totalSkipped = skippedNonNumeric + skippedNegative + skippedZeroTotal
  const totalProcessed = validCount + totalSkipped
  const skipFraction = totalProcessed > 0 ? totalSkipped / totalProcessed : 0

  if (totalSkipped > 0) {
    console.log(`\nWirklich übersprungene Stunden: ${totalSkipped} (${(skipFraction * 100).toFixed(2)} %)`)
    if (skipFraction > MAX_SKIP_FRACTION) {
      throw new Error(
        `Mehr als ${MAX_SKIP_FRACTION * 100} % der Stunden übersprungen (${(skipFraction * 100).toFixed(1)} %). ` +
        'Abbruch, um keine irreführende Datei zu erzeugen.'
      )
    }
  }

  // -----------------------------------------------------------------------
  // Arrays bauen (gerundet)
  // -----------------------------------------------------------------------
  const monthlyMix = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      sources: b.sources,
      totalGenerationMwh: round2(b.totalGen),
      availableHourCount: b.count,
    }))

  const heatmapCo2 = [...heatmapBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const [yearStr, monthStr, hourStr] = key.split('-')
      return {
        year: Number(yearStr),
        month: Number(monthStr),
        hour: Number(hourStr),
        co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
        observationCount: b.count,
      }
    })

  const scatterDaily = [...dayBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      renewableSharePercent: round2((b.renewableGen / b.totalGen) * 100),
      co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
      availableHourCount: b.count,
    }))

  const yearlyMix = [...yearBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearStr, b]) => ({
      year: Number(yearStr),
      sources: b.sources,
      totalGenerationMwh: round2(b.totalGen),
      renewableSharePercent: round2((b.renewableGen / b.totalGen) * 100),
      co2GramsPerKwh: round2(b.co2Weighted / b.totalGen),
      availableHourCount: b.count,
    }))

  // -----------------------------------------------------------------------
  // Qualitätsprüfung vor dem Schreiben
  // -----------------------------------------------------------------------
  console.log('\nPrüfe finale Daten auf nicht-endliche Werte...')
  const output = { monthlyMix, heatmapCo2, scatterDaily, yearlyMix }
  deepCheckFinite(output, 'output')

  // -----------------------------------------------------------------------
  // Ausgabe schreiben (erst nach erfolgreicher Prüfung)
  // -----------------------------------------------------------------------
  const json = JSON.stringify(output, null, 2)
  await Bun.write('public/data/visualization-data.json', json)

  const fileSizeMB = (new TextEncoder().encode(json).length / 1024 / 1024).toFixed(2)
  console.log(`\nGespeichert: visualization-data.json (${fileSizeMB} MB)`)
  console.log(`  monthlyMix:     ${monthlyMix.length} Monate`)
  console.log(`  heatmapCo2:     ${heatmapCo2.length} Zellen`)
  console.log(`  scatterDaily:   ${scatterDaily.length} Tage`)
  console.log(`  yearlyMix:      ${yearlyMix.length} Jahre`)
  console.log('Fertig!')
}

main().catch((err) => {
  console.error('Fehler:', err.message)
})
