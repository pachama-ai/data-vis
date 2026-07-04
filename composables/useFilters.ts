/**
 * composables/useFilters.ts — Globaler Filter-State fuer das Dashboard
 * ====================================================================
 *
 * Der State wird via reactive() im Modul-Scope erzeugt, nicht innerhalb
 * einer setup()-Funktion. Dadurch sehen alle Komponenten, die diesen
 * Composable importieren, dieselbe Instanz — ein einfaches Singleton
 * ohne zusaetzliche Library wie Pinia.
 *
 * filteredHours() ist ein Filter, der ein hourly-Array nimmt und nur die
 * Zeilen zurueckgibt, die den aktuellen Filter-Einstellungen entsprechen.
 */

import { reactive, computed } from 'vue'
import type { HourlyRow } from './useData'

// ----------------------------------------------------------------
// Typdefinitionen fuer Filter
// ----------------------------------------------------------------
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type DayType = 'all' | 'weekday' | 'weekend'

export interface FilterState {
  dateRange: { start: Date; end: Date }
  seasons: Set<Season>
  dayType: DayType
  compareYears: number[]
}

// ----------------------------------------------------------------
// Season aus einem Timestamp ableiten
// ----------------------------------------------------------------
function getSeason(ts: number): Season {
  const month = new Date(ts).getUTCMonth()
  // month ist 0-based: 0=Jan, 1=Feb, 2=Mrz, 3=Apr, 4=Mai, 5=Jun,
  // 6=Jul, 7=Aug, 8=Sep, 9=Okt, 10=Nov, 11=Dez
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

// ----------------------------------------------------------------
// Modul-Scope State — Singleton, von allen Komponenten geteilt
// ----------------------------------------------------------------
const state = reactive<FilterState>({
  dateRange: {
    start: new Date(Date.UTC(2015, 0, 1)),
    end: new Date(Date.UTC(2024, 11, 31)),
  },
  seasons: new Set<Season>(['spring', 'summer', 'autumn', 'winter']),
  dayType: 'all',
  compareYears: [2015, 2020, 2024],
})

// ----------------------------------------------------------------
// useFilters — von Komponenten aufgerufen
// ----------------------------------------------------------------
export function useFilters() {
  /**
   * Wendet alle aktiven Filter auf ein Array von Stundenzeilen an.
   * Gibt ein neues, gefiltertes Array zurueck (keine Mutation).
   */
  function filteredHours(hours: HourlyRow[]): HourlyRow[] {
    return hours.filter((row) => {
      const d = new Date(row.timestamp)
      const ts = row.timestamp

      // 1. Datumsbereich
      if (ts < state.dateRange.start.getTime() || ts > state.dateRange.end.getTime()) {
        return false
      }

      // 2. Jahresauswahl (compareYears wird NICHT hier gefiltert,
      //    das ist nur fuer den Jahresvergleich in Charts)
      //    compareYears steuert, welche Jahre im Chart angezeigt werden,
      //    das macht die jeweilige Chart-Komponente selbst.

      // 3. Saison
      const season = getSeason(ts)
      if (!state.seasons.has(season)) return false

      // 4. Werktag / Wochenende
      if (state.dayType !== 'all') {
        const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
        if (state.dayType === 'weekday' && isWeekend) return false
        if (state.dayType === 'weekend' && !isWeekend) return false
      }

      return true
    })
  }

  /**
   * Setzt alle Filter auf die Standardwerte zurueck.
   */
  function reset() {
    state.dateRange.start = new Date(Date.UTC(2015, 0, 1))
    state.dateRange.end = new Date(Date.UTC(2024, 11, 31))
    state.seasons = new Set<Season>(['spring', 'summer', 'autumn', 'winter'])
    state.dayType = 'all'
    state.compareYears = [2015, 2020, 2024]
  }

  return {
    state,          // reaktiver Filter-State (read/write)
    filteredHours,  // Filter-Funktion fuer ein hourly-Array
    reset,          // Filter zuruecksetzen
  }
}
