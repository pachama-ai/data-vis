<script setup lang="ts">
/**
 * components/dashboard/FilterBar.vue
 * ===================================
 * KPI-Jahrfilter – wirkt NUR auf KPI-Werte und -Sparklines.
 * Scatterplot und Panels haben eigene Zeitsteuerung.
 */

import { useFilters } from '~/composables/useFilters'

const { state } = useFilters()

const YEARS = [null, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
</script>

<template>
  <div class="kpi-filterbar">
    <span class="kpi-filter-label">Zeitraum für Kennzahlen</span>
    <div class="kpi-year-chips">
      <button
        v-for="y in YEARS" :key="y ?? 'all'"
        class="kpi-year-chip"
        :class="{ active: state.year === y }"
        @click="state.year = y"
      >{{ y ?? 'Gesamtzeitraum' }}</button>
    </div>
  </div>
</template>

<style scoped>
.kpi-filterbar {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--hairline);
}

.kpi-filter-label {
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: 8px;
}

.kpi-year-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.kpi-year-chip {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 400;
  padding: 3px 10px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s;
  position: relative;
  white-space: nowrap;
}

.kpi-year-chip:hover {
  color: var(--fg);
}

.kpi-year-chip.active {
  color: var(--fg);
  font-weight: 600;
}

.kpi-year-chip.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 10px;
  right: 10px;
  height: 2px;
  background: var(--fg);
}
</style>

<style scoped>
.filterbar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 14px 24px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  user-select: none;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--fg);
  background: #fff;
  width: 150px;
  height: 36px;
  cursor: pointer;
  box-sizing: border-box;
}

.date-input:focus {
  outline: none;
  border-color: var(--accent);
}

.date-sep {
  color: var(--fg-muted);
  font-size: 0.8rem;
  user-select: none;
}

.preset-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-chip {
  font-family: var(--font);
  font-size: 0.72rem;
  padding: 3px 10px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  box-sizing: border-box;
}

.preset-chip:hover {
  border-color: var(--accent);
  color: var(--fg);
}

.preset-chip.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.segmented-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  height: 36px;
}

.seg-btn {
  font-family: var(--font);
  font-size: 0.78rem;
  padding: 6px 12px;
  border: none;
  background: #fff;
  color: var(--fg);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border-right: 1px solid var(--border);
  white-space: nowrap;
}

.seg-btn:last-child {
  border-right: none;
}

.seg-btn:hover {
  background: #f1f5f9;
}

.seg-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.filter-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: end;
}

.reset-btn {
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 6px 12px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;
  transition: background 0.15s;
}

.reset-btn:hover {
  background: #f0fdf4;
  border-color: var(--accent);
}

@media (max-width: 900px) {
  .filter-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
