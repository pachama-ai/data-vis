<script setup lang="ts">
/**
 * Seitenleiste neben dem Flächendiagramm mit drei Zuständen:
 * Übersicht (keine Auswahl), Energieträger (über die Legende ausgewählt)
 * und Ereignis (Annotation ausgewählt). Der Hover bestimmt nur den Monat
 * im Tooltip.
 * Die Priorität ist Ereignis > Energieträger > Übersicht.
 *
 * @author Selina Schneider
 */

import {
  MIX_LABELS,
  MIX_COLORS,
  MIX_GROUP_LABELS,
} from '~/components/generation/mixConfig'
import AnnotationMarkers from '~/components/generation/AnnotationMarkers.vue'

import type { MixAnnotation } from '~/types/energy-mix'
import type {
  OverviewMetrics,
  SourceMetrics,
  AnnotationContext,
} from '~/composables/useMixMetrics'

interface MixSidebarProps {
  overviewMetrics: OverviewMetrics | null
  sourceMetrics: SourceMetrics | null
  annotationContext: AnnotationContext | null
  annotations: MixAnnotation[]
  selectedAnnotation: number | null
}

const props = defineProps<MixSidebarProps>()

const emit = defineEmits<{
  selectAnnotation: [annotation: MixAnnotation]
}>()

/**
 * Leitet die Auswahl einer Annotation an die übergeordnete
 * Komponente weiter, die den Zustand verwaltet.
 *
 * @param annotation Ausgewählte Annotation
 */
function handleAnnotationSelect(
  annotation: MixAnnotation,
): void {
  emit('selectAnnotation', annotation)
}

// Formatierungsfunktionen für die Kennzahlen in der Seitenleiste.
const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formatiert einen Energiemengenwert mit einer Nachkommastelle und der Einheit TWh.
 *
 * @param value Wert in Terawattstunden
 * @returns Formatierter Wert
 */
function formatTwh(value: number): string {
  return `${numberFormatter.format(value)} TWh`
}

/**
 * Formatiert einen Anteilswert als Prozentzahl mit einer Nachkommastelle.
 *
 * @param share Anteil zwischen 0 und 1
 * @returns Formatierter Wert
 */
function formatPercent(share: number): string {
  return `${numberFormatter.format(share * 100)} %`
}

/**
 * Formatiert eine Veränderung in Prozentpunkten mit Vorzeichen.
 *
 * @param value Veränderung in Prozentpunkten
 * @returns Formatierter Wert
 */
function formatPercentagePoints(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const formatted = numberFormatter.format(Math.abs(rounded))

  if (rounded > 0) return `+${formatted} pp`
  if (rounded < 0) return `-${formatted} pp`
  return `${formatted} pp`
}

/**
 * Formatiert eine Energiemengenveränderung mit Vorzeichen und der Einheit TWh.
 *
 * @param value Veränderung in Terawattstunden
 * @returns Formatierter Wert
 */
function formatSignedTwh(value: number): string {
  const formatted = numberFormatter.format(Math.abs(value))

  if (value > 0) return `+${formatted} TWh`
  if (value < 0) return `-${formatted} TWh`
  return `${formatted} TWh`
}

const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
})

/**
 * Formatiert ein Datum als deutschen Monatsnamen mit Jahr.
 *
 * @param date Datum des Monats
 * @returns Formatierter Wert
 */
function formatMonth(date: Date): string {
  return monthFormatter.format(date)
}
</script>

<template>
  <aside class="mix-sidebar">
    <AnnotationMarkers
      :annotations="annotations"
      :selected-annotation="selectedAnnotation"
      @select="handleAnnotationSelect"
    />

    <div class="sidebar-divider" />

    <!-- Ereignis -->
    <section
      v-if="annotationContext"
      class="sidebar-state"
    >
      <p class="annotation-date">
        {{ annotationContext.annotation.date }}
      </p>

      <h2 class="sidebar-title">
        {{ annotationContext.annotation.title }}
      </h2>

      <p class="annotation-text">
        {{ annotationContext.annotation.text }}
      </p>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">
          Anteile im dargestellten Monat
        </h3>

        <div
          v-for="groupShare in annotationContext.groupShares"
          :key="groupShare.group"
          class="metric-row"
        >
          <span class="metric-label">
            {{ MIX_GROUP_LABELS[groupShare.group] }}
          </span>

          <span class="metric-value">
            {{ formatPercent(groupShare.share) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Energieträger -->
    <section
      v-else-if="sourceMetrics"
      class="sidebar-state"
    >
      <h2 class="source-heading">
        <span
          class="source-color"
          :style="{
            backgroundColor: MIX_COLORS[sourceMetrics.sourceKey],
          }"
        />
        {{ MIX_LABELS[sourceMetrics.sourceKey] }}
      </h2>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Jahr 2024</h3>

        <div class="metric-row">
          <span class="metric-label">Jahressumme 2024</span>
          <span class="metric-value">
            {{ formatTwh(sourceMetrics.value2024) }}
          </span>
        </div>

        <div class="metric-row">
          <span class="metric-label">Anteil am Jahresmix 2024</span>
          <span class="metric-value">
            {{ formatPercent(sourceMetrics.share2024) }}
          </span>
        </div>
      </div>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Verlauf 2015–2024</h3>

        <div class="metric-row">
          <span class="metric-label">Veränderung der Jahressumme seit 2015</span>
          <span
            class="metric-change"
            :class="{
              'metric-change--positive':
                sourceMetrics.changeTwh > 0,
              'metric-change--negative':
                sourceMetrics.changeTwh < 0,
            }"
          >
            {{ formatSignedTwh(sourceMetrics.changeTwh) }}
          </span>
        </div>

        <div class="metric-row">
          <span class="metric-label">Veränderung des Jahresanteils seit 2015</span>
          <span
            class="metric-change"
            :class="{
              'metric-change--positive':
                sourceMetrics.percentagePointChange > 0,
              'metric-change--negative':
                sourceMetrics.percentagePointChange < 0,
            }"
          >
            {{
              formatPercentagePoints(
                sourceMetrics.percentagePointChange,
              )
            }}
          </span>
        </div>
      </div>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Höchster Monatswert</h3>

        <div class="metric-row">
          <span class="metric-label">
            {{ formatMonth(sourceMetrics.maximumMonth.monthRow.date) }}
          </span>
          <span class="metric-value">
            {{ formatTwh(sourceMetrics.maximumMonth.valueTwh) }}
          </span>
        </div>
      </div>

      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Niedrigster Monatswert</h3>

        <div class="metric-row">
          <span class="metric-label">
            {{ formatMonth(sourceMetrics.minimumMonth.monthRow.date) }}
          </span>
          <span class="metric-value">
            {{ formatTwh(sourceMetrics.minimumMonth.valueTwh) }}
          </span>
        </div>
      </div>

      <p
        v-if="sourceMetrics.sourceKey === 'nuclear'"
        class="source-context"
      >
        Die letzten drei Kernkraftwerke wurden am 15. April 2023
        abgeschaltet. Deshalb ist im April noch ein kleiner Anteil
        Kernenergie zu sehen.
      </p>
    </section>

    <!-- Übersicht -->
    <section
      v-else
      class="sidebar-state"
    >
      <template v-if="overviewMetrics">
        <h2 class="sidebar-title">Vergleich zwischen 2015 und 2024</h2>

        <div class="sidebar-section">
          <div
            v-for="group in overviewMetrics.groups"
            :key="group.group"
            class="metric-row"
          >
            <span class="metric-label">
              {{ MIX_GROUP_LABELS[group.group] }}
            </span>

            <span class="metric-value">
              {{ formatPercent(group.share2015) }}
              → {{ formatPercent(group.share2024) }}
            </span>

            <span
              class="metric-change"
              :class="{
                'metric-change--positive':
                  group.percentagePointChange > 0,
                'metric-change--negative':
                  group.percentagePointChange < 0,
              }"
            >
              {{
                formatPercentagePoints(
                  group.percentagePointChange,
                )
              }}
            </span>
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-section-title">Größter absoluter Zuwachs</h3>

          <div class="metric-row">
            <span class="metric-label">
              {{ MIX_LABELS[overviewMetrics.largestIncrease.sourceKey] }}
            </span>
            <span class="metric-change metric-change--positive">
              {{
                formatSignedTwh(
                  overviewMetrics.largestIncrease.changeTwh,
                )
              }}
              gegenüber 2015
            </span>
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="sidebar-section-title">Größter absoluter Rückgang</h3>

          <div class="metric-row">
            <span class="metric-label">
              {{ MIX_LABELS[overviewMetrics.largestDecrease.sourceKey] }}
            </span>
            <span class="metric-change metric-change--negative">
              {{
                formatSignedTwh(
                  overviewMetrics.largestDecrease.changeTwh,
                )
              }}
              gegenüber 2015
            </span>
          </div>
        </div>
      </template>

      <p
        v-else
        class="empty-message"
      >
        Kennzahlen sind nicht verfügbar.
      </p>
    </section>
  </aside>
</template>

<style scoped>
.mix-sidebar {
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

.annotation-date {
  margin: 0 0 2px;
  font-size: 11px;
  color: var(--muted-text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.source-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.source-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.annotation-text {
  margin: 0 0 8px;
  line-height: 1.5;
  color: var(--text-color);
  font-size: 13px;
}

.empty-message {
  margin: 0;
  color: var(--muted-text-color);
  font-style: italic;
}

.source-context {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted-text-color);
  padding: 8px;
  background: rgba(45, 106, 79, 0.04);
  border-radius: 4px;
}

/* .sidebar-divider – Regel in main.css */
</style>