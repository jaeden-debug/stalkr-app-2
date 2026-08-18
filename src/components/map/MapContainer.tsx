/**
 * MapContainer — root map component.
 * All sub-layers are memoized. Self marker only rerenders on self moves.
 * Crew markers only rerender on their own data changes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Polygon, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { MAP_CONSTANTS } from '@/constants/map';
import { getDistance } from '@/utils/distance';
import { SelfMarker } from './SelfMarker';
import { CrewMarkerLayer } from './CrewMarkerLayer';
import { MarkerLayer } from './MarkerLayer';
import { ZoneLayer } from './ZoneLayer';
import { TrailLayer } from './TrailLayer';
import { DestinationMarker } from './DestinationMarker';
import { RallyPointMarker } from './RallyPointMarker';
import { MapControls } from './MapControls';
import { MAP_Z_MARKER, MAP_Z_SHAPE } from '@/constants/mapLayers';

const MapContainerInner: React.FC = () => {
  const mapRef = useRef<MapView>(null);
  const hasAutocentered = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const isSatellite = useMapStore((s) => s.isSatellite);
  const centerTrigger = useMapStore((s) => s.centerTrigger);
  // Boolean, not the location object: this only needs to know WHEN the first
  // fix lands so it can auto-centre once. Subscribing to `myLocation` itself
  // re-rendered the whole map subtree on every position update.
  const hasFix = useMapStore((s) => s.myLocation != null);
  const userId = useAuthStore((s) => s.user?.id);
  const polygonDraftPoints = useMapStore((s) => s.polygonDraftPoints);
  const placingPolygonZone = useMapStore((s) => s.placingPolygonZone);
  const placingCircleZone = useMapStore((s) => s.placingCircleZone);
  const circleDraft = useMapStore((s) => s.circleDraft);
  const searchedPlace = useMapStore((s) => s.searchedPlace);
  const goToTarget = useMapStore((s) => s.goToTarget);
  const goToTrigger = useMapStore((s) => s.goToTrigger);
  const measuring = useMapStore((s) => s.measuring);
  const measurePoints = useMapStore((s) => s.measurePoints);

  const centerOnMe = useCallback(
    (duration: number) => {
      const loc = useMapStore.getState().myLocation;
      if (!loc) return;
      mapRef.current?.animateToRegion(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.latitudeDelta,
          longitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.longitudeDelta,
        },
        duration,
      );
    },
    [],
  );

  // Auto-center once — only after BOTH the map is ready and a GPS fix exists.
  // (Calling animateToRegion before the native map is laid out silently no-ops,
  // which is why the marker used to stay off-screen until CENTER was pressed.)
  useEffect(() => {
    if (mapReady && hasFix && !hasAutocentered.current) {
      hasAutocentered.current = true;
      // next tick so the first layout pass has fully settled
      requestAnimationFrame(() => centerOnMe(800));
    }
  }, [mapReady, hasFix, centerOnMe]);

  useEffect(() => {
    if (centerTrigger > 0 && mapReady) centerOnMe(600);
  }, [centerTrigger, mapReady, centerOnMe]);

  // "Go to" a member / location from a card.
  useEffect(() => {
    if (goToTrigger > 0 && mapReady && goToTarget) {
      mapRef.current?.animateToRegion(
        {
          latitude: goToTarget.latitude,
          longitude: goToTarget.longitude,
          latitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.latitudeDelta,
          longitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.longitudeDelta,
        },
        600,
      );
    }
  }, [goToTrigger, mapReady, goToTarget]);

  // Focus the map on a freshly searched place.
  useEffect(() => {
    if (mapReady && searchedPlace) {
      mapRef.current?.animateToRegion(
        {
          latitude: searchedPlace.latitude,
          longitude: searchedPlace.longitude,
          latitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.latitudeDelta,
          longitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.longitudeDelta,
        },
        600,
      );
    }
  }, [searchedPlace, mapReady]);

  // Live edge handle for the circle draft, projected `radius` metres east of centre.
  const circleEdge = circleDraft
    ? {
        latitude: circleDraft.center.latitude,
        longitude:
          circleDraft.center.longitude +
          circleDraft.radius /
            (111320 * Math.cos((circleDraft.center.latitude * Math.PI) / 180)),
      }
    : null;

  const handleMapPress = useCallback(
    (e: { nativeEvent: { action?: string; coordinate: { latitude: number; longitude: number } } }) => {
      // When a marker/polygon is tapped, react-native-maps still fires the map's
      // onPress with action 'marker-press'/'polygon-press'. Ignore those so we
      // don't clear the selection the marker just set (which made sheets unopenable).
      const action = e.nativeEvent?.action;
      if (action === 'marker-press' || action === 'polygon-press' || action === 'callout-press') return;
      useMapStore.getState().handleMapTap(e.nativeEvent.coordinate);
    },
    [],
  );

  const handleLongPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      useMapStore.getState().handleMapLongPress(e.nativeEvent.coordinate);
    },
    [],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google Maps on BOTH platforms. iOS previously fell through to Apple
        // Maps (provider=undefined), whose marker view manager does not export
        // `rotation`, `flat`, `anchor` or `tracksViewChanges` — so the self /
        // crew heading arrows silently never rotated and pin anchors were
        // ignored. The Google iOS SDK was already linked (ios/Podfile installs
        // `react-native-maps/Google`, Podfile.lock pins GoogleMaps 9.4.0) and
        // keyed via `iosGoogleMapsApiKey` in app.config.ts — it was just unused.
        provider={PROVIDER_GOOGLE}
        mapType={isSatellite ? 'hybrid' : 'standard'}
        initialRegion={MAP_CONSTANTS.DEFAULT_REGION}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        onPress={handleMapPress}
        onLongPress={handleLongPress}
        rotateEnabled
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        <TrailLayer />
        <ZoneLayer />

        {/* ── Polygon draft overlay ── */}
        {placingPolygonZone && polygonDraftPoints.length > 0 && (
          <>
            {polygonDraftPoints.length >= 2 && (
              <Polyline
                coordinates={polygonDraftPoints}
                strokeColor="#22c55e"
                strokeWidth={2}
                lineDashPattern={[8, 4]}
                zIndex={MAP_Z_SHAPE.DRAFT_SHAPE}
              />
            )}
            {polygonDraftPoints.length >= 3 && (
              <Polygon
                coordinates={polygonDraftPoints}
                fillColor="rgba(34,197,94,0.15)"
                strokeColor="#22c55e"
                strokeWidth={1.5}
                zIndex={MAP_Z_SHAPE.DRAFT_SHAPE}
              />
            )}
            {polygonDraftPoints.map((pt) => (
              <DraftVertex key={pt.id} coordinate={pt} />
            ))}
          </>
        )}
        {/* ── Circle draft overlay (place → drag centre / edge → confirm) ── */}
        {placingCircleZone && circleDraft && circleEdge && (
          <>
            <Circle
              center={circleDraft.center}
              radius={circleDraft.radius}
              strokeColor="#22c55e"
              strokeWidth={2}
              fillColor="rgba(34,197,94,0.15)"
              zIndex={MAP_Z_SHAPE.DRAFT_SHAPE}
            />
            {/* Centre handle — drag to move the whole zone */}
            <Marker
              coordinate={circleDraft.center}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable
              tracksViewChanges
              onDragStart={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              onDrag={(e) => useMapStore.getState().setCircleDraftCenter(e.nativeEvent.coordinate)}
              onDragEnd={(e) => useMapStore.getState().setCircleDraftCenter(e.nativeEvent.coordinate)}
              zIndex={MAP_Z_MARKER.DRAFT_HANDLE}
            >
              <View style={styles.centerHandle}>
                <View style={styles.centerHandleDot} />
              </View>
            </Marker>
            {/* Edge handle — drag to resize */}
            <Marker
              coordinate={circleEdge}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable
              tracksViewChanges
              onDragStart={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              onDrag={(e) =>
                useMapStore
                  .getState()
                  .setCircleDraftRadius(getDistance(circleDraft.center, e.nativeEvent.coordinate))
              }
              onDragEnd={(e) =>
                useMapStore
                  .getState()
                  .setCircleDraftRadius(getDistance(circleDraft.center, e.nativeEvent.coordinate))
              }
              zIndex={MAP_Z_MARKER.DRAFT_HANDLE}
            >
              <View style={styles.edgeHandle}>
                <View style={styles.edgeHandleInner} />
              </View>
            </Marker>
          </>
        )}
        {/* ── Searched place pin (pre-journey destination) ── */}
        {searchedPlace && (
          <Marker
            coordinate={{ latitude: searchedPlace.latitude, longitude: searchedPlace.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges
            zIndex={MAP_Z_MARKER.SEARCH_PIN}
          >
            <View style={styles.searchPin}>
              <Ionicons name="location" size={20} color="#000" />
            </View>
          </Marker>
        )}
        {/* ── Measure overlay ── */}
        {measuring && measurePoints.length > 0 && (
          <>
            {measurePoints.length >= 2 && (
              <Polyline coordinates={measurePoints} strokeColor="#4ADE80" strokeWidth={3} lineDashPattern={[2, 6]} zIndex={MAP_Z_SHAPE.MEASURE_LINE} />
            )}
            {measurePoints.map((p, i) => (
              <Marker
                key={p.id}
                coordinate={p}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges
                zIndex={MAP_Z_MARKER.MEASURE_POINT}
              >
                <View style={styles.measureDot}><Text style={styles.measureDotText}>{i + 1}</Text></View>
              </Marker>
            ))}
          </>
        )}
        <DestinationMarker />
        <RallyPointMarker />
        <MarkerLayer />
        <CrewMarkerLayer myUserId={userId ?? ''} />
        {/* Self-contained: subscribes to its own position/heading/selection so
            this container never re-renders on GPS or compass activity. */}
        <SelfMarker />
      </MapView>

      <MapControls />
    </View>
  );
};

/**
 * Memoized: MapContainer takes no props, so this guarantees it re-renders only
 * when one of its own subscriptions changes — never merely because MapScreen
 * re-rendered for an unrelated reason.
 */
export const MapContainer = React.memo(MapContainerInner);
MapContainer.displayName = 'MapContainer';

/** Draft vertex with a stable identity, so undo cannot reuse a stale native view. */
const DraftVertex: React.FC<{ coordinate: { latitude: number; longitude: number } }> = React.memo(
  ({ coordinate }) => (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges
      zIndex={MAP_Z_MARKER.DRAFT_POINT}
    >
      <View style={styles.draftDot} />
    </Marker>
  ),
);
DraftVertex.displayName = 'DraftVertex';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  draftDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  centerHandle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.25)',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  centerHandleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  edgeHandle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  edgeHandleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a0a0f',
  },
  measureDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'center',
  },
  measureDotText: { color: '#000', fontSize: 11, fontWeight: '900' },
  searchPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 10,
  },
});
