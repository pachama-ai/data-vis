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
  hydro: '#1b4468',
  biomass: '#2b7a9b',
  wind_offshore: '#6bb3d6',
  wind_onshore: '#b3d9ea',
  pv: '#ddd45c',
  nuclear: '#c084a8',
  gas: '#d9a442',
  other_fossil: '#ddd4c6',
  hardcoal: '#55555a',
  lignite: '#c4703f',
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
