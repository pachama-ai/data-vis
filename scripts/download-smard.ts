import fs from "fs";

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

async function fetchJSON(url) {
  const res = await fetch(url);

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }

  return res.json();
}

async function getTimestamps(filter) {
  const json = await fetchJSON(
    `${BASE}/${filter}/${REGION}/index_${RESOLUTION}.json`
  );

  if (!json) return [];

  return json.timestamps.filter((t) => t >= START);
}

async function fetchBlock(filter, timestamp) {
  const url =
    `${BASE}/${filter}/${REGION}/` +
    `${filter}_${REGION}_${RESOLUTION}_${timestamp}.json`;

  const json = await fetchJSON(url);

  if (!json) return [];

  return json.series ?? [];
}

async function fetchFilter(name, filter) {
  console.log(`\n${name}`);

  const timestamps = await getTimestamps(filter);

  console.log(`Blöcke: ${timestamps.length}`);

  const result = [];

  const concurrency = 8;

  for (let i = 0; i < timestamps.length; i += concurrency) {
    const chunk = timestamps.slice(i, i + concurrency);

    const data = await Promise.all(
      chunk.map((ts) => fetchBlock(filter, ts))
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
  const merged = {};

  for (const [name, filter] of Object.entries(filters)) {
    const series = await fetchFilter(name, filter);

    for (const [timestamp, value] of series) {
      if (!merged[timestamp]) {
        merged[timestamp] = { timestamp };
      }

      merged[timestamp][name] = value ?? 0;
    }
  }

  const data = Object.values(merged).sort(
    (a, b) => a.timestamp - b.timestamp
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