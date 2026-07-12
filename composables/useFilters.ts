/**
 * composables/useFilters.ts — KPI-Jahrfilter mit Gesamt/Jahr/Vergleich
 * ====================================================================
 * Der Filter wirkt ausschließlich auf die KPI-Werte und -Sparklines.
 * Scatterplot und Panels haben eigene Zeitsteuerung.
 */

import { reactive, computed } from 'vue'
import type { HourlyRow } from './useData'

export type FilterMode = 'gesamt' | 'jahr' | 'vergleich'

export interface KpiFilterState {
  /** null = Gesamtzeitraum 2015-2024, sonst einzelnes Jahr */
  year: number | null
  mode: FilterMode
  baseYear: number
  compareYear: number
}

const state = reactive<KpiFilterState>({
  year: null,
  mode: 'gesamt',
  baseYear: 2015,
  compareYear: 2024,
})

export function useFilters() {
  function filteredKpiData(hours: HourlyRow[]): HourlyRow[] {
    if (state.year === null) return hours
    const y = state.year
    return hours.filter((r) => new Date(r.timestamp).getUTCFullYear() === y)
  }

  function dataForYear(hours: HourlyRow[], y: number): HourlyRow[] {
    return hours.filter((r) => new Date(r.timestamp).getUTCFullYear() === y)
  }

  const compareData = computed(() => {
    const { mode, baseYear, compareYear } = state
    return { mode, baseYear, compareYear }
  })

  return {
    state,
    filteredKpiData,
    dataForYear,
    compareData,
  }
}
