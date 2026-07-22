/**
 * composables/useMixSelection.ts – Gemeinsamer Chart-Auswahlzustand.
 *
 * Die Refs liegen auf Modulebene, damit alle aufrufenden Komponenten
 * denselben Zustand teilen – ohne Event-Bus oder globale State-Library.
 */

import { ref } from 'vue'

import type { ColorMode, MixMode, MixSourceKey } from '~/types/mix'

// =========================================================================
// Modulweite Refs (geteilter Zustand)
// =========================================================================

const mode = ref<MixMode>('absolute')
const colorMode = ref<ColorMode>('default')
const highlighted = ref<MixSourceKey | null>(null)
const selectedYear = ref<number | null>(null)
const selectedAnnotation = ref<number | null>(null)

// =========================================================================
// Composable
// =========================================================================

export function useMixSelection() {
  function setMode(nextMode: MixMode): void {
    mode.value = nextMode
  }

  function setHighlighted(sourceKey: MixSourceKey | null): void {
    highlighted.value = sourceKey
  }

  function toggleHighlighted(sourceKey: MixSourceKey): void {
    if (highlighted.value === sourceKey) {
      highlighted.value = null
      return
    }

    highlighted.value = sourceKey
  }

  function toggleAnnotation(
    annotationId: number,
    annotationYear: number,
  ): void {
    if (selectedAnnotation.value === annotationId) {
      selectedAnnotation.value = null
      selectedYear.value = null
      return
    }

    selectedAnnotation.value = annotationId
    selectedYear.value = annotationYear
  }

  function setSelectedYear(year: number | null): void {
    selectedYear.value = year
  }

  function setSelectedAnnotation(annotationId: number | null): void {
    selectedAnnotation.value = annotationId
  }

  function setColorMode(nextMode: ColorMode): void {
    colorMode.value = nextMode
  }

  function toggleColorMode(): void {
    colorMode.value = colorMode.value === 'default' ? 'accessible' : 'default'
  }

  return {
    mode,
    colorMode,
    highlighted,
    selectedYear,
    selectedAnnotation,
    setMode,
    setColorMode,
    toggleColorMode,
    setHighlighted,
    toggleHighlighted,
    toggleAnnotation,
    setSelectedYear,
    setSelectedAnnotation,
  }
}
