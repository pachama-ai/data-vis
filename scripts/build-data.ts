/**
 * Erstellt die Datei visualization-data.json aus den SMARD-Daten.
 *
 * Das Skript lädt die stündlichen Erzeugungsdaten und aggregiert sie
 * zu Monats- und Jahreswerten.
 *
 * Alle Zeitangaben werden in Berliner Lokalzeit ausgewertet, weil
 * SMARD selbst UTC-Zeitstempel liefert und ich Monats- und
 * Jahresgrenzen so haben wollte, wie sie in Deutschland tatsächlich
 * gelten (inklusive Sommer-/Winterzeit).
 *
 * @author Selina Schneider
 */

// Bun stellt diese Funktionen zur Laufzeit bereit.
// Deklaration wird für TypeScript-Prüfung benötigt.
declare var Bun: {
  file(path: string): {
    exists(): Promise<boolean>
    json(): Promise<unknown>
  }
  write(path: string, data: string): Promise<number>
}

import type {
  MonthlyMixPoint,
  YearlyMixPoint,
} from '../types/visualization-data'

/**
 * Enthält die Erzeugungswerte aller verwendeten Energieträger.
 * Die Werte werden in MWh gespeichert.
 */
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

/**
 * Eine Zeile aus der von download-smard.ts erzeugten smard.json.
 * Alle Felder außer timestamp sind optional, weil nach dem
 * Kernenergieausstieg der Wert für kernenergie fehlen kann.
 */
interface SmardRow {
  timestamp: number
  biomasse?: number
  wasserkraft?: number
  windOnshore?: number
  windOffshore?: number
  solar?: number
  sonstigeErneuerbare?: number
  kernenergie?: number
  braunkohle?: number
  steinkohle?: number
  erdgas?: number
  sonstigeKonventionelle?: number
  pumpspeicher?: number
}

/** Enthält die Teile eines Zeitpunkts in Berliner Lokalzeit. */
interface BerlinDateParts {
  year: number
  month: number
  day: number
  hour: number
  dateKey: string
  monthKey: string
}

/** Sammelt die Werte für einen Monat. */
interface MonthBucket {
  sources: EnergySourceAccum
  totalGen: number
  count: number
}

/** Sammelt die Werte für ein Jahr. */
interface YearBucket {
  sources: EnergySourceAccum
  totalGen: number
  renewableGen: number
  count: number
}

/** Ergebnis von processData(). */
interface ProcessResult {
  monthBuckets: Map<string, MonthBucket>
  yearBuckets: Map<string, YearBucket>
  validCount: number
  skippedOutside: number
  skippedNonNumeric: number
  skippedZeroTotal: number
  totalSkipped: number
}

/** Fertige Monats- und Jahresdaten für die JSON-Datei. */
interface VisualizationOutput {
  monthlyMix: MonthlyMixPoint[]
  yearlyMix: YearlyMixPoint[]
}

/**
 * Verbindet die deutschen Feldnamen aus SMARD mit den
 * englischen Schlüsseln im Projekt.
 */
const GERMAN_TO_ENGLISH = {
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
} as const

const GENERATION_FIELDS = Object.keys(GERMAN_TO_ENGLISH) as (keyof typeof GERMAN_TO_ENGLISH)[]

/** Feldnamen der erneuerbaren Energieträger. */
const RENEWABLE_FIELDS = new Set([
  'biomasse',
  'wasserkraft',
  'windOnshore',
  'windOffshore',
  'solar',
  'sonstigeErneuerbare',
])

/**
 * Die letzten deutschen Kernkraftwerke wurden am 15. April 2023 abgeschaltet.
 */
const NUCLEAR_PHASEOUT_DATE = '2023-04-15'

// Intl.DateTimeFormat mit timeZone: 'Europe/Berlin' rechnet die
// UTC-Zeitstempel automatisch in Berliner Lokalzeit um, inklusive
// Sommer-/Winterzeit-Umstellung. formatToParts() gibt mir Jahr, Monat
// und Tag dann einzeln zurück statt als fertigen String.
const berlinDateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const berlinHourFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: 'numeric',
  hourCycle: 'h23',
})


/**
 * Erstellt ein leeres Objekt für die Erzeugungswerte.
 *
 * @returns Alle Energieträger mit dem Startwert 0
 */
function createEmptySources(): EnergySourceAccum {
  return {
    biomass: 0,
    hydro: 0,
    wind_onshore: 0,
    wind_offshore: 0,
    pv: 0,
    other_renewables: 0,
    lignite: 0,
    hardcoal: 0,
    gas: 0,
    nuclear: 0,
    other_fossil: 0,
    pumped_storage: 0,
  }
}

/**
 * Rundet eine Zahl auf zwei Nachkommastellen.
 *
 * @param value Zahl, die gerundet werden soll
 * @returns Gerundete Zahl
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Liest Jahr, Monat, Tag und Stunde eines Zeitpunkts in Berliner
 * Lokalzeit aus und baut daraus gleich die Bucket-Schlüssel.
 * Datum und Stunde hole ich mit zwei getrennten
 * Formatern, weil ich für die Stunde das 24-Stunden-Format
 * (hourCycle: 'h23') brauche, für das Datum aber nicht.
 *
 * @param timestamp Unix-Zeitstempel in Millisekunden
 * @returns Datumsteile und passende Schlüssel für Tag und Monat
 */
function getBerlinDateParts(timestamp: number): BerlinDateParts {
  const dateParts = berlinDateFormat.formatToParts(timestamp)

  let year = 0
  let month = 0
  let day = 0

  for (const part of dateParts) {
    if (part.type === 'year') year = Number(part.value)
    if (part.type === 'month') month = Number(part.value)
    if (part.type === 'day') day = Number(part.value)
  }

  let hour = 0
  const hourParts = berlinHourFormat.formatToParts(timestamp)

  for (const part of hourParts) {
    if (part.type === 'hour') hour = Number(part.value)
  }

  const monthText = String(month).padStart(2, '0')
  const dayText = String(day).padStart(2, '0')

  return {
    year,
    month,
    day,
    hour,
    dateKey: `${year}-${monthText}-${dayText}`,
    monthKey: `${year}-${monthText}`,
  }
}

/**
 * Liest die Erzeugungswerte aus einer SMARD-Zeile.
 *
 * Fehlt nach dem Kernenergieausstieg (15. April 2023) nur der
 * Kernenergie-Wert, setze ich 0 ein – ab diesem Datum liefert SMARD
 * keine Kernenergiedaten mehr, weil die letzten Meiler endgültig
 * abgeschaltet sind. Fehlen andere Werte oder sind keine gültigen
 * Zahlen, gebe ich null zurück – die Zeile wird dann übersprungen.
 *
 * @param row Eine Zeile aus den geladenen SMARD-Daten
 * @param berlinDate Datum der Zeile in Berliner Lokalzeit
 * @returns Erzeugungswerte oder null bei unvollständiger Zeile
 */
function extractSources(
  row: SmardRow,
  berlinDate: string,
): EnergySourceAccum | null {
  const sources = createEmptySources()

  for (const germanField of GENERATION_FIELDS) {
    const rawValue = row[germanField]
    const sourceKey = GERMAN_TO_ENGLISH[germanField]

    const nuclearIsMissing =
      germanField === 'kernenergie'
      && (rawValue === undefined || rawValue === null)

    // Nach dem Atomausstieg fehlt Kernenergie – dann 0 einsetzen.
    if (nuclearIsMissing) {
      if (berlinDate > NUCLEAR_PHASEOUT_DATE) {
        sources[sourceKey] = 0
        continue
      }

      return null
    }

    if (rawValue === null || rawValue === undefined) {
      return null
    }

    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return null
    }

    sources[sourceKey] = rawValue
  }

  return sources
}

/**
 * Addiert die Erzeugung aller erneuerbaren Energieträger.
 *
 * @param sources Erzeugungswerte der Energieträger
 * @returns Erneuerbare Erzeugung in MWh
 */
function calculateRenewableGeneration(sources: EnergySourceAccum): number {
  let sum = 0

  for (const germanField of GENERATION_FIELDS) {
    if (RENEWABLE_FIELDS.has(germanField)) {
      const sourceKey = GERMAN_TO_ENGLISH[germanField]

      sum += sources[sourceKey]
    }
  }

  return sum
}

/**
 * Addiert die Erzeugung aller Energieträger.
 *
 * @param sources Erzeugungswerte der Energieträger
 * @returns Gesamte Erzeugung in MWh
 */
function calculateTotalGeneration(sources: EnergySourceAccum): number {
  let sum = 0

  for (const value of Object.values(sources)) {
    sum += value
  }

  return sum
}

/**
 * Erstellt die fertigen Monatswerte aus den gesammelten Daten. Die
 * Monatsschlüssel ("YYYY-MM") lassen sich mit localeCompare direkt
 * chronologisch sortieren, ohne sie erst in ein Date umzuwandeln.
 *
 * @param buckets Gesammelte Werte nach Monat
 * @returns Sortierte Monatsdaten für die Visualisierung
 */
function finalizeMonthlyMix(buckets: Map<string, MonthBucket>): MonthlyMixPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (firstEntry, secondEntry) {
    return firstEntry[0].localeCompare(secondEntry[0])
  })

  return entries.map(function (entry) {
    const month = entry[0]
    const bucket = entry[1]

    return {
      month,
      sources: bucket.sources,
      totalGenerationMwh: roundToTwoDecimals(bucket.totalGen),
      availableHourCount: bucket.count,
    }
  })
}

/**
 * Erstellt die fertigen Jahreswerte aus den gesammelten Daten.
 *
 * @param buckets Gesammelte Werte nach Jahr
 * @returns Sortierte Jahresdaten für die Visualisierung
 */
function finalizeYearlyMix(buckets: Map<string, YearBucket>): YearlyMixPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (firstEntry, secondEntry) {
    return firstEntry[0].localeCompare(secondEntry[0])
  })

  return entries.map(function (entry) {
    const year = entry[0]
    const bucket = entry[1]

    return {
      year: Number(year),
      sources: bucket.sources,
      totalGenerationMwh: roundToTwoDecimals(bucket.totalGen),
      renewableSharePercent: roundToTwoDecimals(
        (bucket.renewableGen / bucket.totalGen) * 100,
      ),
      availableHourCount: bucket.count,
    }
  })
}

/**
 * Lädt die SMARD-Daten aus der JSON-Datei.
 *
 * @returns Geladene SMARD-Zeilen
 * @throws Fehler, wenn die Datei fehlt oder keine Daten enthält
 */
async function loadSmardData(): Promise<SmardRow[]> {
  const file = Bun.file('public/data/smard.json')
  const exists = await file.exists()

  if (!exists) {
    throw new Error(
      'public/data/smard.json nicht gefunden. Führe zuerst download-smard.ts aus.',
    )
  }

  const data: unknown = await file.json()

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('public/data/smard.json enthält keine gültigen Daten.')
  }

  return data as SmardRow[]
}

/**
 * Addiert die Werte einer Stunde zu einem Monats-Bucket.
 *
 * @param buckets Monats-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 */
function addToMonthBucket(
  buckets: Map<string, MonthBucket>,
  dateParts: BerlinDateParts,
  sources: EnergySourceAccum,
  totalGeneration: number,
): void {
  let bucket = buckets.get(dateParts.monthKey)

  if (bucket === undefined) {
    bucket = {
      sources: createEmptySources(),
      totalGen: 0,
      count: 0,
    }

    buckets.set(dateParts.monthKey, bucket)
  }

  const sourceKeys = Object.keys(sources) as (keyof EnergySourceAccum)[]

  for (const key of sourceKeys) {
    bucket.sources[key] += sources[key]
  }

  bucket.totalGen += totalGeneration
  bucket.count++
}

/**
 * Addiert die Werte einer Stunde zu einem Jahres-Bucket.
 *
 * @param buckets Jahres-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param renewableGeneration Erneuerbare Erzeugung der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 */
function addToYearBucket(
  buckets: Map<string, YearBucket>,
  dateParts: BerlinDateParts,
  sources: EnergySourceAccum,
  renewableGeneration: number,
  totalGeneration: number,
): void {
  const key = String(dateParts.year)
  let bucket = buckets.get(key)

  if (bucket === undefined) {
    bucket = {
      sources: createEmptySources(),
      totalGen: 0,
      renewableGen: 0,
      count: 0,
    }

    buckets.set(key, bucket)
  }

  const sourceKeys = Object.keys(sources) as (keyof EnergySourceAccum)[]

  for (const sourceKey of sourceKeys) {
    bucket.sources[sourceKey] += sources[sourceKey]
  }

  bucket.totalGen += totalGeneration
  bucket.renewableGen += renewableGeneration
  bucket.count++
}

/**
 * Läuft über alle SMARD-Zeilen, prüft jede einzeln auf Gültigkeit und
 * sammelt die gültigen Zeilen in Monats- und Jahres-Buckets.
 *
 * @param smardData Geladene SMARD-Zeilen
 * @returns Gefüllte Buckets und Zähler für die Auswertung
 */
function processData(
  smardData: SmardRow[],
): ProcessResult {
  let validCount = 0
  let skippedOutside = 0
  let skippedNonNumeric = 0
  let skippedZeroTotal = 0

  const monthBuckets = new Map<string, MonthBucket>()
  const yearBuckets = new Map<string, YearBucket>()

  for (const row of smardData) {
    const timestamp = row.timestamp

    if (typeof timestamp !== 'number') {
      skippedOutside++
      continue
    }

    const dateParts = getBerlinDateParts(timestamp)

    if (dateParts.year < 2015 || dateParts.year > 2024) {
      skippedOutside++
      continue
    }

    const sources = extractSources(row, dateParts.dateKey)

    if (sources === null) {
      skippedNonNumeric++
      continue
    }

    const totalGeneration = calculateTotalGeneration(sources)

    if (totalGeneration <= 0) {
      skippedZeroTotal++
      continue
    }

    validCount++

    const renewableGeneration = calculateRenewableGeneration(sources)

    addToMonthBucket(monthBuckets, dateParts, sources, totalGeneration)
    addToYearBucket(yearBuckets, dateParts, sources, renewableGeneration, totalGeneration)
  }

  const totalSkipped = skippedNonNumeric + skippedZeroTotal

  return {
    monthBuckets,
    yearBuckets,
    validCount,
    skippedOutside,
    skippedNonNumeric,
    skippedZeroTotal,
    totalSkipped,
  }
}

/**
 * Gibt die Auswertung von processData() auf der Konsole aus.
 * @param result Ergebnis von processData()
 */
function printEvaluation(result: ProcessResult): void {
  console.log('\nAuswertung:')
  console.log(`  Gültige Stunden (Berlin 2015–2024):  ${result.validCount}`)
  console.log(`  Außerhalb Berliner Jahre:            ${result.skippedOutside}`)
  console.log(`  Unvollständige Datensätze:           ${result.skippedNonNumeric}`)
  console.log(`  Gesamterzeugung <= 0:                ${result.skippedZeroTotal}`)
}

/**
 * Baut aus den gefüllten Buckets die fertigen Monats- und
 * Jahresdaten für die JSON-Datei.
 *
 * @param result Ergebnis von processData()
 * @returns Fertige Daten für visualization-data.json
 */
function createOutput(result: ProcessResult): VisualizationOutput {
  const monthlyMix = finalizeMonthlyMix(result.monthBuckets)
  const yearlyMix = finalizeYearlyMix(result.yearBuckets)

  return { monthlyMix, yearlyMix }
}

/**
 * Schreibt die fertigen Daten als JSON-Datei und gibt danach die
 * abschließende Zusammenfassung auf der Konsole aus.
 *
 * @param output Fertige Daten für visualization-data.json
 */
async function writeOutput(output: VisualizationOutput): Promise<void> {
  const json = JSON.stringify(output, null, 2)

  await Bun.write('public/data/visualization-data.json', json)

  const fileSizeBytes = new TextEncoder().encode(json).length
  const fileSizeMb = (fileSizeBytes / 1024 / 1024).toFixed(2)

  console.log(`\nGespeichert: visualization-data.json (${fileSizeMb} MB)`)
  console.log(`  monthlyMix: ${output.monthlyMix.length} Monate`)
  console.log(`  yearlyMix:  ${output.yearlyMix.length} Jahre`)
}

/**
 * Führt die Datenaufbereitung aus und schreibt die fertige JSON-Datei.
 */
async function main(): Promise<void> {
  console.log('Lade SMARD-Daten...')
  const smardData = await loadSmardData()
  console.log(`${smardData.length} Rohdatensätze geladen`)

  const result = processData(smardData)

  printEvaluation(result)

  const output = createOutput(result)

  await writeOutput(output)
}

/**
 * Behandelt Fehler, die beim Start des Skripts auftreten.
 *
 * @param error Aufgetretener Fehler
 */
function handleMainError(error: unknown): void {
  let message = String(error)

  if (error instanceof Error) {
    message = error.message
  }

  console.error('Fehler:', message)
  process.exit(1)
}

main().catch(handleMainError)