/**
 * Gemeinsamer Zustand für den Seiten-Zoom.
 *
 * Die Seite kann auf 100 %, 105 % oder 110 % vergrößert werden
 * Der Zustand bleibt beim Wechsel zwischen den Seiten erhalten.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'

/** Erlaubte Zoom-Stufen */
const ZOOM_LEVELS = [100, 105, 110] as const

type ZoomLevel = (typeof ZOOM_LEVELS)[number]

/** Aktuell ausgewählte Zoom-Stufe */
const currentLevel = ref<ZoomLevel>(100)

/**
 * Steuert den Zoom der gesamten Seite.
 */
export function usePageZoom() {
  /**
   * Wendet die aktuelle Zoom-Stufe auf die Seite an.
   */
  function applyZoom(): void {
    if (!import.meta.client) {
      return
    }

    document.documentElement.style.zoom =
      currentLevel.value === 100
        ? ''
        : `${currentLevel.value}%`
  }

  /**
   * Wechselt zur nächsten Zoom-Stufe.
   */
  function cycleZoom(): void {
    const currentIndex = ZOOM_LEVELS.indexOf(currentLevel.value)
    const nextIndex = (currentIndex + 1) % ZOOM_LEVELS.length

    const nextLevel = ZOOM_LEVELS[nextIndex]

    if (nextLevel !== undefined) {
      currentLevel.value = nextLevel
    }

    applyZoom()
  }

  /**
   * Setzt eine bestimmte Zoom-Stufe.
   *
   * @param level Neue Zoom-Stufe
   */
  function setZoomLevel(level: ZoomLevel): void {
    currentLevel.value = level
    applyZoom()
  }

  return {
    level: currentLevel,
    zoomLevels: ZOOM_LEVELS,
    cycleZoom,
    setZoomLevel,
  }
}