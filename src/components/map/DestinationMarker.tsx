import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/store/useSessionStore';
import { MAP_CONSTANTS } from '@/constants/map';
import { useTracksViewChanges } from '@/hooks/useTracksViewChanges';

export const DestinationMarker: React.FC = memo(() => {
  // Use the active JOURNEY session — that's what startJourney sets and what the
  // arrival tracker (useLocationTracker) watches for auto-completion. Reading
  // `activeSession` (group feed) left this null, so the marker never showed.
  const journey = useSessionStore((s) => s.activeJourneySession ?? s.activeSession);
  const hasDestination =
    journey?.destination_latitude != null && journey?.destination_longitude != null;

  const lat = journey?.destination_latitude ?? 0;
  const lng = journey?.destination_longitude ?? 0;
  const name = journey?.destination_name ?? 'Destination';
  const tracksViewChanges = useTracksViewChanges([lat, lng, name]);

  if (!hasDestination) return null;

  return (
    <>
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={MAP_CONSTANTS.DESTINATION_ARRIVAL_RADIUS_M}
        strokeColor="rgba(59,130,246,0.9)"
        fillColor="rgba(59,130,246,0.15)"
        strokeWidth={2}
      />
      <Marker
        coordinate={{ latitude: lat, longitude: lng }}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={20}
      >
        <View style={styles.wrapper}>
          <View style={styles.label}>
            <Text style={styles.labelText} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.pin}>
            <Ionicons name="flag" size={18} color="#fff" />
          </View>
          <View style={styles.stem} />
        </View>
      </Marker>
    </>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pin: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#3b82f6',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 8, elevation: 8,
  },
  stem: {
    width: 0, height: 0, marginTop: -2,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff',
  },
  label: {
    backgroundColor: 'rgba(10,10,16,0.9)', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4, marginBottom: 4,
    borderWidth: 1, borderColor: '#3b82f6', maxWidth: 160,
  },
  labelText: { color: '#93c5fd', fontSize: 11, fontWeight: '700' },
});
