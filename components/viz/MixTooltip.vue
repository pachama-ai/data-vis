<script setup lang="ts">
/**
 * MixTooltip.vue – Kontextabhängiger Tooltip für das Stacked-Area-Chart.
 *
 * Ohne Auswahl: Monat, Gesamtsumme, drei Gruppen (Erneuerbare, Kernenergie, Fossil).
 * Mit Auswahl: Monat mit Quellennamen, Wert und Monatsanteil des gewählten Trägers.
 * Keine D3-Logik.
 */

import { computed } from 'vue'

import {
  GROUP_OF,
  MIX_GROUP_LABELS,
  MIX_GROUP_ORDER,
  MIX_LABELS,
  STACK_ORDER,
} from '~/utils/mix-config'

import type { MixGroup, MixMonthRow, MixSourceKey } from '~/types/mix'

// =========================================================================
// Props
// =========================================================================

interface MixTooltipProps {
  monthRow: MixMonthRow
  chartX: number
  chartY: number
  highlightedSource: MixSourceKey | null
}

const props = defineProps<MixTooltipProps>()

// =========================================================================
// Formatierungsfunktionen
// =========================================================================

const twhFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const germanMonthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

function formatTwh(value: number): string {
  return `${twhFormatter.format(value)} TWh`
}

function formatPercent(share: number): string {
  return `${percentFormatter.format(share * 100)} %`
}

// =========================================================================
// Hilfstypen
// =========================================================================

interface TooltipGroupValue {
  group: MixGroup
  valueTwh: number
  share: number
}

// =========================================================================
// Hilfsfunktionen
// =========================================================================

function calculateShare(value: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return value / total
}

function createEmptyGroupValues(): Record<MixGroup, number> {
  return {
    renewable: 0,
    nuclear: 0,
    fossil: 0,
  }
}

// =========================================================================
// Computed
// =========================================================================

const formattedMonth = computed(() => {
  return germanMonthFormatter.format(props.monthRow.date)
})

const totalValue = computed(() => {
  let total = 0

  for (const sourceKey of STACK_ORDER) {
    total += props.monthRow.values[sourceKey]
  }

  return total
})

const groupValues = computed<TooltipGroupValue[]>(() => {
  const valuesByGroup = createEmptyGroupValues()

  for (const sourceKey of STACK_ORDER) {
    const group = GROUP_OF[sourceKey]

    valuesByGroup[group] += props.monthRow.values[sourceKey]
  }

  const result: TooltipGroupValue[] = []

  for (const group of MIX_GROUP_ORDER) {
    const valueTwh = valuesByGroup[group]
    const share = calculateShare(valueTwh, totalValue.value)

    result.push({ group, valueTwh, share })
  }

  return result
})

const selectedSourceValue = computed(() => {
  const sourceKey = props.highlightedSource

  if (sourceKey === null) {
    return null
  }

  const valueTwh = props.monthRow.values[sourceKey]
  const share = calculateShare(valueTwh, totalValue.value)

  return { sourceKey, valueTwh, share }
})

const tooltipStyle = computed(() => {
  return {
    left: `${props.chartX + 12}px`,
    top: `${props.chartY + 12}px`,
  }
})
</script>

<template>
  <aside
    class="mix-tooltip"
    :style="tooltipStyle"
    role="status"
    aria-live="polite"
  >
    <!-- Zustand B: einzelner Energieträger ausgewählt -->
    <template v-if="selectedSourceValue">
      <h3 class="tooltip-title">
        {{ formattedMonth }}
        ·
        {{ MIX_LABELS[selectedSourceValue.sourceKey] }}
      </h3>

      <p class="tooltip-source-value">
        <strong>
          {{ formatTwh(selectedSourceValue.valueTwh) }}
        </strong>

        <span aria-hidden="true">
          ·
        </span>

        <span class="tooltip-source-pct">
          {{ formatPercent(selectedSourceValue.share) }}
          des Monats
        </span>
      </p>
    </template>

    <!-- Zustand A: Gruppenübersicht -->
    <template v-else>
      <h3 class="tooltip-title">
        {{ formattedMonth }}
      </h3>

      <dl class="tooltip-summary">
        <div class="tooltip-row tooltip-row--total">
          <dt class="tooltip-label">Gesamt</dt>
          <dd class="tooltip-value-cell">
            <span class="tooltip-twh">{{ formatTwh(totalValue) }}</span>
            <span class="tooltip-pct">100,0 %</span>
          </dd>
        </div>

        <div
          v-for="groupValue in groupValues"
          :key="groupValue.group"
          class="tooltip-row"
        >
          <dt class="tooltip-label">
            {{ MIX_GROUP_LABELS[groupValue.group] }}
          </dt>

          <dd class="tooltip-value-cell">
            <span class="tooltip-twh">
              {{ formatTwh(groupValue.valueTwh) }}
            </span>

            <span class="tooltip-pct">
              {{ formatPercent(groupValue.share) }}
            </span>
          </dd>
        </div>
      </dl>
    </template>
  </aside>
</template>

<style scoped>
.mix-tooltip {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
  min-width: 300px;
  white-space: nowrap;
  background: #ffffff;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.5;
}

.tooltip-title {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  margin: 0;
  white-space: nowrap;
}

.tooltip-source-value {
  margin: 6px 0 0;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tooltip-source-value strong {
  font-weight: 600;
}

.tooltip-source-pct {
  white-space: nowrap;
}

.tooltip-summary {
  margin: 10px 0 0;
}

.tooltip-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 2px 0;
  white-space: nowrap;
}

.tooltip-row--total {
  font-weight: 600;
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.tooltip-label {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-value-cell {
  display: flex;
  gap: 16px;
  margin: 0 0 0 auto;
  text-align: right;
  flex-shrink: 0;
}

.tooltip-twh {
  min-width: 70px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.tooltip-pct {
  min-width: 55px;
  text-align: right;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}
</style>
