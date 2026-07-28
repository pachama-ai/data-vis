import { describe, it, expect } from 'vitest'

import { calculateSharePercent } from '~/pages/homeDataTransform'

// calculateSharePercent berechnet, wie viel Prozent ein Energieträger
// an der Gesamterzeugung ausmacht. Wichtig ist der Schutz bei einer
// Gesamterzeugung von 0 (z. B. wenn Daten fehlen) – ohne diesen Schutz
// würde die Rechnung eine Division durch 0 machen und NaN liefern.
// Genau das prüfe ich hier.
describe('calculateSharePercent', () => {
  it('berechnet den Anteil im Normalfall (30 von 100 -> 30 %)', () => {
    const result = calculateSharePercent(30, 100)

    expect(result).toBe(30)
  })

  it('gibt bei einer Gesamterzeugung von 0 den Wert 0 zurück, nicht NaN', () => {
    // Wenn totalMwh 0 ist, würde 30 / 0 in JavaScript Infinity
    // ergeben. Die Funktion soll stattdessen sauber 0 zurückgeben,
    // damit das Diagramm nicht mit einem ungültigen Wert weiterrechnet.
    const result = calculateSharePercent(30, 0)

    expect(result).toBe(0)
  })
})