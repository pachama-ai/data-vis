<script setup lang="ts">
/**
 * DeviationSidebar.vue – Seitenleiste für das Abweichungsdiagramm.
 *
 * Stilistisch an die MixSidebar der Erzeugungsansicht angeglichen.
 * Zeigt bei Auswahl/Hover Details zum Energieträger, darunter
 * einen kontextuellen Jahresblock.
 */

import { computed } from 'vue'

import {
  MIX_COLORS,
  MIX_LABELS,
  MIX_COLORS_ACCESSIBLE,
  GROUP_OF,
  MIX_GROUP_LABELS,
} from '~/components/generation/mixConfig'

import type { DeviationYear, EmissionRow, MixSourceKey } from '~/types/mix'

// =========================================================================
// Props
// =========================================================================

interface DeviationSidebarProps {
  activeYear: DeviationYear | null
  baseYear: DeviationYear | null
  hoveredRow: EmissionRow | null
  selectedRow: EmissionRow | null
  selectedRowBaseShare: number | null
  largestMismatch: EmissionRow | null
  emissionIntensity: number
  renewableShare: number
  baseRenewableShare: number
  baseEmissionIntensity: number
  colorMode?: 'default' | 'accessible'
}

const props = withDefaults(defineProps<DeviationSidebarProps>(), {
  colorMode: 'default',
})

// =========================================================================
// Formatierung
// =========================================================================

const nf1 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const nf0 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function pct(share: number): string {
  return `${nf1.format(share)} %`
}

function pp(n: number): string {
  const abs = nf1.format(Math.abs(n))
  if (n > 0) return `+${abs} pp`
  if (n < 0) return `−${abs} pp`
  return `${abs} pp`
}

function intensity(v: number): string {
  return `${nf0.format(v)} g CO₂/kWh`
}

function change(v: number, suffix: string): string {
  const abs = nf1.format(Math.abs(v))
  return v >= 0 ? `+${abs} ${suffix}` : `−${abs} ${suffix}`
}

/** Balkenbreite in % */
function barWidth(share: number): string {
  return Math.max(0, Math.min(100, share * 100)) + '%'
}

// =========================================================================
// Zustand
// =========================================================================

const hasData = computed(function () { return props.activeYear !== null })

const activeRow = computed<EmissionRow | null>(function () {
  return props.hoveredRow ?? props.selectedRow ?? null
})

const hasSelection = computed(function () {
  return props.selectedRow !== null && props.hoveredRow === null
})

const showsSource = computed(function () {
  return activeRow.value !== null
})

const hasZeroGeneration = computed(function () {
  return activeRow.value !== null && activeRow.value.generationTwh === 0
})

const showsDefault = computed(function () {
  return hasData.value && activeRow.value === null
})

function getColor(key: MixSourceKey): string {
  const pal = props.colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
  return pal[key]
}

/** Kategorie-Label für den aktiven Energieträger */
const groupLabel = computed(function () {
  const row = activeRow.value
  if (!row) return ''
  return MIX_GROUP_LABELS[GROUP_OF[row.sourceKey]]
})

/** Sinnvoller Bedeutungssatz */
function meaning(row: EmissionRow): string {
  const name = MIX_LABELS[row.sourceKey]
  const diff = nf1.format(Math.abs(row.deviationPp))

  if (row.generationTwh === 0) {
    return ''
  }
  if (row.deviationPp > 1) {
    return `${name} verursacht einen deutlich größeren Anteil der direkten CO₂-Emissionen, als sie zur Stromerzeugung beiträgt.`
  }
  if (row.deviationPp < -1) {
    return `${name} verursacht einen deutlich geringeren Anteil der direkten CO₂-Emissionen, als sie zur Stromerzeugung beiträgt.`
  }
  return `${name} verursacht anteilig etwa so viele CO₂-Emissionen, wie sie Strom erzeugt.`
}
</script>

<template>
  <aside class="deviation-sidebar">
    <!-- Keine Daten -->
    <p v-if="!hasData" class="sidebar-empty">
      Kennzahlen sind nicht verfügbar.
    </p>

    <!-- =============================================================== -->
    <!-- QUELLE AUSGEWÄHLT: Details zum Energieträger                    -->
    <!-- =============================================================== -->
    <template v-if="showsSource && activeRow">
      <p class="sidebar-year">{{ activeYear?.year }}</p>
      <div class="sidebar-divider"></div>

      <!-- Null-Erzeugung: Sondermeldung -->
      <template v-if="hasZeroGeneration">
        <p class="title-label">{{ MIX_LABELS[activeRow.sourceKey] }}</p>
        <p class="sidebar-zero-msg">
          Im Jahr {{ activeYear?.year }} fand keine Stromerzeugung
          aus {{ MIX_LABELS[activeRow.sourceKey] }} statt.
        </p>
      </template>

      <!-- Normalfall -->
      <template v-else>
        <section class="sidebar-section">
          <div class="sidebar-name-block">
            <span
              class="sidebar-color"
              :style="{ backgroundColor: getColor(activeRow.sourceKey) }"
              aria-hidden="true"
            ></span>
            <span class="sidebar-source-name">{{ MIX_LABELS[activeRow.sourceKey] }}</span>
            <span class="sidebar-group-label">{{ groupLabel }}</span>
          </div>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Vergleichsgrafik -->
        <section class="sidebar-section">
          <p class="title-label">Stromerzeugung und CO₂-Emissionen</p>
          <div class="cmp-strip">
            <div class="cmp-strip-row">
              <span class="cmp-strip-label">Strom</span>
              <span class="cmp-strip-track">
                <span
                  class="cmp-strip-fill cmp-strip-fill--gen"
                  :style="{ width: barWidth(activeRow.generationShare) }"
                ></span>
              </span>
              <span class="cmp-strip-value">{{ pct(activeRow.generationShare * 100) }}</span>
            </div>
            <div class="cmp-strip-row">
              <span class="cmp-strip-label">CO₂</span>
              <span class="cmp-strip-track">
                <span
                  class="cmp-strip-fill cmp-strip-fill--em"
                  :style="{ width: barWidth(activeRow.emissionShare) }"
                ></span>
              </span>
              <span class="cmp-strip-value">{{ pct(activeRow.emissionShare * 100) }}</span>
            </div>
          </div>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Differenz -->
        <section class="sidebar-section">
          <p class="title-label">Differenz</p>
          <p
            class="sidebar-diff-value"
            :class="{
              'diff-positive': activeRow.deviationPp > 0,
              'diff-negative': activeRow.deviationPp < 0,
            }"
          >
            {{ pp(activeRow.deviationPp) }}
          </p>
          <p class="sidebar-diff-calculation">
            {{ pct(activeRow.emissionShare * 100) }} Emissionen −
            {{ pct(activeRow.generationShare * 100) }} Strom
          </p>
        </section>

        <div class="sidebar-divider"></div>

        <!-- Bedeutung -->
        <section class="sidebar-section">
          <p class="title-label">Bedeutung</p>
          <p class="sidebar-sentence">{{ meaning(activeRow) }}</p>
        </section>

        <!-- Entwicklung seit 2015 -->
        <template v-if="selectedRowBaseShare !== null && hasSelection">
          <div class="sidebar-divider"></div>
          <section class="sidebar-section">
            <p class="title-label">Entwicklung seit 2015</p>
            <p class="sidebar-sentence">
              Der Anteil an der Stromerzeugung
              {{ selectedRowBaseShare! > activeRow.generationShare ? 'sank' : 'stieg' }}
              von {{ pct(selectedRowBaseShare * 100) }}
              auf {{ pct(activeRow.generationShare * 100) }}.
            </p>
          </section>
        </template>
      </template>
    </template>

    <!-- =============================================================== -->
    <!-- DEFAULT: Nur Jahresüberblick                                    -->
    <!-- =============================================================== -->
    <template v-if="showsDefault && activeYear">
      <p class="sidebar-year">{{ activeYear.year }}</p>
      <div class="sidebar-divider"></div>

      <section class="sidebar-section sidebar-context">
        <p class="title-label">Jahresüberblick</p>

        <div class="context-row">
          <span class="context-label">CO₂-Emissionen je kWh</span>
          <span class="context-value">{{ intensity(emissionIntensity) }}</span>
        </div>

        <div class="context-row">
          <span class="context-label">Erneuerbaren-Anteil</span>
          <span class="context-value">{{ pct(renewableShare) }}</span>
        </div>

        <div class="context-row" v-if="baseEmissionIntensity > 0">
          <span class="context-label">Veränderung seit 2015</span>
          <span class="context-value context-value--green">
            {{ change(emissionIntensity - baseEmissionIntensity, 'g CO₂/kWh') }}
          </span>
        </div>

        <div class="context-row" v-if="baseRenewableShare > 0">
          <span class="context-label">EE-Anteil 2015 → {{ activeYear.year }}</span>
          <span class="context-value">
            {{ pct(baseRenewableShare) }} → {{ pct(renewableShare) }}
          </span>
        </div>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.deviation-sidebar {
  width: 100%;
  font-family: var(--sans-font);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color);
  background: var(--background-color);
  border: 1px solid var(--line-color);
  border-radius: 6px;
  padding: 20px;
}

.sidebar-empty {
  color: var(--muted-text-color);
  font-style: italic;
  padding: 16px 0;
}

.sidebar-year {
  font-family: var(--serif-font);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 4px;
  line-height: 1.1;
}

.sidebar-divider {
  height: 1px;
  background: var(--line-color);
  margin: 12px 0;
}

.sidebar-section {
  margin-bottom: 4px;
}

.sidebar-section .eyebrow {
  margin: 0 0 8px;
}

.sidebar-color {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar-name-block {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sidebar-source-name {
  font-family: var(--serif-font);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.sidebar-group-label {
  font-size: 11px;
  color: var(--muted-text-color);
}

.sidebar-sentence {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted-text-color);
}

/* Vergleichs-Strip */
.cmp-strip {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cmp-strip-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cmp-strip-label {
  width: 32px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-text-color);
  text-align: right;
  flex-shrink: 0;
}

.cmp-strip-track {
  flex: 1;
  height: 10px;
  background: var(--line-color);
  border-radius: 3px;
  overflow: hidden;
}

.cmp-strip-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.cmp-strip-fill--gen {
  background: var(--accent-color);
}

.cmp-strip-fill--em {
  background: #b33;
  opacity: 0.75;
}

.cmp-strip-value {
  width: 52px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
  text-align: right;
  flex-shrink: 0;
  font-feature-settings: 'tnum';
}

/* Differenz */
.sidebar-diff-value {
  font-size: 18px;
  font-weight: 700;
  font-feature-settings: 'tnum';
  margin: 0;
}

.diff-positive {
  color: var(--color-diff-positive, #b33);
  opacity: 0.85;
}

.diff-negative {
  color: var(--color-diff-negative, #2a6f4a);
  opacity: 0.85;
}

.sidebar-diff-calculation {
  font-size: 11px;
  color: var(--muted-text-color);
  margin: 2px 0 0;
}

/* Null-Erzeugungs-Meldung */
.sidebar-zero-msg {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted-text-color);
  margin: 0;
}

/* Jahreskontext */
.sidebar-context {
  font-size: 12px;
}

.context-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
}

.context-label {
  color: var(--muted-text-color);
  font-size: 11px;
}

.context-value {
  font-weight: 500;
  font-feature-settings: 'tnum';
  color: var(--text-color);
  font-size: 12px;
}

.context-value--green {
  color: var(--accent-color);
}

/* Abstand vor Jahreskontext */
.sidebar-divider--context {
  margin-top: 20px;
}
</style>
