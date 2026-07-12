/**
 * composables/useEnergyMixData.ts
 * ================================
 * Lädt und cached /public/data/energy_mix_yearly.json.
 * Nutzt useState für globalen Cache (Landing + Dashboard teilen ihn).
 */

export interface EnergyMixRow {
  id: string
  label: string
  category: string
  color: string
  share2015: number
  share2024: number
}

export interface EnergyMixMeta {
  source: string[]
  generated: string
  unit: string
}

export interface EnergyMixData {
  meta: EnergyMixMeta
  rows: EnergyMixRow[]
}

let cache: EnergyMixData | null = null
let promise: Promise<EnergyMixData> | null = null

export function useEnergyMixData() {
  async function load(): Promise<EnergyMixData> {
    if (cache) return cache
    if (promise) return promise

    promise = (async () => {
      const res = await fetch('/data/energy_mix_yearly.json')
      if (!res.ok) throw new Error(`Fehler: ${res.status}`)
      const data = await res.json() as EnergyMixData
      cache = data
      return data
    })()

    return promise
  }

  return { load }
}
