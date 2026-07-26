/**
 * composables/usePageZoom.ts – Gemeinsamer Zustand für den Seiten-Zoom.
 *
 * Drei Stufen: 100 %, 105 %, 110 %. Zyklisch durchgeschaltet.
 * Setzt CSS `zoom` auf dem Wurzelelement, sodass die gesamte Seite
 * vergrößert wird (ähnlich wie Strg++ im Browser).
 *
 * Der Zustand wird als Modul-Variable (`ref` außerhalb der Funktion)
 * gehalten, damit er beim Seitenwechsel erhalten bleibt.
 *
 * KI-Hinweis: Diese Datei ist komplett mit KI-Unterstützung entstanden.
 * Ich hatte die Anforderung „User sollen die Seite in kleinen Stufen
 * größer schalten können, ohne dass ich in jedes einzelne CSS eingreife"
 * formuliert – Aufbau (Modul-Level-ref für seitenübergreifenden State,
 * Nutzung von `document.documentElement.style.zoom`, das Umschalten
 * über eine feste Stufenliste und das Absichern mit `import.meta.client`
 * für SSR) kam aus der Antwort. Angeschaut und geprüft habe ich danach
 * vor allem:
 *   - dass `zoom` in den Ziel-Browsern des Projekts funktioniert (Chrome,
 *     Safari, aktuelle Firefox-Versionen),
 *   - dass der Wechsel wirklich alle Diagramme mitskaliert und das
 *     Layout nicht bricht,
 *   - dass die 100 %-Stufe den Style-Wert bewusst zurücksetzt statt
 *     „100 %" zu schreiben, damit im DOM nichts hängen bleibt.
 *
 * Diese KI-Nutzung muss in Dokumentation und Eigenständigkeitserklärung
 * genannt werden.
 *
 * @author Selina Schneider
 */

import { ref } from 'vue'

/** Die drei erlaubten Zoom-Stufen in Prozent. */
const ZOOM_LEVELS = [100, 105, 110] as const

/**
 * Aktuelle Stufe. Bewusst auf Modul-Ebene (nicht in der Composable-
 * Funktion), damit sich der Zustand beim Seitenwechsel und zwischen
 * verschiedenen Komponenten teilt.
 */
const currentLevel = ref<number>(100)

export type ZoomLevel = (typeof ZOOM_LEVELS)[number]

export function usePageZoom() {
  function cycle(): void {
    const currentIndex = ZOOM_LEVELS.indexOf(currentLevel.value as 100 | 105 | 110)
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

  // Initial anwenden, wenn der Modul-State schon eine höhere Stufe hat
  // (Fall: der User wechselt die Seite und das Composable wird auf der
  // neuen Seite neu aufgerufen – dann muss der Zoom auch dort greifen).
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