/**
 * MarkerLayer — renders shared tactical markers.
 * Memoized per marker ID. Never rerenders on GPS ticks.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { getMarkerConfig } from '@/constants/markerTypes';
import type { Marker as MarkerModel } from '@/types/models';

export const MarkerLayer: React.FC = memo(() => {
  const markers = useMapStore((s) => s.markers);
  return (
    <>
      {markers.map((marker) => (
        <TacticalMarkerPin key={marker.id} marker={marker} />
      ))}
    </>
  );
});

const TacticalMarkerPin: React.FC<{ marker: MarkerModel }> = memo(
  ({ marker }) => {
    const config = getMarkerConfig(marker.type);
    return (
      <Marker
        coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={false}
        onPress={() => useMapStore.getState().setSelectedFieldMarkerId(marker.id)}
        zIndex={30}
      >
        <View style={styles.wrapper}>
          <View style={[styles.pin, { backgroundColor: config.color, borderColor: `${config.color}88` }]}>
            <Text style={styles.emoji}>{config.emoji}</Text>
          </View>
          <View style={[styles.stem, { backgroundColor: config.color }]} />
        </View>
      </Marker>
    );
  },
  (prev, next) =>
    prev.marker.id === next.marker.id &&
    prev.marker.latitude === next.marker.latitude &&
    prev.marker.longitude === next.marker.longitude &&
    prev.marker.type === next.marker.type,
);

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 5,
  },
  emoji: { fontSize: 16 },
  stem: { width: 3, height: 8, borderRadius: 1.5, marginTop: -1 },
});
