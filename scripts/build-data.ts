/**
 * Erstellt die Datei visualization-data.json aus den SMARD-Daten.
 *
 * Das Skript lädt die stündlichen Erzeugungsdaten und die
 * Emissionsfaktoren und aggregiert sie zu Monats-, Tages- und
 * Jahreswerten.
 *
 * Alle Zeitangaben werden in Berliner Lokalzeit ausgewertet.
 *
 * MIT KI: Unterstützung bei der Verarbeitung der Berliner Zeitzone,
 * bei der TypeScript-Typisierung dynamischer Feldnamen, bei der
 * Umstellung der ursprünglich sehr langen Hauptfunktion auf kleinere
 * Hilfsfunktionen und beim Aufbau der Fehlerbehandlung.
 *
 * OHNE KI: Fachliche Zuordnung der Energieträger, Aggregation der
 * Daten und Berechnung der Ausgabegrößen wurden selbst erstellt.
 *
 * @author Selina Schneider
 */

// Bun stellt diese Funktionen zur Laufzeit bereit.
// Die Deklaration wird für die TypeScript-Prüfung benötigt.
declare var Bun: {
  file(path: string): {
    exists(): Promise<boolean>
    json(): Promise<unknown>
  }
  write(path: string, data: string): Promise<number>
}

import type {
  MonthlyMixPoint,
  ScatterDailyPoint,
  YearlyMixPoint,
} from '../types/visualization-data'

/**
 * Enthält die Erzeugungswerte aller verwendeten Energieträger.
 * Die Werte werden in MWh gespeichert.
 *
 * OHNE KI: Die Interfaces bilden die benötigten Datenstrukturen
 * des Projekts ab und wurden selbst erstellt.
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
 * Enthält die Emissionsfaktoren in Gramm CO₂ pro kWh.
 * Die Schlüssel entsprechen den Feldnamen der SMARD-Daten.
 */
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
  co2Weighted: number
  count: number
}

/** Sammelt die Werte für einen Tag. */
interface DayBucket {
  renewableGen: number
  totalGen: number
  co2Weighted: number
  count: number
}

/** Sammelt die Werte für ein Jahr. */
interface YearBucket {
  sources: EnergySourceAccum
  totalGen: number
  renewableGen: number
  co2Weighted: number
  count: number
}

/**
 * Verbindet die deutschen Feldnamen aus SMARD mit den
 * englischen Schlüsseln im Projekt.
 *
 * OHNE KI: Die Zuordnung der Energieträger wurde passend zu den
 * verwendeten SMARD-Daten selbst festgelegt.
 */
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

/** Feldnamen der erneuerbaren Energieträger. */
// OHNE KI: Die Einteilung in erneuerbare und fossile Energieträger
// wurde selbst festgelegt.
const RENEWABLE_FIELDS = new Set([
  'biomasse',
  'wasserkraft',
  'windOnshore',
  'windOffshore',
  'solar',
  'sonstigeErneuerbare',
])

/**
 * Ab diesem Datum wird ein fehlender Kernenergiewert als 0 behandelt.
 * Die letzten deutschen Kernkraftwerke wurden am 15. April 2023
 * abgeschaltet.
 *
 * OHNE KI: Der Grenzwert für die Kernenergie und der Zeitpunkt des
 * Atomausstiegs sind selbst ermittelte fachliche Werte.
 */
const NUCLEAR_PHASEOUT_DATE = '2023-04-15'

/** Höchster erlaubter Anteil verworfener Stunden. */
// OHNE KI: Den Grenzwert von 10 Prozent habe ich selbst festgelegt.
const MAX_SKIP_FRACTION = 0.10

// MIT KI: Die Verarbeitung der Berliner Lokalzeit mit
// Intl.DateTimeFormat, timeZone: 'Europe/Berlin' und formatToParts()
// wurde mit KI-Unterstützung entwickelt.
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
 * OHNE KI: Einfache Hilfsfunktion – selbst erstellt.
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
 * OHNE KI: Einfache Rundungsfunktion – selbst erstellt.
 *
 * @param value Zahl, die gerundet werden soll
 * @returns Gerundete Zahl
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Liest Jahr, Monat, Tag und Stunde eines Zeitpunkts in
 * Berliner Lokalzeit aus.
 *
 * MIT KI: Die Verwendung von Intl.DateTimeFormat mit
 * timeZone: 'Europe/Berlin' und formatToParts() für die zuverlässige
 * Behandlung von Sommer- und Winterzeit wurde mit KI-Unterstützung
 * entwickelt.
 *
 * OHNE KI: Die Zuordnung der Parts zu year/month/day/hour sowie die
 * Bildung von dateKey und monthKey habe ich selbst geschrieben.
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
 * Fehlt nach dem Kernenergieausstieg nur der Wert für Kernenergie,
 * setze ich 0 ein. Fehlen andere Werte oder sind keine gültigen
 * Zahlen, gebe ich null zurück – die Zeile wird dann übersprungen.
 *
 * MIT KI: Bei der TypeScript-Typisierung der dynamischen Feldnamen
 * (Record<string, keyof …>, Casts an der Zugriffsstelle) wurde KI
 * genutzt.
 *
 * OHNE KI: Die fachliche Zuordnung der Energieträger und die
 * Behandlung des Kernenergieausstiegs habe ich selbst festgelegt.
 *
 * @param row Eine Zeile aus den geladenen SMARD-Daten
 * @param berlinDate Datum der Zeile in Berliner Lokalzeit
 * @returns Erzeugungswerte oder null bei unvollständiger Zeile
 */
function extractSources(
  row: Record<string, unknown>,
  berlinDate: string,
): EnergySourceAccum | null {
  const sources = createEmptySources()

  for (const germanField of GENERATION_FIELDS) {
    const rawValue = row[germanField]
    const sourceKey = GERMAN_TO_ENGLISH[germanField] as keyof EnergySourceAccum

    const nuclearIsMissing =
      germanField === 'kernenergie'
      && (rawValue === undefined || rawValue === null)

    // Nach dem Atomausstieg fehlt Kernenergie legitim – dann 0 einsetzen.
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
 * Berechnet die gewichtete CO₂-Summe einer Stunde.
 * Jeder Erzeugungswert wird mit dem passenden Emissionsfaktor
 * multipliziert.
 *
 * MIT KI: Die dynamischen Schlüsselzugriffe (GERMAN_TO_ENGLISH,
 * Casts zu keyof) wurden mit KI-Unterstützung typisiert.
 * OHNE KI: Die Multiplikation von Erzeugungswert und Emissionsfaktor
 * sowie die Summenbildung sind selbst umgesetzt.
 *
 * @param sources Erzeugungswerte der Energieträger
 * @param factors Emissionsfaktoren der Energieträger
 * @returns Gewichtete CO₂-Summe
 */
function calculateCo2Weighted(
  sources: EnergySourceAccum,
  factors: EmissionFactors,
): number {
  let sum = 0

  for (const germanField of GENERATION_FIELDS) {
    const sourceKey =
      GERMAN_TO_ENGLISH[germanField] as keyof EnergySourceAccum

    const generation = sources[sourceKey]
    const factor = factors[germanField as keyof EmissionFactors]

    sum += generation * factor
  }

  return sum
}

/**
 * Addiert die Erzeugung aller erneuerbaren Energieträger.
 *
 * MIT KI: Die dynamischen Schlüsselzugriffe wurden mit
 * KI-Unterstützung typisiert.
 * OHNE KI: Die Summenberechnung und das Filtern nach erneuerbaren
 * Energieträgern sind selbst umgesetzt.
 *
 * @param sources Erzeugungswerte der Energieträger
 * @returns Erneuerbare Erzeugung in MWh
 */
function calculateRenewableGeneration(sources: EnergySourceAccum): number {
  let sum = 0

  for (const germanField of GENERATION_FIELDS) {
    if (RENEWABLE_FIELDS.has(germanField)) {
      const sourceKey =
        GERMAN_TO_ENGLISH[germanField] as keyof EnergySourceAccum

      sum += sources[sourceKey]
    }
  }

  return sum
}

/**
 * Addiert die Erzeugung aller Energieträger.
 *
 * OHNE KI: Einfache Summenberechnung mit einer Schleife – selbst
 * umgesetzt.
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
 * Erstellt die fertigen Monatswerte aus den gesammelten Daten.
 *
 * OHNE KI: Sortierung mit localeCompare, Berechnung der Ausgabewerte
 * und Rundung – selbst umgesetzt.
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
 * Erstellt die fertigen Tageswerte aus den gesammelten Daten.
 *
 * OHNE KI: Sortierung, Prozent- und CO₂-Berechnung sowie Rundung –
 * selbst umgesetzt.
 *
 * @param buckets Gesammelte Werte nach Tag
 * @returns Sortierte Tagesdaten für das Streudiagramm
 */
function finalizeScatterDaily(buckets: Map<string, DayBucket>): ScatterDailyPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (firstEntry, secondEntry) {
    return firstEntry[0].localeCompare(secondEntry[0])
  })

  return entries.map(function (entry) {
    const date = entry[0]
    const bucket = entry[1]

    return {
      date,
      renewableSharePercent: roundToTwoDecimals(
        (bucket.renewableGen / bucket.totalGen) * 100,
      ),
      co2GramsPerKwh: roundToTwoDecimals(bucket.co2Weighted / bucket.totalGen),
      availableHourCount: bucket.count,
    }
  })
}

/**
 * Erstellt die fertigen Jahreswerte aus den gesammelten Daten.
 *
 * OHNE KI: Sortierung, Berechnung der Jahreswerte (Prozent, CO₂)
 * und Rundung – selbst umgesetzt.
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
      co2GramsPerKwh: roundToTwoDecimals(bucket.co2Weighted / bucket.totalGen),
      availableHourCount: bucket.count,
    }
  })
}

/**
 * Lädt die SMARD-Daten aus der JSON-Datei.
 *
 * OHNE KI: Laden und Prüfen einer JSON-Datei mit Bun –
 * selbst umgesetzt.
 *
 * @returns Geladene SMARD-Zeilen
 * @throws Fehler, wenn die Datei fehlt oder keine Daten enthält
 */
async function loadSmardData(): Promise<Record<string, unknown>[]> {
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

  return data as Record<string, unknown>[]
}

/**
 * Lädt und prüft die Emissionsfaktoren.
 *
 * OHNE KI: Die Prüfung mit einer Schleife, typeof und Number.isFinite
 * habe ich selbst umgesetzt.
 *
 * MIT KI: Der abschließende Doppel-Cast
 * `as unknown as EmissionFactors` nach der vorherigen Prüfung wurde
 * mit KI-Hilfe gewählt – TypeScript lässt den direkten Cast von
 * `Record<string, number>` auf ein Interface mit festen Feldern sonst
 * nicht ohne Warnung durch.
 *
 * @returns Vollständige Emissionsfaktoren
 * @throws Fehler, wenn ein Faktor fehlt oder ungültig ist
 */
async function loadEmissionFactors(): Promise<EmissionFactors> {
  const file = Bun.file('emission_factors.json')
  const rawData: unknown = await file.json()

  if (rawData === null || typeof rawData !== 'object') {
    throw new Error('emission_factors.json enthält kein gültiges Objekt.')
  }

  const factorData = rawData as Record<string, unknown>
  const checkedFactors: Record<string, number> = {}

  for (const germanField of GENERATION_FIELDS) {
    const value = factorData[germanField]

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `emission_factors.json: '${germanField}' fehlt oder ist keine gültige Zahl (${value}).`,
      )
    }

    checkedFactors[germanField] = value
  }

  return checkedFactors as unknown as EmissionFactors
}

/**
 * Addiert die Werte einer Stunde zu einem Monats-Bucket.
 *
 * OHNE KI: Aggregation mit Map und Schleife – selbst umgesetzt.
 *
 * @param buckets Monats-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToMonthBucket(
  buckets: Map<string, MonthBucket>,
  dateParts: BerlinDateParts,
  sources: EnergySourceAccum,
  totalGeneration: number,
  co2Weighted: number,
): void {
  let bucket = buckets.get(dateParts.monthKey)

  if (bucket === undefined) {
    bucket = {
      sources: createEmptySources(),
      totalGen: 0,
      co2Weighted: 0,
      count: 0,
    }

    buckets.set(dateParts.monthKey, bucket)
  }

  const sourceKeys = Object.keys(sources) as (keyof EnergySourceAccum)[]

  for (const key of sourceKeys) {
    bucket.sources[key] += sources[key]
  }

  bucket.totalGen += totalGeneration
  bucket.co2Weighted += co2Weighted
  bucket.count++
}

/**
 * Addiert die Werte einer Stunde zu einem Tages-Bucket.
 *
 * OHNE KI: Aggregation mit Map und Schleife – selbst umgesetzt.
 *
 * @param buckets Tages-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param renewableGeneration Erneuerbare Erzeugung der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToDayBucket(
  buckets: Map<string, DayBucket>,
  dateParts: BerlinDateParts,
  renewableGeneration: number,
  totalGeneration: number,
  co2Weighted: number,
): void {
  let bucket = buckets.get(dateParts.dateKey)

  if (bucket === undefined) {
    bucket = { renewableGen: 0, totalGen: 0, co2Weighted: 0, count: 0 }
    buckets.set(dateParts.dateKey, bucket)
  }

  bucket.renewableGen += renewableGeneration
  bucket.totalGen += totalGeneration
  bucket.co2Weighted += co2Weighted
  bucket.count++
}

/**
 * Addiert die Werte einer Stunde zu einem Jahres-Bucket.
 *
 * OHNE KI: Aggregation mit Map und Schleife – selbst umgesetzt.
 *
 * @param buckets Jahres-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param renewableGeneration Erneuerbare Erzeugung der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToYearBucket(
  buckets: Map<string, YearBucket>,
  dateParts: BerlinDateParts,
  sources: EnergySourceAccum,
  renewableGeneration: number,
  totalGeneration: number,
  co2Weighted: number,
): void {
  const key = String(dateParts.year)
  let bucket = buckets.get(key)

  if (bucket === undefined) {
    bucket = {
      sources: createEmptySources(),
      totalGen: 0,
      renewableGen: 0,
      co2Weighted: 0,
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
  bucket.co2Weighted += co2Weighted
  bucket.count++
}

/**
 * Prüft, ob ein Energieträger einen negativen Wert enthält.
 * Sehr kleine negative Abweichungen bis -0,001 toleriere ich –
 * das sind Rundungsdrifts in den Rohdaten.
 *
 * OHNE KI: Einfache Schleife mit Schwellenwert – selbst umgesetzt.
 *
 * @param sources Erzeugungswerte der Stunde
 * @returns true, wenn ein negativer Wert gefunden wurde
 */
function hasNegativeGeneration(sources: EnergySourceAccum): boolean {
  for (const value of Object.values(sources)) {
    if (value < -0.001) {
      return true
    }
  }

  return false
}

/**
 * Prüft, ob zu viele Stunden verworfen wurden.
 *
 * MIT KI: Der Aufbau dieses Sicherheitschecks (Berechnung von
 * totalProcessed und skipFraction, Abbruch bei Überschreitung)
 * wurde mit KI-Unterstützung erstellt.
 *
 * OHNE KI: Den Grenzwert von 10 Prozent (MAX_SKIP_FRACTION) habe
 * ich selbst festgelegt.
 *
 * @param validCount Anzahl gültiger Stunden
 * @param totalSkipped Summe aller wegen Datenqualität verworfenen Stunden
 * @throws Fehler, wenn der erlaubte Anteil überschritten wird
 */
function checkSkippedHours(validCount: number, totalSkipped: number): void {
  if (totalSkipped === 0) return

  const totalProcessed = validCount + totalSkipped
  const skipFraction = totalSkipped / totalProcessed
  const percent = (skipFraction * 100).toFixed(2)

  console.log(`\nWirklich übersprungene Stunden: ${totalSkipped} (${percent} %)`)

  if (skipFraction > MAX_SKIP_FRACTION) {
    const limit = MAX_SKIP_FRACTION * 100

    throw new Error(
      `Mehr als ${limit}% der Stunden übersprungen (${percent}%). `
      + 'Abbruch, um keine irreführende Datei zu erzeugen.',
    )
  }
}

/**
 * Führt die Datenaufbereitung aus und schreibt die fertige JSON-Datei.
 *
 * MIT KI: Die Aufteilung der ursprünglich sehr langen Hauptfunktion
 * in kleinere Hilfsfunktionen (Laden, Bucket-Addieren, Finalisieren)
 * entstand mit KI-Unterstützung.
 *
 * OHNE KI: Die Aggregation mit Schleifen, Maps und Buckets, die
 * Sortierung und Finalisierung der Daten sowie das Laden und
 * Schreiben der Dateien mit Bun wurden selbst umgesetzt.
 *
 * @returns Promise ohne Rückgabewert
 */
async function main(): Promise<void> {
  console.log('Lade SMARD-Daten...')
  const smardData = await loadSmardData()
  console.log(`${smardData.length} Rohdatensätze geladen`)

  console.log('Lade Emissionsfaktoren...')
  const emissionFactors = await loadEmissionFactors()
  console.log('Emissionsfaktoren geladen:', GENERATION_FIELDS.length, 'Träger')

  let validCount = 0
  let skippedOutside = 0
  let skippedNonNumeric = 0
  let skippedZeroTotal = 0
  let skippedNegative = 0

  const monthBuckets = new Map<string, MonthBucket>()
  const dayBuckets = new Map<string, DayBucket>()
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

    if (hasNegativeGeneration(sources)) {
      skippedNegative++
      continue
    }

    const totalGeneration = calculateTotalGeneration(sources)

    if (totalGeneration <= 0) {
      skippedZeroTotal++
      continue
    }

    validCount++

    const co2Weighted = calculateCo2Weighted(sources, emissionFactors)
    const renewableGeneration = calculateRenewableGeneration(sources)

    addToMonthBucket(monthBuckets, dateParts, sources, totalGeneration, co2Weighted)
    addToDayBucket(dayBuckets, dateParts, renewableGeneration, totalGeneration, co2Weighted)
    addToYearBucket(yearBuckets, dateParts, sources, renewableGeneration, totalGeneration, co2Weighted)
  }

  // Zusammenfassung direkt in main(), das war vorher eine eigene Funktion –
  // fand ich als extra Funktion mit 6 Parametern eher unübersichtlich.
  console.log('\nAuswertung:')
  console.log(`  Gültige Stunden (Berlin 2015–2024):  ${validCount}`)
  console.log(`  Außerhalb Berliner Jahre:            ${skippedOutside}`)
  console.log(`  Unvollständige Datensätze:           ${skippedNonNumeric}`)
  console.log(`  Negative Erzeugungswerte:            ${skippedNegative}`)
  console.log(`  Gesamterzeugung <= 0:                ${skippedZeroTotal}`)

  const totalSkipped = skippedNonNumeric + skippedNegative + skippedZeroTotal
  checkSkippedHours(validCount, totalSkipped)

  const monthlyMix = finalizeMonthlyMix(monthBuckets)
  const scatterDaily = finalizeScatterDaily(dayBuckets)
  const yearlyMix = finalizeYearlyMix(yearBuckets)

  const output = { monthlyMix, scatterDaily, yearlyMix }

  const json = JSON.stringify(output, null, 2)

  await Bun.write('public/data/visualization-data.json', json)

  const fileSizeBytes = new TextEncoder().encode(json).length
  const fileSizeMb = (fileSizeBytes / 1024 / 1024).toFixed(2)

  console.log(`\nGespeichert: visualization-data.json (${fileSizeMb} MB)`)
  console.log(`  monthlyMix:   ${monthlyMix.length} Monate`)
  console.log(`  scatterDaily: ${scatterDaily.length} Tage`)
  console.log(`  yearlyMix:    ${yearlyMix.length} Jahre`)
}

/**
 * Behandelt Fehler, die beim Start des Skripts auftreten.
 *
 * MIT KI: Die sichere Behandlung eines Fehlers vom Typ unknown mit
 * instanceof Error, um `error.message` sicher aufrufen zu können,
 * wurde mit KI-Hilfe umgesetzt.
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