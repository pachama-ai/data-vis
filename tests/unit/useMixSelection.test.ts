/**
 * tests/unit/useMixSelection.test.ts
 *
 * Testet das gemeinsame Auswahl-Composable.
 * Da die Refs auf Modulebene liegen, teilen mehrere Aufrufe denselben
 * Zustand – das wird in Test 3 explizit geprüft.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useMixSelection } from '~/composables/useMixSelection'

describe('useMixSelection', () => {
  // Vor jedem Test auf Standardmodus und kein Highlight zurücksetzen
  beforeEach(() => {
    const { setMode, setHighlighted, setSelectedAnnotation } = useMixSelection()

    setMode('absolute')
    setHighlighted(null)
    setSelectedAnnotation(null)
  })

  it('startet im Modus absolute', () => {
    const { mode } = useMixSelection()

    expect(mode.value).toBe('absolute')
  })

  it('wechselt zu share bei setMode("share")', () => {
    const { mode, setMode } = useMixSelection()

    setMode('share')

    expect(mode.value).toBe('share')
  })

  it('teilt denselben Zustand zwischen Aufrufen', () => {
    const firstSelection = useMixSelection()
    const secondSelection = useMixSelection()

    firstSelection.setMode('share')

    expect(secondSelection.mode.value).toBe('share')
  })

  it('toggleHighlighted setzt den Quell-Key', () => {
    const { highlighted, toggleHighlighted } = useMixSelection()

    toggleHighlighted('pv')

    expect(highlighted.value).toBe('pv')
  })

  it('toggleHighlighted auf gleiche Quelle hebt Auswahl auf', () => {
    const { highlighted, toggleHighlighted } = useMixSelection()

    toggleHighlighted('pv')
    toggleHighlighted('pv')

    expect(highlighted.value).toBeNull()
  })

  it('toggleHighlighted wechselt zu anderer Quelle', () => {
    const { highlighted, toggleHighlighted } = useMixSelection()

    toggleHighlighted('pv')
    toggleHighlighted('gas')

    expect(highlighted.value).toBe('gas')
  })

  it('toggleAnnotation setzt ausgewählte Annotation', () => {
    const { selectedAnnotation, selectedYear, toggleAnnotation } = useMixSelection()

    toggleAnnotation(1, 2019)

    expect(selectedAnnotation.value).toBe(1)
    expect(selectedYear.value).toBe(2019)
  })

  it('toggleAnnotation mit selber ID hebt Auswahl auf', () => {
    const { selectedAnnotation, selectedYear, toggleAnnotation } = useMixSelection()

    toggleAnnotation(1, 2019)
    toggleAnnotation(1, 2019)

    expect(selectedAnnotation.value).toBeNull()
    expect(selectedYear.value).toBeNull()
  })

  it('toggleAnnotation wechselt zu anderer Annotation', () => {
    const { selectedAnnotation, selectedYear, toggleAnnotation } = useMixSelection()

    toggleAnnotation(1, 2019)
    toggleAnnotation(2, 2021)

    expect(selectedAnnotation.value).toBe(2)
    expect(selectedYear.value).toBe(2021)
  })

  it('toggleAnnotation leeres Jahr bei Übergabe von 0', () => {
    const { selectedAnnotation, selectedYear, toggleAnnotation } = useMixSelection()

    toggleAnnotation(3, 0)

    expect(selectedAnnotation.value).toBe(3)
    expect(selectedYear.value).toBe(0)
  })
})
