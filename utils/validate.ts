/**
 * validate.ts – Laufzeit-Prüfung für JSON-Daten.
 *
 * Stellt sicher, dass NaN-Werte nicht unbemerkt durch die Pipeline rutschen.
 * Wird vor allem nach dem Daten-Loading und in Tests verwendet.
 */

import type { HourlyRow, YearlyRow } from '~/composables/useData'

export function isValidHourlyRow(value: unknown): value is HourlyRow {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.timestamp === 'number' &&
    typeof r.co2_g_per_kwh === 'number' && isFinite(r.co2_g_per_kwh) &&
    typeof r.ee_share === 'number' && isFinite(r.ee_share) &&
    typeof r.price_eur_mwh === 'number' && isFinite(r.price_eur_mwh) &&
    typeof r.load_mwh === 'number' &&
    r.generation_by_source !== null && typeof r.generation_by_source === 'object'
  )
}

export function isValidHourlyData(data: unknown): data is HourlyRow[] {
  return Array.isArray(data) && data.length > 0 && data.every(isValidHourlyRow)
}

export function isValidYearlyRow(value: unknown): value is YearlyRow {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.year === 'number' &&
    typeof r.avg_co2 === 'number' && isFinite(r.avg_co2) &&
    typeof r.avg_ee_share === 'number' && isFinite(r.avg_ee_share)
  )
}
