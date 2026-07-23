<script setup lang="ts">
/**
 * StackedAreaLegend.vue – Klickbare Legende für den Stacked-Area-Chart.
 *
 * Zeigt alle zehn Energieträger nach Gruppen geordnet.
 * Klick auf einen Chip emittiert den Source-Key.
 * Die Toggle-Logik liegt in useMixSelection, nicht hier.
 */

import { computed } from 'vue'

import {
  GROUP_OF,
  MIX_COLORS,
  MIX_COLORS_ACCESSIBLE,
  MIX_GROUP_LABELS,
  MIX_GROUP_ORDER,
  MIX_LABELS,
  STACK_ORDER,
} from '~/utils/mix-config'

import type { ColorMode, MixGroup, MixSourceKey } from '~/types/mix'

const props = defineProps<{
  highlighted: MixSourceKey | null
  highlightedSources?: MixSourceKey[] | null
  colorMode: ColorMode
  /** Ob ein Ereignis (Annotation) aktiv ist – dann wird die Legende gesperrt */
  hasActiveAnnotation?: boolean
}>()

const emit = defineEmits<{
  select: [sourceKey: MixSourceKey | null]
}>()

const activeColors = computed(() => {
  return props.colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
})

function getSourcesForGroup(group: MixGroup): MixSourceKey[] {
  const sources: MixSourceKey[] = []

  for (const sourceKey of STACK_ORDER) {
    if (GROUP_OF[sourceKey] === group) {
      sources.push(sourceKey)
    }
  }

  return sources
}

const hasEvent = computed(() => {
  return props.highlightedSources != null && props.highlightedSources.length > 0
})

function isSourceActive(sourceKey: MixSourceKey): boolean {
  if (props.hasActiveAnnotation && props.highlightedSources != null) {
    return props.highlightedSources.includes(sourceKey)
  }

  return props.highlighted === sourceKey
}

function isSourceDisabled(sourceKey: MixSourceKey): boolean {
  if (!props.hasActiveAnnotation) return false
  if (props.highlightedSources == null) return false
  return !props.highlightedSources.includes(sourceKey)
}

const showAllDisabled = computed(() => {
  return props.hasActiveAnnotation === true
})

const showAllActive = computed(() => {
  return props.highlightedSources == null && props.highlighted === null
})

function handleSelect(sourceKey: MixSourceKey): void {
  if (isSourceDisabled(sourceKey)) return
  emit('select', sourceKey)
}

function handleShowAll(): void {
  if (showAllDisabled.value) return
  emit('select', null)
}
</script>

<template>
  <div class="stacked-area-legend" aria-label="Energieträger auswählen">
    <button
      type="button"
      class="legend-chip legend-all-button"
      :class="{
        'legend-chip--active': showAllActive,
      }"
      :aria-pressed="showAllActive"
      :disabled="showAllDisabled"
      aria-label="Alle Energieträger anzeigen"
      @click="handleShowAll"
    >
      <span class="legend-all-colors" aria-hidden="true">
        <span class="legend-all-color legend-all-color--renewable" />
        <span class="legend-all-color legend-all-color--nuclear" />
        <span class="legend-all-color legend-all-color--fossil" />
      </span>

      <span class="legend-label">
        Alle anzeigen
      </span>
    </button>

    <section
      v-for="group in MIX_GROUP_ORDER"
      :key="group"
      class="legend-group"
    >
      <h3 class="legend-group-title">
        {{ MIX_GROUP_LABELS[group] }}
      </h3>

      <div class="legend-items">
        <button
          v-for="sourceKey in getSourcesForGroup(group)"
          :key="sourceKey"
          type="button"
          class="legend-chip"
          :class="{
            'legend-chip--active': isSourceActive(sourceKey),
            'legend-chip--dimmed': isSourceDisabled(sourceKey),
          }"
          :disabled="isSourceDisabled(sourceKey)"
          :aria-pressed="isSourceActive(sourceKey)"
          @click="handleSelect(sourceKey)"
        >
          <span
            class="legend-color"
            :style="{ backgroundColor: activeColors[sourceKey] }"
            aria-hidden="true"
          />

          <span class="legend-label">
            {{ MIX_LABELS[sourceKey] }}
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.stacked-area-legend {
  margin-top: 32px;
}

.stacked-area-legend + :deep(*) {
  margin-top: 32px;
}

.legend-group {
  margin-bottom: 18px;
}

.legend-group:last-child {
  margin-bottom: 0;
}

.legend-group-title {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  margin: 0 0 4px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.legend-chip:hover {
  color: var(--fg);
  border-color: var(--fg-muted);
}

.legend-chip--active {
  color: var(--fg);
  border-color: var(--accent);
  background: rgba(45, 106, 79, 0.06);
}

.legend-chip--dimmed {
  opacity: 0.4;
}

.legend-chip:disabled {
  cursor: default;
  opacity: 0.4;
  pointer-events: none;
}

.legend-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.legend-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  font-weight: 400;
}

.legend-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--fg-muted);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  margin: 20px 0 8px;
  font-style: normal;
}

.legend-hint-arrow {
  font-size: 11px;
  opacity: 0.6;
}

.legend-all-button {
  margin-bottom: 20px;
}

.legend-all-colors {
  display: inline-flex;
  gap: 2px;
}

.legend-all-color {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-all-color--renewable {
  background-color: #4fa8a0;
}

.legend-all-color--nuclear {
  background-color: #8e5a9e;
}

.legend-all-color--fossil {
  background-color: #8a5a3c;
}
</style>
