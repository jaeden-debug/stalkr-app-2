/**
 * CrewMarker — one crew member, drawn as two independent siblings:
 *
 *   1. direction cone  <Marker image={...} flat rotation>  — rotates with bearing
 *   2. identity badge  <Marker> + React view                — upright, never rotates
 *
 * The cone is a generated PNG rather than a React view. It is the rotating
 * element and there is one per visible member, so it was the heaviest user of
 * bitmap rasterisation on the map; as an image it cannot blank out and Android
 * shares a single bitmap across every member on the same crew colour.
 *
 * The badge stays a React view because its content is genuinely dynamic —
 * a profile photo when one exists, initials otherwise.
 */
import React, { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import type { MapCrewMember } from '@/types/models';
import { getCrewColor } from '@/constants/map';
import { getCrewConeImage } from '@/constants/mapMarkerImages';
import { MAP_Z_MARKER } from '@/constants/mapLayers';
import { getLocationStatus } from '@/utils/time';
import { useMarkerSnapshot } from '@/hooks/useMarkerSnapshot';

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
    const initials = (
      member?.initials_override ||
      member?.profile?.initials ||
      displayName.slice(0, 2)
    ).toUpperCase();
    const avatarUrl = member?.avatar_url_override || member?.profile?.avatar_url || null;

    const color = getCrewColor(location.user_id);

    // A member who has gone dark is flagged offline/paused on their row — grey
    // them out at their last known position rather than waiting for the ping to
    // age out.
    const explicitOffline = location.status === 'offline' || location.status === 'paused';
    const status = explicitOffline ? 'offline' : getLocationStatus(location.last_ping_at);
    const statusColor = status === 'live' ? '#22c55e' : status === 'stale' ? '#f59e0b' : '#6b7280';

    // heading === null means the member's device reported no compass fix. Show
    // no cone rather than a cone pointing north.
    const hasHeading =
      status !== 'offline' && location.heading != null && Number.isFinite(location.heading);

    // Badge artwork depends on identity and status only — never on coordinates,
    // since moving a marker does not change its bitmap.
    const { tracksViewChanges, onLayout } = useMarkerSnapshot([
      status,
      initials,
      avatarUrl ?? '',
    ]);

    const coordinate = { latitude: location.latitude, longitude: location.longitude };

    const handlePress = () => {
      useMapStore.getState().setSelectedMapUser({ userId: location.user_id, type: 'crew' });
    };

    return (
      <>
        {hasHeading && (
          <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            image={getCrewConeImage(location.user_id)}
            flat
            rotation={location.heading as number}
            zIndex={MAP_Z_MARKER.CREW_DIRECTION}
          />
        )}

        <Marker
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={tracksViewChanges}
          onPress={handlePress}
          onSelect={handlePress}
          zIndex={MAP_Z_MARKER.CREW_BADGE}
        >
          <View style={styles.wrapper} onLayout={onLayout}>
            <View
              style={[
                styles.marker,
                { borderColor: statusColor, backgroundColor: `${color}22` },
              ]}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={[styles.initials, { color }]}>{initials}</Text>
              )}
            </View>
            {status === 'stale' && <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />}
            {status === 'offline' && <View style={[styles.statusDot, { backgroundColor: '#6b7280' }]} />}
          </View>
        </Marker>
      </>
    );
  },
  (prev, next) =>
    prev.location.latitude === next.location.latitude &&
    prev.location.longitude === next.location.longitude &&
    prev.location.heading === next.location.heading &&
    prev.location.status === next.location.status &&
    prev.location.last_ping_at === next.location.last_ping_at,
);

CrewMarker.displayName = 'CrewMarker';

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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  avatar: { width: '100%', height: '100%' },
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
