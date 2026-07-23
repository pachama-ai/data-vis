/**
 * tests/unit/GroupedBarChart.filter.test.ts
 * ==========================================
 * Unit-Tests für die toggleCategoryFilter-Funktion.
 *
 * Die Filter-Funktion steuert, welche Kategorie im Chart angezeigt wird.
 * Ein Klick auf einen Energieträger filtert die Anzeige auf dessen
 * Kategorie (erneuerbar, fossil, kernkraft). Ein erneuter Klick
 * schaltet den Filter wieder aus.
 */

import { describe, it, expect } from 'vitest'
import { toggleCategoryFilter } from '~/components/home/groupedBarUtils'
import type { EnergyCategory } from '~/components/home/groupedBarUtils'

// =========================================================================
// toggleCategoryFilter
// =========================================================================

// Testet das Umschalten des Kategoriefilters.
// Wichtig, weil die Filter-Logik die Interaktivität des Charts steuert.
// Die Funktion ist bewusst als reine Funktion ohne Vue-Ref-Zugriff
// implementiert, damit sie isoliert testbar ist.

describe('toggleCategoryFilter', () => {

  it('setzt Filter auf fossil, wenn kein Filter aktiv ist und fossil geklickt wird', () => {
    const currentFilter: EnergyCategory | null = null
    const result = toggleCategoryFilter(currentFilter, 'fossil')
    expect(result).toBe('fossil')
  })

  it('setzt Filter auf null, wenn fossil aktiv ist und fossil geklickt wird', () => {
    const currentFilter: EnergyCategory | null = 'fossil'
    const result = toggleCategoryFilter(currentFilter, 'fossil')
    expect(result).toBeNull()
  })

  it('wechselt von fossil zu erneuerbar, wenn erneuerbar geklickt wird', () => {
    const currentFilter: EnergyCategory | null = 'fossil'
    const result = toggleCategoryFilter(currentFilter, 'erneuerbar')
    expect(result).toBe('erneuerbar')
  })

  it('wechselt von erneuerbar zu kernkraft, wenn kernkraft geklickt wird', () => {
    const currentFilter: EnergyCategory | null = 'erneuerbar'
    const result = toggleCategoryFilter(currentFilter, 'kernkraft')
    expect(result).toBe('kernkraft')
  })

  it('setzt Filter auf null, wenn kernkraft aktiv ist und kernkraft geklickt wird', () => {
    const currentFilter: EnergyCategory | null = 'kernkraft'
    const result = toggleCategoryFilter(currentFilter, 'kernkraft')
    expect(result).toBeNull()
  })
})
