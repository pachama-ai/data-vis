/**
 * composables/useFilters.ts — KPI-Jahrfilter mit Gesamt/Jahr/Vergleich
 * ====================================================================
 * Der Filter wirkt ausschließlich auf die KPI-Werte und -Sparklines.
 * Scatterplot und Panels haben eigene Zeitsteuerung.
 */

import { reactive } from 'vue'
import type { HourlyRow } from './useData'
import { getBerlinYear } from '~/utils/berlin'

export type FilterMode = 'gesamt' | 'jahr' | 'vergleich'

const state = reactive<{
  year: number | null
  mode: FilterMode
  baseYear: number
  compareYear: number
}>({
  year: null,
  mode: 'gesamt',
  baseYear: 2015,
  compareYear: 2024,
})

export function useFilters() {
  /** Filtert Stunden auf das ausgewählte Einzeljahr (Berliner Kalender) */
  function filteredKpiData(hours: HourlyRow[]): HourlyRow[] {
    if (state.year === null) return hours
    const y = state.year
    return hours.filter((r) => getBerlinYear(r.timestamp) === y)
  }

  /** Filtert Stunden auf ein bestimmtes Jahr (für Vergleichsmodus) */
  function dataForYear(hours: HourlyRow[], y: number): HourlyRow[] {
    return hours.filter((r) => getBerlinYear(r.timestamp) === y)
  }

  return {
    state,
    filteredKpiData,
    dataForYear,
  }
}
