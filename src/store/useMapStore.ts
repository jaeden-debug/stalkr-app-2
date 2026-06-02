import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { Marker, SavedPlace, MapCrewMember, SelectedMapUser, RallyPoint } from '@/types/models';
import type { MarkerType, LatLng } from '@/types/database';
import * as markerService from '@/services/markers';
import * as savedPlaceService from '@/services/savedPlaces';
import { useAuthStore } from './useAuthStore';
import { useGroupStore } from './useGroupStore';

interface MapState {
  // Map view
  isSatellite: boolean;
  centerTrigger: number;

  // Crew locations (keyed by userId)
  crewLocations: Record<string, MapCrewMember>;

  // My location
  myLocation: { latitude: number; longitude: number; heading: number; accuracy: number } | null;

  // Selected UI state
  selectedMapUser: SelectedMapUser | null;
  selectedMarkerId: string | null;
  selectedFieldMarkerId: string | null; // alias for selectedMarkerId
  selectedSavedPlaceId: string | null;

  // Markers
  markers: Marker[];
  markersLoading: boolean;
  placingMarker: boolean;
  selectedMarkerType: MarkerType | null;

  // Saved places / zones
  savedPlaces: SavedPlace[];
  savedPlacesLoading: boolean;
  placingCircleZone: boolean;
  placingSavedPlace: boolean; // alias for placingCircleZone
  placingPolygonZone: boolean;
  polygonDraftPoints: LatLng[];
  movingZoneId: string | null;
  draggingMarkerId: string | null;

  // Pending zone creation (set after tap/finish — triggers ZoneCreationSheet)
  pendingZoneCreation: {
    type: 'circle' | 'polygon';
    coords: LatLng;
    polygonPoints?: LatLng[];
  } | null;

  // Trails
  userTrails: Record<string, LatLng[]>;
  visibleTrailUsers: Record<string, boolean>;
  trailHistoryHours: number;

  // Rally point
  activeRallyPoint: RallyPoint | null;

  // SOS state
  sosActive: boolean;

  // Actions — map view
  toggleSatellite: () => void;
  triggerCenterMap: () => void;
  handleMapTap: (coords: LatLng) => void;
  handleMapLongPress: (coords: LatLng) => void;

  // Crew locations
  setCrewLocation: (userId: string, loc: MapCrewMember) => void;
  removeCrewLocation: (userId: string) => void;

  // My location
  setMyLocation: (loc: { latitude: number; longitude: number; heading: number; accuracy: number }) => void;

  // Selection
  setSelectedMapUser: (u: SelectedMapUser | null) => void;
  setSelectedMarkerId: (id: string | null) => void;
  setSelectedFieldMarkerId: (id: string | null) => void;
  setSelectedSavedPlaceId: (id: string | null) => void;

  // Markers
  loadMarkers: (groupId?: string | null) => Promise<void>;
  startMarkerPlacement: (type: MarkerType) => void;
  cancelMarkerPlacement: () => void;
  placeMarker: (coords: LatLng) => Promise<Marker | null>;
  deleteMarker: (markerId: string) => Promise<boolean>;
  updateMarkerInStore: (markerId: string, updates: Partial<Marker>) => void;

  // Saved places / zones
  loadSavedPlaces: (groupId?: string | null) => Promise<void>;
  startCircleZonePlacement: () => void;
  startSavedPlacePlacement: () => void; // alias
  startPolygonZonePlacement: () => void;
  cancelZonePlacement: () => void;
  cancelSavedPlacePlacement: () => void; // alias
  cancelPolygonZonePlacement: () => void;
  addPolygonPoint: (point: LatLng) => void;
  addPolygonDraftPoint: (point: LatLng) => void; // alias
  removeLastPolygonPoint: () => void;
  finishPolygonZone: () => void;
  confirmZoneCreation: (name: string, notifyArrival: boolean, notifyLeave: boolean) => Promise<SavedPlace | null>;
  cancelZoneCreation: () => void;
  setMovingZoneId: (id: string | null) => void;
  setDraggingMarkerId: (id: string | null) => void;
  removeSavedPlaceFromStore: (id: string) => void;
  upsertSavedPlaceInStore: (place: SavedPlace) => void;
  updateSavedPlaceInStore: (id: string, updates: Partial<SavedPlace>) => void;

  // Trails
  setUserTrail: (userId: string, points: LatLng[]) => void;
  toggleTrailVisibility: (userId: string) => void;
  toggleTrailForUser: (userId: string) => void; // alias
  clearUserTrail: (userId: string) => void;
  setTrailHistoryHours: (hours: number) => void;

  // Rally point
  setActiveRallyPoint: (point: RallyPoint | null) => void;

  // SOS
  triggerSOSMode: () => void;
  clearSOSMode: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      isSatellite: true,
      centerTrigger: 0,
      crewLocations: {},
      myLocation: null,
      selectedMapUser: null,
      selectedMarkerId: null,
      selectedFieldMarkerId: null,
      selectedSavedPlaceId: null,
      markers: [],
      markersLoading: false,
      placingMarker: false,
      selectedMarkerType: null,
      savedPlaces: [],
      savedPlacesLoading: false,
      placingCircleZone: false,
      placingSavedPlace: false,
      placingPolygonZone: false,
      pendingZoneCreation: null,
      polygonDraftPoints: [],
      movingZoneId: null,
      draggingMarkerId: null,
      userTrails: {},
      visibleTrailUsers: {},
      trailHistoryHours: 24,
      activeRallyPoint: null,
      sosActive: false,

      toggleSatellite: () => set((s) => ({ isSatellite: !s.isSatellite })),
      triggerCenterMap: () => set((s) => ({ centerTrigger: s.centerTrigger + 1 })),

      handleMapTap: (coords) => {
        const { placingMarker, placingCircleZone, placingPolygonZone } = get();
        if (placingMarker) {
          get().placeMarker(coords);
          return;
        }
        if (placingPolygonZone) {
          get().addPolygonPoint(coords);
          return;
        }
        if (placingCircleZone) {
          // Store coords and show ZoneCreationSheet
          set({
            placingCircleZone: false,
            placingSavedPlace: false,
            pendingZoneCreation: { type: 'circle', coords },
          });
          return;
        }
        // Deselect everything
        set({ selectedMapUser: null, selectedMarkerId: null, selectedFieldMarkerId: null, selectedSavedPlaceId: null });
      },

      handleMapLongPress: (coords) => {
        // Long-press sets a waypoint marker placement at that position
        const { placingMarker, placingCircleZone, placingPolygonZone } = get();
        if (!placingMarker && !placingCircleZone && !placingPolygonZone) {
          get().placeMarker(coords);
        }
      },

      setCrewLocation: (userId, loc) =>
        set((s) => ({ crewLocations: { ...s.crewLocations, [userId]: loc } })),
      removeCrewLocation: (userId) =>
        set((s) => {
          const copy = { ...s.crewLocations };
          delete copy[userId];
          return { crewLocations: copy };
        }),

      setMyLocation: (loc) => set({ myLocation: loc }),

      setSelectedMapUser: (u) => set({ selectedMapUser: u }),
      setSelectedMarkerId: (id) => set({ selectedMarkerId: id, selectedFieldMarkerId: id }),
      setSelectedFieldMarkerId: (id) => set({ selectedFieldMarkerId: id, selectedMarkerId: id }),
      setSelectedSavedPlaceId: (id) => set({ selectedSavedPlaceId: id }),

      loadMarkers: async (groupId) => {
        const gid = groupId ?? useGroupStore.getState().activeGroupId;
        if (!gid) return;
        set({ markersLoading: true });
        const markers = await markerService.fetchGroupMarkers(gid);
        set({ markers, markersLoading: false });
      },

      startMarkerPlacement: (type) =>
        set({ placingMarker: true, selectedMarkerType: type }),

      cancelMarkerPlacement: () =>
        set({ placingMarker: false, selectedMarkerType: null }),

      placeMarker: async (coords) => {
        const userId = useAuthStore.getState().session?.user?.id;
        const groupId = useGroupStore.getState().activeGroupId;
        const { selectedMarkerType } = get();
        // If no type selected, default to waypoint
        const markerType = selectedMarkerType ?? 'waypoint';
        if (!userId || !groupId) return null;

        const marker = await markerService.createMarker({
          group_id: groupId,
          created_by: userId,
          type: markerType,
          title:
            markerType === 'waypoint'
              ? 'Waypoint'
              : markerType.charAt(0).toUpperCase() + markerType.slice(1).replace('_', ' '),
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (marker) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          set((s) => ({
            markers: [marker, ...s.markers],
            placingMarker: false,
            selectedMarkerType: null,
          }));
        }
        return marker;
      },

      deleteMarker: async (markerId) => {
        const ok = await markerService.deleteMarker(markerId);
        if (ok) set((s) => ({ markers: s.markers.filter((m) => m.id !== markerId) }));
        return ok;
      },

      updateMarkerInStore: (markerId, updates) =>
        set((s) => ({
          markers: s.markers.map((m) => (m.id === markerId ? { ...m, ...updates } : m)),
        })),

      loadSavedPlaces: async (groupId) => {
        const gid = groupId ?? useGroupStore.getState().activeGroupId;
        if (!gid) return;
        set({ savedPlacesLoading: true });
        const places = await savedPlaceService.fetchGroupSavedPlaces(gid);
        set({ savedPlaces: places, savedPlacesLoading: false });
      },

      startCircleZonePlacement: () =>
        set({ placingCircleZone: true, placingSavedPlace: true, placingPolygonZone: false, polygonDraftPoints: [] }),
      startSavedPlacePlacement: () =>
        set({ placingCircleZone: true, placingSavedPlace: true, placingPolygonZone: false, polygonDraftPoints: [] }),

      startPolygonZonePlacement: () =>
        set({ placingPolygonZone: true, placingCircleZone: false, placingSavedPlace: false, polygonDraftPoints: [] }),

      cancelZonePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [] }),
      cancelSavedPlacePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [] }),
      cancelPolygonZonePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [] }),

      addPolygonPoint: (point) =>
        set((s) => ({ polygonDraftPoints: [...s.polygonDraftPoints, point] })),
      addPolygonDraftPoint: (point) =>
        set((s) => ({ polygonDraftPoints: [...s.polygonDraftPoints, point] })),

      removeLastPolygonPoint: () =>
        set((s) => ({ polygonDraftPoints: s.polygonDraftPoints.slice(0, -1) })),

      finishPolygonZone: () => {
        const { polygonDraftPoints } = get();
        if (polygonDraftPoints.length < 3) return;
        const lat = polygonDraftPoints.reduce((s, p) => s + p.latitude, 0) / polygonDraftPoints.length;
        const lng = polygonDraftPoints.reduce((s, p) => s + p.longitude, 0) / polygonDraftPoints.length;
        set({
          placingPolygonZone: false,
          polygonDraftPoints: [],
          pendingZoneCreation: {
            type: 'polygon',
            coords: { latitude: lat, longitude: lng },
            polygonPoints: polygonDraftPoints,
          },
        });
      },

      confirmZoneCreation: async (name, notifyArrival, notifyLeave) => {
        const { pendingZoneCreation } = get();
        if (!pendingZoneCreation) return null;

        const userId = useAuthStore.getState().user?.id;
        const groupId = useGroupStore.getState().activeGroupId;
        if (!userId || !groupId) return null;

        const { type, coords, polygonPoints } = pendingZoneCreation;
        set({ pendingZoneCreation: null });

        const place = await savedPlaceService.createSavedPlace({
          group_id: groupId,
          created_by: userId,
          name: name.trim() || (type === 'circle' ? 'Zone' : 'Polygon Zone'),
          type: 'custom',
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius_meters: 100,
          shape_type: type,
          polygon_coords: type === 'polygon' ? polygonPoints : [],
          notify_on_arrival: notifyArrival,
          notify_on_leave: notifyLeave,
          visible_to_group: true,
          alert_rules: {},
        } as any);

        if (place) {
          set((s) => ({ savedPlaces: [place, ...s.savedPlaces] }));
        }
        return place;
      },

      cancelZoneCreation: () => set({ pendingZoneCreation: null, polygonDraftPoints: [] }),

      setMovingZoneId: (id) => set({ movingZoneId: id }),
      setDraggingMarkerId: (id) => set({ draggingMarkerId: id }),

      removeSavedPlaceFromStore: (id) =>
        set((s) => ({ savedPlaces: s.savedPlaces.filter((p) => p.id !== id) })),

      upsertSavedPlaceInStore: (place) =>
        set((s) => {
          const exists = s.savedPlaces.find((p) => p.id === place.id);
          return {
            savedPlaces: exists
              ? s.savedPlaces.map((p) => (p.id === place.id ? place : p))
              : [place, ...s.savedPlaces],
          };
        }),

      updateSavedPlaceInStore: (id, updates) =>
        set((s) => ({
          savedPlaces: s.savedPlaces.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      setUserTrail: (userId, points) =>
        set((s) => ({ userTrails: { ...s.userTrails, [userId]: points } })),

      toggleTrailVisibility: (userId) =>
        set((s) => ({
          visibleTrailUsers: { ...s.visibleTrailUsers, [userId]: !s.visibleTrailUsers[userId] },
        })),
      toggleTrailForUser: (userId) =>
        set((s) => ({
          visibleTrailUsers: { ...s.visibleTrailUsers, [userId]: !s.visibleTrailUsers[userId] },
        })),

      clearUserTrail: (userId) =>
        set((s) => ({ userTrails: { ...s.userTrails, [userId]: [] } })),

      setTrailHistoryHours: (hours) => set({ trailHistoryHours: hours }),

      setActiveRallyPoint: (point) => set({ activeRallyPoint: point }),

      triggerSOSMode: () => set({ sosActive: true }),
      clearSOSMode: () => set({ sosActive: false }),
    }),
    {
      name: 'map-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        isSatellite: s.isSatellite,
        visibleTrailUsers: s.visibleTrailUsers,
        trailHistoryHours: s.trailHistoryHours,
      }),
    },
  ),
);
