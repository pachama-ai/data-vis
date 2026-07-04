/**
 * scripts/validate-data.mjs — Validierung der Pipeline-Output-Daten
 * =================================================================
 *
 * Prüft hourly_2015_2024.json auf:
 *   - Anzahl Stunden insgesamt und pro Jahr
 *   - Startdatum / Enddatum
 *   - Lücken in der Zeitreihe
 *   - Null/NaN/0-Werte pro Schlüsselfeld
 *   - Min/Max/Ø für CO₂, Preis, EE-Anteil
 *   - Anzahl negativer Preisstunden
 *   - Dateigröße
 *
 * Aufruf: bun run scripts/validate-data.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')
const PFAD = path.join(DATA_DIR, 'hourly_2015_2024.json')

if (!fs.existsSync(PFAD)) {
  console.error(`\n[FEHLER] Datei nicht gefunden: ${PFAD}`)
  console.error('   Erst build_hourly.mjs ausführen: bun run scripts/build_hourly.mjs\n')
  process.exit(1)
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  DATEI-VALIDIERUNG: hourly_2015_2024.json`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log('Lade Datei...')
const daten = JSON.parse(fs.readFileSync(PFAD, 'utf-8'))
const n = daten.length

// ---------------------------------------------------------------------------
// 1. Grundzahlen
// ---------------------------------------------------------------------------
console.log(`\n── 1. GRUNDZAHLEN ──────────────────────────`)
console.log(`   Gesamtanzahl Stunden: ${n.toLocaleString('de-DE')}`)

// Timestamp liegt direkt als Unix-ms in s.timestamp
const timestamps = daten.map(s => s.timestamp).sort((a, b) => a - b)
const erster = new Date(timestamps[0])
const letzter = new Date(timestamps[timestamps.length - 1])

console.log(`   Startdatum:           ${erster.toISOString().slice(0, 16)} UTC`)
console.log(`   Enddatum:             ${letzter.toISOString().slice(0, 16)} UTC`)

// ---------------------------------------------------------------------------
// 2. Pro-Jahr-Analyse mit Schaltjahr-Check
// ---------------------------------------------------------------------------
console.log(`\n── 2. STUNDEN PRO JAHR (Schaltjahre beachten) ──`)

const proJahr = {}
for (const s of daten) {
  const y = new Date(s.timestamp).getUTCFullYear()
  proJahr[y] = (proJahr[y] || 0) + 1
}

const SCHALTJAHRE = new Set([2016, 2020, 2024])
let heatmapProblem = false

for (const [jahr, anzahl] of Object.entries(proJahr).sort()) {
  const erwartet = SCHALTJAHRE.has(parseInt(jahr)) ? 8784 : 8760
  const ok = anzahl === erwartet
  const symbol = ok ? '[OK]' : '[WARN]'
  const diff = anzahl - erwartet
  const diffStr = diff === 0 ? '' : ` (${diff > 0 ? '+' : ''}${diff})`
  if (!ok) heatmapProblem = true
  console.log(`   ${symbol} ${jahr}: ${anzahl} Stunden${diffStr}  (erwartet: ${erwartet})`)
}

// ---------------------------------------------------------------------------
// 3. Lücken in der Zeitreihe
// ---------------------------------------------------------------------------
console.log(`\n── 3. LÜCKEN IN DER ZEITREIHE ──────────────`)

const STUNDE_MS = 3600 * 1000
let luecken = []

for (let i = 1; i < timestamps.length; i++) {
  const delta = timestamps[i] - timestamps[i - 1]
  if (delta !== STUNDE_MS) {
    const von = new Date(timestamps[i - 1]).toISOString().slice(0, 16)
    const bis = new Date(timestamps[i]).toISOString().slice(0, 16)
    const fehlend = Math.round(delta / STUNDE_MS) - 1
    luecken.push({ von, bis, fehlend })
  }
}

if (luecken.length === 0) {
  console.log('   [OK] Keine Lücken – Zeitreihe vollständig lückenlos')
} else {
  console.log(`   [WARN] ${luecken.length} Lücken gefunden:`)
  const anzeigen = luecken.slice(0, 10)
  for (const l of anzeigen) {
    console.log(`     ${l.von} → ${l.bis}  (${l.fehlend} fehlende Stunden)`)
  }
  if (luecken.length > 10) {
    console.log(`     ... und ${luecken.length - 10} weitere`)
  }
  const gesamt = luecken.reduce((s, l) => s + l.fehlend, 0)
  console.log(`   → Insgesamt fehlende Stunden: ${gesamt}`)
}

// ---------------------------------------------------------------------------
// 4. Null / NaN / 0-Analyse der Schlüsselfelder
// ---------------------------------------------------------------------------
console.log(`\n── 4. NULL / NaN / 0-WERTE PRO FELD ────────`)

// Felder aus build_hourly.mjs die für Visualisierungen kritisch sind
const kritischeFelder = [
  { feld: 'co2_g_per_kwh', label: 'CO₂-Intensität (co2_g_per_kwh)' },
  { feld: 'price_eur_mwh',  label: 'Preis (price_eur_mwh)' },
  { feld: 'ee_share',       label: 'EE-Anteil (ee_share)' },
  { feld: 'fossil_share',   label: 'Fossil-Anteil (fossil_share)' },
  { feld: 'load_mwh',       label: 'Last (load_mwh)' },
]

for (const { feld, label } of kritischeFelder) {
  let nullCount = 0
  let nanCount = 0
  let nulloCount = 0

  for (const s of daten) {
    const v = s[feld]
    if (v === null || v === undefined) nullCount++
    else if (typeof v === 'number' && isNaN(v)) nanCount++
    else if (v === 0) nulloCount++
  }

  const symbol = (nullCount > 0 || nanCount > 0) ? '[WARN]' : '[OK]'
  const nullStr  = nullCount  > 0 ? `  null/undef: ${nullCount}` : ''
  const nanStr   = nanCount   > 0 ? `  NaN: ${nanCount}` : ''
  const nulloStr = `  Wert=0: ${nulloCount}`
  console.log(`   ${symbol} ${label.padEnd(35)}${nullStr}${nanStr}${nulloStr}`)
}

// ---------------------------------------------------------------------------
// 5. Min / Max / Ø für Schlüsselmetriken
// ---------------------------------------------------------------------------
console.log(`\n── 5. WERTEBEREICH DER SCHLÜSSELMETRIKEN ───`)

function stats(daten, feld) {
  const werte = daten.map(s => s[feld]).filter(v => v !== null && v !== undefined && !isNaN(v))
  const min = Math.min(...werte)
  const max = Math.max(...werte)
  const avg = Math.round((werte.reduce((s, v) => s + v, 0) / werte.length) * 10) / 10
  return { min, max, avg, n: werte.length }
}

const co2Stats   = stats(daten, 'co2_g_per_kwh')
const preisStats = stats(daten, 'price_eur_mwh')
const eeStats    = stats(daten, 'ee_share')

console.log(`   CO₂-Intensität (g/kWh):`)
console.log(`     Min: ${co2Stats.min}   Max: ${co2Stats.max}   Ø: ${co2Stats.avg}`)

console.log(`   Preis (€/MWh):`)
console.log(`     Min: ${preisStats.min}   Max: ${preisStats.max}   Ø: ${preisStats.avg}`)

console.log(`   EE-Anteil (%):`)
console.log(`     Min: ${eeStats.min}   Max: ${eeStats.max}   Ø: ${eeStats.avg}`)

// Sonderfall: negative Preise
const negPreise = daten.filter(s => s.price_eur_mwh < 0).length
console.log(`\n   Stunden mit negativem Preis: ${negPreise}`)

// Sonderfall: CO₂ = 0 (unplausibel wenn Erzeugung vorhanden)
const co2null = daten.filter(s =>
  s.co2_g_per_kwh === 0 &&
  Object.values(s.generation_by_source).reduce((a, b) => a + b, 0) > 0
).length
if (co2null > 0) {
  console.log(`   [WARN] Stunden mit CO₂=0 aber Erzeugung>0: ${co2null} -> Pruefen!`)
} else {
  console.log(`   [OK] Keine Stunden mit CO₂=0 bei vorhandener Erzeugung`)
}

// ---------------------------------------------------------------------------
// 6. Dateigröße
// ---------------------------------------------------------------------------
const groesse = fs.statSync(PFAD).size
console.log(`\n── 6. DATEIGRÖSSE ───────────────────────────`)
console.log(`   hourly_2015_2024.json: ${(groesse / 1024 / 1024).toFixed(1)} MB`)
if (groesse > 50 * 1024 * 1024) {
  console.log(`   [WARN] Ueber 50 MB – Ladezeit im Browser 2-4 Sekunden.`)
} else {
  console.log(`   [OK] Dateigroesse akzeptabel fuer Offline-Browser-Betrieb.`)
}

// ---------------------------------------------------------------------------
// Abschluss
// ---------------------------------------------------------------------------
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
const fehler = luecken.length > 0 || heatmapProblem
console.log(fehler
  ? `  [WARN] Validierung abgeschlossen mit Warnungen – oben pruefen!`
  : `  [OK] Validierung abgeschlossen – Daten sehen gut aus.`
)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
