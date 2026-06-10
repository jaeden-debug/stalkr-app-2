/**
 * SelfMarker — the current user's marker on the map.
 * Memoized — only rerenders when lat/lng/heading change meaningfully.
 * Tapping opens the SelfMarkerMenu.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useTracksViewChanges } from '@/hooks/useTracksViewChanges';
import { HeadingArrow } from './HeadingArrow';

interface SelfMarkerProps {
  userId: string;
  latitude: number;
  longitude: number;
  heading: number;
}

export const SelfMarker: React.FC<SelfMarkerProps> = memo(
  ({ userId, latitude, longitude, heading }) => {
    // Re-snapshot briefly on mount and whenever position/heading meaningfully
    // change, then settle static — prevents the marker rendering blank/invisible.
    const tracksViewChanges = useTracksViewChanges([latitude, longitude, heading]);

    const handlePress = () => {
      useMapStore.getState().setSelectedMapUser({ userId, type: 'self' });
    };

    return (
      <Marker
        coordinate={{ latitude, longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        onPress={handlePress}
        zIndex={100}
      >
        <View style={styles.wrapper}>
          <HeadingArrow heading={heading} color="#22c55e" size={56} />
          <View style={styles.marker}>
            <View style={styles.ring} />
            <View style={styles.inner}>
              {/* Green "self" dot */}
            </View>
          </View>
        </View>
      </Marker>
    );
  },
  (prev, next) =>
    Math.abs(prev.latitude - next.latitude) < 0.000005 &&
    Math.abs(prev.longitude - next.longitude) < 0.000005 &&
    Math.abs(prev.heading - next.heading) < 3,
);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  inner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
});
