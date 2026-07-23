/**
 * composables/usePageZoom.ts – Gemeinsamer Zustand für den Seiten-Zoom.
 *
 * Drei Stufen: 100 %, 105 %, 110 %. Zyklisch durchgeschaltet.
 * Setzt CSS `zoom` auf dem Wurzelelement, sodass die gesamte Seite
 * vergrößert wird (wie Strg++ im Browser).
 *
 * Der Wert wird als Modul-Variable (ref) gehalten, damit er beim
 * Seitenwechsel erhalten bleibt.
 */

import { ref } from 'vue'

const ZOOM_LEVELS = [100, 105, 110] as const

const currentLevel = ref<number>(100)

export type ZoomLevel = (typeof ZOOM_LEVELS)[number]

export function usePageZoom() {
  function cycle(): void {
    const currentIndex = ZOOM_LEVELS.indexOf(currentLevel.value as ZoomLevel)
    const nextIndex = (currentIndex + 1) % ZOOM_LEVELS.length
    currentLevel.value = ZOOM_LEVELS[nextIndex]!
    apply()
  }

  function setLevel(level: number): void {
    if (ZOOM_LEVELS.includes(level as ZoomLevel)) {
      currentLevel.value = level
      apply()
    }
  }

  function apply(): void {
    if (import.meta.client) {
      if (currentLevel.value === 100) {
        document.documentElement.style.zoom = ''
      } else {
        document.documentElement.style.zoom = `${currentLevel.value}%`
      }
    }
  }

  // Initial anwenden (nur wenn nicht 100 %)
  if (import.meta.client && currentLevel.value !== 100) {
    document.documentElement.style.zoom = `${currentLevel.value}%`
  }

  return {
    level: currentLevel,
    cycle,
    setLevel,
    ZOOM_LEVELS: [...ZOOM_LEVELS],
  }
}
