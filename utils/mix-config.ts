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
  hydro: '#6b8f5e',
  biomass: '#86a86f',
  wind_offshore: '#9dbb85',
  wind_onshore: '#b8cfa2',
  pv: '#d9c47a',
  nuclear: '#b8709a',
  gas: '#c2a173',
  other_fossil: '#d4c3a5',
  hardcoal: '#7a6248',
  lignite: '#a37348',
}

/**
 * Kontrastreiche Alternative (Okabe-Ito-Palette) für Farbfehlsichtigkeit.
 * Blau-Orange-Achse statt Grün-Braun, mit Helligkeitsabstufungen.
 */
export const MIX_COLORS_ACCESSIBLE: Record<MixSourceKey, string> = {
  hydro: '#0d3b66',
  biomass: '#1a6f8f',
  wind_offshore: '#56b4e9',
  wind_onshore: '#a6dcf5',
  pv: '#f0e442',
  nuclear: '#cc79a7',
  gas: '#e69f00',
  other_fossil: '#d9cdbf',
  hardcoal: '#4a4a4a',
  lignite: '#d55e00',
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
