/**
 * scripts/audit/level3-consistency.mjs
 * =====================================
 * Level 3 — Konsistenz zwischen Ansichten
 * Vergleicht Rohdaten-Aggregation mit vorberechneten JSON-Dateien.
 *
 * Aufruf: bun run scripts/audit/level3-consistency.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(__dirname, '..', '..', 'public', 'data')

let passed = 0
let failed = 0
let warned = 0

function pass(msg) { console.log(`  [PASS] ${msg}`); passed++ }
function fail(msg, exp, act) { console.log(`  [FAIL] ${msg}  (erwartet: ${exp}, tatsächlich: ${act})`); failed++ }
function warn(msg) { console.log(`  [WARN] ${msg}`); warned++ }

function fmt(n, d = 1) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) }

// Daten laden
const hourly = JSON.parse(fs.readFileSync(path.join(DATA, 'hourly_2015_2024.json'), 'utf-8'))
const yearly = JSON.parse(fs.readFileSync(path.join(DATA, 'yearly_mix.json'), 'utf-8'))
const ef = JSON.parse(fs.readFileSync(path.join(DATA, 'emission_factors.json'), 'utf-8'))

console.log('\n' + '='.repeat(72))
console.log('  LEVEL 3: KONSISTENZ ZWISCHEN ANSICHTEN')
console.log('='.repeat(72))

// ---------------------------------------------------------------------------
// Mapping: hourly-Feldnamen → yearly-Feldnamen
// ---------------------------------------------------------------------------
const KEY_MAP = {
  wind_onshore: 'windOnshore', wind_offshore: 'windOffshore',
  biomass: 'biomasse', hydro: 'wasserkraft',
  pv: 'solar', lignite: 'braunkohle', hardcoal: 'steinkohle',
  gas: 'erdgas', nuclear: 'kernenergie',
  other_fossil: 'sonstigeKonventionelle',
  other_renewables: 'sonstigeErneuerbare',
  pumped_storage: 'pumpspeicher',
}

function emFactor(key) {
  const mapped = KEY_MAP[key] ?? key
  return ef[mapped] ?? 0
}

function jahr(ts) { return new Date(ts).getUTCFullYear() }

// ===========================================================================
// 1. EE-Anteil 2024: hourly-Aggregation vs. yearly_mix.json
// ===========================================================================
console.log('\n── 1. EE-Anteil 2024 ────────────────────────')
const ee2024Raw = hourly.filter(r => jahr(r.timestamp) === 2024)
const eeAvgRaw = ee2024Raw.reduce((s, r) => s + r.ee_share, 0) / ee2024Raw.length
const eeFromYearly = yearly.find(r => r.year === 2024)?.avg_ee_share ?? 0
const eeDiff = Math.abs(eeAvgRaw - eeFromYearly)
const eeTol = eeFromYearly * 0.001 // 0.1%
if (eeDiff <= eeTol) {
  pass(`EE-Anteil 2024: ${fmt(eeAvgRaw)}% (Rohdaten) vs. ${fmt(eeFromYearly)}% (yearly_mix)`)
} else {
  fail(`EE-Anteil 2024`, fmt(eeFromYearly), fmt(eeAvgRaw))
}

// ===========================================================================
// 2. CO₂-Intensität 2024: hourly-Aggregation vs. yearly_mix.json
// ===========================================================================
console.log('\n── 2. CO₂-Intensität 2024 ────────────────────')
const co2AvgRaw = ee2024Raw.reduce((s, r) => s + r.co2_g_per_kwh, 0) / ee2024Raw.length
const co2FromYearly = yearly.find(r => r.year === 2024)?.avg_co2 ?? 0
const co2Diff = Math.abs(co2AvgRaw - co2FromYearly)
const co2Tol = co2FromYearly * 0.001
if (co2Diff <= co2Tol) {
  pass(`CO₂ 2024: ${fmt(co2AvgRaw)} g/kWh (Rohdaten) vs. ${fmt(co2FromYearly)} g/kWh (yearly_mix)`)
} else {
  fail(`CO₂ 2024`, fmt(co2FromYearly), fmt(co2AvgRaw))
}

// ===========================================================================
// 3. Preis-Spread 2024 (Max - Min)
// ===========================================================================
console.log('\n── 3. Preis-Spread 2024 ──────────────────────')
const prices2024 = ee2024Raw.map(r => r.price_eur_mwh)
const priceMin = Math.min(...prices2024)
const priceMax = Math.max(...prices2024)
const priceSpread = priceMax - priceMin
if (priceSpread > 0 && priceMin < 0 && priceMax > 100) {
  pass(`Preis-Spread 2024: ${fmt(priceMin, 0)} – ${fmt(priceMax, 0)} EUR/MWh (Spread: ${fmt(priceSpread, 0)})`)
} else {
  fail(`Preis-Spread 2024 plausibel?`, `min<0, max>100`, `${fmt(priceMin, 0)} – ${fmt(priceMax, 0)}`)
}

// ===========================================================================
// 4. CO₂-Konsistenz: einfacher Mittelwert (wie yearly_mix)
// ===========================================================================
console.log('\n── 4. CO₂-Konsistenz ─────────────────────────')
const co2AvgSimple = ee2024Raw.reduce((s, r) => s + r.co2_g_per_kwh, 0) / ee2024Raw.length
const co2Diff2 = Math.abs(co2AvgSimple - co2FromYearly)
if (co2Diff2 <= 0.5) {
  pass(`CO₂ Mittelwert: ${fmt(co2AvgSimple)} g/kWh vs. ${fmt(co2FromYearly)} g/kWh (yearly_mix) — Δ=${fmt(co2Diff2)}`)
} else {
  fail(`CO₂ Mittelwert vs. yearly`, fmt(co2FromYearly), fmt(co2AvgSimple))
}

// ===========================================================================
// 5. Sparkline-Konsistenz: Jahreswerte aus hourly vs. yearly_mix
// ===========================================================================
console.log('\n── 5. Sparkline-Konsistenz (alle Jahre) ──────')
for (let y = 2015; y <= 2024; y++) {
  const yd = hourly.filter(r => jahr(r.timestamp) === y)
  if (!yd.length) continue
  const eeAvg = yd.reduce((s, r) => s + r.ee_share, 0) / yd.length
  const co2Avg = yd.reduce((s, r) => s + r.co2_g_per_kwh, 0) / yd.length
  const negCount = yd.filter(r => r.price_eur_mwh < 0).length
  const yRow = yearly.find(r => r.year === y)
  if (!yRow) { fail(`yearly_mix fehlt für ${y}`, 'vorhanden', 'fehlt'); continue }
  let yOk = true
  const eeDiff = Math.abs(eeAvg - yRow.avg_ee_share)
  if (eeDiff > 0.1) { fail(`EE ${y}`, fmt(yRow.avg_ee_share), fmt(eeAvg)); yOk = false }
  const co2D = Math.abs(co2Avg - yRow.avg_co2)
  if (co2D > 0.5) { fail(`CO₂ ${y}`, fmt(yRow.avg_co2), fmt(co2Avg)); yOk = false }
  const negD = Math.abs(negCount - yRow.neg_stunden)
  if (negD > 1) { fail(`Negativ ${y}`, String(yRow.neg_stunden), String(negCount)); yOk = false }
  if (yOk) pass(`${y}: EE ${fmt(eeAvg)}%, CO₂ ${fmt(co2Avg)}, Neg. ${negCount}h`)
}

// ===========================================================================
// 6. Jahre 2015/2016: Gesamtstundenzahl
// ===========================================================================
console.log('\n── 6. Prüfung Verdacht: fehlende Stunden 2015/2016 ──')
for (const y of [2015, 2016]) {
  const n = hourly.filter(r => jahr(r.timestamp) === y).length
  const exp = y === 2016 ? 8784 : 8760
  const diff = n - exp
  if (diff === 0) pass(`${y}: ${n} Std. (exakt ${exp})`)
  else if (diff > -100) warn(`${y}: ${n} Std. (${diff} Abw., erwartet ${exp})`)
  else fail(`${y}: ${n} Std.`, String(exp), String(n))
}

console.log('\n' + '='.repeat(72))
console.log(`  ERGEBNIS: ${passed} PASS, ${warned} WARN, ${failed} FAIL`)
console.log('='.repeat(72) + '\n')
