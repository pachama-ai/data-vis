<script setup lang="ts">
/**
 * DeviationSidebar.vue – Seitenleiste für das Abweichungsdiagramm.
 *
 * Zeigt Kennzahlen zum aktiven Jahr, Details bei Hover und
 * einen Vergleich mit dem Basisjahr 2015.
 * Alle Werte werden bereits berechnet über Props geliefert.
 */

import { computed } from 'vue'

import { MIX_COLORS, MIX_LABELS } from '~/utils/mix-config'

import type { DeviationYear, EmissionRow } from '~/types/mix'

// =========================================================================
// Props
// =========================================================================

interface DeviationSidebarProps {
  activeYear: DeviationYear | null
  baseYear: DeviationYear | null
  hoveredRow: EmissionRow | null
  selectedRow: EmissionRow | null
  largestMismatch: EmissionRow | null
  emissionIntensity: number
  renewableShare: number
  baseRenewableShare: number
  baseEmissionIntensity: number
}

const props = defineProps<DeviationSidebarProps>()

// =========================================================================
// Formatierungsfunktionen
// =========================================================================

const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatPercent(share: number): string {
  const formattedValue = numberFormatter.format(share)

  return `${formattedValue} %`
}

function formatIntensity(value: number): string {
  const formattedValue = integerFormatter.format(value)

  return `${formattedValue} g CO₂/kWh`
}

function formatIntensityRaw(value: number): string {
  return integerFormatter.format(value)
}

function formatPercentagePoints(value: number): string {
  const formattedValue = numberFormatter.format(Math.abs(value))

  if (value > 0) {
    return `+${formattedValue} pp`
  }

  if (value < 0) {
    return `−${formattedValue} pp`
  }

  return `${formattedValue} pp`
}

function formatSignedChange(
  value: number,
  suffix: string,
): string {
  const formattedValue = numberFormatter.format(Math.abs(value))
  const sign = value >= 0 ? '+' : '−'

  return `${sign}${formattedValue} ${suffix}`
}

// =========================================================================
// Hover-Satz
// =========================================================================

function createDeviationSentence(row: EmissionRow): string {
  const absoluteValue = numberFormatter.format(
    Math.abs(row.deviationPp),
  )

  if (row.deviationPp > 0) {
    return `Der Emissionsanteil liegt ${absoluteValue} Prozentpunkte über dem Erzeugungsanteil.`
  }

  if (row.deviationPp < 0) {
    return `Der Emissionsanteil liegt ${absoluteValue} Prozentpunkte unter dem Erzeugungsanteil.`
  }

  return 'Emissions- und Erzeugungsanteil sind gleich groß.'
}

// =========================================================================
// Computed
// =========================================================================

const hoverSentence = computed<string | null>(() => {
  if (!props.hoveredRow) {
    return null
  }

  return createDeviationSentence(props.hoveredRow)
})

const hasData = computed(() => {
  return props.activeYear !== null
})

const showsHover = computed(() => {
  return props.hoveredRow !== null
})

const showsSelection = computed(() => {
  return props.selectedRow !== null
})

const showsDefault = computed(() => {
  return hasData.value && !showsHover.value && !showsSelection.value
})
</script>

<template>
  <aside class="deviation-sidebar">
    <!-- ========================================================= -->
    <!-- Fehlende Daten                                             -->
    <!-- ========================================================= -->
    <p v-if="!hasData" class="sidebar-empty">
      Kennzahlen sind nicht verfügbar.
    </p>

    <!-- ========================================================= -->
    <!-- Hover-Zustand (hat Vorrang)                                -->
    <!-- ========================================================= -->
    <div v-if="showsHover && hoveredRow" class="sidebar-section">
      <div class="sidebar-hover-block">
        <span
          class="sidebar-color"
          :style="{
            backgroundColor: MIX_COLORS[hoveredRow.sourceKey],
          }"
          aria-hidden="true"
        />

        <h3 class="sidebar-hover-title">
          {{ MIX_LABELS[hoveredRow.sourceKey] }}
        </h3>
      </div>

      <p class="sidebar-hover-text">
        {{ hoverSentence }}
      </p>
    </div>

    <!-- ========================================================= -->
    <!-- Ausgewählter Energieträger (Klick)                        -->
    <!-- ========================================================= -->
    <div v-if="showsSelection && selectedRow" class="sidebar-section">
      <div class="sidebar-hover-block">
        <span
          class="sidebar-color"
          :style="{
            backgroundColor: MIX_COLORS[selectedRow.sourceKey],
          }"
          aria-hidden="true"
        />

        <h3 class="sidebar-hover-title">
          {{ MIX_LABELS[selectedRow.sourceKey] }}
        </h3>
      </div>

      <p class="sidebar-mismatch-detail">
        {{ formatPercent(selectedRow.emissionShare * 100) }}
        der direkten CO₂-Emissionen
        <br>
        bei
        {{ formatPercent(selectedRow.generationShare * 100) }}
        Anteil an der Stromerzeugung
      </p>

      <p class="sidebar-hover-text">
        Abweichung:
        {{ formatPercentagePoints(selectedRow.deviationPp) }}
      </p>
    </div>

    <!-- ========================================================= -->
    <!-- Standard-Zustand                                           -->
    <!-- ========================================================= -->
    <template v-if="showsDefault && activeYear">
      <!-- Jahr -->
      <p class="sidebar-year">{{ activeYear.year }}</p>

      <div class="sidebar-divider" />

      <!-- Größtes Missverhältnis -->
      <section
        v-if="largestMismatch"
        class="sidebar-section"
      >
        <p class="sidebar-eyebrow">Größter Unterschied</p>

        <div class="sidebar-mismatch-block">
          <span
            class="sidebar-color"
            :style="{
              backgroundColor:
                MIX_COLORS[largestMismatch.sourceKey],
            }"
            aria-hidden="true"
          />

          <h3 class="sidebar-source-name">
            {{ MIX_LABELS[largestMismatch.sourceKey] }}
          </h3>
        </div>

        <p class="sidebar-mismatch-detail">
          {{ MIX_LABELS[largestMismatch.sourceKey] }}
          verursacht
          {{ formatPercent(largestMismatch.emissionShare * 100) }}
          der direkten CO₂-Emissionen, liefert aber nur
          {{ formatPercent(largestMismatch.generationShare * 100) }}
          der Stromerzeugung.
        </p>
      </section>

      <div class="sidebar-divider" />

      <!-- Emissionsintensität -->
      <section class="sidebar-section">
        <p class="sidebar-eyebrow">CO₂-Emissionen je Kilowattstunde</p>

        <p class="sidebar-value-large">
          {{ formatIntensity(emissionIntensity) }}
        </p>

        <p class="sidebar-sentence">
          Im Jahr {{ activeYear.year }} entstanden durchschnittlich
          {{ formatIntensityRaw(emissionIntensity) }}
          Gramm direkte CO₂-Emissionen je erzeugter Kilowattstunde Strom.
        </p>
      </section>

      <div class="sidebar-divider" />

      <!-- Vergleich mit 2015 -->
      <section class="sidebar-section">
        <p class="sidebar-eyebrow">Entwicklung seit 2015</p>

        <div class="sidebar-comparison">
          <p class="sidebar-sentence">
            Der Anteil erneuerbarer Energien stieg von
            {{ formatPercent(baseRenewableShare) }}
            im Jahr 2015 auf
            {{ formatPercent(renewableShare) }}
            im Jahr {{ activeYear.year }}.
          </p>

          <div class="sidebar-comparison-row">
            <span class="sidebar-comparison-label">
              CO₂-Emissionen je Kilowattstunde
            </span>

            <span class="sidebar-comparison-values">
              {{ formatIntensity(baseEmissionIntensity) }}
              →
              {{ formatIntensity(emissionIntensity) }}
            </span>

            <span
              v-if="baseEmissionIntensity > 0"
              class="sidebar-comparison-change"
            >
              {{
                formatSignedChange(
                  emissionIntensity - baseEmissionIntensity,
                  'g CO₂/kWh',
                )
              }}
            </span>
          </div>

          <p class="sidebar-sentence">
            Die durchschnittlichen direkten CO₂-Emissionen sanken von
            {{ formatIntensityRaw(baseEmissionIntensity) }}
            auf
            {{ formatIntensityRaw(emissionIntensity) }}
            g CO₂/kWh. Das entspricht einem Rückgang um
            {{ formatIntensityRaw(Math.abs(baseEmissionIntensity - emissionIntensity)) }}
            g CO₂/kWh.
          </p>
        </div>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.deviation-sidebar {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  color: var(--fg);
}

.sidebar-empty {
  color: var(--fg-muted);
  font-style: italic;
  padding: 16px 0;
}

.sidebar-year {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 8px;
  line-height: 1.1;
}

.sidebar-sentence {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--fg-muted);
}

.sidebar-divider {
  height: 1px;
  background: var(--hairline);
  margin: 12px 0;
}

.sidebar-section {
  margin-bottom: 8px;
}

.sidebar-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin: 0 0 8px;
}

.sidebar-color {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar-mismatch-block {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.sidebar-source-name {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
}

.sidebar-mismatch-detail {
  margin: 0;
  color: var(--fg-muted);
  font-size: 12px;
  line-height: 1.6;
}

.sidebar-value-large {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
}

.sidebar-comparison {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-comparison-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-comparison-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.sidebar-comparison-values {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}

.sidebar-comparison-change {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

/* Hover-Block */
.sidebar-hover-block {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.sidebar-hover-title {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
}

.sidebar-hover-text {
  margin: 0;
  color: var(--fg-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
