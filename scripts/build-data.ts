/**
 * Erstellt die Datei visualization-data.json aus den SMARD-Daten.
 *
 * Das Skript lädt die stündlichen Erzeugungsdaten und die
 * Emissionsfaktoren. Daraus entstehen die Datensätze für
 * Monatswerte, Heatmap, Streudiagramm und Jahresvergleich.
 *
 * Alle Zeitangaben werden in Berliner Lokalzeit ausgewertet.
 *
 * @author Selina Schneider
 * @lastModified 23.07.2026
 */

// Bun stellt diese Funktionen zur Laufzeit bereit.
// Die Deklaration wird für die TypeScript-Prüfung benötigt.
declare var Bun: {
  file(path: string): {
    exists(): Promise&lt;boolean&gt;
    json(): Promise&lt;unknown&gt;
  }
  write(path: string, data: string): Promise&lt;number&gt;
}

import type {
  HeatmapCo2Cell,
  MonthlyMixPoint,
  ScatterDailyPoint,
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

/**
 * Enthält die Teile eines Zeitpunkts in Berliner Lokalzeit.
 */
interface BerlinDateParts {
  year: number
  month: number
  day: number
  hour: number
  dateKey: string
  monthKey: string
}

/**
 * Sammelt die Werte für einen Monat.
 */
interface MonthBucket {
  sources: EnergySourceAccum
  totalGen: number
  co2Weighted: number
  count: number
}

/**
 * Sammelt die Werte für eine Zelle der Heatmap.
 */
interface HeatmapBucket {
  co2Weighted: number
  totalGen: number
  count: number
}

/**
 * Sammelt die Werte für einen Tag.
 */
interface DayBucket {
  renewableGen: number
  totalGen: number
  co2Weighted: number
  count: number
}

/**
 * Sammelt die Werte für ein Jahr.
 */
interface YearBucket {
  sources: EnergySourceAccum
  totalGen: number
  renewableGen: number
  co2Weighted: number
  count: number
}

/**
 * Verbindet die deutschen Feldnamen aus SMARD
 * mit den englischen Schlüsseln im Projekt.
 */
const GERMAN_TO_ENGLISH: Record&lt;string, keyof EnergySourceAccum&gt; = {
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

/**
 * Feldnamen der erneuerbaren Energieträger.
 */
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
 * Die letzten deutschen Kernkraftwerke wurden am 15. April 2023 abgeschaltet.
 */
const NUCLEAR_PHASEOUT_DATE = '2023-04-15'

/**
 * Höchster erlaubter Anteil verworfener Stunden.
 */
const MAX_SKIP_FRACTION = 0.10

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
 * Liest Jahr, Monat, Tag und Stunde eines Zeitpunkts
 * in Berliner Lokalzeit aus.
 *
 * Die Umstellung zwischen Sommer- und Winterzeit
 * wird dabei automatisch berücksichtigt.
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
    if (part.type === 'year') {
      year = Number(part.value)
    }

    if (part.type === 'month') {
      month = Number(part.value)
    }

    if (part.type === 'day') {
      day = Number(part.value)
    }
  }

  let hour = 0
  const hourParts = berlinHourFormat.formatToParts(timestamp)

  for (const part of hourParts) {
    if (part.type === 'hour') {
      hour = Number(part.value)
    }
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
 * Fehlt nach dem Kernenergieausstieg nur der Wert für
 * Kernenergie, wird dafür 0 eingesetzt. Fehlen andere
 * Werte oder enthalten sie keine gültige Zahl, wird
 * die Zeile als unvollständig zurückgegeben.
 *
 * @param row Eine Zeile aus den geladenen SMARD-Daten
 * @param berlinDate Datum der Zeile in Berliner Lokalzeit
 * @returns Erzeugungswerte und Information über einen ergänzten Kernenergiewert
 */
function extractSources(
  row: Record&lt;string, unknown&gt;,
  berlinDate: string,
): {
  sources: EnergySourceAccum | null
  nuclearFilled: boolean
} {
  const sources = createEmptySources()
  let nuclearFilled = false

  for (const germanField of GENERATION_FIELDS) {
    const rawValue = row[germanField]
    const sourceKey = GERMAN_TO_ENGLISH[germanField] as keyof EnergySourceAccum

    const nuclearIsMissing =
      germanField === 'kernenergie'
      &amp;&amp; (rawValue === undefined || rawValue === null)

    if (nuclearIsMissing) {
      if (berlinDate &gt; NUCLEAR_PHASEOUT_DATE) {
        sources[sourceKey] = 0
        nuclearFilled = true
        continue
      }

      return {
        sources: null,
        nuclearFilled: false,
      }
    }

    if (rawValue === null || rawValue === undefined) {
      return {
        sources: null,
        nuclearFilled: false,
      }
    }

    if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) {
      return {
        sources: null,
        nuclearFilled: false,
      }
    }

    sources[sourceKey] = rawValue
  }

  return {
    sources,
    nuclearFilled,
  }
}

/**
 * Berechnet die gewichtete CO₂-Summe einer Stunde.
 *
 * Jeder Erzeugungswert wird mit dem passenden
 * Emissionsfaktor multipliziert.
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
 * @param sources Erzeugungswerte der Energieträger
 * @returns Erneuerbare Erzeugung in MWh
 */
function calculateRenewableGeneration(
  sources: EnergySourceAccum,
): number {
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
 * @param sources Erzeugungswerte der Energieträger
 * @returns Gesamte Erzeugung in MWh
 */
function calculateTotalGeneration(
  sources: EnergySourceAccum,
): number {
  let sum = 0
  const values = Object.values(sources)

  for (const value of values) {
    sum += value
  }

  return sum
}

/**
 * Erstellt die fertigen Monatswerte aus den gesammelten Daten.
 *
 * @param buckets Gesammelte Werte nach Monat
 * @returns Sortierte Monatsdaten für die Visualisierung
 */
function finalizeMonthlyMix(
  buckets: Map&lt;string, MonthBucket&gt;,
): MonthlyMixPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (
    firstEntry,
    secondEntry,
  ) {
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
 * Erstellt die fertigen Heatmap-Werte aus den gesammelten Daten.
 *
 * @param buckets Gesammelte Werte nach Jahr, Monat und Stunde
 * @returns Sortierte Zellen für die Heatmap
 */
function finalizeHeatmapCo2(
  buckets: Map&lt;string, HeatmapBucket&gt;,
): HeatmapCo2Cell[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (
    firstEntry,
    secondEntry,
  ) {
    return firstEntry[0].localeCompare(secondEntry[0])
  })

  return entries.map(function (entry) {
    const key = entry[0]
    const bucket = entry[1]
    const keyParts = key.split('-')

    return {
      year: Number(keyParts[0]),
      month: Number(keyParts[1]),
      hour: Number(keyParts[2]),
      co2GramsPerKwh: roundToTwoDecimals(
        bucket.co2Weighted / bucket.totalGen,
      ),
      observationCount: bucket.count,
    }
  })
}

/**
 * Erstellt die fertigen Tageswerte aus den gesammelten Daten.
 *
 * @param buckets Gesammelte Werte nach Tag
 * @returns Sortierte Tagesdaten für das Streudiagramm
 */
function finalizeScatterDaily(
  buckets: Map&lt;string, DayBucket&gt;,
): ScatterDailyPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (
    firstEntry,
    secondEntry,
  ) {
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
      co2GramsPerKwh: roundToTwoDecimals(
        bucket.co2Weighted / bucket.totalGen,
      ),
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
function finalizeYearlyMix(
  buckets: Map&lt;string, YearBucket&gt;,
): YearlyMixPoint[] {
  const entries = Array.from(buckets.entries())

  entries.sort(function (
    firstEntry,
    secondEntry,
  ) {
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
      co2GramsPerKwh: roundToTwoDecimals(
        bucket.co2Weighted / bucket.totalGen,
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
async function loadSmardData(): Promise&lt;Record&lt;string, unknown&gt;[]&gt; {
  const file = Bun.file('public/data/smard.json')
  const exists = await file.exists()

  if (!exists) {
    throw new Error(
      'public/data/smard.json nicht gefunden. Führe zuerst download-smard.ts aus.',
    )
  }

  const data: unknown = await file.json()

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'public/data/smard.json enthält keine gültigen Daten.',
    )
  }

  return data as Record&lt;string, unknown&gt;[]
}

/**
 * Lädt und prüft die Emissionsfaktoren.
 *
 * @returns Vollständige Emissionsfaktoren
 * @throws Fehler, wenn ein Faktor fehlt oder ungültig ist
 */
async function loadEmissionFactors(): Promise&lt;EmissionFactors&gt; {
  const file = Bun.file('emission_factors.json')
  const rawData: unknown = await file.json()

  if (
    rawData === null
    || typeof rawData !== 'object'
  ) {
    throw new Error(
      'emission_factors.json enthält kein gültiges Objekt.',
    )
  }

  const factorData = rawData as Record&lt;string, unknown&gt;
  const checkedFactors: Record&lt;string, number&gt; = {}

  for (const germanField of GENERATION_FIELDS) {
    const value = factorData[germanField]

    if (
      typeof value !== 'number'
      || !Number.isFinite(value)
    ) {
      throw new Error(
        `emission_factors.json: '${germanField}' fehlt oder ist keine gültige Zahl (${value}).`,
      )
    }

    checkedFactors[germanField] = value
  }

  return checkedFactors as unknown as EmissionFactors
}

/**
 * Prüft ein Objekt rekursiv auf ungültige Zahlen
 * sowie fehlende Werte.
 *
 * @param value Wert oder Objekt, das geprüft werden soll
 * @param path Aktuelle Stelle innerhalb des Objekts
 * @throws Fehler, wenn ein ungültiger Wert gefunden wird
 */
function checkFiniteValues(
  value: unknown,
  path: string,
): void {
  if (value === null || value === undefined) {
    throw new Error(`Null oder undefined gefunden in ${path}`)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Nicht-endlicher Wert (${value}) in ${path}`,
      )
    }

    return
  }

  if (Array.isArray(value)) {
    for (let index = 0; index &lt; value.length; index++) {
      checkFiniteValues(
        value[index],
        `${path}[${index}]`,
      )
    }

    return
  }

  if (typeof value === 'object') {
    const entries = Object.entries(
      value as Record&lt;string, unknown&gt;,
    )

    for (const entry of entries) {
      const key = entry[0]
      const nestedValue = entry[1]

      checkFiniteValues(
        nestedValue,
        `${path}.${key}`,
      )
    }
  }
}

/**
 * Addiert die Werte einer Stunde zu einem Monats-Bucket.
 *
 * @param buckets Monats-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToMonthBucket(
  buckets: Map&lt;string, MonthBucket&gt;,
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

  const sourceKeys = Object.keys(
    sources,
  ) as (keyof EnergySourceAccum)[]

  for (const key of sourceKeys) {
    bucket.sources[key] += sources[key]
  }

  bucket.totalGen += totalGeneration
  bucket.co2Weighted += co2Weighted
  bucket.count++
}

/**
 * Addiert die Werte einer Stunde zu einem Heatmap-Bucket.
 *
 * @param buckets Heatmap-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToHeatmapBucket(
  buckets: Map&lt;string, HeatmapBucket&gt;,
  dateParts: BerlinDateParts,
  totalGeneration: number,
  co2Weighted: number,
): void {
  const month = String(dateParts.month).padStart(2, '0')
  const hour = String(dateParts.hour).padStart(2, '0')
  const key = `${dateParts.year}-${month}-${hour}`

  let bucket = buckets.get(key)

  if (bucket === undefined) {
    bucket = {
      co2Weighted: 0,
      totalGen: 0,
      count: 0,
    }

    buckets.set(key, bucket)
  }

  bucket.co2Weighted += co2Weighted
  bucket.totalGen += totalGeneration
  bucket.count++
}

/**
 * Addiert die Werte einer Stunde zu einem Tages-Bucket.
 *
 * @param buckets Tages-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param renewableGeneration Erneuerbare Erzeugung der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToDayBucket(
  buckets: Map&lt;string, DayBucket&gt;,
  dateParts: BerlinDateParts,
  renewableGeneration: number,
  totalGeneration: number,
  co2Weighted: number,
): void {
  let bucket = buckets.get(dateParts.dateKey)

  if (bucket === undefined) {
    bucket = {
      renewableGen: 0,
      totalGen: 0,
      co2Weighted: 0,
      count: 0,
    }

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
 * @param buckets Jahres-Buckets
 * @param dateParts Datumsteile der Stunde
 * @param sources Erzeugungswerte der Stunde
 * @param renewableGeneration Erneuerbare Erzeugung der Stunde
 * @param totalGeneration Gesamterzeugung der Stunde
 * @param co2Weighted Gewichtete CO₂-Summe der Stunde
 */
function addToYearBucket(
  buckets: Map&lt;string, YearBucket&gt;,
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

  const sourceKeys = Object.keys(
    sources,
  ) as (keyof EnergySourceAccum)[]

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
 *
 * Kleine Abweichungen bis -0,001 werden toleriert.
 *
 * @param sources Erzeugungswerte der Stunde
 * @param dateParts Datumsteile der Stunde
 * @param examples Liste mit Beispielen für die Ausgabe
 * @returns true, wenn ein negativer Wert gefunden wurde
 */
function hasNegativeGeneration(
  sources: EnergySourceAccum,
  dateParts: BerlinDateParts,
  examples: string[],
): boolean {
  const sourceKeys = Object.keys(
    sources,
  ) as (keyof EnergySourceAccum)[]

  let hasNegative = false

  for (const key of sourceKeys) {
    if (sources[key] &lt; -0.001) {
      hasNegative = true

      if (examples.length &lt; 5) {
        const hour = String(dateParts.hour).padStart(2, '0')

        examples.push(
          `  ${dateParts.dateKey} ${hour}:00 – ${key} = ${sources[key]} MWh`,
        )
      }
    }
  }

  return hasNegative
}

/**
 * Gibt die Statistik zu den verarbeiteten Stunden aus.
 *
 * @param validCount Anzahl gültiger Stunden
 * @param skippedOutside Stunden außerhalb des Zeitraums
 * @param skippedNonNumeric Unvollständige Stunden
 * @param skippedNegative Stunden mit negativen Werten
 * @param skippedZeroTotal Stunden ohne Gesamterzeugung
 * @param nuclearFilledCount Ergänzte Kernenergiewerte
 */
function printProcessingSummary(
  validCount: number,
  skippedOutside: number,
  skippedNonNumeric: number,
  skippedNegative: number,
  skippedZeroTotal: number,
  nuclearFilledCount: number,
): void {
  console.log('\nAuswertung:')
  console.log(
    `  Gültige Stunden (Berlin 2015–2024):       ${validCount}`,
  )
  console.log(
    `  Außerhalb Berliner Jahre 2015–2024:      ${skippedOutside}`,
  )
  console.log(
    `  Unvollständige Datensätze:               ${skippedNonNumeric}`,
  )
  console.log(
    `  Negative Erzeugungswerte:                ${skippedNegative}`,
  )
  console.log(
    `  Gesamterzeugung &lt;= 0:                    ${skippedZeroTotal}`,
  )
  console.log(
    `  Ergänzte Kernenergie-Nullwerte:          ${nuclearFilledCount}`,
  )
}

/**
 * Prüft, ob zu viele Stunden verworfen wurden.
 *
 * @param validCount Anzahl gültiger Stunden
 * @param skippedNonNumeric Unvollständige Stunden
 * @param skippedNegative Stunden mit negativen Werten
 * @param skippedZeroTotal Stunden ohne Gesamterzeugung
 * @throws Fehler, wenn der erlaubte Anteil überschritten wird
 */
function checkSkippedHours(
  validCount: number,
  skippedNonNumeric: number,
  skippedNegative: number,
  skippedZeroTotal: number,
): void {
  const totalSkipped =
    skippedNonNumeric
    + skippedNegative
    + skippedZeroTotal

  const totalProcessed = validCount + totalSkipped

  let skipFraction = 0

  if (totalProcessed &gt; 0) {
    skipFraction = totalSkipped / totalProcessed
  }

  if (totalSkipped === 0) {
    return
  }

  const percent = (skipFraction * 100).toFixed(2)

  console.log(
    `\nWirklich übersprungene Stunden: ${totalSkipped} (${percent} %)`,
  )

  if (skipFraction &gt; MAX_SKIP_FRACTION) {
    const limit = MAX_SKIP_FRACTION * 100
    const actual = (skipFraction * 100).toFixed(1)

    throw new Error(
      `Mehr als ${limit}% der Stunden übersprungen (${actual}%). `
      + 'Abbruch, um keine irreführende Datei zu erzeugen.',
    )
  }
}

/**
 * Führt die komplette Datenaufbereitung aus
 * und schreibt die fertige JSON-Datei.
 *
 * @returns Promise ohne Rückgabewert
 */
async function main(): Promise&lt;void&gt; {
  console.log('Lade SMARD-Daten...')
  const smardData = await loadSmardData()
  console.log(`${smardData.length} Rohdatensätze geladen`)

  console.log('Lade Emissionsfaktoren...')
  const emissionFactors = await loadEmissionFactors()
  console.log(
    'Emissionsfaktoren geladen:',
    GENERATION_FIELDS.length,
    'Träger',
  )

  let validCount = 0
  let skippedOutside = 0
  let skippedNonNumeric = 0
  let skippedZeroTotal = 0
  let skippedNegative = 0
  let nuclearFilledCount = 0

  const negativeExamples: string[] = []

  const monthBuckets = new Map&lt;string, MonthBucket&gt;()
  const heatmapBuckets = new Map&lt;string, HeatmapBucket&gt;()
  const dayBuckets = new Map&lt;string, DayBucket&gt;()
  const yearBuckets = new Map&lt;string, YearBucket&gt;()

  for (const row of smardData) {
    const timestamp = row.timestamp

    if (typeof timestamp !== 'number') {
      skippedOutside++
      continue
    }

    const dateParts = getBerlinDateParts(timestamp)

    if (
      dateParts.year &lt; 2015
      || dateParts.year &gt; 2024
    ) {
      skippedOutside++
      continue
    }

    const sourceResult = extractSources(
      row,
      dateParts.dateKey,
    )

    if (sourceResult.sources === null) {
      skippedNonNumeric++
      continue
    }

    if (sourceResult.nuclearFilled) {
      nuclearFilledCount++
    }

    const sources = sourceResult.sources

    if (
      hasNegativeGeneration(
        sources,
        dateParts,
        negativeExamples,
      )
    ) {
      skippedNegative++
      continue
    }

    const totalGeneration =
      calculateTotalGeneration(sources)

    if (totalGeneration &lt;= 0) {
      skippedZeroTotal++
      continue
    }

    validCount++

    const co2Weighted = calculateCo2Weighted(
      sources,
      emissionFactors,
    )

    const renewableGeneration =
      calculateRenewableGeneration(sources)

    addToMonthBucket(
      monthBuckets,
      dateParts,
      sources,
      totalGeneration,
      co2Weighted,
    )

    addToHeatmapBucket(
      heatmapBuckets,
      dateParts,
      totalGeneration,
      co2Weighted,
    )

    addToDayBucket(
      dayBuckets,
      dateParts,
      renewableGeneration,
      totalGeneration,
      co2Weighted,
    )

    addToYearBucket(
      yearBuckets,
      dateParts,
      sources,
      renewableGeneration,
      totalGeneration,
      co2Weighted,
    )
  }

  printProcessingSummary(
    validCount,
    skippedOutside,
    skippedNonNumeric,
    skippedNegative,
    skippedZeroTotal,
    nuclearFilledCount,
  )

  if (negativeExamples.length &gt; 0) {
    console.log('\nBeispiele negativer Werte:')

    for (const example of negativeExamples) {
      console.log(example)
    }
  }

  checkSkippedHours(
    validCount,
    skippedNonNumeric,
    skippedNegative,
    skippedZeroTotal,
  )

  const monthlyMix = finalizeMonthlyMix(monthBuckets)
  const heatmapCo2 = finalizeHeatmapCo2(heatmapBuckets)
  const scatterDaily = finalizeScatterDaily(dayBuckets)
  const yearlyMix = finalizeYearlyMix(yearBuckets)

  const output = {
    monthlyMix,
    heatmapCo2,
    scatterDaily,
    yearlyMix,
  }

  console.log(
    '\nPrüfe finale Daten auf ungültige Werte...',
  )

  checkFiniteValues(output, 'output')

  const json = JSON.stringify(output, null, 2)

  await Bun.write(
    'public/data/visualization-data.json',
    json,
  )

  const fileSizeBytes =
    new TextEncoder().encode(json).length

  const fileSizeMb =
    (fileSizeBytes / 1024 / 1024).toFixed(2)

  console.log(
    `\nGespeichert: visualization-data.json (${fileSizeMb} MB)`,
  )
  console.log(
    `  monthlyMix:   ${monthlyMix.length} Monate`,
  )
  console.log(
    `  heatmapCo2:   ${heatmapCo2.length} Zellen`,
  )
  console.log(
    `  scatterDaily: ${scatterDaily.length} Tage`,
  )
  console.log(
    `  yearlyMix:    ${yearlyMix.length} Jahre`,
  )
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
