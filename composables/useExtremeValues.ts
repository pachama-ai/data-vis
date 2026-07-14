/**
 * composables/useExtremeValues.ts
 * ================================
 * Berechnet die drei Extremwert-Kennzahlen aus monatlich aggregierten Daten.
 * Pure Computed-Properties ohne Seiteneffekte – verwendbar in jeder Komponente.
 *
 * Datenstruktur MonthlyDataPoint entspricht dem Output der aggregate()-Funktion
 * aus StackedArea.vue (monatliche Aggregation).
 */

export interface MonthlyDataPoint {
  date: Date
  total: number
  [key: string]: number | Date | boolean | undefined
  biomass: number
  hydro: number
  wind_onshore: number
  wind_offshore: number
  pv: number
  nuclear: number
  gas: number
  hardcoal: number
  lignite: number
  other: number
  _gap?: boolean
}

export interface ExtremeValueResult {
  /** Kategorie-Titel (z. B. 'HÖCHSTER ERNEUERBAREN-ANTEIL') */
  label: string
  /** Formatierter Hauptwert (z. B. '68,4 %') */
  value: string
  /** Monat des Extremums (z. B. 'Juli 2023') */
  dateLabel: string
  /** Kontext-Zeile (z. B. 'im Vergleich zum Durchschnitt: +12 pp') */
  context: string
  /** Nummerischer Rohwert für Animation */
  rawValue: number
}

const RENEWABLE_KEYS = ['wind_onshore', 'wind_offshore', 'pv', 'biomass', 'hydro']
const FOSSIL_KEYS = ['lignite', 'hardcoal', 'gas']
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

/** Dezimalzahl als Prozent-String (z. B. 0,68 → '68,4 %') */
function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace('.', ',') + ' %'
}

/** Differenz in Prozentpunkten (z. B. 0,12 → '+12,0 pp') */
function fmtPctDiff(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return sign + (v * 100).toFixed(1).replace('.', ',') + ' pp'
}

/** Datum als deutscher Monatsname mit Jahr (z. B. 'Januar 2024') */
function fmtMonth(d: Date): string {
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
}

/** MWh-Wert in GWh-String umrechnen (z. B. 5000000 → '5.000 GWh') */
function fmtGWh(v: number): string {
  return Math.round(v / 1000).toLocaleString('de-DE') + ' GWh'
}

export function useExtremeValues(data: Ref<MonthlyDataPoint[]>) {
  // Hilfsrechnung: Erneuerbaren-Anteil pro Monat
  const renewableSharePerMonth = computed(() => {
    return data.value.map((d) => {
      const ren = RENEWABLE_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      return { date: d.date, share: d.total > 0 ? ren / d.total : 0 }
    })
  })

  // 1. Höchster Erneuerbaren-Anteil
  const highestRenewableShare = computed<ExtremeValueResult | null>(() => {
    const items = renewableSharePerMonth.value
    if (!items.length) return null
    const max = items.reduce((a, b) => (a.share > b.share ? a : b))
    const avg = items.reduce((s, d) => s + d.share, 0) / items.length
    const diff = max.share - avg
    const context = diff >= 0
      ? 'zum Durchschnitt: +' + (diff * 100).toFixed(1).replace('.', ',') + ' pp'
      : 'zum Durchschnitt: ' + (diff * 100).toFixed(1).replace('.', ',') + ' pp'
    return {
      label: 'Höchster Erneuerbaren-Anteil',
      value: fmtPct(max.share),
      dateLabel: fmtMonth(max.date),
      context: 'im Vergleich ' + context,
      rawValue: max.share,
    }
  })

  // 2. Höchste fossile Erzeugung
  const highestFossilGeneration = computed<ExtremeValueResult | null>(() => {
    if (!data.value.length) return null
    let maxMonth: MonthlyDataPoint | null = null
    let maxFossil = 0
    for (const d of data.value) {
      const fossil = FOSSIL_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      if (fossil > maxFossil) { maxFossil = fossil; maxMonth = d }
    }
    if (!maxMonth) return null
    const share = maxMonth.total > 0 ? maxFossil / maxMonth.total : 0
    return {
      label: 'Höchste fossile Erzeugung',
      value: fmtGWh(maxFossil),
      dateLabel: fmtMonth(maxMonth.date!),
      context: 'Anteil am Strommix: ' + (share * 100).toFixed(1).replace('.', ',') + ' %',
      rawValue: maxFossil,
    }
  })

  // 3. Größte Veränderung
  const largestChange = computed<ExtremeValueResult | null>(() => {
    if (data.value.length < 2) return null
    const first = data.value[0]
    const last = data.value[data.value.length - 1]
    let maxDelta = 0
    let maxKey = ''
    for (const key of ALL_KEYS) {
      const fv = first[key] as number
      const lv = last[key] as number
      const fTotal = first.total || 1
      const lTotal = last.total || 1
      const fShare = fv / fTotal
      const lShare = lv / lTotal
      const delta = lShare - fShare
      if (Math.abs(delta) > Math.abs(maxDelta)) {
        maxDelta = delta
        maxKey = key
      }
    }
    if (!maxKey) return null
    return {
      label: 'Größte Veränderung',
      value: LABELS[maxKey] || maxKey,
      dateLabel: fmtMonth(first.date!) + ' → ' + fmtMonth(last.date!),
      context: fmtPctDiff(maxDelta),
      rawValue: maxDelta,
    }
  })

  return { highestRenewableShare, highestFossilGeneration, largestChange }
}
