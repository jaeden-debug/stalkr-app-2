/**
 * MarkerLayer — renders shared tactical markers.
 * Memoized per marker ID + selection state. Never rerenders on GPS ticks.
 * Supports drag-to-move when draggingMarkerId matches.
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { updateMarker } from '@/services/markers';
import { getMarkerConfig } from '@/constants/markerTypes';
import { useTracksViewChanges } from '@/hooks/useTracksViewChanges';

export const MarkerLayer: React.FC = memo(() => {
  const markerIds = useMapStore((s) =>
    s.markers.filter((m) => !s.hiddenMarkerTypes.includes(m.type)).map((m) => m.id),
  );
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
  const menuMove = useMapStore((s) => s.draggingMarkerId === markerId);

  // Local drag state — drives the enlarge / "drop to place" affordance.
  const [dragging, setDragging] = useState(false);
  const isDragging = dragging || menuMove;

  // Keep the snapshot fresh while selected/dragging or just after mount, then
  // settle to a static (cheap) marker. Fixes blank / un-tappable pins.
  const tracksViewChanges = useTracksViewChanges([isSelected], isDragging);

  // Drop-bounce animation on mount
  const dropAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(dropAnim, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, []);
  const scaleY = dropAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1.12, 1] });

  const handleDragStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setDragging(false);
      useMapStore.getState().updateMarkerInStore(markerId, { latitude, longitude });
      useMapStore.getState().setDraggingMarkerId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateMarker(markerId, { latitude, longitude } as any).catch(() => {});
    },
    [markerId],
  );

  if (!marker) return null;
  const { latitude, longitude } = marker;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const config = getMarkerConfig(marker.type);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPress={() => {
        if (!isDragging) useMapStore.getState().setSelectedFieldMarkerId(markerId);
      }}
      zIndex={isDragging ? 999 : isSelected ? 995 : 30}
    >
      <Animated.View style={[styles.wrapper, { transform: [{ scaleY }] }]}>
        {/* Drag hint badge */}
        {isDragging && (
          <View style={styles.dragBadge}>
            <Text style={styles.dragText}>Drop to place</Text>
          </View>
        )}

        {/* Title badge — only when selected (not dragging) */}
        {isSelected && !isDragging && (
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
            isDragging && [styles.pinDragging, { borderColor: '#fff', shadowColor: config.color }],
          ]}
        >
          <Text style={[styles.emoji, (isSelected || isDragging) && styles.emojiSelected]}>
            {config.emoji}
          </Text>
        </View>

        {/* Stem */}
        <View
          style={[
            styles.stem,
            { borderTopColor: isDragging ? '#fff' : config.color },
            (isSelected || isDragging) && styles.stemSelected,
          ]}
        />
      </Animated.View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },

  dragBadge: {
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(34,197,94,0.9)',
    borderRadius: 8,
  },
  dragText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

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
  pinDragging: {
    // Keep the same footprint as the resting pin so the bottom anchor (the GPS
    // point) never shifts mid-drag — this makes drops land exactly where intended.
    borderWidth: 3,
    borderColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 14,
  },
  emoji: { fontSize: 18 },
  emojiSelected: { fontSize: 22 },

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
