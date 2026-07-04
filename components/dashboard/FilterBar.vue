<script setup lang="ts">
/**
 * components/dashboard/FilterBar.vue
 * ===================================
 * Horizontale Filterleiste ueber dem Dashboard.
 * Schreibt direkt in den globalen Filter-State aus useFilters().
 *
 * Enthaelt vier Filtergruppen:
 *   - Zeitraum (zwei date-Inputs)
 *   - Saison (Custom-Dropdown mit Checkboxen)
 *   - Wochentag (Drei-State-Toggle)
 *   - Vergleichsjahre (Toggle-Buttons)
 * Sowie "Weitere Filter" Ausklapp und "Filter zuruecksetzen".
 */

import { ref, computed } from 'vue'
import { useFilters } from '~/composables/useFilters'
import type { Season, DayType } from '~/composables/useFilters'

const { state, reset } = useFilters()

// ----------------------------------------------------------------
// Season-Labels und -Reihenfolge
// ----------------------------------------------------------------
const SEASONS: { key: Season; label: string }[] = [
  { key: 'spring', label: 'Fruehling' },
  { key: 'summer', label: 'Sommer' },
  { key: 'autumn', label: 'Herbst' },
  { key: 'winter', label: 'Winter' },
]

// ----------------------------------------------------------------
// Date-Inputs: Date-Objekt <-> YYYY-MM-DD String Konvertierung
// ----------------------------------------------------------------
function dateToString(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function stringToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const dateStart = computed({
  get: () => dateToString(state.dateRange.start),
  set: (val: string) => { state.dateRange.start = stringToDate(val) },
})

const dateEnd = computed({
  get: () => dateToString(state.dateRange.end),
  set: (val: string) => { state.dateRange.end = stringToDate(val) },
})

// ----------------------------------------------------------------
// Season-Dropdown (offen/zu)
// ----------------------------------------------------------------
const seasonOpen = ref(false)

// Text im Dropdown-Header: "Alle ausgewaehlt (4)" oder "2 ausgewaehlt"
const seasonLabel = computed(() => {
  const active = state.seasons.size
  if (active === SEASONS.length) return `Alle ausgewaehlt (${active})`
  if (active === 0) return 'Keine'
  return `${active} ausgewaehlt`
})

// Checkbox umschalten
function toggleSeason(season: Season) {
  if (state.seasons.has(season)) {
    state.seasons.delete(season)
  } else {
    state.seasons.add(season)
  }
  // Set-Aenderung triggert Reactivity nur, wenn das Set neu zugewiesen wird
  state.seasons = new Set(state.seasons)
}

// Dropdown schliessen bei Klick ausserhalb
function onSeasonBlur() {
  // Verzoegert, damit Click auf Checkbox noch registriert wird
  setTimeout(() => { seasonOpen.value = false }, 200)
}

// ----------------------------------------------------------------
// DayType: Drei-State-Toggle
// ----------------------------------------------------------------
const DAY_OPTIONS: { key: DayType; label: string }[] = [
  { key: 'all', label: 'Alle Tage' },
  { key: 'weekday', label: 'Wochentag' },
  { key: 'weekend', label: 'Wochenende' },
]

function setDayType(type: DayType) {
  state.dayType = type
}

// ----------------------------------------------------------------
// Vergleichsjahre
// ----------------------------------------------------------------
const AVAILABLE_YEARS = [2015, 2020, 2024]

function toggleCompareYear(year: number) {
  const idx = state.compareYears.indexOf(year)
  if (idx >= 0) {
    state.compareYears.splice(idx, 1)
  } else {
    state.compareYears.push(year)
    state.compareYears.sort()
  }
}

// ----------------------------------------------------------------
// "Weitere Filter" Ausklapp (nur Struktur, erstmal leer)
// ----------------------------------------------------------------
const moreOpen = ref(false)
</script>

<template>
  <div class="filterbar">
    <!-- 1. Zeitraum -->
    <div class="filter-group">
      <span class="filter-label">Zeitraum</span>
      <div class="date-range">
        <input type="date" class="date-input" v-model="dateStart" min="2015-01-01" max="2024-12-31" />
        <span class="date-sep">–</span>
        <input type="date" class="date-input" v-model="dateEnd" min="2015-01-01" max="2024-12-31" />
      </div>
    </div>

    <!-- 2. Saison -->
    <div class="filter-group">
      <span class="filter-label">Saison / Monat</span>
      <div class="season-dropdown" @blur="onSeasonBlur" tabindex="0">
        <button class="dropdown-header" @click="seasonOpen = !seasonOpen">
          {{ seasonLabel }}
          <span class="arrow" :class="{ up: seasonOpen }">▾</span>
        </button>
        <div v-if="seasonOpen" class="dropdown-panel">
          <label v-for="s in SEASONS" :key="s.key" class="checkbox-row">
            <input type="checkbox" :checked="state.seasons.has(s.key)"
                   @change="toggleSeason(s.key)" />
            {{ s.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- 3. Wochentag -->
    <div class="filter-group">
      <span class="filter-label">Wochentag / Wochenende</span>
      <div class="segmented-toggle">
        <button v-for="opt in DAY_OPTIONS" :key="opt.key"
          class="seg-btn"
          :class="{ active: state.dayType === opt.key }"
          @click="setDayType(opt.key)">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 4. Vergleichsjahre -->
    <div class="filter-group">
      <span class="filter-label">Vergleichsjahre</span>
      <div class="year-toggles">
        <button v-for="y in AVAILABLE_YEARS" :key="y"
          class="year-btn"
          :class="{ active: state.compareYears.includes(y) }"
          @click="toggleCompareYear(y)">
          {{ y }}
        </button>
      </div>
    </div>

    <!-- Rechte Seite: Weitere Filter + Reset -->
    <div class="filter-actions">
      <div class="more-wrapper" @blur="moreOpen = false" tabindex="0">
        <button class="more-btn" @click="moreOpen = !moreOpen">
          Weitere Filter <span class="arrow" :class="{ up: moreOpen }">▾</span>
        </button>
        <div v-if="moreOpen" class="more-panel">
          <!-- Hier kommen spaeter zusaetzliche Filter rein -->
          <p class="more-placeholder">(Folgt in einem spaeteren Baustein)</p>
        </div>
      </div>
      <button class="reset-btn" @click="reset()">Filter zuruecksetzen</button>
    </div>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   FilterBar: horizontale Leiste, weisser Hintergrund, Border unten
   ---------------------------------------------------------------- */
.filterbar {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  padding: 12px 24px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  min-height: 72px;
  flex-wrap: wrap;
}

/* ----------------------------------------------------------------
   Filter-Gruppe: Label oben, Control darunter
   ---------------------------------------------------------------- */
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 0.75rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;
}

/* ----------------------------------------------------------------
   Zeitraum: zwei date-Inputs
   ---------------------------------------------------------------- */
.date-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-input {
  font-family: var(--font);
  font-size: 0.875rem;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg);
  background: var(--bg);
  width: 140px;
  cursor: pointer;
}

.date-input:focus {
  outline: none;
  border-color: var(--accent);
}

.date-sep {
  color: var(--fg-muted);
  font-size: 0.875rem;
  user-select: none;
}

/* ----------------------------------------------------------------
   Saison-Dropdown (custom, kein natives select)
   ---------------------------------------------------------------- */
.season-dropdown {
  position: relative;
  outline: none;
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 0.875rem;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  min-width: 180px;
}

.dropdown-header:hover {
  border-color: var(--accent);
}

.arrow {
  font-size: 0.7rem;
  transition: transform 0.15s;
  margin-left: auto;
}

.arrow.up {
  transform: rotate(180deg);
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 8px;
  min-width: 200px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 4px;
}

.checkbox-row:hover {
  background: #f3f4f6;
}

.checkbox-row input[type="checkbox"] {
  accent-color: var(--accent);
}

/* ----------------------------------------------------------------
   Segmented Toggle (Drei-State)
   ---------------------------------------------------------------- */
.segmented-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.seg-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 14px;
  border: none;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border-right: 1px solid var(--border);
}

.seg-btn:last-child {
  border-right: none;
}

.seg-btn:hover {
  background: #f3f4f6;
}

.seg-btn.active {
  background: var(--accent);
  color: #fff;
}

/* ----------------------------------------------------------------
   Jahres-Toggle-Buttons
   ---------------------------------------------------------------- */
.year-toggles {
  display: flex;
  gap: 6px;
}

.year-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.year-btn:hover {
  border-color: var(--accent);
}

.year-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* ----------------------------------------------------------------
   Rechte Actions: Weitere Filter + Reset
   ---------------------------------------------------------------- */
.filter-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.more-wrapper {
  position: relative;
  outline: none;
}

.more-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.more-btn:hover {
  border-color: var(--accent);
}

.more-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 16px;
  min-width: 240px;
}

.more-placeholder {
  color: var(--fg-muted);
  font-size: 0.8rem;
  margin: 0;
}

.reset-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
}

.reset-btn:hover {
  text-decoration: underline;
}
</style>
