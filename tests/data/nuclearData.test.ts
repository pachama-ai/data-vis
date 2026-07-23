/**
 * tests/unit/nuclear-data.test.ts
 *
 * Prüft die Kernenergie-Monatswerte ab April 2023.
 */

import { describe, it, expect } from 'vitest'
import { useMixData } from '~/composables/useMixData'
import type { MixMonthRow } from '~/types/mix'

describe('Kernenergie ab April 2023', () => {
  it('April 2023 enthält einen positiven Kernenergie-Wert', async () => {
    // Lade echte Daten
    const { loadData, monthRows } = useMixData()
    await loadData()

    const aprilRow: MixMonthRow | undefined = monthRows.value.find(
      (row) => row.month === '2023-04',
    )

    expect(aprilRow).toBeDefined()
    expect(aprilRow!.values.nuclear).toBeGreaterThan(0)
  })

  it('ab Mai 2023 sind alle Kernenergie-Werte exakt null', async () => {
    const { loadData, monthRows } = useMixData()
    await loadData()

    const monthsAfterApril: MixMonthRow[] = monthRows.value.filter(
      (row) => {
        return (
          row.month.localeCompare('2023-05') >= 0 &&
          row.month.localeCompare('2024-12') <= 0
        )
      },
    )

    for (const monthRow of monthsAfterApril) {
      expect(monthRow.values.nuclear).toBe(0)
    }
  })
})
