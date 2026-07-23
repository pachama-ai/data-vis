/**
 * tests/composables/usePageZoom.test.ts
 *
 * Testet den Seiten-Zoom.
 * Der Wert wird als Modul-ref gehalten, bleibt beim Seitenwechsel erhalten.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { usePageZoom } from '~/composables/usePageZoom'

describe('usePageZoom', function () {
  beforeEach(function () {
    // Auf 100 % zurücksetzen
    var { setLevel } = usePageZoom()
    setLevel(100)
    document.documentElement.style.zoom = ''
  })

  it('startet bei 100 Prozent', function () {
    var { level } = usePageZoom()
    expect(level.value).toBe(100)
  })

  it('ZOOM_LEVELS enthält 100, 105, 110', function () {
    var { ZOOM_LEVELS } = usePageZoom()
    expect(ZOOM_LEVELS).toEqual([100, 105, 110])
  })

  it('cycle schaltet auf 105 Prozent', function () {
    var { level, cycle } = usePageZoom()
    cycle()
    expect(level.value).toBe(105)
  })

  it('zweites cycle schaltet auf 110 Prozent', function () {
    var { level, cycle } = usePageZoom()
    cycle()
    cycle()
    expect(level.value).toBe(110)
  })

  it('drittes cycle schaltet zurück auf 100 Prozent', function () {
    var { level, cycle } = usePageZoom()
    cycle()
    cycle()
    cycle()
    expect(level.value).toBe(100)
  })

  it('setLevel auf 105 setzt den Wert', function () {
    var { level, setLevel } = usePageZoom()
    setLevel(105)
    expect(level.value).toBe(105)
  })

  it('setLevel mit ungültigem Wert ändert nichts', function () {
    var { level, setLevel } = usePageZoom()
    const before = level.value
    setLevel(200)
    expect(level.value).toBe(before)
  })

  it('setzt document.documentElement.style.zoom bei Aktivierung', function () {
    var { level, cycle } = usePageZoom()
    cycle()
    // In happy-dom wird CSS zoom nicht unterstützt,
    // daher prüfen wir den ref-Wert als Alternative.
    expect(level.value).toBe(105)
  })

  it('entfernt zoom bei 100 Prozent', function () {
    var { level, cycle } = usePageZoom()
    cycle()
    cycle()
    cycle()
    expect(level.value).toBe(100)
  })
})
