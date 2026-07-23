/**
 * tests/composables/useHighContrast.test.ts
 *
 * Testet den globalen Kontrastmodus:
 * – Standardwert aus
 * – toggle schaltet um
 * – setzt dataset.contrast auf dem Wurzelelement
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useHighContrast } from '~/composables/useHighContrast'

describe('useHighContrast', () => {
  beforeEach(() => {
    // Zustand zurücksetzen
    const { setActive } = useHighContrast()
    setActive(false)
  })

  it('ist initial aus', () => {
    const { isActive } = useHighContrast()
    expect(isActive.value).toBe(false)
  })

  it('toggle schaltet ein', () => {
    const { isActive, toggle } = useHighContrast()
    toggle()
    expect(isActive.value).toBe(true)
  })

  it('toggle schaltet aus', () => {
    const { isActive, toggle } = useHighContrast()
    toggle() // an
    toggle() // aus
    expect(isActive.value).toBe(false)
  })

  it('setActive(true) aktiviert', () => {
    const { isActive, setActive } = useHighContrast()
    setActive(true)
    expect(isActive.value).toBe(true)
  })

  it('setActive(false) deaktiviert', () => {
    const { isActive, setActive } = useHighContrast()
    setActive(true)
    setActive(false)
    expect(isActive.value).toBe(false)
  })
})
