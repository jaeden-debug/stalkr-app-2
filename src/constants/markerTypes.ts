import type { MarkerType } from '@/types/database';

export interface MarkerTypeConfig {
  type: MarkerType;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

export const MARKER_TYPE_CONFIGS: Record<MarkerType, MarkerTypeConfig> = {
  waypoint: {
    type: 'waypoint',
    label: 'Waypoint',
    emoji: '📍',
    color: '#3b82f6',
    description: 'General waypoint or point of interest',
  },
  danger: {
    type: 'danger',
    label: 'Danger',
    emoji: '⚠️',
    color: '#ef4444',
    description: 'Hazard, dangerous area, or warning',
  },
  safe_zone: {
    type: 'safe_zone',
    label: 'Safe Zone',
    emoji: '🛡️',
    color: '#22c55e',
    description: 'Known safe area or meeting point',
  },
  camp: {
    type: 'camp',
    label: 'Camp',
    emoji: '⛺',
    color: '#f59e0b',
    description: 'Campsite or base camp location',
  },
  vehicle: {
    type: 'vehicle',
    label: 'Vehicle',
    emoji: '🚗',
    color: '#6b7280',
    description: 'Parked vehicle or equipment',
  },
  animal_sign: {
    type: 'animal_sign',
    label: 'Animal Sign',
    emoji: '🦌',
    color: '#92400e',
    description: 'Animal tracks, signs, or sightings',
  },
  evidence: {
    type: 'evidence',
    label: 'Evidence',
    emoji: '🔍',
    color: '#7c3aed',
    description: 'Evidence, find, or notable discovery',
  },
  supply_cache: {
    type: 'supply_cache',
    label: 'Supply Cache',
    emoji: '📦',
    color: '#0891b2',
    description: 'Cached supplies, water, or gear',
  },
  custom: {
    type: 'custom',
    label: 'Custom',
    emoji: '📌',
    color: '#ec4899',
    description: 'Custom marker',
  },
};

export const MARKER_TYPES = Object.values(MARKER_TYPE_CONFIGS);

export function getMarkerConfig(type: MarkerType): MarkerTypeConfig {
  return MARKER_TYPE_CONFIGS[type] ?? MARKER_TYPE_CONFIGS.waypoint;
}
