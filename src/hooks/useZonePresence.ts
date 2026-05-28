/**
 * Monitors zone presence and handles stay-too-long alerts.
 * Works alongside useLocationTracker — reads current location from store.
 */
import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { isInsideCircle } from '@/utils/distance';
import { isInsidePolygon } from '@/utils/polygon';

export function useZonePresence() {
  // This hook is intentionally lightweight — the heavy lifting is in useLocationTracker.
  // It provides zone presence state for UI components.
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const myLocation = useMapStore((s) => s.myLocation);

  const insideZones = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!myLocation) return;
    const { latitude, longitude } = myLocation;

    for (const zone of savedPlaces) {
      const inside =
        zone.shape_type === 'polygon'
          ? isInsidePolygon({ latitude, longitude }, zone.polygon_coords)
          : isInsideCircle({ latitude, longitude }, { latitude: zone.latitude, longitude: zone.longitude }, zone.radius_meters);
      insideZones.current[zone.id] = inside;
    }
  }, [myLocation, savedPlaces]);

  return { insideZones: insideZones.current };
}
