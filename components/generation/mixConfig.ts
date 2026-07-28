/**
 * Gemeinsame Einstellungen für die Strommix-Diagramme
 */

import type { MixGroup, MixSourceKey } from '~/types/energy-mix'

// Reihenfolge der Flächen von unten nach oben
export const STACK_ORDER: MixSourceKey[] = [
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
]

// Namen der Energieträger
export const MIX_LABELS: {
  hydro: string
  biomass: string
  wind_offshore: string
  wind_onshore: string
  pv: string
  nuclear: string
  gas: string
  other_fossil: string
  hardcoal: string
  lignite: string
} = {
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

// Farben
export const MIX_COLORS: {
  hydro: string
  biomass: string
  wind_offshore: string
  wind_onshore: string
  pv: string
  nuclear: string
  gas: string
  other_fossil: string
  hardcoal: string
  lignite: string
} = {
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

export const MIX_COLORS_ACCESSIBLE: {
  hydro: string
  biomass: string
  wind_offshore: string
  wind_onshore: string
  pv: string
  nuclear: string
  gas: string
  other_fossil: string
  hardcoal: string
  lignite: string
} = {
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

// Gruppen der Energieträger
export const GROUP_OF: {
  hydro: MixGroup
  biomass: MixGroup
  wind_offshore: MixGroup
  wind_onshore: MixGroup
  pv: MixGroup
  nuclear: MixGroup
  gas: MixGroup
  other_fossil: MixGroup
  hardcoal: MixGroup
  lignite: MixGroup
} = {
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

// Reihenfolge und Namen der Gruppen
export const MIX_GROUP_ORDER: MixGroup[] = [
  'renewable',
  'nuclear',
  'fossil',
]

export const MIX_GROUP_LABELS: {
  renewable: string
  nuclear: string
  fossil: string
} = {
  renewable: 'Erneuerbare Energien',
  nuclear: 'Kernenergie',
  fossil: 'Fossile Energieträger',
}
