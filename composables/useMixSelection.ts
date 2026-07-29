/**
 * Gemeinsamer Auswahlzustand für die Chart-Bedienelemente.
 *
 * Bündelt alle Zustände, die sich mehrere Komponenten teilen: den
 * Modus des Strommix-Diagramms (TWh oder Anteile), den Farbmodus,
 * den hervorgehobenen Energieträger, das ausgewählte Jahr und die
 * ausgewählte Annotation.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'

import type { ColorMode, MixMode, MixSourceKey } from '~/types/energy-mix'


// Modulweite Refs – geteilt von allen Komponenten, die das Composable nutzen.

/** TWh oder Anteile im Strommix-Diagramm. */
const mode = ref<MixMode>('absolute')

/** Standardpalette oder kontrastreichere Palette. */
const colorMode = ref<ColorMode>('default')

/** Aktuell hervorgehobener Energieträger. */
const highlighted = ref<MixSourceKey | null>(null)

/** Ausgewähltes Jahr im Abweichungsdiagramm. */
const selectedYear = ref<number | null>(null)

/** Ausgewählte Annotation im Strommix-Diagramm. */
const selectedAnnotation = ref<number | null>(null)


export function useMixSelection() {
  /**
   * Wechselt zwischen TWh- und Anteils-Darstellung.
   *
   * @param nextMode Neuer Modus
   */
  function setMode(nextMode: MixMode): void {
    mode.value = nextMode
  }

  /**
   * Setzt den Farbmodus.
   *
   * @param nextMode Neuer Farbmodus (default oder accessible)
   */
  function setColorMode(nextMode: ColorMode): void {
    colorMode.value = nextMode
  }

  /**
   * Setzt den hervorgehobenen Energieträger direkt.
   *
   * @param sourceKey Hervorzuhebender Träger oder null zum Zurücksetzen
   */
  function setHighlighted(sourceKey: MixSourceKey | null): void {
    highlighted.value = sourceKey
  }

  /**
   * Schaltet die Hervorhebung eines Trägers um. Ist der Träger schon
   * hervorgehoben, wird die Hervorhebung aufgehoben, sonst wird er neu
   * hervorgehoben.
   *
   * @param sourceKey Umzuschaltender Energieträger
   */
  function toggleHighlighted(sourceKey: MixSourceKey): void {
    if (highlighted.value === sourceKey) {
      highlighted.value = null
      return
    }

    highlighted.value = sourceKey
  }

  /**
   * Schaltet eine Annotation um. Bei erneutem Klick auf dieselbe
   * Annotation wird die Auswahl zurückgesetzt.
   *
   * @param annotationId ID der Annotation
   * @param annotationYear Jahr der Annotation
   */
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

  /**
   * Setzt das ausgewählte Jahr.
   *
   * @param year Jahr oder null zum Zurücksetzen
   */
  function setSelectedYear(year: number | null): void {
    selectedYear.value = year
  }

  /**
   * Setzt die ausgewählte Annotation.
   *
   * @param annotationId ID der Annotation oder null zum Zurücksetzen
   */
  function setSelectedAnnotation(annotationId: number | null): void {
    selectedAnnotation.value = annotationId
  }

  return {
    mode,
    colorMode,
    highlighted,
    selectedYear,
    selectedAnnotation,
    setMode,
    setColorMode,
    setHighlighted,
    toggleHighlighted,
    toggleAnnotation,
    setSelectedYear,
    setSelectedAnnotation,
  }
} 