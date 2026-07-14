<script setup lang="ts">
/**
 * components/dashboard/FilterBar.vue
 * ===================================
 * KPI-Jahrfilter als Segment-Toggle (wie Strommix-Sektion).
 * Zwei Ebenen: Modus-Auswahl (immer) + kontextuelle Zusatz-Auswahl (bei Jahr/Vergleich).
 */

import { ref, watch } from 'vue'
import { useFilters } from '~/composables/useFilters'
import type { FilterMode } from '~/composables/useFilters'

const { state } = useFilters()

const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

/** Wechselt den Filter-Modus und setzt das ausgewählte Jahr zurück */
function applyMode(m: FilterMode) {
  state.mode = m
  if (m === 'gesamt') {
    state.year = null
  } else if (m === 'jahr') {
    state.year = state.year ?? 2024
  } else if (m === 'vergleich') {
    state.year = null
  }
}

/** Wählt ein bestimmtes Jahr für den Jahr-Modus aus */
function selectYear(y: number) {
  state.year = y
}
</script>

<template>
  <div class="kpi-filterbar">
    <!-- Ebene 1: Label + Modus-Toggle -->
    <div class="filter-level">
      <span class="kpi-filter-label">Zeitraum</span>
      <div class="segment-group mode-toggle">
        <button class="segment-btn" :class="{ active: state.mode === 'gesamt' }" @click="applyMode('gesamt')">Gesamt</button>
        <button class="segment-btn" :class="{ active: state.mode === 'jahr' }" @click="applyMode('jahr')">Jahr</button>
        <button class="segment-btn" :class="{ active: state.mode === 'vergleich' }" @click="applyMode('vergleich')">Vergleich</button>
      </div>
    </div>

    <!-- Ebene 2: Jahr-Chips -->
    <div v-if="state.mode === 'jahr'" class="filter-level-sub">
      <div class="segment-group year-chips">
        <button v-for="y in YEARS" :key="y"
          class="year-chip"
          :class="{ active: state.year === y }"
          @click="selectYear(y)">{{ y }}</button>
      </div>
    </div>

    <!-- Ebene 2: Vergleichs-Auswahl -->
    <div v-if="state.mode === 'vergleich'" class="filter-level-sub">
      <div class="compare-group">
        <div class="compare-field">
          <span class="compare-label">BASIS</span>
          <select v-model.number="state.baseYear" class="year-select">
            <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <span class="compare-arrow">&rarr;</span>
        <div class="compare-field">
          <span class="compare-label">VERGLEICH</span>
          <select v-model.number="state.compareYear" class="year-select">
            <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-filterbar {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--hairline);
}

.filter-level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
}

.kpi-filter-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  flex-shrink: 0;
}

.filter-level-sub {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  height: 32px;
}

.mode-toggle {
  height: 32px;
}

.segment-group {
  display: flex;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  overflow: hidden;
}

.segment-btn {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0 14px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  transition: all .15s;
  border-right: 1px solid var(--hairline);
  white-space: nowrap;
}

.segment-btn:last-child { border-right: none; }
.segment-btn:hover { background: var(--bg); }
.segment-btn.active { background: var(--accent); color: #fff; }

/* Jahr-Chips (28px hoch) */
.year-chips {
  height: 28px;
  border-radius: 6px;
}

.year-chip {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 0 9px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  transition: all .15s;
  border-right: 1px solid var(--hairline);
  white-space: nowrap;
}

.year-chip:last-child { border-right: none; }
.year-chip:hover { background: var(--bg); }
.year-chip.active { background: var(--accent); color: #fff; }

/* Vergleichs-Auswahl (32px Grundlinie) */
.compare-group {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 32px;
}

.compare-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.compare-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  line-height: 1;
}

.year-select {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 10px;
  height: 32px;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}

.year-select:hover { border-color: var(--accent); }

.compare-arrow {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg-muted);
  line-height: 32px;
}
</style>
