/**
 * MapContainer — root map component.
 * All sub-layers are memoized. Self marker only rerenders on self moves.
 * Crew markers only rerender on their own data changes.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Polygon } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { MAP_CONSTANTS } from '@/constants/map';
import { SelfMarker } from './SelfMarker';
import { CrewMarkerLayer } from './CrewMarkerLayer';
import { MarkerLayer } from './MarkerLayer';
import { ZoneLayer } from './ZoneLayer';
import { TrailLayer } from './TrailLayer';
import { DestinationMarker } from './DestinationMarker';
import { RallyPointMarker } from './RallyPointMarker';
import { MapControls } from './MapControls';

export const MapContainer: React.FC = () => {
  const mapRef = useRef<MapView>(null);

  const isSatellite = useMapStore((s) => s.isSatellite);
  const centerTrigger = useMapStore((s) => s.centerTrigger);
  const myLocation = useMapStore((s) => s.myLocation);
  const userId = useAuthStore((s) => s.user?.id);
  const polygonDraftPoints = useMapStore((s) => s.polygonDraftPoints);
  const placingPolygonZone = useMapStore((s) => s.placingPolygonZone);

  useEffect(() => {
    if (centerTrigger > 0 && myLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.latitudeDelta,
          longitudeDelta: MAP_CONSTANTS.INITIAL_ZOOM.longitudeDelta,
        },
        600,
      );
    }
  }, [centerTrigger]);

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
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
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={isSatellite ? 'hybrid' : 'standard'}
        initialRegion={MAP_CONSTANTS.DEFAULT_REGION}
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
                zIndex={20}
              />
            )}
            {polygonDraftPoints.length >= 3 && (
              <Polygon
                coordinates={polygonDraftPoints}
                fillColor="rgba(34,197,94,0.15)"
                strokeColor="#22c55e"
                strokeWidth={1.5}
                zIndex={19}
              />
            )}
            {polygonDraftPoints.map((pt, idx) => (
              <Marker
                key={`draft-${idx}`}
                coordinate={pt}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={21}
              >
                <View style={styles.draftDot} />
              </Marker>
            ))}
          </>
        )}
        <DestinationMarker />
        <RallyPointMarker />
        <MarkerLayer />
        <CrewMarkerLayer myUserId={userId ?? ''} />
        {myLocation && userId && (
          <SelfMarker
            userId={userId}
            latitude={myLocation.latitude}
            longitude={myLocation.longitude}
            heading={myLocation.heading}
          />
        )}
      </MapView>

      <MapControls />
    </View>
  );
};

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
});
