/**
 * scripts/build_yearly.mjs — Jahresaggregation aus Stundenwerten
 * ==============================================================
 *
 * Liest public/data/hourly_2015_2024.json und aggregiert pro Jahr:
 *   - Summe MWh pro Energieträger
 *   - Durchschnitt CO₂ (co2_g_per_kwh)
 *   - Durchschnitt EE-Anteil (ee_share)
 *
 * Output: public/data/yearly_mix.json
 *
 * Aufruf: bun run scripts/build_yearly.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// __dirname-Ersatz in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
console.log('Lade hourly_2015_2024.json...')
const hourly = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'hourly_2015_2024.json'), 'utf-8')
)

console.log(`${hourly.length} Stundenwerte geladen\n`)

// ---------------------------------------------------------------------------
// Jahres-Aggregation
// ---------------------------------------------------------------------------
console.log('Aggregiere Jahreswerte...')

// Alle Energieträger-Schlüssel aus dem ersten Eintrag ermitteln
const sourceKeys = Object.keys(hourly[0].generation_by_source)

// 1. Gruppierung pro Jahr
const byYear = new Map()

for (const entry of hourly) {
  const year = new Date(entry.timestamp).getUTCFullYear()

  if (!byYear.has(year)) {
    byYear.set(year, {
      year,
      count: 0,
      negStunden: 0,
      co2Sum: 0,
      eeShareSum: 0,
      sourceSums: Object.fromEntries(sourceKeys.map(k => [k, 0])),
    })
  }

  const acc = byYear.get(year)
  acc.count++
  if (entry.price_eur_mwh < 0) acc.negStunden++
  acc.co2Sum += entry.co2_g_per_kwh
  acc.eeShareSum += entry.ee_share

  for (const key of sourceKeys) {
    acc.sourceSums[key] += entry.generation_by_source[key] ?? 0
  }
}

// 2. Array aus Map erzeugen, sortiert nach Jahr
const yearly = [...byYear.values()]
  .sort((a, b) => a.year - b.year)
  .map(acc => {
    const sources = {}
    for (const key of sourceKeys) {
      // MWh gerundet auf 2 Nachkommastellen
      sources[key] = Math.round(acc.sourceSums[key] * 100) / 100
    }

    return {
      year: acc.year,
      sources,
      avg_co2: Math.round((acc.co2Sum / acc.count) * 10) / 10,
      avg_ee_share: Math.round((acc.eeShareSum / acc.count) * 10) / 10,
      neg_stunden: acc.negStunden,
    }
  })

// ---------------------------------------------------------------------------
// Konsolen-Output
// ---------------------------------------------------------------------------
console.log(`${yearly.length} Jahre aggregiert:\n`)
for (const j of yearly) {
  console.log(
    `  ${j.year}:  Ø CO₂ ${j.avg_co2} g/kWh  |  ` +
    `Neg ${j.neg_stunden} h  |  ` +
    `Ø EE ${j.avg_ee_share}%  |  ` +
    `Summe ${Object.values(j.sources).reduce((a, b) => a + b, 0).toFixed(0)} MWh`
  )
}

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true })

const outPath = path.join(DATA_DIR, 'yearly_mix.json')
fs.writeFileSync(outPath, JSON.stringify(yearly, null, 2))

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
console.log(`\nGespeichert: yearly_mix.json (${mb} MB)`)
console.log('Fertig!')
