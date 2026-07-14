/**
 * composables/useLandingData.ts
 * ==============================
 * Lädt vorberechnete Landingpage-Daten aus landing.json.
 * Die Berechnung (Meilensteine, Wochenaggregate, Detaildaten)
 * erfolgt via scripts/build_landing.mjs – nicht mehr im Browser.
 * Spart ~35 MB Ladevolumen (smard.json + preise.json).
 */

import { ref, computed, shallowRef, readonly } from 'vue'
import type { SmardRow, PriceRow } from './useData'

// ----------------------------------------------------------------
// Typen (unverändert zum Original)
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
  weekStart: number
  maxRenewableShare: number
  meanRenewableShare: number
  runningRecord: number
  recordTimestamp: number
}

export interface DetailData {
  type: 'hourlyMix' | 'yearlyComparison' | 'dailyPrice'
  hours?: (SmardRow & { renewableShare: number })[]
  years?: { year: number; value: number }[]
  prices?: { hour: number; price: number }[]
}

// ----------------------------------------------------------------
// Cache für geladene Landing-Daten
// ----------------------------------------------------------------
let landingCache: {
  weeklyData: WeeklyRecordPoint[]
  milestones: Milestone[]
  detailData: Record<string, DetailData>
} | null = null

let landingPromise: Promise<typeof landingCache> | null = null

// ----------------------------------------------------------------
// useLandingData
// ----------------------------------------------------------------
export function useLandingData() {
  const loading = shallowRef(true)
  const error = shallowRef<string | null>(null)
  const data = shallowRef<{
    weeklyData: WeeklyRecordPoint[]
    milestones: Milestone[]
    detailData: Record<string, DetailData>
  }>({ weeklyData: [], milestones: [], detailData: {} })

  /** Lädt landing.json (Meilensteine, Wochenaggregate) mit Cache */
  async function load() {
    loading.value = true
    error.value = null

    try {
      if (landingCache) {
        data.value = landingCache
        return
      }
      if (landingPromise) {
        data.value = await landingPromise!
        return
      }

      landingPromise = (async () => {
        const res = await fetch('/data/landing.json')
        if (!res.ok) throw new Error(`Fehler beim Laden der Landing-Daten: ${res.status}`)
        const json = await res.json()
        landingCache = json
        return json
      })()

      data.value = await landingPromise
    } catch (e: any) {
      error.value = e.message ?? 'Fehler beim Laden der Daten'
    } finally {
      loading.value = false
      landingPromise = null
    }
  }

  /** Liefert Detaildaten zu einem bestimmten Meilenstein */
  function getDetailData(m: Milestone): DetailData | null {
    return data.value.detailData[m.id] ?? null
  }

  const weeklyData = computed(() => data.value.weeklyData)
  const milestones = computed(() => data.value.milestones)

  return {
    loading: readonly(loading),
    error: readonly(error),
    load,
    weeklyData,
    milestones,
    getDetailData,
  }
}
