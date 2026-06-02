/**
 * ZoneLayer — renders circle and polygon saved places/zones.
 *
 * Per-ID memoization: layer subscribes to IDs only, each item reads its own zone.
 * Selection state drives stroke width + colour highlight.
 * Zone type drives stroke/fill colour.
 * A ZoneLabelMarker at the centroid shows the zone name and handles taps.
 * When movingZoneId matches, the label marker becomes draggable to reposition.
 */
import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Marker, Polygon } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { updateSavedPlace } from '@/services/savedPlaces';
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
  const circleIds = useMapStore((s) =>
    s.savedPlaces.filter((p) => p.shape_type !== 'polygon').map((p) => p.id),
  );
  const polygonIds = useMapStore((s) =>
    s.savedPlaces
      .filter((p) => p.shape_type === 'polygon' && p.polygon_coords != null && Array.isArray(p.polygon_coords) && p.polygon_coords.length >= 3)
      .map((p) => p.id),
  );

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
        zIndex={10}
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
        zIndex={10}
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

    const handleDragEnd = useCallback(
      (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
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
        useMapStore.getState().setMovingZoneId(null);
      },
      [zone, coordinate],
    );

    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={isSelected || isMoving}
        draggable={isMoving}
        onDragEnd={isMoving ? handleDragEnd : undefined}
        zIndex={isMoving ? 999 : 11}
        onPress={() => {
          if (!isMoving) useMapStore.getState().setSelectedSavedPlaceId(zone.id);
        }}
      >
        <View style={[
          styles.badge,
          { borderColor: base + (isSelected || isMoving ? 'cc' : '55') },
          isSelected && !isMoving && { backgroundColor: base + '33' },
          isMoving && { backgroundColor: 'rgba(34,197,94,0.85)', borderColor: '#fff' },
        ]}>
          <Text
            style={[
              styles.badgeText,
              (isSelected || isMoving) && { color: '#ffffff' },
            ]}
            numberOfLines={1}
          >
            {isMoving ? '✥  Drop to place' : zone.name}
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
  badgeText: {
    color: '#e8e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
