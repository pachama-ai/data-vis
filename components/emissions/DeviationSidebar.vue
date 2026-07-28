<script setup lang="ts">
/**
 * Zeigt die Informationen zum Abweichungsdiagramm.
 *
 * Je nach Hover oder Auswahl erscheinen die Werte eines
 * Energieträgers. Ohne Auswahl bleibt der Jahresüberblick sichtbar.
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
 * Werte, die die Seitenleiste für ihre Anzeige erhält.
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

const decimalFormatter = new Intl.NumberFormat(
  'de-DE',
  {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
)

const wholeNumberFormatter = new Intl.NumberFormat(
  'de-DE',
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
)

/**
 * Wandelt einen Prozentwert in die deutsche Schreibweise um.
 *
 * @param value Wert in Prozent
 * @returns Prozentwert mit einer Nachkommastelle
 */
function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)} %`
}

/**
 * Zeigt die Abweichung mit dem passenden Vorzeichen an.
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
 * Gibt die Emissionsintensität ohne Nachkommastellen aus.
 *
 * @param value Emissionsintensität in Gramm pro Kilowattstunde
 * @returns Wert mit Einheit
 */
function formatIntensity(value: number): string {
  return `${wholeNumberFormatter.format(value)} g CO₂/kWh`
}

/**
 * Ergänzt eine Veränderung um Vorzeichen und Einheit.
 *
 * @param value Veränderung zum Basisjahr
 * @param suffix Einheit des Werts
 * @returns Fertig formatierter Wert
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
 * Begrenzt die Balkenbreite auf 0 bis 100 Prozent
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

const hasData = computed(function () {
  return props.activeYear !== null
})

/**
 * Aktuelle Zeile: Hover hat Vorrang, sonst die Auswahl
 */
const activeRow = computed(function () {
  if (props.hoveredRow !== null) {
    return props.hoveredRow
  }

  return props.selectedRow
})

const hasSelection = computed(function () {
  if (props.selectedRow === null) {
    return false
  }

  return props.hoveredRow === null
})

const showsSource = computed(function () {
  return activeRow.value !== null
})

const hasZeroGeneration = computed(function () {
  const row = activeRow.value

  if (row === null) {
    return false
  }

  return row.generationTwh === 0
})

const showsDefault = computed(function () {
  if (!hasData.value) {
    return false
  }

  return activeRow.value === null
})

/**
 * Liefert die passende Farbe aus der aktuell gewählten Palette.
 *
 * @param sourceKey Energieträger
 * @returns Farbe für den Punkt neben dem Namen
 */
function getColor(sourceKey: MixSourceKey): string {
  if (props.colorMode === 'accessible') {
    return MIX_COLORS_ACCESSIBLE[sourceKey]
  }

  return MIX_COLORS[sourceKey]
}

const groupLabel = computed(function () {
  const row = activeRow.value

  if (row === null) {
    return ''
  }

  return MIX_GROUP_LABELS[GROUP_OF[row.sourceKey]]
})

/**
 * Ordnet die Abweichung in einem kurzen Satz ein
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

const showsDevelopment = computed(function () {
  if (props.selectedRowBaseShare === null) {
    return false
  }

  return hasSelection.value
})

/**
 * Vergleicht den aktuellen Stromanteil mit dem Wert von 2015
 *
 * @param currentShare Aktueller Erzeugungsanteil
 * @returns Passendes Wort für den Entwicklungssatz
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
    <p
      v-if="!hasData"
      class="sidebar-empty"
    >
      Kennzahlen sind nicht verfügbar.
    </p>

    <template v-if="showsSource && activeRow">
      <p class="sidebar-year">
        {{ activeYear?.year }}
      </p>

      <div class="sidebar-divider"></div>

      <!-- Dieser Fall braucht keine weiteren Kennzahlen. -->
      <template v-if="hasZeroGeneration">
        <p class="title-label">
          {{ MIX_LABELS[activeRow.sourceKey] }}
        </p>

        <p class="sidebar-zero-msg">
          Im Jahr {{ activeYear?.year }} fand keine
          Stromerzeugung aus
          {{ MIX_LABELS[activeRow.sourceKey] }} statt.
        </p>
      </template>

      <template v-else>
        <section class="sidebar-section">
          <div class="sidebar-name-block">
            <span
              class="sidebar-color"
              :style="{
                backgroundColor:
                  getColor(activeRow.sourceKey),
              }"
              aria-hidden="true"
            ></span>

            <span class="sidebar-source-name">
              {{ MIX_LABELS[activeRow.sourceKey] }}
            </span>

            <span class="sidebar-group-label">
              {{ groupLabel }}
            </span>
          </div>
        </section>

        <div class="sidebar-divider"></div>

        <section class="sidebar-section">
          <p class="title-label">
            Stromerzeugung und CO₂-Emissionen
          </p>

          <div class="comparison">
            <div class="comparison-row">
              <span class="comparison-label">
                Strom
              </span>

              <span class="comparison-track">
                <span
                  class="comparison-fill comparison-fill--generation"
                  :style="{
                    width:
                      getBarWidth(
                        activeRow.generationShare,
                      ),
                  }"
                ></span>
              </span>

              <span class="comparison-value">
                {{
                  formatPercent(
                    activeRow.generationShare * 100,
                  )
                }}
              </span>
            </div>

            <div class="comparison-row">
              <span class="comparison-label">
                CO₂
              </span>

              <span class="comparison-track">
                <span
                  class="comparison-fill comparison-fill--emissions"
                  :style="{
                    width:
                      getBarWidth(
                        activeRow.emissionShare,
                      ),
                  }"
                ></span>
              </span>

              <span class="comparison-value">
                {{
                  formatPercent(
                    activeRow.emissionShare * 100,
                  )
                }}
              </span>
            </div>
          </div>
        </section>

        <div class="sidebar-divider"></div>

        <section class="sidebar-section">
          <p class="title-label">
            Differenz
          </p>

          <p
            class="sidebar-difference"
            :class="{
              'difference-positive':
                activeRow.deviationPp > 0,
              'difference-negative':
                activeRow.deviationPp < 0,
            }"
          >
            {{
              formatPercentagePoints(
                activeRow.deviationPp,
              )
            }}
          </p>

          <p class="sidebar-calculation">
            {{
              formatPercent(
                activeRow.emissionShare * 100,
              )
            }}
            Emissionen −
            {{
              formatPercent(
                activeRow.generationShare * 100,
              )
            }}
            Strom
          </p>
        </section>

        <div class="sidebar-divider"></div>

        <section class="sidebar-section">
          <p class="title-label">
            Bedeutung
          </p>

          <p class="sidebar-sentence">
            {{ createMeaning(activeRow) }}
          </p>
        </section>

        <template v-if="showsDevelopment">
          <div class="sidebar-divider"></div>

          <section class="sidebar-section">
            <p class="title-label">
              Entwicklung seit 2015
            </p>

            <p class="sidebar-sentence">
              Der Anteil an der Stromerzeugung
              {{
                getDevelopmentWord(
                  activeRow.generationShare,
                )
              }}
              von
              {{
                formatPercent(
                  selectedRowBaseShare! * 100,
                )
              }}
              auf
              {{
                formatPercent(
                  activeRow.generationShare * 100,
                )
              }}.
            </p>
          </section>
        </template>
      </template>
    </template>

    <template v-if="showsDefault && activeYear">
      <p class="sidebar-year">
        {{ activeYear.year }}
      </p>

      <div class="sidebar-divider"></div>

      <section class="sidebar-section sidebar-context">
        <p class="title-label">
          Jahresüberblick
        </p>

        <div class="context-row">
          <span class="context-label">
            CO₂-Emissionen je kWh
          </span>

          <span class="context-value">
            {{ formatIntensity(emissionIntensity) }}
          </span>
        </div>

        <div class="context-row">
          <span class="context-label">
            Erneuerbaren-Anteil
          </span>

          <span class="context-value">
            {{ formatPercent(renewableShare) }}
          </span>
        </div>

        <div
          v-if="baseEmissionIntensity > 0"
          class="context-row"
        >
          <span class="context-label">
            Veränderung seit 2015
          </span>

          <span class="context-value context-value--green">
            {{
              formatChange(
                emissionIntensity
                  - baseEmissionIntensity,
                'g CO₂/kWh',
              )
            }}
          </span>
        </div>

        <div
          v-if="baseRenewableShare > 0"
          class="context-row"
        >
          <span class="context-label">
            EE-Anteil 2015 →
            {{ activeYear.year }}
          </span>

          <span class="context-value">
            {{ formatPercent(baseRenewableShare) }}
            →
            {{ formatPercent(renewableShare) }}
          </span>
        </div>
      </section>
    </template>
  </aside>
</template>

<style scoped>
/* Äußerer Bereich der Seitenleiste. */
.deviation-sidebar {
  width: 100%;
  padding: 20px;
  border: 1px solid var(--line-color);
  border-radius: 6px;
  background: var(--background-color);
  color: var(--text-color);
  font-family: var(--sans-font);
  font-size: 13px;
  line-height: 1.5;
}

/* Schlichter Hinweis, falls keine Jahresdaten vorliegen. */
.sidebar-empty {
  padding: 16px 0;
  color: var(--muted-text-color);
  font-style: italic;
}

/* Das Jahr steht bewusst größer über den restlichen Kennzahlen. */
.sidebar-year {
  margin: 0 0 4px;
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
}

/* Hält die einzelnen Inhalte optisch auseinander – Regel in main.css */

.sidebar-section {
  margin-bottom: 4px;
}

/* Energieträger und Gruppe stehen in einer gemeinsamen Zeile. */
.sidebar-name-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.sidebar-color {
  display: inline-block;
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.sidebar-source-name {
  color: var(--text-color);
  font-family: var(--serif-font);
  font-size: 15px;
  font-weight: 600;
}

.sidebar-group-label {
  color: var(--muted-text-color);
  font-size: 11px;
}

/* Etwas zurückhaltendere Texte für Erklärungen und Vergleiche. */
.sidebar-sentence {
  margin: 6px 0 0;
  color: var(--muted-text-color);
  font-size: 12px;
  line-height: 1.6;
}

/* Kleine Balken zum direkten Vergleich der beiden Anteile. */
.comparison {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.comparison-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comparison-label {
  flex-shrink: 0;
  width: 32px;
  color: var(--muted-text-color);
  font-size: 11px;
  font-weight: 600;
  text-align: right;
}

.comparison-track {
  flex: 1;
  height: 10px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--line-color);
}

.comparison-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;
}

.comparison-fill--generation {
  background: var(--accent-color);
}

.comparison-fill--emissions {
  background: #b33;
  opacity: 0.75;
}

.comparison-value {
  flex-shrink: 0;
  width: 52px;
  color: var(--text-color);
  font-size: 12px;
  font-weight: 500;
  font-feature-settings: 'tnum';
  text-align: right;
}

/* Die Differenz hebt sich stärker von den übrigen Werten ab. */
.sidebar-difference {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  font-feature-settings: 'tnum';
}

.difference-positive {
  color: var(--color-diff-positive, #b33);
  opacity: 0.85;
}

.difference-negative {
  color: var(--color-diff-negative, #2a6f4a);
  opacity: 0.85;
}

.sidebar-calculation {
  margin: 2px 0 0;
  color: var(--muted-text-color);
  font-size: 11px;
}

/* Eigener Hinweis für Energieträger ohne Erzeugung. */
.sidebar-zero-msg {
  margin: 0;
  color: var(--muted-text-color);
  font-size: 12px;
  line-height: 1.6;
}

/* Die Kennzahlen des Jahresüberblicks bleiben etwas kompakter. */
.sidebar-context {
  font-size: 12px;
}

/* Bezeichnung und Wert stehen jeweils in einer Zeile. */
.context-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 4px 0;
}

.context-label {
  color: var(--muted-text-color);
  font-size: 11px;
}

.context-value {
  color: var(--text-color);
  font-size: 12px;
  font-weight: 500;
  font-feature-settings: 'tnum';
}

.context-value--green {
  color: var(--accent-color);
}
</style>