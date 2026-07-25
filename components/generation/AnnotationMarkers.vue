<script setup lang="ts">
/**
 * Zeigt die auswählbaren Ereignisse unter dem Diagramm.
 *
 * Jede Zahl steht für ein Ereignis im Zeitverlauf.
 * Beim Anklicken wird das Ereignis an die übergeordnete
 * Komponente weitergegeben.
 *
 * @author Selina Schneider
 */

import type { MixAnnotation } from '~/types/mix'

/**
 * Daten für die Ereignisnavigation.
 */
interface AnnotationMarkersProps {
  /** Ereignisse, die angezeigt werden */
  annotations: MixAnnotation[]

  /** ID des ausgewählten Ereignisses */
  selectedAnnotation: number | null
}

defineProps<AnnotationMarkersProps>()

const emit = defineEmits<{
  select: [annotation: MixAnnotation]
}>()

/**
 * Gibt das angeklickte Ereignis weiter.
 *
 * @param annotation Ausgewähltes Ereignis
 */
function handleSelect(
  annotation: MixAnnotation,
): void {
  emit('select', annotation)
}

/**
 * Baut den Hinweistext unter den Ereignisbuttons zusammen.
 *
 * Am Anfang stand dieser Text direkt im HTML-Teil der
 * Komponente. Das sah ungefähr so aus:
 *
 *   {{ selectedAnnotation === null
 *     ? 'Ereignis im Zeitverlauf anzeigen'
 *     : 'Erneut anklicken, um die Auswahl aufzuheben' }}
 *
 * Das war nicht schlimm, aber wenn ich den Text ändern
 * wollte, musste ich in der Vorlage suchen. Außerdem
 * wurde die Zeile mit jedem weiteren Text länger.
 *
 * KI hat mir vorgeschlagen, die Logik in eine eigene
 * Funktion zu legen. Der Vorteil ist: Ich sehe auf einen
 * Blick, was passiert. Und wenn ich den Text umformuliere,
 * muss ich nur hier ändern, nicht im HTML-Teil.
 *
 * @param selectedId ID des ausgewählten Ereignisses
 * @returns Hinweistext für die aktuelle Auswahl
 */
function getHelpText(
  selectedId: number | null,
): string {
  if (selectedId === null) {
    return 'Ereignis im Zeitverlauf anzeigen'
  }

  return 'Erneut anklicken, um die Auswahl aufzuheben'
}
</script>

<template>
  <div
    class="annotation-navigation"
    aria-label="Ereignis auswählen"
  >
    <!-- Nummerierte Auswahl der Ereignisse -->
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
        :aria-pressed="
          selectedAnnotation === annotation.id
        "
        @click="handleSelect(annotation)"
      >
        {{ annotation.id }}
      </button>
    </div>

    <!-- Hinweis zur Bedienung -->
    <p class="annotation-help">
      {{ getHelpText(selectedAnnotation) }}
    </p>
  </div>
</template>

<style scoped>
/* Gesamter Bereich der Ereignisnavigation. */
.annotation-navigation {
  width: 100%;
}

/* Ordnet die nummerierten Buttons an. */
.annotation-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/*
 * Grundform eines Ereignisbuttons.
 */
.annotation-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--muted-text-color);
  border-radius: 50%;
  background: transparent;
  color: var(--muted-text-color);
  font-family: var(--sans-font);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.annotation-button:hover {
  border-color: var(--text-color);
  background: rgba(45, 106, 79, 0.08);
  color: var(--text-color);
}

/* Markiert das ausgewählte Ereignis. */
.annotation-button--active {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: #ffffff;
}

/*
 * Zeigt den Tastaturfokus deutlich an.
 */
.annotation-button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Hinweis unter den Ereignisbuttons. */
.annotation-help {
  margin: 6px 0 0;
  color: var(--muted-text-color);
  font-size: 0.72rem;
  line-height: 1.4;
}
</style>