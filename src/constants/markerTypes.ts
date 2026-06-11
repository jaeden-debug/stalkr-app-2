import type { MarkerType } from '@/types/database';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface MarkerTypeConfig {
  type: MarkerType;
  label: string;
  emoji: string;
  /** Ionicons glyph — map pins + nav-drawer quick options share this. */
  ionicon: IoniconName;
  color: string;
  description: string;
}

// Icons + colors match the nav-drawer quick-option picker so map pins look identical.
export const MARKER_TYPE_CONFIGS: Record<MarkerType, MarkerTypeConfig> = {
  waypoint: {
    type: 'waypoint', label: 'Waypoint', emoji: '📍', ionicon: 'pin', color: '#4ADE80',
    description: 'General waypoint or point of interest',
  },
  danger: {
    type: 'danger', label: 'Danger', emoji: '⚠️', ionicon: 'warning', color: '#EF4444',
    description: 'Hazard, dangerous area, or warning',
  },
  safe_zone: {
    type: 'safe_zone', label: 'Safe Zone', emoji: '🛡️', ionicon: 'shield-checkmark', color: '#60A5FA',
    description: 'Known safe area or meeting point',
  },
  camp: {
    type: 'camp', label: 'Camp', emoji: '⛺', ionicon: 'bonfire', color: '#F97316',
    description: 'Campsite or base camp location',
  },
  vehicle: {
    type: 'vehicle', label: 'Vehicle', emoji: '🚗', ionicon: 'car-sport', color: '#FACC15',
    description: 'Parked vehicle or equipment',
  },
  animal_sign: {
    type: 'animal_sign', label: 'Animal Sign', emoji: '🦌', ionicon: 'paw', color: '#A855F7',
    description: 'Animal tracks, signs, or sightings',
  },
  evidence: {
    type: 'evidence', label: 'Evidence', emoji: '🔍', ionicon: 'search', color: '#22D3EE',
    description: 'Evidence, find, or notable discovery',
  },
  supply_cache: {
    type: 'supply_cache', label: 'Supply Cache', emoji: '📦', ionicon: 'cube', color: '#EAB308',
    description: 'Cached supplies, water, or gear',
  },
  custom: {
    type: 'custom', label: 'Custom', emoji: '📌', ionicon: 'add-circle', color: '#FFFFFF',
    description: 'Custom marker',
  },
};

export const MARKER_TYPES = Object.values(MARKER_TYPE_CONFIGS);

export function getMarkerConfig(type: MarkerType): MarkerTypeConfig {
  return MARKER_TYPE_CONFIGS[type] ?? MARKER_TYPE_CONFIGS.waypoint;
}
