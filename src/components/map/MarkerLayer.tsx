/**
 * MarkerLayer — renders shared tactical markers.
 * Memoized per marker ID + selection state. Never rerenders on GPS ticks.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { getMarkerConfig } from '@/constants/markerTypes';
import type { Marker as MarkerModel } from '@/types/models';

export const MarkerLayer: React.FC = memo(() => {
  const markerIds = useMapStore((s) => s.markers.map((m) => m.id));
  return (
    <>
      {markerIds.map((id) => (
        <TacticalMarkerPin key={id} markerId={id} />
      ))}
    </>
  );
});

const TacticalMarkerPin: React.FC<{ markerId: string }> = memo(({ markerId }) => {
  const marker = useMapStore((s) => s.markers.find((m) => m.id === markerId));
  const isSelected = useMapStore((s) => s.selectedFieldMarkerId === markerId);

  if (!marker) return null;
  const { latitude, longitude } = marker;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const config = getMarkerConfig(marker.type);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={isSelected}
      onPress={() => useMapStore.getState().setSelectedFieldMarkerId(markerId)}
      zIndex={isSelected ? 995 : 30}
    >
      <View style={styles.wrapper}>
        {/* Title badge — only when selected */}
        {isSelected && (
          <View style={styles.titleBadge}>
            <Text style={styles.titleText} numberOfLines={1}>
              {marker.title}
            </Text>
          </View>
        )}

        {/* Pin body */}
        <View
          style={[
            styles.pin,
            { backgroundColor: '#111', borderColor: config.color },
            isSelected && [styles.pinSelected, { shadowColor: config.color }],
          ]}
        >
          <Text style={[styles.emoji, isSelected && styles.emojiSelected]}>
            {config.emoji}
          </Text>
        </View>

        {/* Stem */}
        <View
          style={[
            styles.stem,
            { borderTopColor: config.color },
            isSelected && styles.stemSelected,
          ]}
        />
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },

  // Title badge
  titleBadge: {
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  titleText: {
    color: '#e8e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    maxWidth: 160,
  },

  // Pin
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  pinSelected: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  emoji: { fontSize: 18 },
  emojiSelected: { fontSize: 22 },

  // Stem (triangle tail)
  stem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  stemSelected: {
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
  },
});
