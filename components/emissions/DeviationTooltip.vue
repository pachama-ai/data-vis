<script setup lang="ts">
/**
 * Tooltip für das Abweichungsdiagramm. Erscheint beim Hover über einem
 * Balken und zeigt Erzeugungsanteil, Emissionsanteil und die Abweichung
 * zwischen beiden Werten.
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'

import {
  MIX_COLORS,
  MIX_LABELS,
} from '~/components/generation/mixConfig'

import type { EmissionRow } from '~/types/emissions'

interface DeviationTooltipProps {
  row: EmissionRow

  /** Mausposition relativ zum Chart-Container.
   * Die Chart-Klasse liefert die Koordinaten im Hover-Payload. */
  chartX: number
  chartY: number
}

const props = defineProps<DeviationTooltipProps>()

const percentFormatter = new Intl.NumberFormat(
  'de-DE',
  {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
)

/**
 * Formatiert einen Anteil als Prozentwert mit einer Nachkommastelle.
 * Die Rohwerte liegen zwischen 0 und 1, deshalb multipliziere ich vor
 * der Formatierung mit 100.
 *
 * @param share Anteil zwischen 0 und 1
 * @returns Formatierter Wert
 */
function formatPercent(share: number): string {
  const percentValue = share * 100
  const formattedValue =
    percentFormatter.format(percentValue)

  return `${formattedValue} %`
}

/**
 * Formatiert die Abweichung mit Vorzeichen. Das Vorzeichen zeigt,
 * ob der Emissionsanteil über oder unter dem Erzeugungsanteil liegt.
 *
 * @param value Abweichung in Prozentpunkten
 * @returns Formatierter Wert
 */
function formatPercentagePoints(
  value: number,
): string {
  const absoluteValue = Math.abs(value)
  const formattedValue =
    percentFormatter.format(absoluteValue)

  if (value > 0) {
    return `+${formattedValue} pp`
  }

  if (value < 0) {
    return `−${formattedValue} pp`
  }

  return `${formattedValue} pp`
}

// Absolute Positionierung neben dem Mauszeiger, mit Offset,
// damit der Cursor den Tooltip nicht überdeckt.
const tooltipStyle = computed(function () {
  return {
    left: `${props.chartX + 12}px`,
    top: `${props.chartY + 12}px`,
  }
})
</script>

<template>
  <aside
    class="deviation-tooltip"
    :style="tooltipStyle"
    role="status"
    aria-live="polite"
  >
    <header class="tooltip-header">
      <span
        class="tooltip-color"
        :style="{
          backgroundColor:
            MIX_COLORS[row.sourceKey],
        }"
        aria-hidden="true"
      />

      <h3 class="tooltip-title">
        {{ MIX_LABELS[row.sourceKey] }}
      </h3>
    </header>

    <dl class="tooltip-metrics">
      <div class="tooltip-row">
        <dt>Stromerzeugung</dt>
        <dd>
          {{ formatPercent(row.generationShare) }}
        </dd>
      </div>

      <div class="tooltip-row">
        <dt>CO₂-Emissionen</dt>
        <dd>
          {{ formatPercent(row.emissionShare) }}
        </dd>
      </div>

      <div class="tooltip-row tooltip-row--result">
        <dt>Abweichung</dt>
        <dd>
          {{ formatPercentagePoints(row.deviationPp) }}
        </dd>
      </div>
    </dl>
  </aside>
</template>

<style scoped>
/*
 * position: absolute, weil der Tooltip relativ zum Chart-Container
 * positioniert wird. Pointer-events: none, damit der Cursor weiter die
 * darunterliegenden Balken erreicht.
 */
.deviation-tooltip {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
  min-width: 220px;
  white-space: nowrap;
  background: #ffffff;
  border: 1px solid var(--line-color);
  border-radius: 6px;
  padding: 10px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: var(--sans-font);
  font-size: 12px;
  line-height: 1.5;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

/* Farbpunkt vor dem Energieträgernamen. */
.tooltip-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-title {
  font-family: var(--serif-font);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.tooltip-metrics {
  margin: 0;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 2px 0;
}

.tooltip-row dt {
  color: var(--muted-text-color);
  font-weight: 400;
}

.tooltip-row dd {
  color: var(--text-color);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  margin: 0;
}

/* Ergebniszeile durch Trennlinie und dunkleren Text vom Rest abgesetzt. */
.tooltip-row--result {
  border-top: 1px solid var(--line-color);
  margin-top: 4px;
  padding-top: 6px;
}

.tooltip-row--result dt {
  font-weight: 500;
  color: var(--text-color);
}

.tooltip-row--result dd {
  font-weight: 600;
}
</style>