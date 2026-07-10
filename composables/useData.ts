/**
 * composables/useData.ts — Zentraler Daten-Loader fuer alle JSON-Quellen
 * ======================================================================
 *
 * Jede load-Funktion cached das Ergebnis in einer Modul-Variable.
 * Wird die Funktion ein zweites Mal aufgerufen, wird das gecachte
 * Ergebnis sofort zurueckgegeben — kein erneuter网络-Fetch.
 *
 * Die Interfaces HourlyRow, YearlyRow und Factors koennen von
 * Komponenten und Charts importiert werden, um Typ-Sicherheit
 * bei der Datenverarbeitung zu haben.
 */

// ----------------------------------------------------------------
// TypeScript-Interfaces — spiegeln die JSON-Strukturen wider
// ----------------------------------------------------------------
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
}

export interface Factors {
  [source: string]: number
}

// ----------------------------------------------------------------
// Rohdaten für Landingpage-Timeline und Meilensteine
// ----------------------------------------------------------------
export interface SmardRow {
  timestamp: number
  braunkohle?: number | null
  kernenergie?: number | null
  windOffshore?: number | null
  wasserkraft?: number | null
  sonstigeKonventionelle?: number | null
  sonstigeErneuerbare?: number | null
  biomasse?: number | null
  windOnshore?: number | null
  solar?: number | null
  steinkohle?: number | null
  pumpspeicher?: number | null
  erdgas?: number | null
  last?: number | null
  residuallast?: number | null
  pumpspeicherVerbrauch?: number | null
}

export interface PriceRow {
  timestamp: number
  price: number
}

// ----------------------------------------------------------------
// Cache — Modul-Variablen, leben nach erstem Fetch weiter
// Geteilte Promises verhindern doppelte Requests bei Parallelaufrufen.
// ----------------------------------------------------------------
let hourlyCache: HourlyRow[] | null = null
let yearlyCache: YearlyRow[] | null = null
let factorsCache: Factors | null = null

let hourlyPromise: Promise<HourlyRow[]> | null = null
let yearlyPromise: Promise<YearlyRow[]> | null = null
let factorsPromise: Promise<Factors> | null = null

let smardCache: SmardRow[] | null = null
let pricesCache: PriceRow[] | null = null
let smardPromise: Promise<SmardRow[]> | null = null
let pricesPromise: Promise<PriceRow[]> | null = null

// ----------------------------------------------------------------
// useData — von Komponenten aufgerufen
// ----------------------------------------------------------------
export function useData() {
  /**
   * Laedt die Stunden-Daten (hourly_2015_2024.json).
   * Teilt die Promise zwischen Aufrufern — kein doppelter Fetch.
   * Gibt ein Promise<HourlyRow[]> zurueck.
   */
  async function loadHourly(): Promise<HourlyRow[]> {
    if (hourlyCache) return hourlyCache
    if (hourlyPromise) return hourlyPromise

    hourlyPromise = (async () => {
      try {
        const res = await fetch('/data/hourly_2015_2024.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Stunden-Daten: ${res.status}`)
        hourlyCache = await res.json() as HourlyRow[]
        console.log(`useData: ${hourlyCache.length} Stunden geladen`)
        return hourlyCache
      } finally {
        hourlyPromise = null
      }
    })()

    return hourlyPromise
  }

  /**
   * Laedt die Jahres-Daten (yearly_mix.json).
   * Teilt die Promise zwischen Aufrufern — kein doppelter Fetch.
   * Gibt ein Promise<YearlyRow[]> zurueck.
   */
  async function loadYearly(): Promise<YearlyRow[]> {
    if (yearlyCache) return yearlyCache
    if (yearlyPromise) return yearlyPromise

    yearlyPromise = (async () => {
      try {
        const res = await fetch('/data/yearly_mix.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Jahres-Daten: ${res.status}`)
        yearlyCache = await res.json() as YearlyRow[]
        console.log(`useData: ${yearlyCache.length} Jahre geladen`)
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
  async function loadSmard(): Promise<SmardRow[]> {
    if (smardCache) return smardCache
    if (smardPromise) return smardPromise

    smardPromise = (async () => {
      try {
        const res = await fetch('/data/smard.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der SMARD-Daten: ${res.status}`)
        smardCache = await res.json() as SmardRow[]
        return smardCache
      } finally {
        smardPromise = null
      }
    })()

    return smardPromise
  }

  /**
   * Laedt die rohen Preis-Daten (preise.json).
   * Teilt die Promise zwischen Aufrufern.
   */
  async function loadPrices(): Promise<PriceRow[]> {
    if (pricesCache) return pricesCache
    if (pricesPromise) return pricesPromise

    pricesPromise = (async () => {
      try {
        const res = await fetch('/data/preise.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Preis-Daten: ${res.status}`)
        pricesCache = await res.json() as PriceRow[]
        return pricesCache
      } finally {
        pricesPromise = null
      }
    })()

    return pricesPromise
  }

  return {
    loadHourly,
    loadYearly,
    loadFactors,
    loadSmard,
    loadPrices,
  }
}
