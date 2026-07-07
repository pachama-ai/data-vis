/**
 * composables/useDashboardPreload.ts
 * ====================================
 * Lädt Dashboard-Daten im Hintergrund vor, während die Landing Page
 * angezeigt wird. Nutzt den bereits vorhandenen useData()-Cache,
 * sodass das Dashboard später keinen Fetch mehr braucht.
 *
 * Priorität:
 *   1. yearly_mix.json (klein, ~4 kB) – sofort
 *   2. hourly_2015_2024.json (groß, ~32 MB) – nach requestIdleCallback
 *
 * Fehler beim Preload dürfen die Landing Page nicht beeinträchtigen.
 */

import { onMounted } from 'vue'
import { useData } from './useData'

export function useDashboardPreload() {
  const { loadYearly, loadHourly } = useData()

  onMounted(() => {
    // 1. Jahres-Daten sofort laden (klein, wichtig für Dashboard-KPIs)
    loadYearly().catch(() => {
      if (import.meta.dev) console.warn('[Preload] yearly_mix.json fehlgeschlagen')
    })

    // 2. Stunden-Daten nach requestIdleCallback laden (groß)
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        loadHourly().catch(() => {
          if (import.meta.dev) console.warn('[Preload] hourly_2015_2024.json fehlgeschlagen')
        })
      }, { timeout: 5000 })
    } else {
      // Fallback für Browser ohne requestIdleCallback
      setTimeout(() => {
        loadHourly().catch(() => {
          if (import.meta.dev) console.warn('[Preload] hourly_2015_2024.json fehlgeschlagen')
        })
      }, 2000)
    }
  })
}
