/**
 * useData.ts – Zentraler Daten-Loader für alle JSON-Quellen.
 *
 * Jede load-Funktion cached das Ergebnis in einer Modul-Variable.
 * Bei wiederholtem Aufruf wird das gecachte Ergebnis sofort zurückgegeben.
 * Geteilte Promises verhindern doppelte Netzwerk-Requests bei Parallelaufrufen.
 *
 * @example
 * const { loadHourly, loadYearly, loadFactors } = useData()
 * const data = await loadHourly()
 */

// interfaces — spiegeln die json-strukturen wider (aus smard + eigenem format)
export interface HourlyRow {
  timestamp: number
  co2_g_per_kwh: number
  ee_share: number
  fossil_share: number
  price_eur_mwh: number
  load_mwh: number
  generation_by_source: {
    lignite: number
    nuclear: number
    wind_offshore: number
    hydro: number
    other_fossil: number
    other_renewables: number
    biomass: number
    wind_onshore: number
    pv: number
    hardcoal: number
    pumped_storage: number
    gas: number
  }
}

export interface YearlyRow {
  year: number
  sources: Record<string, number>
  avg_co2: number
  avg_ee_share: number
  neg_stunden: number
}

// cache — module-level, leben nach erstem fetch weiter
let hourlyCache: HourlyRow[] | null = null
let yearlyCache: YearlyRow[] | null = null
let factorsCache: Factors | null = null

let hourlyPromise: Promise<HourlyRow[]> | null = null
let yearlyPromise: Promise<YearlyRow[]> | null = null
let factorsPromise: Promise<Factors> | null = null

// public composable — von komponenten aufgerufen
export function useData() {
  /**
   * Lädt die Stunden-Daten aus hourly_2015_2024.json.
   * Die Promise wird zwischen allen Aufrufern geteilt – kein doppelter Fetch.
   *
   * @returns Promise mit Array von HourlyRow-Objekten.
   */
  async function loadHourly(): Promise<HourlyRow[]> {
    if (hourlyCache) return hourlyCache
    if (hourlyPromise) return hourlyPromise

    hourlyPromise = (async () => {
      try {
        const res = await fetch('/data/hourly_2015_2024.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Stunden-Daten: ${res.status}`)
        hourlyCache = await res.json() as HourlyRow[]
        return hourlyCache
      } finally {
        hourlyPromise = null
      }
    })()

    return hourlyPromise
  }

  /**
   * Lädt die Jahres-Daten aus yearly_mix.json.
   *
   * @returns Promise mit Array von YearlyRow-Objekten.
   */
  async function loadYearly(): Promise<YearlyRow[]> {
    if (yearlyCache) return yearlyCache
    if (yearlyPromise) return yearlyPromise

    yearlyPromise = (async () => {
      try {
        const res = await fetch('/data/yearly_mix.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Jahres-Daten: ${res.status}`)
        yearlyCache = await res.json() as YearlyRow[]
        return yearlyCache
      } finally {
        yearlyPromise = null
      }
    })()

    return yearlyPromise
  }

  /**
   * Laedt die Emissionsfaktoren (emission_factors.json aus public/data/).
   * Wird fuer CO2-Berechnungen in Charts benoetigt.
   */
  async function loadFactors(): Promise<Factors> {
    if (factorsCache) return factorsCache
    if (factorsPromise) return factorsPromise

    factorsPromise = (async () => {
      try {
        const res = await fetch('/data/emission_factors.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Emissionsfaktoren: ${res.status}`)
        factorsCache = await res.json() as Factors
        return factorsCache
      } finally {
        factorsPromise = null
      }
    })()

    return factorsPromise
  }

  /**
   * Laedt die rohen SMARD-Erzeugungsdaten (smard.json).
   * Teilt die Promise zwischen Aufrufern.
   */
  return {
    loadHourly,
    loadYearly,
    loadFactors,
  }
}
