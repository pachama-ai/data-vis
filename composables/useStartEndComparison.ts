/**
 * useStartEndComparison.ts – Vergleich zwischen erstem und letztem Monat.
 *
 * Berechnet die drei Energieträger mit der größten Veränderung im
 * sichtbaren Zeitraum. Liefert Daten für die Barbell-Chart-Darstellung.
 *
 * @example
 * const { rows, dateRangeLabel } = useStartEndComparison(monthlyData)
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

// TODO: irgendwann in shared file, kommt auch in StackedArea.vue und useExtremeValues vor

/**
 * Vergleicht den ersten mit dem letzten Monat und gibt die Top-3-Veränderungen zurück.
 *
 * @param data Ref mit Array von MonthlyDataPoint.
 * @returns rows (Top-3-Veränderungen), dateRangeLabel, maxShare.
 */
export function useStartEndComparison(data: Ref<MonthlyDataPoint[]>) {
  const cleanData = computed(() => data.value.filter((d) => !d._gap))
  const rows = computed<BarbellRow[]>(() => {
    if (cleanData.value.length < 2) return []
    const first = cleanData.value[0]
    const last = cleanData.value[cleanData.value.length - 1]

    // für jeden träger die veränderung berechnen
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

    // sortieren nach absoluter veränderung, top 3
    return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
  })

  const dateRangeLabel = computed(() => {
    if (cleanData.value.length < 2) return ''
    const first = cleanData.value[0]
    const last = cleanData.value[cleanData.value.length - 1]
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
