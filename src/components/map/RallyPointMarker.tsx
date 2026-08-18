import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useMarkerSnapshot } from '@/hooks/useMarkerSnapshot';
import { MAP_Z_MARKER, MAP_Z_SHAPE } from '@/constants/mapLayers';
import { FEATURES } from '@/config/features';

export const RallyPointMarker: React.FC = memo(() => {
  // Hooks run before any early return. The feature-flag check used to sit above
  // these calls, which only avoided a Rules-of-Hooks violation because the flag
  // is a build constant — flipping it at runtime would have crashed the map.
  const rallyPoint = useMapStore((s) => s.activeRallyPoint);
  const { tracksViewChanges, onLayout } = useMarkerSnapshot([rallyPoint?.name ?? '']);

  if (!FEATURES.RALLY_POINTS) return null;
  if (!rallyPoint) return null;

  return (
    <>
      <Circle
        center={{ latitude: rallyPoint.latitude, longitude: rallyPoint.longitude }}
        radius={30}
        strokeColor="rgba(245,158,11,0.9)"
        fillColor="rgba(245,158,11,0.15)"
        strokeWidth={2}
        zIndex={MAP_Z_SHAPE.RALLY_POINT}
      />
      <Marker
        coordinate={{ latitude: rallyPoint.latitude, longitude: rallyPoint.longitude }}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={MAP_Z_MARKER.RALLY_POINT}
      >
        <View style={styles.wrapper} onLayout={onLayout}>
          <View style={styles.pin}>
            <Text style={styles.emoji}>🚩</Text>
          </View>
          <View style={styles.label}>
            <Text style={styles.labelText}>{rallyPoint.name}</Text>
          </View>
        </View>
      </Marker>
    </>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pin: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 2, borderColor: '#f59e0b',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  label: {
    backgroundColor: '#1a1a24', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
    borderWidth: 1, borderColor: '#f59e0b',
  },
  labelText: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
});
