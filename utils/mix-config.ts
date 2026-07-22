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
  hydro: '#3d6b4a',
  biomass: '#6b9c5e',
  wind_offshore: '#98bd7e',
  wind_onshore: '#c2d6a0',
  pv: '#e8c55f',
  nuclear: '#b5628f',
  gas: '#c99a5e',
  other_fossil: '#ddd0b8',
  hardcoal: '#6b5744',
  lignite: '#9c5f30',
}

/**
 * Entsättigte Kontrastpalette für Farbfehlsichtigkeit.
 * Blau-Orange-Achse, ruhiger als die Okabe-Ito-Originale.
 */
export const MIX_COLORS_ACCESSIBLE: Record<MixSourceKey, string> = {
  hydro: '#2f5d4a',
  biomass: '#4f8a5c',
  wind_offshore: '#7fb185',
  wind_onshore: '#c3dcbc',
  pv: '#d4a234',
  nuclear: '#a8558c',
  gas: '#d99a4e',
  other_fossil: '#e0d6c2',
  hardcoal: '#4a423a',
  lignite: '#a05a2c',
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
