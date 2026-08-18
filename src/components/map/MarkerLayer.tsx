/**
 * MarkerLayer — renders shared tactical markers.
 *
 * Each pin subscribes to its own record by ID, so adding, updating or deleting
 * one marker cannot re-render or remount its neighbours.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { updateMarker } from '@/services/markers';
import { getMarkerConfig } from '@/constants/markerTypes';
import { useMarkerSnapshot } from '@/hooks/useMarkerSnapshot';
import { MAP_Z_MARKER } from '@/constants/mapLayers';

export const MarkerLayer: React.FC = memo(() => {
  // Subscribe to the SOURCE arrays, not a derived one. The previous selector
  //   s.markers.filter(...).map(m => m.id)
  // allocated a fresh array on every call, and Zustand compares with Object.is,
  // so this layer re-rendered on EVERY map-store write — including each compass
  // tick. Both selectors below return stable references until the data changes,
  // and the derivation happens in useMemo.
  const markers = useMapStore((s) => s.markers);
  const hiddenMarkerTypes = useMapStore((s) => s.hiddenMarkerTypes);

  const visibleIds = useMemo(
    () => markers.filter((m) => !hiddenMarkerTypes.includes(m.type)).map((m) => m.id),
    [markers, hiddenMarkerTypes],
  );

  return (
    <>
      {visibleIds.map((id) => (
        <TacticalMarkerPin key={id} markerId={id} />
      ))}
    </>
  );
});

MarkerLayer.displayName = 'MarkerLayer';

const TacticalMarkerPin: React.FC<{ markerId: string }> = memo(({ markerId }) => {
  const marker = useMapStore((s) => s.markers.find((m) => m.id === markerId));
  const isSelected = useMapStore((s) => s.selectedFieldMarkerId === markerId);
  const menuMove = useMapStore((s) => s.draggingMarkerId === markerId);

  // Local drag state — drives the enlarge / "drop to place" affordance.
  const [dragging, setDragging] = useState(false);
  const isDragging = dragging || menuMove;

  // Drop-bounce animation on mount.
  const dropAnim = useRef(new Animated.Value(0)).current;
  const [dropSettled, setDropSettled] = useState(false);
  useEffect(() => {
    const animation = Animated.spring(dropAnim, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    });
    animation.start(() => setDropSettled(true));
    return () => animation.stop();
  }, [dropAnim]);
  const scaleY = dropAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1.12, 1] });

  const config = marker ? getMarkerConfig(marker.type) : null;

  // Rasterise until the view has actually been measured — never on a timer.
  //
  // `force` covers the two cases where onLayout alone is not enough:
  //  • the drop-bounce is a TRANSFORM, which does not trigger re-layout, so
  //    settling on first onLayout would freeze the pin squashed at scaleY 0.3.
  //    We hold until the spring's completion callback fires.
  //  • while dragging, the pin's appearance changes every frame.
  const { tracksViewChanges, onLayout } = useMarkerSnapshot(
    [isSelected, marker?.title ?? '', marker?.type ?? ''],
    !dropSettled || isDragging,
  );

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

  const handlePress = useCallback(() => {
    if (!isDragging) useMapStore.getState().setSelectedFieldMarkerId(markerId);
  }, [isDragging, markerId]);

  if (!marker || !config) return null;
  const { latitude, longitude } = marker;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      // Now honoured on iOS too (Apple Maps ignored `anchor`), so the pin tip
      // genuinely sits on the coordinate rather than the pin being centred.
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      // Only draggable once the user chooses "Move" from the detail sheet — an
      // always-draggable marker swallows the tap gesture, so onPress never fires
      // and the detail sheet cannot open.
      draggable={menuMove}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      // onPress (Android) + onSelect (iOS) — both are exported by the Google
      // marker managers and both set the same id, so firing both is harmless.
      onPress={handlePress}
      onSelect={handlePress}
      zIndex={
        isDragging
          ? MAP_Z_MARKER.DRAGGING
          : isSelected
            ? MAP_Z_MARKER.FIELD_MARKER_SELECTED
            : MAP_Z_MARKER.FIELD_MARKER
      }
    >
      <Animated.View style={[styles.wrapper, { transform: [{ scaleY }] }]} onLayout={onLayout}>
        {/* Drag hint badge */}
        {isDragging && (
          <View style={styles.dragBadge}>
            <Text style={styles.dragText}>Drop to place</Text>
          </View>
        )}

        {/* Title badge — selected only, so a resting pin carries no dynamic text. */}
        {isSelected && !isDragging && (
          <View style={styles.titleBadge}>
            <Text style={styles.titleText} numberOfLines={1}>
              {marker.title}
            </Text>
          </View>
        )}

        {/* Pin body — Ionicon (matches the nav-drawer quick-option icons) */}
        <View
          style={[
            styles.pin,
            { backgroundColor: '#111', borderColor: config.color },
            isSelected && [styles.pinSelected, { shadowColor: config.color }],
            isDragging && [styles.pinDragging, { borderColor: '#fff', shadowColor: config.color }],
          ]}
        >
          <Ionicons
            name={config.ionicon}
            size={isSelected || isDragging ? 22 : 18}
            color={config.color}
          />
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

TacticalMarkerPin.displayName = 'TacticalMarkerPin';

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
