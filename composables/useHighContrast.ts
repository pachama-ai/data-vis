/**
 * composables/useHighContrast.ts – Globaler Kontrastmodus.
 *
 * Ein/Aus-Schalter für kräftigere Farben und stärkere Kontraste.
 * Der Wert wird als Modul-Variable (ref) gehalten, damit er beim
 * Seitenwechsel erhalten bleibt.
 *
 * Setzt dataset.contrast auf dem Wurzelelement, damit CSS global
 * reagieren kann, und synchronisiert den Chart-Farbmodus über
 * useMixSelection.
 */

import { ref } from 'vue'
import { useMixSelection } from '~/composables/useMixSelection'

const isActive = ref(false)

export function useHighContrast() {
  function toggle(): void {
    isActive.value = !isActive.value
    apply()
  }

  function setActive(value: boolean): void {
    isActive.value = value
    apply()
  }

  function apply(): void {
    // CSS-Kontrast-Token umschalten
    if (import.meta.client) {
      document.documentElement.dataset.contrast = isActive.value ? 'on' : 'off'
    }

    // Chart-Farbmodus synchronisieren
    const { setColorMode } = useMixSelection()
    setColorMode(isActive.value ? 'accessible' : 'default')
  }

  // Initial anwenden
  if (import.meta.client) {
    document.documentElement.dataset.contrast = isActive.value ? 'on' : 'off'
  }

  return {
    isActive,
    toggle,
    setActive,
  }
}
