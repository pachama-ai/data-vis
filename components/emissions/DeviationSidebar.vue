<script setup lang="ts">
/**
 * Anzeigen der Informationen zum Abweichungsdiagramm
 *
 * Bei Hover oder Auswahl werden die Werte eines
 * Energieträgers angezeigt
 * Ohne Auswahl bleibt der Jahresüberblick sichtbar
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'

import {
  GROUP_OF,
  MIX_COLORS,
  MIX_COLORS_ACCESSIBLE,
  MIX_GROUP_LABELS,
  MIX_LABELS,
} from '~/components/generation/mixConfig'

import type {
  DeviationYear,
  EmissionRow,
  MixSourceKey,
} from '~/types/emissions'

/**
 * Werte für die Anzeige in der Seitenleiste
 */
interface DeviationSidebarProps {
  /** Daten des ausgewählten Jahres */
  activeYear: DeviationYear | null

  /** Daten des Vergleichsjahres 2015 */
  baseYear: DeviationYear | null

  /** Energieträger unter dem Mauszeiger */
  hoveredRow: EmissionRow | null

  /** Durch Klick ausgewählter Energieträger */
  selectedRow: EmissionRow | null

  /** Erzeugungsanteil der Auswahl im Basisjahr */
  selectedRowBaseShare: number | null

  /** Emissionsintensität des aktiven Jahres */
  emissionIntensity: number

  /** Anteil erneuerbarer Energien im aktiven Jahr */
  renewableShare: number

  /** Anteil erneuerbarer Energien im Basisjahr */
  baseRenewableShare: number

  /** Emissionsintensität des Basisjahres */
  baseEmissionIntensity: number

  /** Verwendete Farbpalette */
  colorMode?: 'default' | 'accessible'
}

const props = withDefaults(
  defineProps<DeviationSidebarProps>(),
  {
    colorMode: 'default',
  },
)

/* Formatieren von Zahlen mit einer Nachkommastelle */
const decimalFormatter = new Intl.NumberFormat(
  'de-DE',
  {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
)

/* Formatieren von Zahlen ohne Nachkommastellen */
const wholeNumberFormatter = new Intl.NumberFormat(
  'de-DE',
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
)

/**
 * Formatieren eines Prozentwerts
 *
 * @param value Wert in Prozent
 * @returns Prozentwert mit einer Nachkommastelle
 */
function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)} %`
}

/**
 * Formatieren einer Abweichung mit Vorzeichen
 *
 * Das Vorzeichen zeigt direkt, ob der Emissionsanteil
 * größer oder kleiner als der Erzeugungsanteil ist
 *
 * @param value Abweichung in Prozentpunkten
 * @returns Wert mit Vorzeichen und Einheit
 */
function formatPercentagePoints(value: number): string {
  const absoluteValue = decimalFormatter.format(
    Math.abs(value),
  )

  if (value > 0) {
    return `+${absoluteValue} pp`
  }

  if (value < 0) {
    return `−${absoluteValue} pp`
  }

  return `${absoluteValue} pp`
}

/**
 * Formatieren der Emissionsintensität ohne Nachkommastellen
 *
 * @param value Emissionsintensität in Gramm pro Kilowattstunde
 * @returns Wert mit Einheit
 */
function formatIntensity(value: number): string {
  return `${wholeNumberFormatter.format(value)} g CO₂/kWh`
}

/**
 * Formatieren einer Veränderung zum Vergleichsjahr
 *
 * @param value Veränderung zum Basisjahr
 * @param suffix Einheit des Werts
 * @returns Wert mit Vorzeichen und Einheit
 */
function formatChange(
  value: number,
  suffix: string,
): string {
  const absoluteValue = decimalFormatter.format(
    Math.abs(value),
  )

  if (value > 0) {
    return `+${absoluteValue} ${suffix}`
  }

  if (value < 0) {
    return `−${absoluteValue} ${suffix}`
  }

  return `${absoluteValue} ${suffix}`
}

/**
 * Begrenzen der Balkenbreite auf 0 bis 100 Prozent
 *
 * Dadurch können falsche Werte nicht über den
 * vorgesehenen Bereich hinauslaufen
 *
 * @param share Anteil zwischen 0 und 1
 * @returns Breite für das CSS
 */
function getBarWidth(share: number): string {
  let width = share * 100

  if (width < 0) {
    width = 0
  }

  if (width > 100) {
    width = 100
  }

  return `${width}%`
}

/* Prüfen, ob Daten für ein Jahr vorhanden sind */
const hasData = computed(function () {
  return props.activeYear !== null
})

/*
 * Festlegen der aktuell angezeigten Zeile
 *
 * Hover hat Vorrang vor einer geklickten Auswahl,
 * damit direkt der Wert unter der Maus angezeigt wird
 */
const activeRow = computed(function () {
  if (props.hoveredRow !== null) {
    return props.hoveredRow
  }

  return props.selectedRow
})

/*
 * Prüfen, ob eine Auswahl angezeigt wird
 *
 * Während des Hoverns wird die Auswahl kurz überlagert
 */
const hasSelection = computed(function () {
  if (props.selectedRow === null) {
    return false
  }

  return props.hoveredRow === null
})

/* Prüfen, ob ein Energieträger angezeigt wird */
const showsSource = computed(function () {
  return activeRow.value !== null
})

/*
 * Prüfen auf Energieträger ohne Stromerzeugung
 *
 * In diesem Fall werden keine weiteren Kennzahlen angezeigt
 */
const hasZeroGeneration = computed(function () {
  const row = activeRow.value

  if (row === null) {
    return false
  }

  return row.generationTwh === 0
})

/* Anzeigen des Jahresüberblicks ohne ausgewählten Energieträger */
const showsDefault = computed(function () {
  if (!hasData.value) {
    return false
  }

  return activeRow.value === null
})

/**
 * Auswählen der Farbe für einen Energieträger
 *
 * @param sourceKey Energieträger
 * @returns Farbe aus der ausgewählten Palette
 */
function getColor(sourceKey: MixSourceKey): string {
  if (props.colorMode === 'accessible') {
    return MIX_COLORS_ACCESSIBLE[sourceKey]
  }

  return MIX_COLORS[sourceKey]
}

/* Ermitteln der Gruppe des aktuell angezeigten Energieträgers */
const groupLabel = computed(function () {
  const row = activeRow.value

  if (row === null) {
    return ''
  }

  return MIX_GROUP_LABELS[GROUP_OF[row.sourceKey]]
})

/**
 * Erstellen einer kurzen Erklärung zur Abweichung
 *
 * Kleine Abweichungen bis 1 Prozentpunkt werden
 * als ungefähr gleich eingeordnet
 *
 * @param row Daten des Energieträgers
 * @returns Kurze Einordnung der Abweichung
 */
function createMeaning(row: EmissionRow): string {
  const name = MIX_LABELS[row.sourceKey]

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

/*
 * Anzeigen der Entwicklung nur bei einer festen Auswahl
 *
 * Für Hoverwerte gibt es keinen Vergleich mit dem Basisjahr
 */
const showsDevelopment = computed(function () {
  if (props.selectedRowBaseShare === null) {
    return false
  }

  return hasSelection.value
})

/**
 * Vergleichen des aktuellen Stromanteils mit 2015
 *
 * @param currentShare Aktueller Erzeugungsanteil
 * @returns Wort für die Veränderung seit 2015
 */
function getDevelopmentWord(
  currentShare: number,
): string {
  const baseShare = props.selectedRowBaseShare

  if (baseShare === null) {
    return ''
  }

  if (currentShare > baseShare) {
    return 'stieg'
  }

  if (currentShare < baseShare) {
    return 'sank'
  }

  return 'blieb gleich'
}
</script>

<template>
  <aside class="deviation-sidebar">
    <!-- Jahresüberblick -->
    <section
      v-if="showsDefault"
      class="sidebar-state"
    >
      <h2 class="sidebar-title">Jahresüberblick</h2>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Erneuerbare Energien</h3>

        <div class="metric-row">
          <span class="metric-label">{{ props.activeYear?.year }}</span>
          <span class="metric-value">{{ formatPercent(props.renewableShare) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">2015</span>
          <span class="metric-value">{{ formatPercent(props.baseRenewableShare) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">Veränderung</span>
          <span
            class="metric-change"
            :class="{
              'metric-change--positive': props.renewableShare > props.baseRenewableShare,
              'metric-change--negative': props.renewableShare < props.baseRenewableShare,
            }"
          >
            {{ formatChange(props.renewableShare - props.baseRenewableShare, 'pp') }}
          </span>
        </div>
      </div>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">CO₂-Intensität</h3>

        <div class="metric-row">
          <span class="metric-label">{{ props.activeYear?.year }}</span>
          <span class="metric-value">{{ formatIntensity(props.emissionIntensity) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">2015</span>
          <span class="metric-value">{{ formatIntensity(props.baseEmissionIntensity) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">Veränderung</span>
          <span
            class="metric-change"
            :class="{
              'metric-change--positive': props.emissionIntensity < props.baseEmissionIntensity,
              'metric-change--negative': props.emissionIntensity > props.baseEmissionIntensity,
            }"
          >
            {{ formatChange(props.emissionIntensity - props.baseEmissionIntensity, 'g CO₂/kWh') }}
          </span>
        </div>
      </div>
    </section>

    <!-- Energieträger-Details -->
    <section
      v-else-if="showsSource"
      class="sidebar-state"
    >
      <div
        v-if="activeRow"
        class="source-header"
      >
        <span
          class="source-color"
          :style="{ backgroundColor: getColor(activeRow.sourceKey) }"
        />
        <h2 class="source-name">
          {{ MIX_LABELS[activeRow.sourceKey] }}
        </h2>
      </div>

      <p class="source-group">{{ groupLabel }}</p>

      <div
        v-if="!hasZeroGeneration"
        class="sidebar-section"
      >
        <h3 class="sidebar-section-title">Stromerzeugung</h3>

        <div class="metric-row">
          <span class="metric-label">Erzeugung</span>
          <span class="metric-value">{{ formatPercent(activeRow?.generationShare ?? 0) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">CO₂-Anteil</span>
          <span class="metric-value">{{ formatPercent(activeRow?.emissionShare ?? 0) }}</span>
        </div>

        <div class="metric-row">
          <span class="metric-label">Abweichung</span>
          <span
            class="metric-change"
            :class="{
              'metric-change--positive': (activeRow?.deviationPp ?? 0) > 0,
              'metric-change--negative': (activeRow?.deviationPp ?? 0) < 0,
            }"
          >
            {{ formatPercentagePoints(activeRow?.deviationPp ?? 0) }}
          </span>
        </div>

        <div class="deviation-bar-container">
          <div
            class="deviation-bar"
            :style="{ width: getBarWidth(activeRow?.generationShare ?? 0) }"
          />
        </div>
      </div>

      <p
        v-if="activeRow && !hasZeroGeneration"
        class="source-meaning"
      >
        {{ createMeaning(activeRow) }}
      </p>

      <p
        v-if="hasZeroGeneration && activeRow"
        class="source-meaning"
      >
        {{ MIX_LABELS[activeRow.sourceKey] }} hatte im ausgewählten Jahr keine Stromerzeugung.
      </p>

      <div
        v-if="showsDevelopment && activeRow"
        class="sidebar-section"
      >
        <h3 class="sidebar-section-title">Entwicklung seit 2015</h3>

        <p class="development-text">
          Der Anteil von {{ MIX_LABELS[activeRow.sourceKey] }}
          {{ getDevelopmentWord(activeRow.generationShare) }}
          von {{ formatPercent(props.selectedRowBaseShare ?? 0) }}
          auf {{ formatPercent(activeRow.generationShare) }}.
        </p>
      </div>
    </section>

    <!-- Keine Daten -->
    <section
      v-else
      class="sidebar-state"
    >
      <p class="empty-message">Keine Daten verfügbar.</p>
    </section>
  </aside>
</template>

<style scoped>
.deviation-sidebar {
  font-family: var(--sans-font);
  font-size: 13px;
  color: var(--text-color);
}

.sidebar-state {
  background: var(--background-color);
  border: 1px solid var(--line-color);
  border-radius: 6px;
  padding: 16px;
}

.sidebar-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.sidebar-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line-color);
}

.sidebar-section-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
}

.metric-label {
  color: var(--muted-text-color);
  font-size: 13px;
}

.metric-value {
  font-weight: 600;
  font-size: 13px;
  text-align: right;
  white-space: nowrap;
}

.metric-change {
  font-weight: 600;
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.metric-change--positive {
  color: var(--accent-color);
}

.metric-change--negative {
  color: #b33a3a;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.source-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.source-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.source-group {
  margin: 0 0 12px;
  font-size: 11px;
  color: var(--muted-text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.deviation-bar-container {
  margin-top: 8px;
  height: 6px;
  background: var(--line-color);
  border-radius: 3px;
  overflow: hidden;
}

.deviation-bar {
  height: 100%;
  background: var(--accent-color);
  border-radius: 3px;
  transition: width 200ms ease-out;
}

.source-meaning {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted-text-color);
  padding: 8px;
  background: rgba(45, 106, 79, 0.04);
  border-radius: 4px;
}

.development-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color);
}

.empty-message {
  margin: 0;
  color: var(--muted-text-color);
  font-style: italic;
}
</style>

