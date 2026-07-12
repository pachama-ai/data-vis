/**
 * composables/useStartEndComparison.ts
 * =====================================
 * Berechnet die drei Träger mit der größten Veränderung zwischen
 * erstem und letztem Monat des sichtbaren Zeitraums.
 * Pure Computed-Properties ohne Seiteneffekte.
 */

import type { MonthlyDataPoint } from './useExtremeValues'

export interface BarbellRow {
  key: string
  label: string
  color: string
  shareStart: number
  shareEnd: number
  delta: number // in Prozentpunkten (als Dezimal, z. B. 0.05 = 5 pp)
}

const ALL_KEYS = ['biomass', 'hydro', 'wind_onshore', 'wind_offshore', 'pv',
  'nuclear', 'gas', 'hardcoal', 'lignite', 'other']

const COLORS: Record<string, string> = {
  biomass: '#7A9B4E', hydro: '#C4B8A0', wind_onshore: '#4A90A4',
  wind_offshore: '#1A4A5A', pv: '#E8B547', nuclear: '#B85C8E',
  gas: '#D97742', hardcoal: '#3A3A3A', lignite: '#6B4423', other: '#A8A29E',
}
const LABELS: Record<string, string> = {
  biomass: 'Biomasse', hydro: 'Wasserkraft', wind_onshore: 'Wind Onshore',
  wind_offshore: 'Wind Offshore', pv: 'Photovoltaik', nuclear: 'Kernenergie',
  gas: 'Erdgas', hardcoal: 'Steinkohle', lignite: 'Braunkohle', other: 'Sonstige',
}

export function useStartEndComparison(data: Ref<MonthlyDataPoint[]>) {
  const rows = computed<BarbellRow[]>(() => {
    if (data.value.length < 2) return []
    const first = data.value[0]
    const last = data.value[data.value.length - 1]

    // Für jeden Träger die Veränderung in Prozentpunkten berechnen
    const deltas = ALL_KEYS.map((key) => {
      const fv = first[key] as number
      const lv = last[key] as number
      const fTotal = first.total || 1
      const lTotal = last.total || 1
      const shareStart = fv / fTotal
      const shareEnd = lv / lTotal
      return {
        key,
        label: LABELS[key],
        color: COLORS[key],
        shareStart,
        shareEnd,
        delta: shareEnd - shareStart,
      }
    })

    // Nach absoluter Veränderung sortieren, Top 3
    return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
  })

  const dateRangeLabel = computed(() => {
    if (data.value.length < 2) return ''
    const first = data.value[0]
    const last = data.value[data.value.length - 1]
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
    return fmt(first.date!) + ' → ' + fmt(last.date!)
  })

  const maxShare = computed(() => {
    if (!rows.value.length) return 0.05
    // Größter vorkommender Anteil (Start oder Ende) plus 5 % Puffer
    let max = 0
    for (const r of rows.value) {
      max = Math.max(max, r.shareStart, r.shareEnd)
    }
    return Math.min(1, max * 1.2 + 0.05)
  })

  return { rows, dateRangeLabel, maxShare }
}
