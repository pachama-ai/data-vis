import fs from 'node:fs'

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
  erdgas: 4071,

  // Nachfrage / Netz
  last: 410,          // Gesamtlast
  residuallast: 4359, // Last nach EE-Erzeugung


  pumpspeicherVerbrauch: 4387
}

const BASE = "https://www.smard.de/app/chart_data";
const REGION = "DE";
const RESOLUTION = "hour";
const START = Date.UTC(2015, 0, 1);

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }

  return res.json();
}

async function getTimestamps(filter: number): Promise<number[]> {
  const json = await fetchJSON(
    `${BASE}/${filter}/${REGION}/index_${RESOLUTION}.json`
  );

  if (!json) return [];

  const ts = (json as { timestamps: number[] }).timestamps
  return ts.filter((t: number) => t >= START);
}

async function fetchBlock(filter: number, timestamp: number): Promise<number[][]> {
  const url =
    `${BASE}/${filter}/${REGION}/` +
    `${filter}_${REGION}_${RESOLUTION}_${timestamp}.json`;

  const json = await fetchJSON(url);

  if (!json) return [];

  return (json as { series?: number[][] }).series ?? [];
}

async function fetchFilter(name: string, filter: number): Promise<number[][]> {
  console.log(`\n${name}`);

  const timestamps = await getTimestamps(filter);

  console.log(`Blöcke: ${timestamps.length}`);

  const result = [];

  const concurrency = 8;

  for (let i = 0; i < timestamps.length; i += concurrency) {
    const chunk = timestamps.slice(i, i + concurrency);

    const data = await Promise.all(
      chunk.map((ts: number) => fetchBlock(filter, ts))
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

async function main() {
  const merged: Record<number, Record<string, number | string>> = {};

  for (const [name, filter] of Object.entries(filters)) {
    const series = await fetchFilter(name, filter);

    for (const entry of series) {
      const timestamp = entry[0];
      const value = entry[1];
      if (timestamp === undefined) continue;

      let record = merged[timestamp];
      if (!record) {
        record = { timestamp };
        merged[timestamp] = record;
      }

      record[name] = value ?? 0;
    }
  }

  const data = Object.values(merged).sort(
    (a: Record<string, number | string>, b: Record<string, number | string>) =>
      (a.timestamp as number) - (b.timestamp as number),
  );

  fs.mkdirSync("./public/data", { recursive: true });

  fs.writeFileSync(
    "./public/data/smard.json",
    JSON.stringify(data)
  );

  console.log(
    `\nFertig! ${data.length} Zeitpunkte gespeichert.`
  );
}

main().catch(console.error);