/**
 * useExtremeValues.ts – Berechnet die drei Extremwert-Kennzahlen.
 *
 * Arbeitet auf monatlich aggregierten Daten (MonthlyDataPoint) und liefert
 * pure Computed-Properties ohne Seiteneffekte. Wird von der Dashboard-Seite
 * und ExtremeValuesPanel verwendet.
 *
 * @example
 * const { highestRenewableShare, largestChange } = useExtremeValues(monthlyData)
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

/**
 * Ergebnis einer Extremwert-Berechnung.
 * Enthält den formatierten Wert, Datumsangabe und Kontext für die Anzeige.
 * valueType steuert das Vorzeichen (Ø, Σ oder keins) in der Sidebar.
 */
export type ValueType = 'average' | 'sum' | 'delta'

export interface ExtremeValueResult {
  label: string
  value: string
  dateLabel: string
  context: string
  rawValue: number
  valueType: ValueType
}

// TODO: irgendwann in shared file, kommt auch in StackedArea.vue und StartEndComparison vor
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

/**
 * Dezimalzahl als Prozent-String, deutsches Format.
 * @param v Dezimalwert (0.68 = 68 %).
 * @returns z. B. "68,4 %".
 */
function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace('.', ',') + ' %'
}

/**
 * Differenz in Prozentpunkten mit Vorzeichen.
 * @param v Dezimal-Differenz (0.12 = +12 pp).
 * @returns z. B. "+12,0 pp" oder "-3,5 pp".
 */
function fmtPctDiff(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return sign + (v * 100).toFixed(1).replace('.', ',') + ' pp'
}

/**
 * Formatiert ein Datum level-abhängig.
 * @param d Das Datum.
 * @param aggLevel Aggregationsebene.
 * @returns z. B. "Januar 2024", "Q1 2024", "KW 22/2024".
 */
function fmtDate(d: Date, aggLevel: string): string {
  if (aggLevel === 'quartal') {
    const q = Math.ceil((d.getUTCMonth() + 1) / 3)
    return 'Q' + q + ' ' + d.getUTCFullYear()
  }
  if (aggLevel === 'woche') {
    const start = new Date(d.getUTCFullYear(), 0, 1)
    const kw = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7)
    return 'KW ' + kw + '/' + d.getUTCFullYear()
  }
  if (aggLevel === 'tag') {
    return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
}

/**
 * Formatiert MWh level-abhängig (GWh für Monat/Tag/Woche, TWh für Quartal).
 */
function fmtEnergy(v: number, aggLevel: string): string {
  if (aggLevel === 'quartal') {
    return (v / 1e6).toFixed(1).replace('.', ',') + ' TWh'
  }
  return Math.round(v / 1000).toLocaleString('de-DE') + ' GWh'
}

export function useExtremeValues(
  data: Ref<MonthlyDataPoint[]>,
  aggLevel: Ref<string> = ref('monat'),
  mode: Ref<'absolute' | 'percent'> = ref('percent')
) {
  const cleanData = computed(() => data.value.filter((d) => !d._gap))

  // EE-Erzeugung absolut pro Bucket (für Absolute-Modus)
  const renewableGenPerBucket = computed(() => {
    return cleanData.value.map((d) => {
      const ren = RENEWABLE_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      return { date: d.date, gen: ren }
    })
  })

  // EE-Anteil pro Bucket (für Prozent-Modus)
  const renewableSharePerMonth = computed(() => {
    return cleanData.value.map((d) => {
      const ren = RENEWABLE_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      return { date: d.date, share: d.total > 0 ? ren / d.total : 0 }
    })
  })

  // Fossiler Anteil pro Bucket (für Prozent-Modus)
  const fossilSharePerMonth = computed(() => {
    return cleanData.value.map((d) => {
      const fos = FOSSIL_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      return { date: d.date, share: d.total > 0 ? fos / d.total : 0 }
    })
  })

  // 1. Höchster EE-Wert (Anteil in %, oder absolute Erzeugung)
  const highestRenewableShare = computed<ExtremeValueResult | null>(() => {
    if (!cleanData.value.length) return null

    if (mode.value === 'absolute') {
      // Absolut: Höchste EE-Erzeugung in GWh/TWh
      const gb = renewableGenPerBucket.value
      if (!gb.length) return null
      const maxBucket = gb.reduce((a, b) => (b.gen > a.gen ? b : a))
      return {
        label: 'Höchste EE-Erzeugung',
        value: fmtEnergy(maxBucket.gen, aggLevel.value),
        dateLabel: fmtDate(maxBucket.date, aggLevel.value),
        context: 'Zeitraum mit der meisten erneuerbaren Stromerzeugung',
        rawValue: maxBucket.gen,
        valueType: 'sum',
      }
    }

    // Prozent: Höchster EE-Anteil
    const items = renewableSharePerMonth.value
    const max = items.reduce((a, b) => (a.share > b.share ? a : b))
    const avg = items.reduce((s, d) => s + d.share, 0) / items.length
    const diff = max.share - avg
    const ppm = (diff * 100).toFixed(1).replace('.', ',')
    const context = diff >= 0
      ? ppm + ' Prozentpunkte über dem Durchschnitt des gewählten Zeitraums'
      : Math.abs(diff * 100).toFixed(1).replace('.', ',') + ' Prozentpunkte unter dem Durchschnitt des gewählten Zeitraums'
    return {
      label: 'Höchster Erneuerbaren-Anteil',
      value: fmtPct(max.share),
      dateLabel: fmtDate(max.date, aggLevel.value),
      context: context,
      rawValue: max.share,
      valueType: 'average',
    }
  })

  // 2. Höchste fossile Erzeugung / Höchster fossiler Anteil
  const highestFossilGeneration = computed<ExtremeValueResult | null>(() => {
    if (!cleanData.value.length) return null

    if (mode.value === 'percent') {
      // Prozent: Höchster fossiler Anteil
      const items = fossilSharePerMonth.value
      const max = items.reduce((a, b) => (a.share > b.share ? a : b))
      const avg = items.reduce((s, d) => s + d.share, 0) / items.length
      const diff = max.share - avg
      const ppm = (diff * 100).toFixed(1).replace('.', ',')
      const context = diff >= 0
        ? ppm + ' Prozentpunkte über dem Durchschnitt des gewählten Zeitraums'
        : Math.abs(diff * 100).toFixed(1).replace('.', ',') + ' Prozentpunkte unter dem Durchschnitt des gewählten Zeitraums'
      return {
        label: 'Höchster fossiler Anteil',
        value: fmtPct(max.share),
        dateLabel: fmtDate(max.date, aggLevel.value),
        context: context,
        rawValue: max.share,
        valueType: 'average',
      }
    }

    // Absolut: Höchste fossile Erzeugung in GWh/TWh
    let maxMonth: MonthlyDataPoint | null = null
    let maxFossil = 0
    for (const d of cleanData.value) {
      const fossil = FOSSIL_KEYS.reduce((s, k) => s + (d[k] as number), 0)
      if (fossil > maxFossil) { maxFossil = fossil; maxMonth = d }
    }
    if (!maxMonth) return null
    const share = maxMonth.total > 0 ? maxFossil / maxMonth.total : 0
    return {
      label: 'Höchste fossile Erzeugung',
      value: fmtEnergy(maxFossil, aggLevel.value),
      dateLabel: fmtDate(maxMonth.date!, aggLevel.value),
      context: 'Anteil am Strommix: ' + (share * 100).toFixed(1).replace('.', ',') + ' %',
      rawValue: maxFossil,
      valueType: 'sum',
    }
  })

  // 3. Größte Veränderung
  const largestChange = computed<ExtremeValueResult | null>(() => {
    if (cleanData.value.length < 2) return null
    const first = cleanData.value[0]!
    const last = cleanData.value[cleanData.value.length - 1]!
    let maxDelta = 0
    let maxKey = ''
    if (mode.value === 'absolute') {
      // Absolut: Veränderung in MWh/GWh
      for (const key of ALL_KEYS) {
        const fv = first[key] as number
        const lv = last[key] as number
        const delta = lv - fv
        if (Math.abs(delta) > Math.abs(maxDelta)) {
          maxDelta = delta
          maxKey = key
        }
      }
      if (!maxKey) return null
      const prefix = maxDelta >= 0 ? '+' : ''
      return {
        label: 'Größte Veränderung der Erzeugungsmenge',
        value: LABELS[maxKey] || maxKey,
        dateLabel: fmtDate(first.date!, aggLevel.value) + ' → ' + fmtDate(last.date!, aggLevel.value),
        context: prefix + fmtEnergy(Math.abs(maxDelta), aggLevel.value),
        rawValue: maxDelta,
        valueType: 'delta',
      }
    }
    // Prozent: Veränderung in Prozentpunkten
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
      label: 'Größte Veränderung des Strommix-Anteils',
      value: LABELS[maxKey] || maxKey,
      dateLabel: fmtDate(first.date!, aggLevel.value) + ' → ' + fmtDate(last.date!, aggLevel.value),
      context: fmtPctDiff(maxDelta),
      rawValue: maxDelta,
      valueType: 'delta',
    }
  })

  return { highestRenewableShare, highestFossilGeneration, largestChange }
}
