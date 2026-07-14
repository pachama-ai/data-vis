/**
 * level1-integrity.ts – Prüft die Rohdaten-Integrität aller JSON-Dateien.
 *
 * Führt folgende Checks pro Datei durch: Stundenanzahl pro Jahr,
 * Zeitreihen-Kontinuität, Sommer-/Winterzeit, Null-Werte pro
 * Energieträger, Wertebereich und Summen-Konsistenz.
 *
 * Aufruf: bun run scripts/audit/level1-integrity.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(__dirname, '..', '..', 'public', 'data')

let passed = 0
let warned = 0
let failed = 0

/**
 * Erfasst einen bestandenen Check.
 * @param msg Beschreibung des Checks.
 */
function ok(msg) { console.log(`  [OK]  ${msg}`); passed++ }
/**
 * Erfasst eine Warnung (nicht kritisch).
 * @param msg Beschreibung.
 */
function warn(msg) { console.log(`  [WARN] ${msg}`); warned++ }
/**
 * Erfasst einen fehlgeschlagenen Check.
 * @param msg Beschreibung des Fehlers.
 */
function fail(msg) { console.log(`  [FEHLER] ${msg}`); failed++ }

/**
 * Formatiert eine Zahl mit deutschem Tausendertrennzeichen.
 * @param n Die Zahl.
 * @param d Anzahl Nachkommastellen.
 */
function fmt(n, d = 1) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) }

// --- hourly_2015_2024.json ---
console.log('\n' + '='.repeat(72))
console.log('  LEVEL 1: ROHDATEN-INTEGRITÄT')
console.log('='.repeat(72))

console.log('\n── hourly_2015_2024.json ──────────────────────')
const pfad = path.join(DATA, 'hourly_2015_2024.json')
if (!fs.existsSync(pfad)) { fail('Datei nicht gefunden'); process.exit(1) }

const rows = JSON.parse(fs.readFileSync(pfad, 'utf-8'))
const N = rows.length
const ts = rows.map(r => r.timestamp).sort((a, b) => a - b)
const STUNDE = 3600_000

// Check 1: Stunden pro Jahr
console.log('\n  1.1 Stunden pro Jahr')
const SCHALT = new Set([2016, 2020, 2024])
const proJahr = {}
for (const r of rows) {
  const y = new Date(r.timestamp).getUTCFullYear()
  proJahr[y] = (proJahr[y] || 0) + 1
}
for (let y = 2015; y <= 2024; y++) {
  const n = proJahr[y] ?? 0
  const exp = SCHALT.has(y) ? 8784 : 8760
  if (y === 2018) {
    if (n >= 6000 && n <= 7000) ok(`2018: ${n} Std. (bekannte ENTSO-E-Lücke, ~6600 erwartet)`)
    else warn(`2018: ${n} Std. (erwartet ~6600 wegen ENTSO-E-Lücke)`)
  } else {
    const diff = n - exp
    if (diff === 0) ok(`${y}: ${n} Std.`)
    else warn(`${y}: ${n} Std. (${diff > 0 ? '+' : ''}${diff} Abweichung, erwartet ${exp})`)
  }
}

// Check 2: Zeitreihen-Kontinuität
console.log('\n  1.2 Zeitreihen-Kontinuität')
let gaps = []
for (let i = 1; i < ts.length; i++) {
  const d = ts[i] - ts[i - 1]
  if (d !== STUNDE) {
    gaps.push({
      from: new Date(ts[i - 1]).toISOString().slice(0, 16),
      to: new Date(ts[i]).toISOString().slice(0, 16),
      missing: Math.round(d / STUNDE) - 1
    })
  }
}
// Prüfe ob 2018 die einzige große Lücke ist
const gap2018 = gaps.filter(g => g.from.startsWith('2018'))
const otherGaps = gaps.filter(g => !g.from.startsWith('2018'))
if (gap2018.length > 0 && otherGaps.length === 0) {
  const totalMissing = gaps.reduce((s, g) => s + g.missing, 0)
  ok(`Nur 2018er-Lücke (${totalMissing} Std. fehlen gesamt), sonst lückenlos`)
} else if (otherGaps.length > 0) {
  const totalMissing = gaps.reduce((s, g) => s + g.missing, 0)
  warn(`${gaps.length} Lücken (${totalMissing} Std.), darunter ${otherGaps.length} außerhalb 2018`)
  for (const g of otherGaps.slice(0, 5)) {
    console.log(`     ${g.from} → ${g.to} (${g.missing} fehlend)`)
  }
} else {
  ok('Keine Lücken — lückenlose Zeitreihe')
}

// Check 3: Sommer-/Winterzeit (23h/25h-Tage)
console.log('\n  1.3 Sommer-/Winterzeit-Umstellung')
// Die Umstellung erzeugt 23h (März) bzw. 25h (Oktober) Tage
// Erkennbar: an einem Tag existieren 23 oder 25 Einträge
import { strict as assert } from 'assert'

const dayCounts = {}
for (const r of rows) {
  const d = new Date(r.timestamp).toISOString().slice(0, 10)
  dayCounts[d] = (dayCounts[d] || 0) + 1
}
const oddDays = Object.entries(dayCounts).filter(([d, c]) => c !== 24)
if (oddDays.length > 0) {
  const dstOk = oddDays.filter(([d, c]) => c === 23 || c === 25)
  const other = oddDays.filter(([d, c]) => c !== 23 && c !== 25)
  if (dstOk.length > 0) ok(`${dstOk.length} Tage mit 23h/25h (DST-Umstellung korrekt)`)
  if (other.length > 0) warn(`${other.length} Tage weder 23h noch 25h: ${other.slice(0, 5).map(([d, c]) => `${d}(${c}h)`).join(', ')}`)
  console.log(`     DST-Tage: ${dstOk.map(([d]) => d).slice(0, 5).join(', ')}${dstOk.length > 5 ? ' ...' : ''}`)
} else {
  warn('Keine 23h/25h-Tage gefunden — DST fehlt möglicherweise')
}

// Check 4: Null-Werte pro Energieträger
console.log('\n  1.4 Null-Werte pro Energieträger')
const QUELLEN = ['lignite', 'nuclear', 'wind_offshore', 'hydro', 'other_fossil', 'other_renewables', 'biomass', 'wind_onshore', 'pv', 'hardcoal', 'pumped_storage', 'gas']
const thresholds = { pv: 0.5 } // PV: >0.5 GW nur tagsüber

for (const q of QUELLEN) {
  let nullCount = 0
  let zeroCount = 0
  let totalCount = 0
  for (const r of rows) {
    const v = r.generation_by_source?.[q]
    if (v === null || v === undefined) nullCount++
    else if (v === 0) zeroCount++
    totalCount++
  }
  const zeroPct = (zeroCount / totalCount * 100).toFixed(1)
  if (q === 'pv') {
    // PV hat nachts Nullen — das ist normal
    ok(`PV: ${zeroPct}% Null (nachts normal)${nullCount > 0 ? `, ${nullCount} null/undef` : ''}`)
  } else if (zeroPct > 50) {
    warn(`${q}: ${zeroPct}% Null — ungewöhnlich hoch`)
  } else {
    ok(`${q}: ${zeroPct}% Null${nullCount > 0 ? `, ${nullCount} null/undef` : ''}`)
  }
}

// Check 5: Wertebereich pro Träger (MWh → GW umgerechnet)
console.log('\n  1.5 Wertebereich pro Träger')
const ranges = {
  pv:           [0, 50_000],    // 0–50 GW in MWh
  wind_onshore: [0, 55_000],
  wind_offshore:[0, 15_000],
  lignite:      [0, 25_000],
  hardcoal:     [0, 20_000],
  gas:          [0, 25_000],
  nuclear:      [0, 15_000],
  biomass:      [0, 10_000],
  hydro:        [0, 8_000],
}
for (const [q, [min, max]] of Object.entries(ranges)) {
  const vals = rows.map(r => r.generation_by_source?.[q] ?? 0)
  const actualMin = Math.min(...vals)
  const actualMax = Math.max(...vals)
  const outOfRange = vals.filter(v => v < min || v > max).length
  const allOut = outOfRange === vals.length
  if (allOut) {
    // Alle Werte außerhalb — wahrscheinlich Einheiten-Fehler
    warn(`${q}: ${fmt(actualMin)}–${fmt(actualMax)} MWh (${fmt(actualMin/1000)}–${fmt(actualMax/1000)} GW) — ALLE außerhalb [${min/1000}, ${max/1000}] GW`)
  } else if (outOfRange === 0) {
    ok(`${q}: ${fmt(actualMin/1000)}–${fmt(actualMax/1000)} GW (im Bereich ${min/1000}–${max/1000})`)
  } else {
    warn(`${q}: ${fmt(actualMin/1000)}–${fmt(actualMax/1000)} GW, ${outOfRange} Werte außerhalb [${min/1000}, ${max/1000}]`)
  }
}

// Check 6: Summen-Konsistenz (Σ Erzeugung ≈ Last ± 15%, denn pumped_storage, Verluste, Import/Export fehlen)
console.log('\n  1.6 Summen-Konsistenz (Σ Erzeugung vs. Last)')
let withinTolerance = 0
let outsideTolerance = 0
let maxDiff = 0
for (const r of rows) {
  // Ohne pumped_storage, denn die ist Verbrauch, keine Erzeugung
  const genSum = Object.entries(r.generation_by_source)
    .filter(([k]) => k !== 'pumped_storage')
    .reduce((s, [, v]) => s + (v ?? 0), 0)
  const load = r.load_mwh
  if (load > 0) {
    const diff = Math.abs(genSum - load) / load
    if (diff <= 0.15) withinTolerance++
    else outsideTolerance++
    if (diff > maxDiff) maxDiff = diff
  }
}
const total = withinTolerance + outsideTolerance
const pctOk = (withinTolerance / total * 100).toFixed(1)
if (pctOk >= 80) ok(`${pctOk}% der Stunden innerhalb ±15% (max. Abw.: ${(maxDiff * 100).toFixed(1)}%)`)
else warn(`Nur ${pctOk}% innerhalb ±15% (max. Abw.: ${(maxDiff * 100).toFixed(1)}%)`)

// ===========================================================================
// 2. yearly_mix.json
// ===========================================================================
console.log('\n── yearly_mix.json ───────────────────────────')
const ymPfad = path.join(DATA, 'yearly_mix.json')
if (fs.existsSync(ymPfad)) {
  const ym = JSON.parse(fs.readFileSync(ymPfad, 'utf-8'))
  const jahre = ym.map(r => r.year).sort((a, b) => a - b)
  if (jahre[0] === 2015 && jahre[jahre.length - 1] === 2024 && jahre.length === 10) {
    ok(`10 Jahre (2015–2024) vollständig`)
  } else {
    warn(`${ym.length} Jahre: ${jahre.join(', ')}`)
  }
  // Prüfe EE-Anteil und CO₂ auf grobe Plausibilität
  const co2Trend = ym.map(r => ({ y: r.year, v: r.avg_co2 }))
  if (co2Trend[0].v > 400 && co2Trend[co2Trend.length - 1].v < 400) {
    ok(`CO₂-Trend: ${co2Trend[0].v} → ${co2Trend[co2Trend.length - 1].v} g/kWh (sinkend plausibel)`)
  } else {
    warn(`CO₂-Trend: ${co2Trend[0].v} → ${co2Trend[co2Trend.length - 1].v} g/kWh`)
  }
  const eeTrend = ym.map(r => ({ y: r.year, v: r.avg_ee_share }))
  if (eeTrend[eeTrend.length - 1].v > eeTrend[0].v) {
    ok(`EE-Anteil steigend: ${eeTrend[0].v}% → ${eeTrend[eeTrend.length - 1].v}%`)
  } else {
    warn(`EE-Anteil: ${eeTrend[0].v}% → ${eeTrend[eeTrend.length - 1].v}%`)
  }
} else {
  fail('Datei nicht gefunden')
}

// ===========================================================================
// 3. emission_factors.json
// ===========================================================================
console.log('\n── emission_factors.json ─────────────────────')
const efPfad = path.join(DATA, 'emission_factors.json')
if (fs.existsSync(efPfad)) {
  const ef = JSON.parse(fs.readFileSync(efPfad, 'utf-8'))
  const keys = Object.keys(ef)
  const expected = ['biomasse', 'wasserkraft', 'windOnshore', 'windOffshore', 'solar', 'sonstigeErneuerbare', 'kernenergie', 'braunkohle', 'steinkohle', 'erdgas', 'sonstigeKonventionelle', 'pumpspeicher']
  const missing = expected.filter(k => !keys.includes(k))
  if (missing.length === 0) ok(`Alle ${keys.length} Emissionsfaktoren vorhanden`)
  else warn(`Fehlende Faktoren: ${missing.join(', ')}`)
  if (ef.braunkohle === 1075) ok('Braunkohle: 1075 g/kWh')
  else warn(`Braunkohle: ${ef.braunkohle} g/kWh (erwartet 1075)`)
  if (ef.steinkohle === 835) ok('Steinkohle: 835 g/kWh')
  else warn(`Steinkohle: ${ef.steinkohle} g/kWh (erwartet 835)`)
  if (ef.erdgas === 411) ok('Erdgas: 411 g/kWh')
  else warn(`Erdgas: ${ef.erdgas} g/kWh (erwartet 411)`)
} else {
  fail('Datei nicht gefunden')
}

// ===========================================================================
// Zusammenfassung
// ===========================================================================
console.log('\n' + '='.repeat(72))
console.log('  ZUSAMMENFASSUNG')
console.log('='.repeat(72))
console.log(`  [OK]:     ${passed}`)
console.log(`  [WARN]:   ${warned}`)
console.log(`  [FEHLER]: ${failed}`)
const totalC = passed + warned + failed
const rating = failed > 0 ? '⚠️  Fehler gefunden — bitte prüfen' :
               warned > totalC * 0.3 ? '⚠️  Viele Warnungen — prüfenswert' :
               '✅  Datenqualität akzeptabel'
console.log(`  Rating:   ${rating}`)
console.log()
