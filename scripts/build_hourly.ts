/**
 * scripts/build_hourly.mjs — Datenpipeline: Stundenwerte aus Rohdaten
 * ===================================================================
 *
 * Liest zwei Roh-JSONs:
 *   - public/data/smard.json    (SMARD-Erzeugung, Felder auf Deutsch)
 *   - public/data/preise.json   (ENTSO-E-Strompreise)
 *
 * Führt einen INNER JOIN auf timestamp durch und berechnet:
 *   - total_generation_mwh  (Summe aller Erzeugungsträger)
 *   - co2_g_per_kwh         (CO₂-gewichteter Durchschnitt)
 *   - ee_share / fossil_share (Anteile Erneuerbare / Fossil)
 *   - price_eur_mwh, load_mwh
 *   - generation_by_source  (Einzelwerte pro Träger auf Englisch)
 *
 * Output: public/data/hourly_2015_2024.json
 *
 * Aufruf: bun run scripts/build_hourly.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// __dirname-Ersatz in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')

// ---------------------------------------------------------------------------
// UBA-Emissionsfaktoren (g CO₂ / kWh) — Referenz aus emission_factors.json
// ---------------------------------------------------------------------------
const CO2_FAKTOREN = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'emission_factors.json'), 'utf-8')
)

// ---------------------------------------------------------------------------
// Feldmapping: Deutsch → Englisch (für generation_by_source im Output)
// ---------------------------------------------------------------------------
const FIELD_MAP = {
  braunkohle:              'lignite',
  kernenergie:             'nuclear',
  windOffshore:            'wind_offshore',
  wasserkraft:             'hydro',
  sonstigeKonventionelle:  'other_fossil',
  sonstigeErneuerbare:     'other_renewables',
  biomasse:                'biomass',
  windOnshore:             'wind_onshore',
  solar:                   'pv',
  steinkohle:              'hardcoal',
  pumpspeicher:            'pumped_storage',
  erdgas:                  'gas',
}

// Alle Erzeugungsfelder (für Summenbildung)
const GENERATION_FIELDS = Object.keys(FIELD_MAP)

// Erneuerbare Träger (für ee_share)
const EE_FIELDS = [
  'biomasse', 'wasserkraft', 'windOnshore', 'windOffshore',
  'solar', 'sonstigeErneuerbare'
]

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
console.log('Lade smard.json...')
const smard = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'smard.json'), 'utf-8')
)

console.log('Lade preise.json...')
const preise = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'preise.json'), 'utf-8')
)

// Preis-Map für O(1)-Lookup
const preisMap = new Map(preise.map(p => [p.timestamp, p.price]))

console.log(`SMARD:  ${smard.length} Einträge`)
console.log(`Preise: ${preise.length} Einträge`)

// ---------------------------------------------------------------------------
// Join & Berechnung
// ---------------------------------------------------------------------------
console.log('\nBerechne Stundenwerte...')

let nanCount = 0
let nullCount = 0
let co2Min = Infinity
let co2Max = -Infinity
let minTs = Infinity
let maxTs = -Infinity

const hourly = smard
  .map(punkt => {
    const ts = punkt.timestamp
    const price = preisMap.get(ts)

    // Inner join: nur Zeilen mit Preisübernahme
    if (price === undefined) return null

    // 2025-Reste rausfiltern: download-prices.js liefert vereinzelt
    // Punkte mit timestamp >= 2025-01-01 (API-Periodenrand)
    if (ts >= Date.UTC(2025, 0, 1)) return null

    // Datumsbereich tracken
    if (ts < minTs) minTs = ts
    if (ts > maxTs) maxTs = ts

    // Summe aller Erzeugung
    let totalGen = 0
    const genBySource = {}

    for (const deField of GENERATION_FIELDS) {
      const value = punkt[deField] ?? 0
      const enField = FIELD_MAP[deField]
      genBySource[enField] = Math.round(value * 100) / 100
      totalGen += value
    }

    totalGen = Math.round(totalGen * 100) / 100

    // Erneuerbare / Fossil
    let eeSum = 0
    let fossilSum = 0

    for (const deField of GENERATION_FIELDS) {
      const value = punkt[deField] ?? 0
      if (EE_FIELDS.includes(deField)) {
        eeSum += value
      } else {
        // pumpspeicher ist weder ee noch fossil
        if (deField !== 'pumpspeicher') {
          fossilSum += value
        }
      }
    }

    const eeShare = totalGen > 0
      ? Math.round((eeSum / totalGen) * 1000) / 10
      : 0

    const fossilShare = totalGen > 0
      ? Math.round((fossilSum / totalGen) * 1000) / 10
      : 0

    // CO₂-gewichteter Durchschnitt
    let co2Sum = 0
    for (const deField of GENERATION_FIELDS) {
      const faktor = CO2_FAKTOREN[deField] ?? 0
      co2Sum += (punkt[deField] ?? 0) * faktor
    }

    const co2 = totalGen > 0
      ? Math.round((co2Sum / totalGen) * 10) / 10
      : 0

    // Sanity-Check: NaN/Null erkennen
    if (Number.isNaN(co2)) nanCount++
    if (co2 === 0 && totalGen > 0) nullCount++
    if (co2 < co2Min) co2Min = co2
    if (co2 > co2Max) co2Max = co2

    return {
      timestamp: ts,
      co2_g_per_kwh: co2,
      ee_share: eeShare,
      fossil_share: fossilShare,
      price_eur_mwh: Math.round(price * 100) / 100,
      load_mwh: Math.round((punkt.last ?? 0) * 100) / 100,
      generation_by_source: genBySource,
    }
  })
  .filter(Boolean)

// ---------------------------------------------------------------------------
// Konsolen-Output: Sanity-Checks
// ---------------------------------------------------------------------------
console.log(`\nErgebnis: ${hourly.length} Zeilen`)
console.log(`Datumsbereich: ${new Date(minTs).toISOString()} bis ${new Date(maxTs).toISOString()}`)
console.log(`CO₂ min: ${co2Min} g/kWh`)
console.log(`CO₂ max: ${co2Max} g/kWh`)
console.log(`NaN-Werte: ${nanCount}`)
console.log(`Null-CO₂ bei positiver Erzeugung: ${nullCount}`)

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true })

const outPath = path.join(DATA_DIR, 'hourly_2015_2024.json')
fs.writeFileSync(outPath, JSON.stringify(hourly))

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1)
console.log(`\nGespeichert: hourly_2015_2024.json (${mb} MB, ${hourly.length} Zeilen)`)
console.log('Fertig!')
