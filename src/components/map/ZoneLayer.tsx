/**
 * ZoneLayer — renders circle and polygon saved places/zones.
 *
 * Per-ID memoization: layer subscribes to IDs only, each item reads its own zone.
 * Selection state drives stroke width + colour highlight.
 * Zone type drives stroke/fill colour.
 * A ZoneLabelMarker at the centroid shows the zone name and handles taps.
 * When movingZoneId matches, the label marker becomes draggable to reposition.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker, Polygon } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { updateSavedPlace } from '@/services/savedPlaces';
import { useMarkerSnapshot } from '@/hooks/useMarkerSnapshot';
import { MAP_Z_MARKER, MAP_Z_SHAPE } from '@/constants/mapLayers';
import type { SavedPlace } from '@/types/models';
import type { LatLng } from '@/types/database';

// ─── Zone colour by type ──────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, string> = {
  safe_zone:   '#22c55e',
  danger_zone: '#ef4444',
  camp:        '#f59e0b',
  waypoint:    '#59ffff',
  custom:      '#8b5cf6',
};
const defaultZoneColor = '#22c55e';

function zoneColor(type: string, selected: boolean, moving: boolean) {
  const base = ZONE_COLORS[type] ?? defaultZoneColor;
  return {
    stroke: moving ? '#ffffff' : selected ? '#ffffff' : base,
    fill:   base + (selected || moving ? '44' : '1a'),
    strokeWidth: moving ? 3 : selected ? 2.5 : 1.5,
  };
}

function centroid(coords: LatLng[]): LatLng {
  const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
  return { latitude: lat, longitude: lng };
}

// ─── ZoneLayer ────────────────────────────────────────────────────────────────
export const ZoneLayer: React.FC = memo(() => {
  const showZones = useMapStore((s) => s.showZones);
  // Subscribe to the source array, not a derived one. The previous selectors
  // allocated a fresh array on every call and Zustand compares with Object.is,
  // so this layer re-rendered on EVERY map-store write — including each compass
  // tick, which is why turning the phone disturbed zones.
  const savedPlaces = useMapStore((s) => s.savedPlaces);

  const { circleIds, polygonIds } = useMemo(
    () => ({
      circleIds: savedPlaces.filter((p) => p.shape_type !== 'polygon').map((p) => p.id),
      polygonIds: savedPlaces
        .filter(
          (p) =>
            p.shape_type === 'polygon' &&
            Array.isArray(p.polygon_coords) &&
            p.polygon_coords.length >= 3,
        )
        .map((p) => p.id),
    }),
    [savedPlaces],
  );

  if (!showZones) return null;

  return (
    <>
      {circleIds.map((id) => <ZoneCircleItem key={id} zoneId={id} />)}
      {polygonIds.map((id) => <ZonePolygonItem key={id} zoneId={id} />)}
    </>
  );
});

// ─── ZoneCircleItem ───────────────────────────────────────────────────────────
const ZoneCircleItem: React.FC<{ zoneId: string }> = memo(({ zoneId }) => {
  const zone = useMapStore((s) => s.savedPlaces.find((p) => p.id === zoneId));
  const isSelected = useMapStore((s) => s.selectedSavedPlaceId === zoneId);
  const isMoving = useMapStore((s) => s.movingZoneId === zoneId);

  if (!zone) return null;
  if (!Number.isFinite(zone.latitude) || !Number.isFinite(zone.longitude)) return null;

  const { stroke, fill, strokeWidth } = zoneColor(zone.type, isSelected, isMoving);
  const center = { latitude: zone.latitude, longitude: zone.longitude };

  return (
    <>
      <Circle
        center={center}
        radius={Math.max(10, zone.radius_meters ?? 50)}
        strokeColor={stroke}
        strokeWidth={strokeWidth}
        fillColor={fill}
        zIndex={MAP_Z_SHAPE.ZONE}
      />
      <ZoneLabelMarker zone={zone} coordinate={center} isSelected={isSelected} isMoving={isMoving} />
    </>
  );
});

// ─── ZonePolygonItem ──────────────────────────────────────────────────────────
const ZonePolygonItem: React.FC<{ zoneId: string }> = memo(({ zoneId }) => {
  const zone = useMapStore((s) => s.savedPlaces.find((p) => p.id === zoneId));
  const isSelected = useMapStore((s) => s.selectedSavedPlaceId === zoneId);
  const isMoving = useMapStore((s) => s.movingZoneId === zoneId);

  if (!zone?.polygon_coords || zone.polygon_coords.length < 3) return null;

  const { stroke, fill, strokeWidth } = zoneColor(zone.type, isSelected, isMoving);
  const center = centroid(zone.polygon_coords);

  return (
    <>
      <Polygon
        coordinates={zone.polygon_coords}
        strokeColor={stroke}
        strokeWidth={strokeWidth}
        fillColor={fill}
        tappable
        zIndex={MAP_Z_SHAPE.ZONE}
        onPress={() => {
          if (!isMoving) useMapStore.getState().setSelectedSavedPlaceId(zoneId);
        }}
      />
      <ZoneLabelMarker zone={zone} coordinate={center} isSelected={isSelected} isMoving={isMoving} />
    </>
  );
});

// ─── ZoneLabelMarker — name badge + tap target + drag-to-move ─────────────────
interface ZoneLabelProps {
  zone: SavedPlace;
  coordinate: LatLng;
  isSelected: boolean;
  isMoving: boolean;
}

const ZoneLabelMarker: React.FC<ZoneLabelProps> = memo(
  ({ zone, coordinate, isSelected, isMoving }) => {
    const base = ZONE_COLORS[zone.type] ?? defaultZoneColor;

    // Local drag state — zone labels are directly draggable (long-press to lift),
    // in addition to the "Move Zone" menu action (isMoving).
    const [dragging, setDragging] = useState(false);
    const active = dragging || isMoving;
    // Labels stay permanently mounted rather than being shown only when
    // selected, because <Circle> exposes no tap handler in react-native-maps —
    // this marker is the ONLY way to open a circle zone's drawer. Stability
    // comes from layout-gated rasterisation instead of hiding them.
    const { tracksViewChanges, onLayout } = useMarkerSnapshot(
      [isSelected, active, zone.name, zone.type],
      active,
    );

    const handleDragStart = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDragging(true);
    }, []);

    const handleDragEnd = useCallback(
      (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setDragging(false);
        // For circle zones: move center. For polygon: shift all coords by delta.
        if (zone.shape_type === 'polygon' && zone.polygon_coords?.length) {
          const dLat = latitude - coordinate.latitude;
          const dLng = longitude - coordinate.longitude;
          const newCoords = zone.polygon_coords.map((pt) => ({
            latitude: pt.latitude + dLat,
            longitude: pt.longitude + dLng,
          }));
          useMapStore.getState().updateSavedPlaceInStore(zone.id, { polygon_coords: newCoords });
          updateSavedPlace(zone.id, { polygon_coords: newCoords }).catch(() => {});
        } else {
          useMapStore.getState().updateSavedPlaceInStore(zone.id, { latitude, longitude });
          updateSavedPlace(zone.id, { latitude, longitude }).catch(() => {});
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useMapStore.getState().setMovingZoneId(null);
      },
      [zone, coordinate],
    );

    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        // Only draggable once "Move Zone" is chosen from the detail sheet.
        // An always-draggable marker eats the tap on iOS, so the zone could not
        // be opened. Gating drag behind move-mode restores tap-to-open.
        draggable={isMoving}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        zIndex={
          active
            ? MAP_Z_MARKER.DRAGGING
            : isSelected
              ? MAP_Z_MARKER.ZONE_LABEL_SELECTED
              : MAP_Z_MARKER.ZONE_LABEL
        }
        // onPress (Android) + onSelect (iOS) for reliable taps on custom markers.
        onPress={() => {
          if (!active) useMapStore.getState().setSelectedSavedPlaceId(zone.id);
        }}
        onSelect={() => {
          if (!active) useMapStore.getState().setSelectedSavedPlaceId(zone.id);
        }}
      >
        <View onLayout={onLayout} style={[
          styles.badge,
          active && styles.badgeActive,
          { borderColor: base + (isSelected || active ? 'cc' : '55') },
          isSelected && !active && { backgroundColor: base + '33' },
          active && { backgroundColor: 'rgba(34,197,94,0.9)', borderColor: '#fff' },
        ]}>
          <Text
            style={[
              styles.badgeText,
              (isSelected || active) && { color: '#ffffff' },
            ]}
            numberOfLines={1}
          >
            {active ? '✥  Drop to place' : zone.name}
          </Text>
        </View>
      </Marker>
    );
  },
  (p, n) =>
    p.zone.id === n.zone.id &&
    p.zone.name === n.zone.name &&
    p.zone.type === n.zone.type &&
    p.zone.latitude === n.zone.latitude &&
    p.zone.longitude === n.zone.longitude &&
    p.isSelected === n.isSelected &&
    p.isMoving === n.isMoving,
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    maxWidth: 180,
  },
  badgeActive: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 10,
  },
  badgeText: {
    color: '#e8e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
