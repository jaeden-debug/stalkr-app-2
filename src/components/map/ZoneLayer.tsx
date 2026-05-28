/**
 * ZoneLayer — renders circle and polygon saved places/zones.
 */
import React, { memo } from 'react';
import { Circle, Polygon } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';

export const ZoneLayer: React.FC = memo(() => {
  const zones = useMapStore((s) => s.savedPlaces);

  return (
    <>
      {zones.map((zone) => {
        if (zone.shape_type === 'polygon' && zone.polygon_coords.length >= 3) {
          return (
            <Polygon
              key={zone.id}
              coordinates={zone.polygon_coords}
              strokeColor="rgba(34,197,94,0.8)"
              fillColor="rgba(34,197,94,0.12)"
              strokeWidth={2}
              onPress={() => useMapStore.getState().setSelectedSavedPlaceId(zone.id)}
              tappable
            />
          );
        }
        return (
          <Circle
            key={zone.id}
            center={{ latitude: zone.latitude, longitude: zone.longitude }}
            radius={zone.radius_meters}
            strokeColor="rgba(34,197,94,0.8)"
            fillColor="rgba(34,197,94,0.12)"
            strokeWidth={2}
            onPress={() => useMapStore.getState().setSelectedSavedPlaceId(zone.id)}
          />
        );
      })}
    </>
  );
});
