/**
 * utils/mix-config.ts – Konfiguration für das Stacked-Area-Chart.
 *
 * Enthält ausschließlich Konstanten: Stack-Reihenfolge, Labels,
 * Farben, Gruppenzuordnung. Keine Datenumwandlung, kein D3, kein Vue.
 */

import type { MixGroup, MixSourceKey } from '~/types/mix'

// =========================================================================
// Stack-Reihenfolge (von unten nach oben)
// =========================================================================

/**
 * Reihenfolge der Energieträger im Stack, von unten nach oben.
 * Erneuerbare unten, Kernenergie in der Mitte, fossile oben.
 */
export const STACK_ORDER: readonly MixSourceKey[] = [
  'hydro',
  'biomass',
  'wind_offshore',
  'wind_onshore',
  'pv',
  'nuclear',
  'other_fossil',
  'gas',
  'hardcoal',
  'lignite',
] as const

// =========================================================================
// Labels (deutsche Anzeigenamen)
// =========================================================================

export const MIX_LABELS: Record<MixSourceKey, string> = {
  hydro: 'Wasserkraft',
  biomass: 'Biomasse',
  wind_offshore: 'Wind Offshore',
  wind_onshore: 'Windenergie an Land',
  pv: 'Photovoltaik',
  nuclear: 'Kernenergie',
  gas: 'Erdgas',
  other_fossil: 'Sonstige Konventionelle',
  hardcoal: 'Steinkohle',
  lignite: 'Braunkohle',
}

// =========================================================================
// Farben
// =========================================================================

export const MIX_COLORS: Record<MixSourceKey, string> = {
  hydro: '#4a7c59',
  biomass: '#6b9e6b',
  wind_offshore: '#9ac088',
  wind_onshore: '#c8dcb0',
  pv: '#dfb54a',
  nuclear: '#b0648f',
  gas: '#cc9a52',
  other_fossil: '#e3d9c6',
  hardcoal: '#5c5147',
  lignite: '#9d6234',
}

/**
 * Kontrastpalette für Farbfehlsichtigkeit.
 * Blaugrün-verschobene Grüntöne, Helligkeitsabstufungen.
 */
export const MIX_COLORS_ACCESSIBLE: Record<MixSourceKey, string> = {
  hydro: '#1a3f5c',
  biomass: '#3d7d5a',
  wind_offshore: '#4a90b8',
  wind_onshore: '#a8cfe0',
  pv: '#e8c547',
  nuclear: '#c2669b',
  gas: '#d2833c',
  other_fossil: '#ddd8cc',
  hardcoal: '#3f3f44',
  lignite: '#8b5a2b',
}

// =========================================================================
// Gruppenzuordnung
// =========================================================================

export const GROUP_OF: Record<MixSourceKey, MixGroup> = {
  hydro: 'renewable',
  biomass: 'renewable',
  wind_offshore: 'renewable',
  wind_onshore: 'renewable',
  pv: 'renewable',
  nuclear: 'nuclear',
  gas: 'fossil',
  other_fossil: 'fossil',
  hardcoal: 'fossil',
  lignite: 'fossil',
}

// =========================================================================
// Gruppen-Reihenfolge und -Labels
// =========================================================================

export const MIX_GROUP_ORDER: readonly MixGroup[] = [
  'renewable',
  'nuclear',
  'fossil',
] as const

export const MIX_GROUP_LABELS: Record<MixGroup, string> = {
  renewable: 'Erneuerbare Energien',
  nuclear: 'Kernenergie',
  fossil: 'Fossile Energieträger',
}
