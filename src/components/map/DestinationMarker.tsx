import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
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
          <View style={styles.pin}>
            <Text style={styles.emoji}>🎯</Text>
          </View>
          <View style={styles.label}>
            <Text style={styles.labelText} numberOfLines={1}>{name}</Text>
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
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 2, borderColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  label: {
    backgroundColor: '#1a1a24', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
    borderWidth: 1, borderColor: '#3b82f6', maxWidth: 140,
  },
  labelText: { color: '#60a5fa', fontSize: 11, fontWeight: '600' },
});
