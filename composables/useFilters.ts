/**
 * composables/useFilters.ts — Nur noch KPI-Jahrfilter
 * ====================================================
 * Der Filter wirkt ausschließlich auf die KPI-Werte und -Sparklines.
 * Scatterplot und Panels haben eigene Zeitsteuerung.
 */

import { reactive } from 'vue'
import type { HourlyRow } from './useData'

export interface KpiFilterState {
  /** null = Gesamtzeitraum 2015-2024, sonst einzelnes Jahr */
  year: number | null
}

const state = reactive<KpiFilterState>({
  year: null, // null = Gesamtzeitraum
})

export function useFilters() {
  function filteredKpiData(hours: HourlyRow[]): HourlyRow[] {
    if (state.year === null) return hours
    const y = state.year
    return hours.filter((r) => new Date(r.timestamp).getUTCFullYear() === y)
  }

  return {
    state,
    filteredKpiData,
  }
}
