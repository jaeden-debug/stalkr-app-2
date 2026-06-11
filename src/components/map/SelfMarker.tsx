/**
 * SelfMarker — the current user's marker on the map.
 * Memoized — only rerenders when lat/lng/heading change meaningfully.
 * Tapping opens the SelfMarkerMenu.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useTracksViewChanges } from '@/hooks/useTracksViewChanges';
import { HeadingArrow } from './HeadingArrow';

interface SelfMarkerProps {
  userId: string;
  latitude: number;
  longitude: number;
  heading: number;
}

const LIVE = '#22c55e';
const DARK = '#6b7280';

export const SelfMarker: React.FC<SelfMarkerProps> = memo(
  ({ userId, latitude, longitude, heading }) => {
    // Reflect Go Dark for the ACTIVE crew (broadcasting is per-crew). Falls back
    // to the global flag if this crew has no explicit override yet. Greys out the
    // self marker so it matches how crew members see you when you're dark.
    const activeGroupId = useGroupStore((s) => s.activeGroupId);
    const isDark = useLocationStore((s) => {
      const perCrew = activeGroupId ? s.groupBroadcastingStatus[activeGroupId] : undefined;
      return perCrew !== undefined ? !perCrew : !s.isBroadcasting;
    });
    const color = isDark ? DARK : LIVE;

    // Re-snapshot only on position / dark-state change — NOT heading. Rotation is
    // applied natively via the Marker's `rotation` prop (smooth, no re-snapshot).
    const tracksViewChanges = useTracksViewChanges([latitude, longitude, isDark]);

    const handlePress = () => {
      useMapStore.getState().setSelectedMapUser({ userId, type: 'self' });
    };

    return (
      <Marker
        coordinate={{ latitude, longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        // flat + rotation = the marker rotates in MAP space (true bearing), so it
        // stays correct even when the user rotates the map — like Apple/Google Maps.
        flat
        rotation={heading}
        stopPropagation
        // onPress (Android) + onSelect (iOS) for reliable taps.
        onPress={handlePress}
        onSelect={handlePress}
        zIndex={100}
      >
        <View style={styles.wrapper}>
          {/* Arrow drawn pointing up; the Marker's rotation aims it at the bearing. */}
          {!isDark && <HeadingArrow heading={0} color={color} size={56} />}
          <View style={[styles.marker, { backgroundColor: color, shadowColor: color }, isDark && styles.markerDark]}>
            <View style={[styles.ring, { borderColor: isDark ? 'rgba(107,114,128,0.4)' : 'rgba(34,197,94,0.35)' }]} />
            <View style={styles.inner} />
          </View>
        </View>
      </Marker>
    );
  },
  (prev, next) =>
    Math.abs(prev.latitude - next.latitude) < 0.000005 &&
    Math.abs(prev.longitude - next.longitude) < 0.000005 &&
    // 1° threshold keeps the native rotation prop updating smoothly as you turn.
    Math.abs(prev.heading - next.heading) < 1,
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
  markerDark: {
    shadowOpacity: 0.3,
    shadowRadius: 3,
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
