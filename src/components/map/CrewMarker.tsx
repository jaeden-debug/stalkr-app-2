/**
 * CrewMarker — a single crew member's marker.
 * Memoized — only rerenders when this specific member's data changes.
 * Shows heading arrow, status ring, initials.
 * Tap opens CrewMemberMenu.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import type { MapCrewMember } from '@/types/models';
import { getCrewColor } from '@/constants/map';
import { getLocationStatus } from '@/utils/time';
import { HeadingArrow } from './HeadingArrow';

interface CrewMarkerProps {
  location: MapCrewMember;
}

export const CrewMarker: React.FC<CrewMarkerProps> = memo(
  ({ location }) => {
    const members = useGroupStore((s) => s.groupMembers);
    const member = members.find((m) => m.user_id === location.user_id);
    const displayName =
      member?.nickname_override ||
      member?.profile?.nickname ||
      member?.profile?.display_name ||
      '??';
    const initials =
      member?.initials_override ||
      member?.profile?.initials ||
      displayName.slice(0, 2).toUpperCase();
    const color = getCrewColor(location.user_id);
    const status = getLocationStatus(location.last_ping_at);

    const statusColor =
      status === 'live' ? '#22c55e' : status === 'stale' ? '#f59e0b' : '#6b7280';

    const handlePress = () => {
      useMapStore.getState().setSelectedMapUser({ userId: location.user_id, type: 'crew' });
    };

    return (
      <Marker
        coordinate={{ latitude: location.latitude, longitude: location.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        onPress={handlePress}
        zIndex={50}
      >
        <View style={styles.wrapper}>
          {status !== 'offline' && (
            <HeadingArrow heading={location.heading} color={color} size={52} />
          )}
          <View
            style={[
              styles.marker,
              {
                borderColor: statusColor,
                backgroundColor: `${color}22`,
              },
            ]}
          >
            <Text style={[styles.initials, { color }]}>{initials}</Text>
          </View>
          {/* Stale indicator */}
          {status === 'stale' && (
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
          )}
          {status === 'offline' && (
            <View style={[styles.statusDot, { backgroundColor: '#6b7280' }]} />
          )}
        </View>
      </Marker>
    );
  },
  (prev, next) =>
    prev.location.latitude === next.location.latitude &&
    prev.location.longitude === next.location.longitude &&
    prev.location.heading === next.location.heading &&
    prev.location.status === next.location.status &&
    prev.location.last_ping_at === next.location.last_ping_at,
);

const styles = StyleSheet.create({
  wrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0a0a0f',
  },
});
