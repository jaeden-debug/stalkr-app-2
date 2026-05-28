/**
 * ZoneLayer — renders circle and polygon saved places/zones.
 *
 * Note: react-native-maps Circle does not support onPress.
 * We render a transparent tap-target Marker at the zone center instead.
 */
import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Circle, Marker, Polygon } from 'react-native-maps';
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

        // Circle zones: render the circle visually + an invisible Marker for tap handling
        // (MapCircle does not fire onPress in react-native-maps)
        return (
          <React.Fragment key={zone.id}>
            <Circle
              center={{ latitude: zone.latitude, longitude: zone.longitude }}
              radius={zone.radius_meters}
              strokeColor="rgba(34,197,94,0.8)"
              fillColor="rgba(34,197,94,0.12)"
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => useMapStore.getState().setSelectedSavedPlaceId(zone.id)}
              tracksViewChanges={false}
            >
              {/* Invisible tap target — visuals come from the Circle above */}
              <View style={styles.tapTarget} />
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  tapTarget: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent' },
});
