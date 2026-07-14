/**
 * utils/aggregate.ts
 * ===================
 * Geteilte Aggregations-Funktion, von dashboard.vue und StackedArea.vue genutzt.
 * Fasst Stunden-Daten in Tag/Woche/Monat/Quartal-Buckets zusammen.
 */

import type { HourlyRow } from '~/composables/useData'
import type { MonthlyDataPoint } from '~/composables/useExtremeValues'
import { getBerlinYear, getBerlinMonth, getBerlinDateKey, getBerlinHour } from './berlin'

// Alle Erzeugungs-Quellen (Reihenfolge wie im Dashboard)
const SOURCES = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite', 'other'] as const

// Erwartete Stunden pro Aggregationsebene (für Lücken-Erkennung)
const HOURS_EXPECTED: Record<string, number> = { tag: 1, woche: 168, monat: 730, quartal: 2190 }

type AggLevel = 'tag' | 'woche' | 'monat' | 'quartal'

interface AggOptions {
  level?: AggLevel
  /** CO₂-Summe pro Bucket mitschreiben (für StackedArea) */
  trackCo2?: boolean
  /** Schwellwert (0–1): Buckets mit weniger Stunden gelten als Lücke. Default 0.1 */
  gapThreshold?: number
}

export function aggregate(rows: HourlyRow[], options: AggOptions = {}): MonthlyDataPoint[] {
  const level = options.level ?? 'monat'
  const trackCo2 = options.trackCo2 ?? false
  const minFrac = options.gapThreshold ?? 0.1

  const levelConfig: Record<string, { makeKey: (ts: number) => string; parseDate: (key: string) => Date }> = {
    tag: {
      makeKey: (ts) => getBerlinDateKey(ts),
      parseDate: (key) => new Date(key + 'T00:00:00+01:00'), // CET
    },
    woche: {
      makeKey: (ts) => {
        const d = new Date(ts)
        const berlinStr = d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
        const [dd, mm, yyyy] = berlinStr.split('.')
        const berlinDate = new Date(+yyyy, +mm - 1, +dd)
        const do4 = new Date(berlinDate); do4.setDate(berlinDate.getDate() + (4 - (berlinDate.getDay() || 7)))
        const weekNum = Math.ceil(((do4.getTime() - new Date(do4.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)
        return do4.getFullYear() + '-W' + String(weekNum).padStart(2, '0')
      },
      parseDate: (key) => { const [y, w] = key.split('-W'); return new Date(Date.UTC(+y, 0, 1 + (+w - 1) * 7)) },
    },
    monat: {
      makeKey: (ts) => getBerlinYear(ts) + '-' + String(getBerlinMonth(ts)).padStart(2, '0'),
      parseDate: (key) => { const [y, m] = key.split('-'); return new Date(Date.UTC(+y, +m - 1, 1)) },
    },
    quartal: {
      makeKey: (ts) => getBerlinYear(ts) + '-Q' + (Math.ceil(getBerlinMonth(ts) / 3)),
      parseDate: (key) => { const [y, q] = key.split('-Q'); return new Date(Date.UTC(+y, (+q - 1) * 3, 1)) },
    },
  }
  const cfg = levelConfig[level] || levelConfig.monat

  // Buckets bauen
  const buckets = new Map<string, any>()

  for (const row of rows) {
    const key = cfg.makeKey(row.timestamp)
    if (!buckets.has(key)) {
      const init: any = { date: cfg.parseDate(key), total: 0, hours: 0, co2Sum: 0, co2Count: 0 }
      for (const src of SOURCES) init[src] = 0
      buckets.set(key, init)
    }
    const b = buckets.get(key)!
    b.hours++
    for (const src of SOURCES) {
      if (src === 'other') {
        b.other += (row.generation_by_source.other_renewables ?? 0) + (row.generation_by_source.other_fossil ?? 0) + (row.generation_by_source.pumped_storage ?? 0)
      } else {
        b[src] += (row.generation_by_source[src as keyof typeof row.generation_by_source] ?? 0)
      }
    }
    b.total += Object.values(row.generation_by_source).reduce((s: number, v) => s + (v ?? 0), 0)
    if (trackCo2) { b.co2Sum += row.co2_g_per_kwh; b.co2Count++ }
  }

  const expected = HOURS_EXPECTED[level] || 730
  return [...buckets.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((d) => (d.hours / expected >= minFrac) ? d : { ...d, _gap: true })
}
