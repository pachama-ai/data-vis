/**
 * Schaltet stärkere Farben und Kontraste ein oder aus.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'
import { useMixSelection } from '~/composables/useMixSelection'

const isActive = ref(false)

/**
 * Composable zum Umschalten zwischen normalem und kontrastreichem
 * Farbmodus. Setzt ein data-Attribut auf dem <html>-Element und
 * aktualisiert den Farbmodus in useMixSelection.
 *
 * @returns Objekt mit isActive, toggle, setActive
 */
export function useHighContrast() {
  /**
   * Übernimmt den aktuellen Kontrastmodus.
   */
  function apply(): void {
    if (import.meta.client) {
      document.documentElement.dataset.contrast = isActive.value ? 'on' : 'off'
    }

    const { setColorMode } = useMixSelection()
    setColorMode(isActive.value ? 'accessible' : 'default')
  }

  /**
   * Schaltet den Kontrastmodus um.
   */
  function toggle(): void {
    isActive.value = !isActive.value
    apply()
  }

  /**
   * Setzt den Kontrastmodus.
   *
   * @param value Neuer Zustand
   */
  function setActive(value: boolean): void {
    isActive.value = value
    apply()
  }

  // Aktuellen Zustand beim Aufruf übernehmen
  apply()

  return {
    isActive,
    toggle,
    setActive,
  }
}