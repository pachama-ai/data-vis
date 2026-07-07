/**
 * scripts/check-dashboard-data.mjs
 * =================================
 * Liest hourly_2015_2024.json und yearly_mix.json und gibt alle
 * Kennzahlen aus, die im Dashboard verwendet werden.
 * Damit kann man direkt vergleichen, ob die Dashboard-Werte stimmen.
 *
 * Aufruf: bun run check:data
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(__dirname, '..', 'public', 'data')

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------
const hourly = JSON.parse(fs.readFileSync(path.join(DATA, 'hourly_2015_2024.json'), 'utf-8'))
const yearly = JSON.parse(fs.readFileSync(path.join(DATA, 'yearly_mix.json'), 'utf-8'))

const N = hourly.length
const ts = hourly.map((r) => r.timestamp).sort((a, b) => a - b)
const erster = new Date(ts[0])
const letzter = new Date(ts[ts.length - 1])

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
function fmt(n, d = 2) { return Number(n).toFixed(d) }
function durchschnitt(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length }
function jahr(ts) { return new Date(ts).getUTCFullYear() }
function isSchalt(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }
function erwartet(y) { return isSchalt(y) ? 8784 : 8760 }

// ------------------------------------------------
// 1. Grunddaten
// ------------------------------------------------
console.log('')
console.log('='.repeat(72))
console.log('  1. GRUNDDATEN')
console.log('='.repeat(72))
console.log(`  Stunden gesamt:       ${N.toLocaleString('de-DE')}`)
console.log(`  Erstes Datum:         ${erster.toISOString().slice(0, 16)} UTC`)
console.log(`  Letztes Datum:        ${letzter.toISOString().slice(0, 16)} UTC`)

const hat2025 = hourly.some((r) => jahr(r.timestamp) >= 2025)
console.log(`  2025-Daten enthalten: ${hat2025 ? 'JA (!)' : 'NEIN'}`)
console.log('')

// Soll-Stunden im Idealzeitraum 2015-01-01 00:00 bis 2024-12-31 23:00
let sollGesamt = 0
for (let y = 2015; y <= 2024; y++) sollGesamt += erwartet(y)
const fehlIdeal = sollGesamt - N

// Fehlende Stunden vor erstem Datenpunkt
const firstTs = ts[0]
const idealStart = Date.UTC(2015, 0, 1)
const fehlVorErstem = Math.round((firstTs - idealStart) / 3600000)

console.log(`  Soll-Stunden 2015-2024: ${sollGesamt}`)
console.log(`  Fehlend (Soll 01.01.):  ${fehlIdeal}`)
console.log(`  Datenstart ist:         ${new Date(firstTs).toISOString().slice(0, 16)} UTC (${fehlVorErstem}h nach 01.01.)`)
console.log(`  Fehlend (ab Datenstart): ${fehlIdeal - fehlVorErstem}`)
console.log(`  Differenz:              ${fehlVorErstem}h durch API-Spaetstart (2015-01-04 statt 2015-01-01)`)
console.log('')

const proJahr = {}
for (const r of hourly) {
  const y = jahr(r.timestamp)
  proJahr[y] = (proJahr[y] || 0) + 1
}

console.log('  Stunden pro Jahr:')
let gesamtFehl = 0
for (const [y, n] of Object.entries(proJahr).sort()) {
  const exp = erwartet(parseInt(y))
  const fehl = exp - n
  gesamtFehl += fehl
  const ok = fehl === 0 ? 'OK' : `FEHLT ${fehl}`
  console.log(`    ${y}: ${String(n).padStart(6)}h  (erwartet ${exp}h)  ${ok}`)
}
console.log(`  Fehlende Stunden gesamt: ${gesamtFehl}`)
console.log(`  (davon ${fehlVorErstem}h durch API-Spaetstart 2015)`)
console.log('')

// ------------------------------------------------
// 2. Preise
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  2. PREISE')
console.log('='.repeat(72))

const preise = hourly.map((r) => r.price_eur_mwh)
const minP = Math.min(...preise)
const maxP = Math.max(...preise)
const avgP = durchschnitt(preise)
const negGesamt = preise.filter((p) => p < 0).length
console.log(`  Min Preis:            ${fmt(minP, 2)} EUR/MWh`)
console.log(`  Max Preis:            ${fmt(maxP, 2)} EUR/MWh`)
console.log(`  Durchschnitt Preis:   ${fmt(avgP, 2)} EUR/MWh`)
console.log(`  Negative Stunden:     ${negGesamt}`)
console.log('')

const negProJahr = {}
for (const r of hourly) {
  const y = jahr(r.timestamp)
  if (r.price_eur_mwh < 0) negProJahr[y] = (negProJahr[y] || 0) + 1
}
console.log('  Negative Stunden pro Jahr:')
for (const [y, n] of Object.entries(negProJahr).sort()) {
  console.log(`    ${y}: ${n}h`)
}
console.log('')

// ------------------------------------------------
// 3. CO2
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  3. CO2')
console.log('='.repeat(72))

const co2vals = hourly.map((r) => r.co2_g_per_kwh)
const minC = Math.min(...co2vals)
const maxC = Math.max(...co2vals)
const avgC = durchschnitt(co2vals)
const nullCo2 = co2vals.filter((c) => c === null || c === undefined).length
const nanCo2 = co2vals.filter((c) => typeof c === 'number' && isNaN(c)).length
const unrealCo2 = co2vals.filter((c) => c < 0 || c > 2000).length

console.log(`  Min CO2:              ${fmt(minC, 1)} g/kWh`)
console.log(`  Max CO2:              ${fmt(maxC, 1)} g/kWh`)
console.log(`  Durchschnitt CO2:     ${fmt(avgC, 1)} g/kWh`)
console.log(`  null/undefined:       ${nullCo2}`)
console.log(`  NaN:                  ${nanCo2}`)
console.log(`  Unrealistisch (<0/>2000): ${unrealCo2}`)
console.log('')

// ------------------------------------------------
// 4. EE-Anteil
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  4. EE-ANTEIL')
console.log('='.repeat(72))

const eeVals = hourly.map((r) => r.ee_share)
const minE = Math.min(...eeVals)
const maxE = Math.max(...eeVals)
const avgE = durchschnitt(eeVals)
const outE = eeVals.filter((v) => v < 0 || v > 100).length
console.log(`  Min EE-Anteil:        ${fmt(minE, 1)} %`)
console.log(`  Max EE-Anteil:        ${fmt(maxE, 1)} %`)
console.log(`  Durchschnitt EE:      ${fmt(avgE, 1)} %`)
console.log(`  Ausserhalb 0-100:     ${outE}`)
console.log('')

// ------------------------------------------------
// 5. Jahresvergleich hourly vs yearly_mix
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  5. JAHRESVERGLEICH hourly vs yearly_mix')
console.log('='.repeat(72))

const yearlyMap = {}
for (const y of yearly) yearlyMap[y.year] = y

const hourlyByYear = {}
for (const r of hourly) {
  const y = jahr(r.timestamp)
  if (!hourlyByYear[y]) hourlyByYear[y] = { co2: [], ee: [], neg: 0, count: 0 }
  hourlyByYear[y].co2.push(r.co2_g_per_kwh)
  hourlyByYear[y].ee.push(r.ee_share)
  if (r.price_eur_mwh < 0) hourlyByYear[y].neg++
  hourlyByYear[y].count++
}

console.log('  Jahr  |  hourly_ee  yearly_ee  diff_ee  | hourly_co2 yearly_co2 diff_co2 | neg_hourly neg_yearly')
console.log('  ' + '-'.repeat(85))
for (const [yStr, h] of Object.entries(hourlyByYear).sort()) {
  const y = parseInt(yStr)
  const ym = yearlyMap[y]
  if (!ym) continue

  const hEE = h.ee.reduce((s, v) => s + v, 0) / h.ee.length
  const hCO2 = h.co2.reduce((s, v) => s + v, 0) / h.co2.length
  const warnEE = Math.abs(hEE - ym.avg_ee_share) / ym.avg_ee_share > 0.005 ? 'WARN' : ''
  const warnCO2 = Math.abs(hCO2 - ym.avg_co2) / ym.avg_co2 > 0.005 ? 'WARN' : ''
  const warnNeg = h.neg !== (ym.neg_stunden ?? 0) ? 'WARN' : ''

  console.log(
    `  ${y}  |` +
    ` ${fmt(hEE, 1).padStart(7)}  ${fmt(ym.avg_ee_share, 1).padStart(7)}  ${fmt(hEE - ym.avg_ee_share, 2).padStart(7)} ${warnEE.padStart(5)} |` +
    ` ${fmt(hCO2, 1).padStart(7)}  ${fmt(ym.avg_co2, 1).padStart(7)}  ${fmt(hCO2 - ym.avg_co2, 2).padStart(7)} ${warnCO2.padStart(5)} |` +
    ` ${String(h.neg).padStart(5)}h  ${String(ym.neg_stunden ?? 0).padStart(5)}h ${warnNeg.padStart(5)}`
  )
}
console.log('')

// ------------------------------------------------
// 6. Scatter-Werte (Pearson-Korrelation)
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  6. KORRELATIONEN')
console.log('='.repeat(72))

function pearson(x, y) {
  const n = Math.min(x.length, y.length)
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sx2 += x[i] * x[i]; sy2 += y[i] * y[i]
  }
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  return den === 0 ? 0 : (n * sxy - sx * sy) / den
}

const valid = hourly.filter((r) =>
  r.ee_share != null && !isNaN(r.ee_share) &&
  r.co2_g_per_kwh != null && !isNaN(r.co2_g_per_kwh) &&
  r.price_eur_mwh != null && !isNaN(r.price_eur_mwh)
)
const ee = valid.map((r) => r.ee_share)
const co2 = valid.map((r) => r.co2_g_per_kwh)
const pr = valid.map((r) => r.price_eur_mwh)

const rEeCo2 = pearson(ee, co2)
const rEePreis = pearson(ee, pr)
const rCo2Preis = pearson(co2, pr)

console.log(`  Pearson r (EE vs CO2):            ${fmt(rEeCo2, 4)}   (R² = ${fmt(rEeCo2 * rEeCo2, 4)})`)
console.log(`  Pearson r (EE vs Preis):          ${fmt(rEePreis, 4)}   (R² = ${fmt(rEePreis * rEePreis, 4)})`)
console.log(`  Pearson r (CO2 vs Preis):         ${fmt(rCo2Preis, 4)}   (R² = ${fmt(rCo2Preis * rCo2Preis, 4)})`)
console.log(`  Datenpunkte fuer Korrelation:     ${valid.length.toLocaleString('de-DE')}`)
console.log('')

// ------------------------------------------------
// 7. Duck-Curve-Check
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  7. DUCK-CURVE-CHECK (Sommer vs Winter)')
console.log('='.repeat(72))

function residuallastGW(row) {
  const g = row.generation_by_source
  const ee = (g.wind_onshore ?? 0) + (g.wind_offshore ?? 0) + (g.pv ?? 0) +
    (g.biomass ?? 0) + (g.hydro ?? 0) + (g.other_renewables ?? 0)
  return (row.load_mwh - ee) / 1000
}

function pvGW(row) {
  return (row.generation_by_source.pv ?? 0) / 1000
}

const sommer = hourly.filter((r) => { const m = new Date(r.timestamp).getUTCMonth(); return m >= 5 && m <= 7 })
const winter = hourly.filter((r) => { const m = new Date(r.timestamp).getUTCMonth(); return m === 11 || m <= 1 })

function avgProfile(rows) {
  const byH = Array.from({ length: 24 }, () => ({ pv: [], res: [], price: [] }))
  for (const r of rows) {
    const h = new Date(r.timestamp).getUTCHours()
    byH[h].pv.push(pvGW(r))
    byH[h].res.push(residuallastGW(r))
    byH[h].price.push(r.price_eur_mwh)
  }
  return byH.map((h, i) => ({
    hour: i,
    pv: h.pv.reduce((s, v) => s + v, 0) / Math.max(1, h.pv.length),
    res: h.res.reduce((s, v) => s + v, 0) / Math.max(1, h.res.length),
    price: h.price.reduce((s, v) => s + v, 0) / Math.max(1, h.price.length),
  }))
}

const sProfile = avgProfile(sommer)
const wProfile = avgProfile(winter)

console.log('  Std | Sommer PV  Winter PV  | Sommer Res  Winter Res  | Sommer Preis Winter Preis')
console.log('  ' + '-'.repeat(80))
for (let h = 0; h < 24; h++) {
  console.log(
    `  ${String(h).padStart(2)}:00 |` +
    ` ${fmt(sProfile[h].pv, 2).padStart(6)} GW  ${fmt(wProfile[h].pv, 2).padStart(6)} GW  |` +
    ` ${fmt(sProfile[h].res, 2).padStart(6)} GW  ${fmt(wProfile[h].res, 2).padStart(6)} GW  |` +
    ` ${fmt(sProfile[h].price, 1).padStart(7)}    ${fmt(wProfile[h].price, 1).padStart(7)} EUR/MWh`
  )
}
console.log('')

// ------------------------------------------------
// 8. Zusammenfassung Dashboard-Vergleich
// ------------------------------------------------
console.log('='.repeat(72))
console.log('  8. DASHBOARD-KPI-VERGLEICH')
console.log('='.repeat(72))

console.log(`  EE-Anteil (Durchschnitt):       ${fmt(avgE, 1)} %`)
console.log(`  CO2-Intensitaet (Durchschnitt): ${fmt(avgC, 0)} g/kWh`)
console.log(`  Day-Ahead-Preis (Durchschnitt): ${fmt(avgP, 1)} EUR/MWh`)
console.log(`  Stunden mit negativen Preisen:  ${negGesamt.toLocaleString('de-DE')} h`)
console.log(`  Pearson r (EE vs CO2):          ${fmt(rEeCo2, 2)}`)
console.log(`  Datenpkte Korrelation:          ${valid.length.toLocaleString('de-DE')}`)
console.log('')
