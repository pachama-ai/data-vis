<script setup lang="ts">
/**
 * AnnotationMarkers.vue – Ereignisnavigation für die Sidebar.
 *
 * Zeigt fünf nummerierte Buttons.
 * Keine Pixelpositionen, keine Chartkoordinaten.
 * Die vollständige Beschreibung erscheint in der Sidebar.
 */

import { ref } from 'vue'

import type { MixAnnotation } from '~/types/mix'

defineProps<{
  annotations: MixAnnotation[]
  selectedAnnotation: number | null
}>()

const emit = defineEmits<{
  select: [annotation: MixAnnotation]
}>()

const hoveredAnnotationId = ref<number | null>(null)

function handleSelect(annotation: MixAnnotation): void {
  emit('select', annotation)
}
</script>

<template>
  <div
    class="annotation-navigation"
    aria-label="Ereignis auswählen"
  >
    <div class="annotation-buttons">
      <button
        v-for="annotation in annotations"
        :key="annotation.id"
        type="button"
        class="annotation-button"
        :class="{
          'annotation-button--active':
            selectedAnnotation === annotation.id,
        }"
        :aria-label="annotation.title"
        :aria-pressed="selectedAnnotation === annotation.id"
        @pointerenter="hoveredAnnotationId = annotation.id"
        @pointerleave="hoveredAnnotationId = null"
        @focus="hoveredAnnotationId = annotation.id"
        @blur="hoveredAnnotationId = null"
        @click="handleSelect(annotation)"
      >
        {{ annotation.id }}
      </button>
    </div>

    <p class="sidebar-eyebrow">Wichtige Zeitpunkte</p>

    <p class="annotation-help">
      {{ selectedAnnotation === null ? 'Zahl anklicken, um den Zeitpunkt im Chart zu markieren' : 'Nochmal klicken, um wieder alle Energieträger zu sehen' }}
    </p>
  </div>
</template>

<style scoped>
.annotation-navigation {
  width: 100%;
}

.annotation-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.annotation-button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--fg-muted);
  border-radius: 50%;
  background: transparent;
  color: var(--fg-muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}

.annotation-button:hover {
  background: rgba(45, 106, 79, 0.08);
  color: var(--fg);
  border-color: var(--fg);
}

.annotation-button--active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.annotation-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.annotation-help {
  margin: 6px 0 0;
  color: var(--fg-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}
</style>
