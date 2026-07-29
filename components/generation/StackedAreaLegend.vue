<script setup lang="ts">
/**
 * Klickbare Legende für das gestapelte Flächendiagramm.
 * Zeigt alle zehn Energieträger nach Gruppen geordnet.
 *
 * @author Selina Schneider
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
} from '~/components/generation/mixConfig'

import type { ColorMode, MixGroup, MixSourceKey } from '~/types/energy-mix'

const props = defineProps<{
  /** Vom Nutzer per Hover oder Klick ausgewählter Träger. */
  highlighted: MixSourceKey | null

  /** Von einer Annotation vorgegebene Träger. Überschreibt highlighted, wenn gesetzt. */
  highlightedSources?: MixSourceKey[] | null

  colorMode: ColorMode

  /** Ob eine Annotation aktiv ist – dann wird die Legende gesperrt. */
  hasActiveAnnotation?: boolean
}>()

const emit = defineEmits<{
  select: [sourceKey: MixSourceKey | null]
}>()

// Umschalten zwischen Standard- und Kontrast-Palette.
const activeColors = computed(function () {
  return props.colorMode === 'accessible' ? MIX_COLORS_ACCESSIBLE : MIX_COLORS
})

/**
 * Gibt die Quellen-Schlüssel einer Gruppe in der festgelegten
 * STACK_ORDER-Reihenfolge zurück.
 *
 * @param group Gruppe (erneuerbar, Kernenergie, fossil)
 * @returns Liste der Quellen-Schlüssel in der Gruppe
 */
function getSourcesForGroup(group: MixGroup): MixSourceKey[] {
  const sources: MixSourceKey[] = []

  for (const sourceKey of STACK_ORDER) {
    if (GROUP_OF[sourceKey] === group) {
      sources.push(sourceKey)
    }
  }

  return sources
}

/**
 * Prüft, ob ein Energieträger gerade aktiv hervorgehoben ist.
 * Bei aktiver Annotation zählt die highlightedSources-Liste,
 * sonst der einzelne highlighted-Wert.
 *
 * @param sourceKey Zu prüfender Energieträger
 * @returns true, wenn der Träger aktiv ist
 */
function isSourceActive(sourceKey: MixSourceKey): boolean {
  if (props.hasActiveAnnotation && props.highlightedSources != null) {
    return props.highlightedSources.includes(sourceKey)
  }

  return props.highlighted === sourceKey
}

/**
 * Prüft, ob ein Energieträger bei aktiver Annotation ausgegraut werden soll.
 * Nur die von der Annotation angesprochenen Träger bleiben klar sichtbar.
 *
 * @param sourceKey Zu prüfender Energieträger
 * @returns true, wenn der Träger deaktiviert ist
 */
function isSourceDisabled(sourceKey: MixSourceKey): boolean {
  if (!props.hasActiveAnnotation) {
    return false
  }

  if (props.highlightedSources == null) {
    return false
  }

  return !props.highlightedSources.includes(sourceKey)
}

/**
 * Prüft, ob kein Filter gesetzt ist, also alle Träger anzeigt werden.
 *
 * @returns true, wenn weder Highlight noch Annotation aktiv ist
 */
function isAllActive(): boolean {
  return props.highlightedSources == null && props.highlighted === null
}

/**
 * Gibt den ausgewählten Energieträger an das Dashboard weiter.
 *
 * @param sourceKey Angeklickter Energieträger
 */
function handleSelect(sourceKey: MixSourceKey): void {
  if (isSourceDisabled(sourceKey)) {
    return
  }

  emit('select', sourceKey)
}

/**
 * Setzt die Auswahl zurück, damit wieder alle Träger sichtbar sind.
 */
function handleShowAll(): void {
  if (props.hasActiveAnnotation) {
    return
  }

  emit('select', null)
}
</script>

<template>
  <div
    class="stacked-area-legend"
    aria-label="Energieträger auswählen"
  >
    <button
      type="button"
      class="legend-chip legend-all-button"
      :class="{
        'legend-chip--active': isAllActive(),
      }"
      :aria-pressed="isAllActive()"
      :disabled="hasActiveAnnotation"
      aria-label="Alle Energieträger anzeigen"
      @click="handleShowAll"
    >
      <span
        class="legend-all-colors"
        aria-hidden="true"
      >
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
  font-family: var(--sans-font);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-text-color);
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
  border: 1px solid var(--line-color);
  border-radius: 4px;
  background: transparent;
  font-family: var(--sans-font);
  font-size: 11px;
  color: var(--muted-text-color);
  cursor: pointer;
  transition: all 0.15s;
}

.legend-chip:hover {
  color: var(--text-color);
  border-color: var(--muted-text-color);
}

.legend-chip--active {
  color: var(--text-color);
  border-color: var(--accent-color);
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
  outline: 2px solid var(--accent-color);
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