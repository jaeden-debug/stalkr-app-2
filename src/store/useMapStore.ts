import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Marker, SavedPlace, MapCrewMember, SelectedMapUser, RallyPoint } from '@/types/models';
import type { MarkerType, LatLng } from '@/types/database';
import { createLocalId } from '@/utils/ids';
import { isStaleUpdate } from '@/utils/eventOrder';

/** An ephemeral, client-only point with a stable identity for React keys. */
export type DraftPoint = LatLng & { id: string };
import * as markerService from '@/services/markers';
import * as savedPlaceService from '@/services/savedPlaces';
import { logEvent } from '@/services/groupEvents';
import { useAuthStore } from './useAuthStore';
import { useGroupStore } from './useGroupStore';

interface MapState {
  // Map view
  isSatellite: boolean;
  centerTrigger: number;

  // Map search / pending destination
  searchOpen: boolean;
  searchedPlace: { name: string; address?: string; latitude: number; longitude: number } | null;

  // Measure tool
  measuring: boolean;
  measurePoints: DraftPoint[];
  units: 'metric' | 'imperial';

  // Layer filters
  hiddenMarkerTypes: MarkerType[];
  showZones: boolean;
  showTrails: boolean;
  filterSheetOpen: boolean;

  // Crew locations (keyed by userId)
  crewLocations: Record<string, MapCrewMember>;

  /**
   * Which crew the currently-rendered markers/zones/crewLocations belong to.
   * null means "no trusted population" (mid crew-switch). This is the crew
   * isolation boundary: nothing may render unless it was committed for the
   * crew that is active right now.
   */
  populationGroupId: string | null;

  // My location
  myLocation: { latitude: number; longitude: number; heading: number; accuracy: number; speed?: number } | null;

  // "Go to" focus target (member card → recenter map). Bumped to retrigger.
  goToTarget: LatLng | null;
  goToTrigger: number;

  // Selected UI state
  selectedMapUser: SelectedMapUser | null;
  selectedMarkerId: string | null;
  selectedFieldMarkerId: string | null; // alias for selectedMarkerId
  selectedSavedPlaceId: string | null;
  lastSelectAt: number;

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
  polygonDraftPoints: DraftPoint[];
  // Live circle draft while placing a circle zone (center + radius in metres).
  // Null until the user taps to drop the center.
  circleDraft: { center: LatLng; radius: number } | null;
  movingZoneId: string | null;
  draggingMarkerId: string | null;

  // Pending zone creation (set after tap/finish — triggers ZoneCreationSheet)
  pendingZoneCreation: {
    type: 'circle' | 'polygon';
    coords: LatLng;
    radius?: number;
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

  // Map search / pending destination
  setSearchOpen: (v: boolean) => void;
  setSearchedPlace: (p: { name: string; address?: string; latitude: number; longitude: number } | null) => void;
  clearSearchedPlace: () => void;
  startCircleZoneAt: (center: LatLng) => void;

  // Measure tool
  startMeasure: () => void;
  stopMeasure: () => void;
  addMeasurePoint: (p: LatLng) => void;
  undoMeasurePoint: () => void;
  clearMeasure: () => void;
  toggleUnits: () => void;

  // Layer filters
  toggleMarkerType: (type: MarkerType) => void;
  setAllMarkerTypes: (visible: boolean, allTypes: MarkerType[]) => void;
  setShowZones: (v: boolean) => void;
  setShowTrails: (v: boolean) => void;
  setFilterSheetOpen: (v: boolean) => void;

  // Crew locations
  setCrewLocation: (userId: string, loc: MapCrewMember) => void;
  removeCrewLocation: (userId: string) => void;

  // Crew population lifecycle (see Stage 12 notes in useRealtimeGroup)
  suspendPopulation: () => void;
  commitPopulation: (
    groupId: string,
    data: {
      markers: Marker[];
      savedPlaces: SavedPlace[];
      crewLocations: Record<string, MapCrewMember>;
    },
  ) => void;

  // My location
  setMyLocation: (loc: { latitude: number; longitude: number; heading: number; accuracy: number; speed?: number }) => void;
  goTo: (coords: LatLng) => void;

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
  /** Drop the pending marker at the user's own GPS fix rather than a finger tap. */
  placeMarkerAtMyLocation: () => Promise<Marker | null>;
  deleteMarker: (markerId: string) => Promise<boolean>;
  updateMarkerInStore: (markerId: string, updates: Partial<Marker>) => void;
  upsertMarkerInStore: (marker: Marker) => void;
  removeMarkerFromStore: (markerId: string) => void;

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
  // Circle draft
  setCircleDraftCenter: (center: LatLng) => void;
  setCircleDraftRadius: (radius: number) => void;
  backCircleDraft: () => void;
  confirmCircleDraft: () => void;
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
      searchOpen: false,
      searchedPlace: null,
      measuring: false,
      measurePoints: [],
      units: 'imperial',
      hiddenMarkerTypes: [],
      showZones: true,
      showTrails: true,
      filterSheetOpen: false,
      goToTarget: null,
      goToTrigger: 0,
      crewLocations: {},
      populationGroupId: null,
      myLocation: null,
      selectedMapUser: null,
      selectedMarkerId: null,
      selectedFieldMarkerId: null,
      selectedSavedPlaceId: null,
      // Timestamp of the last marker/zone/self selection. The MapView's onPress
      // can fire right after a marker's onPress (tap-through), which would clear
      // the selection we just set. handleMapTap ignores deselect within ~350ms.
      lastSelectAt: 0,
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
      circleDraft: null,
      movingZoneId: null,
      draggingMarkerId: null,
      userTrails: {},
      visibleTrailUsers: {},
      trailHistoryHours: 24,
      activeRallyPoint: null,
      sosActive: false,

      toggleSatellite: () => set((s) => ({ isSatellite: !s.isSatellite })),
      triggerCenterMap: () => set((s) => ({ centerTrigger: s.centerTrigger + 1 })),

      setSearchOpen: (v) => set({ searchOpen: v }),
      setSearchedPlace: (p) => set({ searchedPlace: p }),
      clearSearchedPlace: () => set({ searchedPlace: null }),

      // ── Measure tool ──
      startMeasure: () => set({ measuring: true, measurePoints: [] }),
      stopMeasure: () => set({ measuring: false, measurePoints: [] }),
      addMeasurePoint: (p) =>
        set((s) => ({ measurePoints: [...s.measurePoints, { ...p, id: createLocalId('measure') }] })),
      undoMeasurePoint: () => set((s) => ({ measurePoints: s.measurePoints.slice(0, -1) })),
      clearMeasure: () => set({ measurePoints: [] }),
      toggleUnits: () => set((s) => ({ units: s.units === 'metric' ? 'imperial' : 'metric' })),

      // ── Layer filters ──
      toggleMarkerType: (type) =>
        set((s) => ({
          hiddenMarkerTypes: s.hiddenMarkerTypes.includes(type)
            ? s.hiddenMarkerTypes.filter((t) => t !== type)
            : [...s.hiddenMarkerTypes, type],
        })),
      setAllMarkerTypes: (visible, allTypes) =>
        set({ hiddenMarkerTypes: visible ? [] : [...allTypes] }),
      setShowZones: (v) => set({ showZones: v }),
      setShowTrails: (v) => set({ showTrails: v }),
      setFilterSheetOpen: (v) => set({ filterSheetOpen: v }),

      // Begin a circle-zone draft pre-centered on a searched place. The existing
      // placement toolbar (DRAG TO SIZE · BACK · CONFIRM) then takes over.
      startCircleZoneAt: (center) =>
        set({
          placingCircleZone: true,
          placingSavedPlace: true,
          placingPolygonZone: false,
          polygonDraftPoints: [],
          circleDraft: { center, radius: 100 },
          searchedPlace: null,
          searchOpen: false,
        }),

      handleMapTap: (coords) => {
        const { placingMarker, placingCircleZone, placingPolygonZone } = get();
        if (get().measuring) {
          Haptics.selectionAsync();
          get().addMeasurePoint(coords);
          return;
        }
        if (placingMarker) {
          get().placeMarker(coords);
          return;
        }
        if (placingPolygonZone) {
          get().addPolygonPoint(coords);
          return;
        }
        if (placingCircleZone) {
          // First tap drops the center → show a live, adjustable draft circle.
          // Further taps are ignored; the user resizes/moves via the handles.
          if (!get().circleDraft) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            set({ circleDraft: { center: coords, radius: 100 } });
          }
          return;
        }
        // Tap-through guard: react-native-maps can fire the MapView onPress right
        // after a marker/zone/self onPress. Without this, tapping a marker would
        // open its sheet and then immediately deselect it (sheet flashes closed).
        if (Date.now() - get().lastSelectAt < 350) return;
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

      /**
       * Apply a crew position, rejecting out-of-order deliveries.
       *
       * Realtime does not guarantee arrival order, so without this a delayed
       * 10:04:04 packet arriving after 10:04:08 would drag the marker
       * backwards in time — and a stale 'live' ping still in flight could undo
       * a Go Dark transition. Ordering uses the server timestamp on the row.
       */
      setCrewLocation: (userId, loc) =>
        set((s) => {
          if (isStaleUpdate(s.crewLocations[userId], loc)) return {};
          return { crewLocations: { ...s.crewLocations, [userId]: loc } };
        }),
      removeCrewLocation: (userId) =>
        set((s) => {
          const copy = { ...s.crewLocations };
          delete copy[userId];
          return { crewLocations: copy };
        }),

      /**
       * Crew switch — drop the outgoing crew's data immediately.
       *
       * Isolation beats visual continuity: holding crew A's pins on screen
       * while crew B loads would briefly render one crew's positions under
       * another crew's context. This is the ONLY path that clears, and it runs
       * only when the crew actually changes.
       */
      suspendPopulation: () =>
        set({ crewLocations: {}, markers: [], savedPlaces: [], populationGroupId: null }),

      /**
       * Atomically install a fully-loaded population.
       *
       * Rejects late responses: if the user switched crews while this fetch was
       * in flight, `groupId` no longer matches the active crew and the data is
       * discarded rather than rendered under the wrong crew.
       */
      commitPopulation: (groupId, data) => {
        if (useGroupStore.getState().activeGroupId !== groupId) return;
        set({
          markers: data.markers,
          savedPlaces: data.savedPlaces,
          crewLocations: data.crewLocations,
          populationGroupId: groupId,
        });
      },

      setMyLocation: (loc) => set({ myLocation: loc }),
      goTo: (coords) => set((s) => ({ goToTarget: coords, goToTrigger: s.goToTrigger + 1 })),

      setSelectedMapUser: (u) => set({ selectedMapUser: u, lastSelectAt: u ? Date.now() : 0 }),
      setSelectedMarkerId: (id) => set({ selectedMarkerId: id, selectedFieldMarkerId: id, lastSelectAt: id ? Date.now() : 0 }),
      setSelectedFieldMarkerId: (id) => set({ selectedFieldMarkerId: id, selectedMarkerId: id, lastSelectAt: id ? Date.now() : 0 }),
      setSelectedSavedPlaceId: (id) => set({ selectedSavedPlaceId: id, lastSelectAt: id ? Date.now() : 0 }),

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
          logEvent(groupId, userId, 'marker_created', `Marker: ${marker.title}`,
            `${marker.type.replace('_', ' ')} placed.`,
            { latitude: marker.latitude, longitude: marker.longitude }).catch(() => {});
        }
        return marker;
      },

      /**
       * Place at the device's own position instead of a tapped point.
       *
       * A fingertip covers ~40-60px; at typical hunting-property zoom that is
       * tens of metres, so "mark camp accurately" is not achievable by tapping.
       * Using the GPS fix makes the pin as accurate as the device allows, and
       * the accuracy is recorded so the marker can be trusted (or not) later.
       */
      placeMarkerAtMyLocation: async () => {
        const loc = get().myLocation;
        if (!loc) {
          Alert.alert(
            'No GPS fix yet',
            'Waiting for your location. Try again in a moment, or tap the map to place the marker manually.',
          );
          return null;
        }
        return get().placeMarker({ latitude: loc.latitude, longitude: loc.longitude });
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

      upsertMarkerInStore: (marker) =>
        set((s) => {
          const exists = s.markers.some((m) => m.id === marker.id);
          return {
            markers: exists
              ? s.markers.map((m) => (m.id === marker.id ? marker : m))
              : [marker, ...s.markers],
          };
        }),

      removeMarkerFromStore: (markerId) =>
        set((s) => ({ markers: s.markers.filter((m) => m.id !== markerId) })),

      loadSavedPlaces: async (groupId) => {
        const gid = groupId ?? useGroupStore.getState().activeGroupId;
        if (!gid) return;
        set({ savedPlacesLoading: true });
        const places = await savedPlaceService.fetchGroupSavedPlaces(gid);
        set({ savedPlaces: places, savedPlacesLoading: false });
      },

      startCircleZonePlacement: () =>
        set({ placingCircleZone: true, placingSavedPlace: true, placingPolygonZone: false, polygonDraftPoints: [], circleDraft: null }),
      startSavedPlacePlacement: () =>
        set({ placingCircleZone: true, placingSavedPlace: true, placingPolygonZone: false, polygonDraftPoints: [], circleDraft: null }),

      startPolygonZonePlacement: () =>
        set({ placingPolygonZone: true, placingCircleZone: false, placingSavedPlace: false, polygonDraftPoints: [], circleDraft: null }),

      cancelZonePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [], circleDraft: null }),
      cancelSavedPlacePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [], circleDraft: null }),
      cancelPolygonZonePlacement: () =>
        set({ placingCircleZone: false, placingSavedPlace: false, placingPolygonZone: false, polygonDraftPoints: [], circleDraft: null }),

      addPolygonPoint: (point) =>
        set((s) => ({
          polygonDraftPoints: [...s.polygonDraftPoints, { ...point, id: createLocalId('vertex') }],
        })),
      addPolygonDraftPoint: (point) =>
        set((s) => ({
          polygonDraftPoints: [...s.polygonDraftPoints, { ...point, id: createLocalId('vertex') }],
        })),

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
            // Strip local ids — they are React keys, not geometry, and must
            // not be written into the polygon_coords jsonb column.
            polygonPoints: polygonDraftPoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
          },
        });
      },

      // ── Circle draft (place → adjust → confirm) ──────────────────────────────
      setCircleDraftCenter: (center) =>
        set((s) => (s.circleDraft ? { circleDraft: { ...s.circleDraft, center } } : {})),

      setCircleDraftRadius: (radius) =>
        set((s) =>
          s.circleDraft
            ? { circleDraft: { ...s.circleDraft, radius: Math.max(20, Math.min(20000, Math.round(radius))) } }
            : {},
        ),

      backCircleDraft: () => {
        // Step back: if a draft exists, clear it (re-place center). Otherwise
        // exit placement entirely.
        if (get().circleDraft) {
          Haptics.selectionAsync();
          set({ circleDraft: null });
        } else {
          set({ placingCircleZone: false, placingSavedPlace: false });
        }
      },

      confirmCircleDraft: () => {
        const { circleDraft } = get();
        if (!circleDraft) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        set({
          placingCircleZone: false,
          placingSavedPlace: false,
          circleDraft: null,
          pendingZoneCreation: {
            type: 'circle',
            coords: circleDraft.center,
            radius: circleDraft.radius,
          },
        });
      },

      confirmZoneCreation: async (name, notifyArrival, notifyLeave) => {
        const { pendingZoneCreation } = get();
        if (!pendingZoneCreation) return null;

        const userId = useAuthStore.getState().user?.id;
        const groupId = useGroupStore.getState().activeGroupId;
        if (!userId || !groupId) return null;

        const { type, coords, polygonPoints, radius } = pendingZoneCreation;
        set({ pendingZoneCreation: null });

        const place = await savedPlaceService.createSavedPlace({
          group_id: groupId,
          created_by: userId,
          name: name.trim() || (type === 'circle' ? 'Zone' : 'Polygon Zone'),
          type: 'custom',
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius_meters: type === 'circle' ? Math.round(radius ?? 100) : 100,
          shape_type: type,
          polygon_coords: type === 'polygon' ? polygonPoints : [],
          notify_on_arrival: notifyArrival,
          notify_on_leave: notifyLeave,
          visibility: 'crew',
          alert_rules: {},
        } as any);

        if (place) {
          set((s) => ({ savedPlaces: [place, ...s.savedPlaces] }));
          logEvent(groupId, userId, 'zone_created', `Zone: ${place.name}`,
            `${type === 'polygon' ? 'Polygon' : 'Circle'} zone created.`).catch(() => {});
        } else {
          // Insert failed — tell the user instead of letting the zone vanish silently.
          Alert.alert(
            'Could not save zone',
            "The zone couldn't be saved. Please check your connection and try again. If this keeps happening, the app database may need updating.",
          );
        }
        return place;
      },

      cancelZoneCreation: () => set({ pendingZoneCreation: null, polygonDraftPoints: [], circleDraft: null }),

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
        units: s.units,
        showZones: s.showZones,
        showTrails: s.showTrails,
        hiddenMarkerTypes: s.hiddenMarkerTypes,
      }),
    },
  ),
);
