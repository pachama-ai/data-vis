/**
 * Lädt die stündlichen Erzeugungsdaten der zwölf Energieträger von
 * SMARD und speichert sie zusammengeführt als smard.json ab.
 *
 * Für jeden Energieträger wird zuerst die Liste der verfügbaren
 * Wochenblöcke abgefragt und danach Block für Block nachgeladen. Am
 * Ende werden alle Zeitreihen anhand des Zeitstempels zu einer
 * gemeinsamen Tabelle zusammengeführt.
 *
 * @author Selina Schneider
 */

import fs from 'node:fs'

// Filter-IDs von smard.de. Jede Zahl steht für eine eigene Zeitreihe
// in der öffentlichen Chart-Data-API der Bundesnetzagentur.
const filters = {
  // Erzeugung
  braunkohle: 1223,
  kernenergie: 1224,
  windOffshore: 1225,
  wasserkraft: 1226,
  sonstigeKonventionelle: 1227,
  sonstigeErneuerbare: 1228,

  biomasse: 4066,
  windOnshore: 4067,
  solar: 4068,
  steinkohle: 4069,
  pumpspeicher: 4070,
  erdgas: 4071
}

const BASE = "https://www.smard.de/app/chart_data";
const REGION = "DE";
const RESOLUTION = "hour";

// Ab diesem Zeitpunkt beginnt mein Auswertungszeitraum.
const START = Date.UTC(2015, 0, 1);

/**
 * Lädt eine JSON-Datei von SMARD.
 * Bei einer 404 (Datei existiert nicht) gebe ich null zurück -
 * das kommt beispielsweise vor, wenn ein angefragter Block noch nicht
 * existiert.
 *
 * @param url Adresse der JSON-Datei
 * @returns Geladene Daten oder null bei 404
 * @throws Fehler bei einem anderen HTTP-Status als 200 oder 404
 */
async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }

  return res.json();
}

/**
 * Fragt ab, welche Zeitstempel-Blöcke für einen Filter
 * verfügbar sind. SMARD liefert die Daten nicht als eine große
 * Zeitreihe, sondern in vielen kleinen Wochenblöcken: ich muss
 * also erst diese Liste holen, bevor ich die eigentlichen Werte laden
 * kann.
 *
 * @param filter SMARD-Filter-ID
 * @returns Zeitstempel ab meinem Startdatum (2015)
 */
async function getTimestamps(filter: number): Promise<number[]> {
  const json = await fetchJSON(
    `${BASE}/${filter}/${REGION}/index_${RESOLUTION}.json`
  );

  if (!json) return [];

  const ts = (json as { timestamps: number[] }).timestamps
  return ts.filter(function (t: number) { return t >= START });
}

/**
 * Lädt einen einzelnen Wochenblock mit den Rohwerten.
 *
 * @param filter SMARD-Filter-ID
 * @param timestamp Zeitstempel des Blocks (aus getTimestamps)
 * @returns Rohwerte des Blocks, leeres Array bei 404
 */
async function fetchBlock(filter: number, timestamp: number): Promise<number[][]> {
  const url =
    `${BASE}/${filter}/${REGION}/` +
    `${filter}_${REGION}_${RESOLUTION}_${timestamp}.json`;

  const json = await fetchJSON(url);

  if (!json) return [];

  return (json as { series?: number[][] }).series ?? [];
}

/**
 * Lädt alle Blöcke eines Energieträgers, immer 8 Blöcke gleichzeitig.
 * Ich lade nicht alles auf einmal, weil das bei über 10
 * Jahren Daten zu viele gleichzeitige Anfragen sind.
 *
 * @param name Name des Energieträgers, nur für die Konsolenausgabe
 * @param filter SMARD-Filter-ID
 * @returns Alle geladenen Rohwerte dieses Energieträgers
 */
async function fetchFilter(name: string, filter: number): Promise<number[][]> {
  console.log(`\n${name}`);

  const timestamps = await getTimestamps(filter);

  console.log(`Blöcke: ${timestamps.length}`);

  const result = [];

  const concurrency = 8;

  for (let i = 0; i < timestamps.length; i += concurrency) {
    const chunk = timestamps.slice(i, i + concurrency);

    const data = await Promise.all(
      chunk.map(function (ts: number) { return fetchBlock(filter, ts) })
    );

    for (const series of data) {
      result.push(...series);
    }

    process.stdout.write(
      `${Math.min(i + concurrency, timestamps.length)}/${timestamps.length}\r`
    );
  }

  console.log(` -> ${result.length} Werte`);

  return result;
}

/**
 * Fügt die Werte eines Energieträgers in die zusammengeführte Tabelle
 * ein. Am Ende steht pro Zeitstempel ein Objekt mit allen Werten der
 * Energieträger, die zu diesem Zeitpunkt einen Eintrag hatten.
 *
 * @param merged Zusammengeführte Tabelle, wird direkt verändert
 * @param name Name des Energieträgers (Schlüssel in `filters`)
 * @param series Rohwerte dieses Energieträgers
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

function addSeriesToMerged(
  merged: Record<number, SmardRow>,
  name: string,
  series: number[][],
): void {
  for (const entry of series) {
    const timestamp = entry[0]!;
    const value = entry[1];

    let record = merged[timestamp];
    if (!record) {
      record = { timestamp };
      merged[timestamp] = record;
    }

    // Fehlende Werte (null) speichere ich als 0, damit später beim
    // Aggregieren keine Lücken im Datensatz entstehen.
    record[name as keyof SmardRow] = value ?? 0;
  }
}

/**
 * Lädt alle Energieträger nacheinander und führt sie über den
 * Zeitstempel zu einer gemeinsamen Tabelle zusammen.
 *
 * @returns Zusammengeführte Rohdaten, noch unsortiert
 */
async function loadAndMergeAllFilters(): Promise<Record<number, SmardRow>> {
  const merged: Record<number, SmardRow> = {};

  for (const [name, filter] of Object.entries(filters)) {
    const series = await fetchFilter(name, filter);

    addSeriesToMerged(merged, name, series);
  }

  return merged;
}

/**
 * Sortiert die zusammengeführte Tabelle aufsteigend nach Zeitstempel.
 *
 * @param merged Zusammengeführte Tabelle
 * @returns Sortierte Liste aller Zeitpunkte
 */
function sortMergedData(
  merged: Record<number, SmardRow>,
): SmardRow[] {
  return Object.values(merged).sort(
    function (a: SmardRow, b: SmardRow) {
      return (a.timestamp as number) - (b.timestamp as number)
    },
  );
}

/**
 * Schreibt die zusammengeführten und sortierten Daten als smard.json.
 *
 * @param data Sortierte Rohdaten
 */
function writeSmardFile(data: SmardRow[]): void {
  fs.mkdirSync("./public/data", { recursive: true });

  fs.writeFileSync(
    "./public/data/smard.json",
    JSON.stringify(data)
  );

  console.log(
    `\nFertig! ${data.length} Zeitpunkte gespeichert.`
  );
}

/**
 * Lädt alle Energieträger nacheinander, führt sie über den
 * Zeitstempel zu einer gemeinsamen Tabelle zusammen und schreibt das
 * Ergebnis als smard.json.
 */
async function main() {
  const merged = await loadAndMergeAllFilters();
  const data = sortMergedData(merged);

  writeSmardFile(data);
}

main().catch(function (caughtError: unknown) {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
  console.error('Fehler:', message)
})
