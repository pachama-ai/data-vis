import fs from 'fs'

console.log('Lade smard.json...')
const smard = JSON.parse(fs.readFileSync('./public/data/smard.json', 'utf-8'))

console.log('Lade preise.json...')
const preise = JSON.parse(fs.readFileSync('./public/data/preise.json', 'utf-8'))

const preisMap = new Map(preise.map(p => [p.timestamp, p.price]))

console.log(`SMARD:  ${smard.length} Eintraege`)
console.log(`Preise: ${preise.length} Eintraege`)

const eeFelder = [
  'windOnshore', 'windOffshore', 'solar',
  'biomasse', 'wasserkraft', 'sonstigeErneuerbare'
]
const alleFelder = [
  'windOnshore', 'windOffshore', 'solar', 'biomasse',
  'wasserkraft', 'braunkohle', 'steinkohle', 'erdgas',
  'kernenergie', 'sonstigeErneuerbare', 'pumpspeicher', 'sonstigeKonventionelle'
]

const co2Faktoren = {
  // fossile Stromerzeugung (UBA)
  braunkohle:            1119,   // UBA Braunkohle
  steinkohle:             860,   // UBA Steinkohle
  erdgas:                 394,   // UBA Erdgas

  // Deutschland 2024
  kernenergie:              0,   // keine Erzeugung mehr

  // Erneuerbare (UBA Lebenszyklus)
  biomasse:                230,  // UBA Biomasse
  wasserkraft:             2.7,  // UBA Wasserkraft
  windOnshore:            17.6,  // UBA Wind Onshore
  windOffshore:            9.6,  // UBA Wind Offshore
  solar:                  56.5,  // UBA Photovoltaik

  // Speicher
  pumpspeicher:             0,   // Emissionen beim Verbrauch bilanziert

  // mangels UBA-Einzelwerten
  sonstigeErneuerbare:     45,   // Mittelwert uebrige EE
  sonstigeKonventionelle: 650,   // Mittelwert konv. Kraftwerke
}

// ---------------------------------------------------------------------------
// Stundenwerte
// ---------------------------------------------------------------------------
console.log('\nBerechne Stundenwerte...')

const stunden = smard
  .map(punkt => {
    const preis = preisMap.get(punkt.timestamp) ?? null
    if (preis === null) return null

    const d       = new Date(punkt.timestamp)
    const year    = d.getUTCFullYear()
    const month   = d.getUTCMonth() + 1
    const day     = d.getUTCDate()
    const hour    = d.getUTCHours()
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6

    const gesamt = alleFelder.reduce((s, f) => s + (punkt[f] ?? 0), 0)
    const ee     = eeFelder.reduce((s, f) => s + (punkt[f] ?? 0), 0)
    const konv   = gesamt - ee
    const last   = punkt.last ?? 0

    // EE-Anteil an Erzeugung
    const eeAnt = gesamt > 0
      ? Math.round((ee / gesamt) * 1000) / 10
      : 0

    // FIX: EE-Anteil an Last (Konzept S1 + S3 Umschalter)
    const eeAntLast = last > 0
      ? Math.round((ee / last) * 1000) / 10
      : 0

    const co2sum = alleFelder.reduce((s, f) =>
      s + (punkt[f] ?? 0) * (co2Faktoren[f] ?? 0), 0)
    const co2 = gesamt > 0
      ? Math.round((co2sum / gesamt) * 10) / 10
      : 0

    // Residuallast: negativ = EE-Überschuss
    const resLast = last - ee

    return {
      ts:      punkt.timestamp,
      year,
      month,
      day,
      hour,
      weekend,

      preis:         Math.round(preis * 100) / 100,
      negativePrice: preis < 0,

      ges:        Math.round(gesamt),
      ee:         Math.round(ee),
      eeAnt,
      eeAntLast,  // NEU
      konv:       Math.round(konv),
      co2,

      last:       Math.round(last),
      resLast:    Math.round(resLast),

      wOn:  Math.round(punkt.windOnshore             ?? 0),
      wOff: Math.round(punkt.windOffshore            ?? 0),
      sol:  Math.round(punkt.solar                   ?? 0),
      bio:  Math.round(punkt.biomasse                ?? 0),
      was:  Math.round(punkt.wasserkraft             ?? 0),
      bk:   Math.round(punkt.braunkohle              ?? 0),
      sk:   Math.round(punkt.steinkohle              ?? 0),
      gas:  Math.round(punkt.erdgas                  ?? 0),
      kern: Math.round(punkt.kernenergie             ?? 0),
      pump: Math.round(punkt.pumpspeicher            ?? 0),
      pumpV:Math.round(punkt.pumpspeicherVerbrauch   ?? 0), // NEU
      sEE:  Math.round(punkt.sonstigeErneuerbare     ?? 0),
      sKon: Math.round(punkt.sonstigeKonventionelle  ?? 0),
    }
  })
  .filter(Boolean)

console.log(`Stundenwerte: ${stunden.length}`)

// ---------------------------------------------------------------------------
// Tageswerte  (BUG GEFIXT: Key-Check war kaputt)
// ---------------------------------------------------------------------------
console.log('Berechne Tageswerte...')

function aggregiereTage(stunden) {
  const tage = new Map()

  for (const s of stunden) {
    const key = `${s.year}-${String(s.month).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`

    if (!tage.has(key)) {
      tage.set(key, {
        ts:      new Date(Date.UTC(s.year, s.month - 1, s.day)).getTime(),
        date:    key,
        year:    s.year,
        month:   s.month,
        day:     s.day,
        weekend: s.weekend,
        _p:      []
      })
    }
    tage.get(key)._p.push(s)
  }

  return [...tage.values()].map(tag => {
    const p = tag._p
    const n = p.length
    const avg = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0) / n * 10) / 10
    const sum = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0))

    return {
      ts:      tag.ts,
      date:    tag.date,
      year:    tag.year,
      month:   tag.month,
      day:     tag.day,
      weekend: tag.weekend,

      preis:       avg('preis'),
      negativePrice: p.some(x => x.negativePrice),
      negStunden:  p.filter(x => x.negativePrice).length,

      ges:      sum('ges'),
      ee:       sum('ee'),
      konv:     sum('konv'),
      eeAnt:    avg('eeAnt'),
      eeAntLast:avg('eeAntLast'), // NEU
      co2:      avg('co2'),

      last:     avg('last'),
      resLast:  avg('resLast'),

      wOn:  sum('wOn'),  wOff: sum('wOff'), sol:  sum('sol'),
      bio:  sum('bio'),  was:  sum('was'),  bk:   sum('bk'),
      sk:   sum('sk'),   gas:  sum('gas'),  kern: sum('kern'),
      pump: sum('pump'), pumpV:sum('pumpV'), // NEU
      sEE:  sum('sEE'),  sKon: sum('sKon'),
    }
  })
}

const tage = aggregiereTage(stunden)
console.log(`Tageswerte:   ${tage.length}`)

// ---------------------------------------------------------------------------
// Wochenwerte
// ---------------------------------------------------------------------------
console.log('Berechne Wochenwerte...')

function aggregiereWochen(tage) {
  const wochen = new Map()

  for (const t of tage) {
    const d    = new Date(t.ts)
    const do4  = new Date(d)
    do4.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)))
    const j0   = new Date(Date.UTC(do4.getUTCFullYear(), 0, 1))
    const kw   = Math.ceil(((do4 - j0) / 86400000 + 1) / 7)
    const key  = `${do4.getUTCFullYear()}-W${String(kw).padStart(2, '0')}`

    if (!wochen.has(key)) {
      wochen.set(key, { key, ts: t.ts, year: t.year, _p: [] })
    }
    wochen.get(key)._p.push(t)
  }

  return [...wochen.values()].map(wo => {
    const p = wo._p
    const n = p.length
    const avg = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0) / n * 10) / 10
    const sum = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0))

    return {
      ts:    wo.ts,
      key:   wo.key,
      year:  wo.year,

      preis:      avg('preis'),
      negStunden: sum('negStunden'),

      ges:       sum('ges'),
      ee:        sum('ee'),
      konv:      sum('konv'),
      eeAnt:     avg('eeAnt'),
      eeAntLast: avg('eeAntLast'), // NEU
      co2:       avg('co2'),

      last:    avg('last'),
      resLast: avg('resLast'),

      wOn:  sum('wOn'),  wOff: sum('wOff'), sol:  sum('sol'),
      bio:  sum('bio'),  was:  sum('was'),  bk:   sum('bk'),
      sk:   sum('sk'),   gas:  sum('gas'),  kern: sum('kern'),
      pump: sum('pump'), pumpV:sum('pumpV'), // NEU
      sEE:  sum('sEE'),  sKon: sum('sKon'),
    }
  })
}

const wochen = aggregiereWochen(tage)
console.log(`Wochenwerte:  ${wochen.length}`)

// ---------------------------------------------------------------------------
// Jahreswerte  (NEU – für S6 CO₂-Linie + Balkendiagramm negative Preise)
// ---------------------------------------------------------------------------
console.log('Berechne Jahreswerte...')

function aggregiereJahre(tage) {
  const jahre = new Map()

  for (const t of tage) {
    const key = String(t.year)
    if (!jahre.has(key)) {
      jahre.set(key, { year: t.year, ts: new Date(Date.UTC(t.year, 0, 1)).getTime(), _p: [] })
    }
    jahre.get(key)._p.push(t)
  }

  return [...jahre.values()]
    .sort((a, b) => a.year - b.year)
    .map(ja => {
      const p  = ja._p
      const n  = p.length
      const avg = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0) / n * 10) / 10
      const sum = f => Math.round(p.reduce((s, x) => s + (x[f] ?? 0), 0))

      return {
        ts:   ja.ts,
        year: ja.year,

        // S6: CO₂-Intensitätslinie
        co2:  avg('co2'),

        // S6: Balkendiagramm negative Preise
        negStunden: sum('negStunden'),

        preis:      avg('preis'),
        eeAnt:      avg('eeAnt'),
        eeAntLast:  avg('eeAntLast'),

        ges:  sum('ges'),
        ee:   sum('ee'),
        konv: sum('konv'),

        wOn:  sum('wOn'),  wOff: sum('wOff'), sol:  sum('sol'),
        bio:  sum('bio'),  was:  sum('was'),  bk:   sum('bk'),
        sk:   sum('sk'),   gas:  sum('gas'),  kern: sum('kern'),
        pump: sum('pump'), pumpV:sum('pumpV'),
        sEE:  sum('sEE'),  sKon: sum('sKon'),
      }
    })
}

const jahre = aggregiereJahre(tage)
console.log(`Jahreswerte:  ${jahre.length}`)

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------
console.log('\nSpeichere Dateien...')
fs.mkdirSync('./public/data', { recursive: true })

fs.writeFileSync('./public/data/combined-hour.json',  JSON.stringify(stunden))
fs.writeFileSync('./public/data/combined-day.json',   JSON.stringify(tage))
fs.writeFileSync('./public/data/combined-week.json',  JSON.stringify(wochen))
fs.writeFileSync('./public/data/combined-year.json',  JSON.stringify(jahre))

const mb = f => (fs.statSync(f).size / 1024 / 1024).toFixed(1)
console.log(`combined-hour.json:  ${mb('./public/data/combined-hour.json')} MB  (${stunden.length} Punkte)`)
console.log(`combined-day.json:   ${mb('./public/data/combined-day.json')} MB  (${tage.length} Punkte)`)
console.log(`combined-week.json:  ${mb('./public/data/combined-week.json')} MB  (${wochen.length} Punkte)`)
console.log(`combined-year.json:  ${mb('./public/data/combined-year.json')} MB  (${jahre.length} Punkte)`)
console.log('\nFertig!')