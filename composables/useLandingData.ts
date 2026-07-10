/**
 * composables/useLandingData.ts
 * ==============================
 * Aggregiert SMARD-Rohdaten in Wochenwerte und berechnet
 * datenbasierte Meilensteine für die Landingpage-Timeline.
 *
 * Alle Berechnungen basieren auf Europe/Berlin Ortszeit.
 */

import { computed, shallowRef, readonly } from 'vue'
import { useData } from './useData'
import type { SmardRow, PriceRow } from './useData'

// ----------------------------------------------------------------
// Typen
// ----------------------------------------------------------------
export type MilestoneCategory = 'renewables' | 'structural' | 'prices'

export interface Milestone {
  id: string
  timestamp: number
  year: number
  category: MilestoneCategory
  title: string
  description: string
  value?: number
  unit?: string
  source: 'SMARD' | 'ENTSO-E'
  resolution: 'PT60M' | 'P1Y'
  definition: string
  isPrimary: boolean
}

export interface WeeklyRecordPoint {
  weekStart: number           // UTC ms, Montag 00:00 Europe/Berlin
  maxRenewableShare: number   // Wochenmaximum EE-Anteil
  meanRenewableShare: number  // Wochenmittel EE-Anteil
  runningRecord: number       // Laufender Rekord (nie sinkend)
  recordTimestamp: number     // Timestamp des bisherigen Rekords
}

export interface DetailData {
  type: 'hourlyMix' | 'yearlyComparison' | 'dailyPrice'
  /** Für hourlyMix: Stunden um das Ereignis herum */
  hours?: (SmardRow & { renewableShare: number })[]
  /** Für yearlyComparison: Werte pro Jahr */
  years?: { year: number; value: number }[]
  /** Für dailyPrice: Preisverlauf eines Tages */
  prices?: { hour: number; price: number }[]
}

// ----------------------------------------------------------------
// Hilfsfunktionen
// ----------------------------------------------------------------
const MS_PER_HOUR = 3600_000

/** Prüft, ob ein SmardRow alle benötigten EE-Felder als gültige Zahl hat */
const EE_FIELDS = ['solar', 'windOnshore', 'windOffshore', 'biomasse', 'wasserkraft', 'sonstigeErneuerbare'] as const

function isValidEERow(row: SmardRow): row is SmardRow & { last: number } & Record<typeof EE_FIELDS[number], number> {
  if (!Number.isFinite(row.last) || row.last! <= 0) return false
  for (const f of EE_FIELDS) {
    if (!Number.isFinite(row[f])) return false
  }
  return true
}

function isValidNuclearRow(row: SmardRow): row is SmardRow & { kernenergie: number } {
  return Number.isFinite(row.kernenergie)
}

/** Berechne renewables = solar + windOnshore + windOffshore + biomasse + wasserkraft + sonstigeErneuerbare */
function calcRenewables(row: SmardRow): number {
  return (row.solar ?? 0) + (row.windOnshore ?? 0) + (row.windOffshore ?? 0) +
         (row.biomasse ?? 0) + (row.wasserkraft ?? 0) + (row.sonstigeErneuerbare ?? 0)
}

/** Konvertiere UTC-Timestamp zu Europe/Berlin Localzeit und gib [year, month, day, hours] zurück */
function toBerlinLocal(ts: number): { year: number; month: number; day: number; hours: number; dow: number } {
  const d = new Date(ts)
  const berlin = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d)

  const get = (type: string) => parseInt(berlin.find(p => p.type === type)?.value ?? '0', 10)
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hours = get('hour')

  // Wochentag (Mo=1, So=7) per Intl
  const dowStr = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' }).formatToParts(d)
    .find(p => p.type === 'weekday')?.value ?? 'Montag'
  const dowMap: Record<string, number> = { 'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4, 'Freitag': 5, 'Samstag': 6, 'Sonntag': 7 }
  const dow = dowMap[dowStr] ?? 1

  return { year, month, day, hours, dow }
}

/** Gib UTC-Ms für Montag 00:00 Europe/Berlin der Woche, die `ts` enthält */
function weekStartBerlin(ts: number): number {
  const { year, month, day, hours, dow } = toBerlinLocal(ts)
  // daysSinceMonday: dow (Mo=1) → 0, Di=2→1, ..., So=7→6
  const daysSinceMonday = dow - 1
  // Local date at 00:00 Berlin time on Monday
  const localStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
  const localDate = new Date(localStr)
  // Subtract days since Monday + hours
  const msMonday = localDate.getTime() - daysSinceMonday * 86400_000 - (hours % 24) * MS_PER_HOUR
  return msMonday
}

// ----------------------------------------------------------------
// Hauptfunktion
// ----------------------------------------------------------------
export function useLandingData() {
  const { loadSmard, loadPrices } = useData()

  const loading = shallowRef(true)
  const error = shallowRef<string | null>(null)
  const smard = shallowRef<SmardRow[]>([])
  const prices = shallowRef<PriceRow[]>([])

  /** Einmalig alle Rohdaten laden */
  async function load() {
    loading.value = true
    error.value = null
    try {
      const [s, p] = await Promise.all([loadSmard(), loadPrices()])
      smard.value = s
      prices.value = p
    } catch (e: any) {
      error.value = e.message ?? 'Fehler beim Laden der Daten'
    } finally {
      loading.value = false
    }
  }

  // --------------------------------------------------------------
  // Wochenaggregation (reaktiv, abhängig von smard.value)
  // --------------------------------------------------------------
  const weeklyData = computed<WeeklyRecordPoint[]>(() => {
    const rows = smard.value
    if (!rows.length) return []

    const weekMap = new Map<number, { max: number; sum: number; count: number; recordTs: number }>()

    for (const row of rows) {
      if (!isValidEERow(row)) continue
      const share = calcRenewables(row) / row.last
      const ws = weekStartBerlin(row.timestamp)
      const entry = weekMap.get(ws) ?? { max: -Infinity, sum: 0, count: 0, recordTs: 0 }
      entry.max = Math.max(entry.max, share)
      entry.sum += share
      entry.count++
      if (share > entry.max) entry.recordTs = row.timestamp
      weekMap.set(ws, entry)
    }

    const sorted = [...weekMap.entries()].sort((a, b) => a[0] - b[0])
    let runningRecord = 0
    const result: WeeklyRecordPoint[] = []

    for (const [ws, d] of sorted) {
      if (d.max > runningRecord) {
        runningRecord = d.max
      }
      result.push({
        weekStart: ws,
        maxRenewableShare: d.max,
        meanRenewableShare: d.sum / d.count,
        runningRecord,
        recordTimestamp: d.recordTs,
      })
    }

    return result
  })

  // --------------------------------------------------------------
  // Meilensteine (reaktiv, abhängig von smard.value + prices.value)
  // --------------------------------------------------------------
  const milestones = computed<Milestone[]>(() => {
    const rows = smard.value
    const priceRows = prices.value
    if (!rows.length) return []

    const result: Milestone[] = []

    // --- Helper: Jahresaggregat ---
    function annualAggregate(fn: (row: SmardRow) => number, filter?: (row: SmardRow) => boolean): { year: number; value: number }[] {
      const yearMap = new Map<number, { sum: number; denom: number }>()
      for (const row of rows) {
        if (filter && !filter(row)) continue
        const v = fn(row)
        if (!Number.isFinite(v)) continue
        const loc = toBerlinLocal(row.timestamp)
        const e = yearMap.get(loc.year) ?? { sum: 0, denom: 0 }
        if (typeof v === 'number' && v !== 0) { e.sum += v; e.denom++ }
        yearMap.set(loc.year, e)
      }
      return [...yearMap.entries()]
        .map(([year, e]) => ({ year, value: e.sum }))
        .sort((a, b) => a.year - b.year)
    }

    // --- Meilenstein 1: Startwert 2015 ---
    const annualEE = annualAggregate(
      (row) => { const r = calcRenewables(row); return Number.isFinite(row.last) && row.last! > 0 ? r / row.last : NaN },
      (row) => isValidEERow(row)
    )
    // Wir brauchen den jährlichen EE-Anteil als Anteil, nicht als Summe
    const annualEEShare: { year: number; value: number }[] = []
    const yearSum = new Map<number, { renewSum: number; loadSum: number }>()
    for (const row of rows) {
      if (!isValidEERow(row)) continue
      const loc = toBerlinLocal(row.timestamp)
      const e = yearSum.get(loc.year) ?? { renewSum: 0, loadSum: 0 }
      e.renewSum += calcRenewables(row)
      e.loadSum += row.last
      yearSum.set(loc.year, e)
    }
    for (const [year, v] of [...yearSum.entries()].sort((a, b) => a[0] - b[0])) {
      annualEEShare.push({ year, value: v.renewSum / v.loadSum })
    }

    const start2015 = annualEEShare.find(y => y.year === 2015)
    if (start2015) {
      result.push({
        id: 'start-2015',
        timestamp: new Date(Date.UTC(2015, 0, 1)).getTime(),
        year: 2015,
        category: 'renewables',
        title: 'Startwert 2015',
        description: `Erneuerbare decken ${(start2015.value * 100).toFixed(0)} % der Stromnachfrage.`,
        value: start2015.value,
        unit: '%',
        source: 'SMARD',
        resolution: 'P1Y',
        definition: 'Jährlicher EE-Anteil: sum(renewables) / sum(load)',
        isPrimary: true,
      })
    }

    // --- Meilenstein 2: Erstes Jahr über 40 % EE ---
    const over40 = annualEEShare.find(y => y.value > 0.4)
    if (over40) {
      result.push({
        id: 'first-over-40',
        timestamp: new Date(Date.UTC(over40.year, 0, 1)).getTime(),
        year: over40.year,
        category: 'renewables',
        title: 'Erstes Jahr über 40 % Erneuerbare',
        description: `Der jährliche EE-Anteil erreicht ${(over40.value * 100).toFixed(0)} %.`,
        value: over40.value,
        unit: '%',
        source: 'SMARD',
        resolution: 'P1Y',
        definition: 'Erstes Jahr mit sum(renewables) / sum(load) > 0,4',
        isPrimary: true,
      })
    }

    // --- Meilenstein 3: Wind überholt Braunkohle ---
    const windVsLignite: { year: number; wind: number; lignite: number }[] = []
    const wlMap = new Map<number, { wind: number; lignite: number }>()
    for (const row of rows) {
      if (!Number.isFinite(row.windOnshore) || !Number.isFinite(row.windOffshore) || !Number.isFinite(row.braunkohle)) continue
      const loc = toBerlinLocal(row.timestamp)
      const e = wlMap.get(loc.year) ?? { wind: 0, lignite: 0 }
      e.wind += (row.windOnshore ?? 0) + (row.windOffshore ?? 0)
      e.lignite += (row.braunkohle ?? 0)
      wlMap.set(loc.year, e)
    }
    for (const [year, v] of [...wlMap.entries()].sort((a, b) => a[0] - b[0])) {
      windVsLignite.push({ year, wind: v.wind, lignite: v.lignite })
    }
    const windWins = windVsLignite.find(y => y.wind > y.lignite)
    if (windWins) {
      result.push({
        id: 'wind-over-lignite',
        timestamp: new Date(Date.UTC(windWins.year, 0, 1)).getTime(),
        year: windWins.year,
        category: 'structural',
        title: 'Wind überholt Braunkohle',
        description: 'Wind erzeugt im Jahresverlauf erstmals mehr Strom als Braunkohle.',
        source: 'SMARD',
        resolution: 'P1Y',
        definition: 'Erstes Jahr mit sum(windOnshore + windOffshore) > sum(braunkohle)',
        isPrimary: true,
      })
    }

    // --- Meilenstein 4: Solar überholt Steinkohle ---
    const solarVsCoal: { year: number; solar: number; hardcoal: number }[] = []
    const scMap = new Map<number, { solar: number; hardcoal: number }>()
    for (const row of rows) {
      if (!Number.isFinite(row.solar) || !Number.isFinite(row.steinkohle)) continue
      const loc = toBerlinLocal(row.timestamp)
      const e = scMap.get(loc.year) ?? { solar: 0, hardcoal: 0 }
      e.solar += (row.solar ?? 0)
      e.hardcoal += (row.steinkohle ?? 0)
      scMap.set(loc.year, e)
    }
    for (const [year, v] of [...scMap.entries()].sort((a, b) => a[0] - b[0])) {
      solarVsCoal.push({ year, solar: v.solar, hardcoal: v.hardcoal })
    }
    const solarWins = solarVsCoal.find(y => y.solar > y.hardcoal)
    if (solarWins) {
      result.push({
        id: 'solar-over-hardcoal',
        timestamp: new Date(Date.UTC(solarWins.year, 0, 1)).getTime(),
        year: solarWins.year,
        category: 'structural',
        title: 'Solar überholt Steinkohle',
        description: 'Photovoltaik übertrifft Steinkohle erstmals in der Jahreserzeugung.',
        source: 'SMARD',
        resolution: 'P1Y',
        definition: 'Erstes Jahr mit sum(solar) > sum(steinkohle)',
        isPrimary: true,
      })
    }

    // --- Meilenstein 5: Höchste Wind-und-Solar-Erzeugung (stündlich) ---
    let maxWindSolar = 0
    let maxWSTs = 0
    for (const row of rows) {
      const ws = (row.solar ?? 0) + (row.windOnshore ?? 0) + (row.windOffshore ?? 0)
      if (ws > maxWindSolar) { maxWindSolar = ws; maxWSTs = row.timestamp }
    }
    if (maxWSTs > 0) {
      const loc = toBerlinLocal(maxWSTs)
      result.push({
        id: 'max-wind-solar',
        timestamp: maxWSTs,
        year: loc.year,
        category: 'renewables',
        title: 'Neuer Höchstwert für Wind und Solar',
        description: `Wind und Solar erzeugen gemeinsam ${(maxWindSolar / 1000).toFixed(1)} GW in einer Stunde.`,
        value: maxWindSolar / 1000,
        unit: 'GW',
        source: 'SMARD',
        resolution: 'PT60M',
        definition: 'Maximaler stündlicher Wert von solar + windOnshore + windOffshore',
        isPrimary: true,
      })
    }

    // --- Meilenstein 6: Höchster stündlicher EE-Anteil ---
    let maxEE = 0
    let maxEETs = 0
    for (const row of rows) {
      if (!isValidEERow(row)) continue
      const share = calcRenewables(row) / row.last
      if (share > maxEE) { maxEE = share; maxEETs = row.timestamp }
    }
    if (maxEETs > 0) {
      const loc = toBerlinLocal(maxEETs)
      result.push({
        id: 'max-ee-share',
        timestamp: maxEETs,
        year: loc.year,
        category: 'renewables',
        title: 'Höchster stündlicher EE-Anteil',
        description: `Der Anteil erneuerbarer Energien erreicht ${(maxEE * 100).toFixed(0)} % der Stromnachfrage.`,
        value: maxEE * 100,
        unit: '%',
        source: 'SMARD',
        resolution: 'PT60M',
        definition: 'Maximaler stündlicher Wert von renewables / last (beide in MWh)',
        isPrimary: true,
      })
    }

    // --- Meilenstein 7: Ende der Kernenergie ---
    const nuclearThresholdMW = 10
    let lastNuclearTs = 0
    let foundEnd = false
    for (const row of rows) {
      if (!isValidNuclearRow(row)) continue
      if (row.kernenergie >= nuclearThresholdMW) {
        lastNuclearTs = row.timestamp
      }
    }
    // Prüfe, dass nach lastNuclearTs keine relevante Kernenergie mehr kommt
    if (lastNuclearTs > 0) {
      const after = rows.filter(r => r.timestamp > lastNuclearTs && isValidNuclearRow(r))
      const hasNuclearAfter = after.some(r => r.kernenergie >= nuclearThresholdMW)
      if (!hasNuclearAfter) {
        const loc = toBerlinLocal(lastNuclearTs)
        result.push({
          id: 'nuclear-end',
          timestamp: lastNuclearTs,
          year: loc.year,
          category: 'structural',
          title: 'Kernenergie verschwindet aus dem Erzeugungsmix',
          description: `Letzte gemessene Erzeugungsstunde mit mehr als ${nuclearThresholdMW} MW Kernenergie.`,
          source: 'SMARD',
          resolution: 'PT60M',
          definition: `Letzter Stundenwert mit kernenergie >= ${nuclearThresholdMW} MW, danach kein relevanter Wert mehr`,
          isPrimary: true,
        })
      }
    }

    // --- Meilenstein 8: Tag mit den meisten negativen Preisstunden ---
    if (priceRows.length > 0) {
      // Gruppiere nach Europe/Berlin Kalendertag
      const dayNegMap = new Map<string, { date: number; negCount: number; minPrice: number; sumPrice: number; count: number }>()
      for (const pr of priceRows) {
        if (!Number.isFinite(pr.price)) continue
        const loc = toBerlinLocal(pr.timestamp)
        const dayKey = `${loc.year}-${String(loc.month).padStart(2, '0')}-${String(loc.day).padStart(2, '0')}`
        const e = dayNegMap.get(dayKey) ?? { date: pr.timestamp - (pr.timestamp % 86400_000), negCount: 0, minPrice: Infinity, sumPrice: 0, count: 0 }
        e.sumPrice += pr.price
        e.count++
        if (pr.price < 0) e.negCount++
        if (pr.price < e.minPrice) e.minPrice = pr.price
        dayNegMap.set(dayKey, e)
      }

      let worstDay: { date: number; negCount: number; minPrice: number; sumPrice: number; count: number } | null = null
      for (const d of dayNegMap.values()) {
        if (!worstDay || d.negCount > worstDay.negCount ||
            (d.negCount === worstDay.negCount && d.sumPrice / d.count < worstDay.sumPrice / worstDay.count)) {
          worstDay = d
        }
      }

      if (worstDay && worstDay.negCount > 0) {
        const loc = toBerlinLocal(worstDay.date)
        result.push({
          id: 'most-negative-prices',
          timestamp: worstDay.date,
          year: loc.year,
          category: 'prices',
          title: 'Tag mit den meisten negativen Preisstunden',
          description: `${worstDay.negCount} von ${worstDay.count} Stunden mit negativem Day-Ahead-Preis. Tiefster Preis: ${worstDay.minPrice.toFixed(0)} €/MWh.`,
          value: worstDay.negCount,
          unit: 'h',
          source: 'ENTSO-E',
          resolution: 'PT60M',
          definition: 'Kalendertag (Europe/Berlin) mit den meisten negativen stündlichen Day-Ahead-Preisen',
          isPrimary: true,
        })
      }
    }

    return result
  })

  // --------------------------------------------------------------
  // Detaildaten für die MilestoneCard (pro Milestone)
  // --------------------------------------------------------------
  function getDetailData(m: Milestone): DetailData | null {
    const rows = smard.value
    const priceRows = prices.value
    if (!rows.length) return null

    if (m.resolution === 'PT60M' && m.timestamp > 0) {
      // ±24 Stunden um das Ereignis
      const start = m.timestamp - 24 * MS_PER_HOUR
      const end = m.timestamp + 24 * MS_PER_HOUR
      const hours = rows
        .filter(r => r.timestamp >= start && r.timestamp <= end && isValidEERow(r))
        .map(r => ({ ...r, renewableShare: calcRenewables(r) / r.last }))

      if (m.id === 'most-negative-prices' && priceRows.length > 0) {
        // Preisverlauf des Tages
        const dayStart = m.timestamp
        const dayEnd = m.timestamp + 86400_000
        const prices = priceRows
          .filter(p => p.timestamp >= dayStart && p.timestamp < dayEnd)
          .map(p => ({ hour: new Date(p.timestamp).getUTCHours(), price: p.price }))
          .sort((a, b) => a.hour - b.hour)
        return { type: 'dailyPrice', prices }
      }

      if (hours.length > 0) {
        return { type: 'hourlyMix', hours }
      }
    }

    if (m.resolution === 'P1Y') {
      // Jahresvergleich: Wind vs Braunkohle oder Solar vs Steinkohle
      if (m.id === 'wind-over-lignite' || m.id === 'solar-over-hardcoal') {
        const years: { year: number; value: number }[] = []
        const yearMap = new Map<number, number>()
        const field1 = m.id === 'wind-over-lignite' ? ['windOnshore', 'windOffshore'] : ['solar']
        const field2 = m.id === 'wind-over-lignite' ? 'braunkohle' : 'steinkohle'

        for (const row of rows) {
          const v1 = field1.reduce((s, f) => s + ((row as any)[f] ?? 0), 0)
          const v2 = (row as any)[field2] ?? 0
          if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue
          const loc = toBerlinLocal(row.timestamp)
          // Nur die Jahre um den Meilenstein herum
          if (Math.abs(loc.year - m.year) > 3) continue
          const key = loc.year
          const existing = yearMap.get(key) ?? 0
          yearMap.set(key, existing + v1)
        }

        for (const [year, val] of yearMap) {
          years.push({ year, value: val })
        }
        years.sort((a, b) => a.year - b.year)
        return { type: 'yearlyComparison', years }
      }
    }

    return null
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    load,
    smard: readonly(smard),
    prices: readonly(prices),
    weeklyData,
    milestones,
    getDetailData,
  }
}
