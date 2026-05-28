import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SharingMode } from '@/types/database';
import type { MapCrewMember } from '@/types/models';

interface LocationState {
  isBroadcasting: boolean;
  /** Per-group broadcasting overrides */
  groupBroadcastingStatus: Record<string, boolean>;
  sharingMode: SharingMode;
  isApproximate: boolean;
  lastBroadcastAt: string | null;
  batteryLevel: number | null;

  // ── Read from map store rather than duplicating, but SelfMarkerMenu
  //    historically read from this store. We expose pass-through selectors
  //    that delegate to useMapStore at runtime.
  //    These are populated by useLocationTracker writing to useMapStore.
  //    Components SHOULD use useMapStore for location/crew data.
  //    These aliases exist only for backward compatibility with components
  //    that were wired to this store before the refactor.
  crewLocations: Record<string, MapCrewMember>;
  myLocation: { latitude: number; longitude: number; heading: number; accuracy: number } | null;
  lastPingAt: string | null;

  // Aliases
  isBroadcastingLocation: boolean;

  setIsBroadcasting: (v: boolean) => void;
  setIsBroadcastingLocation: (v: boolean) => void; // alias
  setGroupBroadcasting: (groupId: string, v: boolean) => void;
  setSharingMode: (mode: SharingMode) => void;
  setIsApproximate: (v: boolean) => void;
  setLastBroadcastAt: (iso: string) => void;
  setBatteryLevel: (level: number | null) => void;

  // These are set by useLocationTracker via useMapStore — mirrored here
  // for components that haven't been migrated yet
  setMyLocationMirror: (loc: { latitude: number; longitude: number; heading: number; accuracy: number }) => void;
  setCrewLocationMirror: (userId: string, loc: MapCrewMember) => void;
  setLastPingAt: (iso: string) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      isBroadcasting: false,
      groupBroadcastingStatus: {},
      sharingMode: 'sessions_only',
      isApproximate: false,
      lastBroadcastAt: null,
      batteryLevel: null,
      crewLocations: {},
      myLocation: null,
      lastPingAt: null,

      get isBroadcastingLocation() {
        return get().isBroadcasting;
      },

      setIsBroadcasting: (v) => set({ isBroadcasting: v }),
      setIsBroadcastingLocation: (v) => set({ isBroadcasting: v }),
      setGroupBroadcasting: (groupId, v) =>
        set((s) => ({ groupBroadcastingStatus: { ...s.groupBroadcastingStatus, [groupId]: v } })),
      setSharingMode: (mode) => set({ sharingMode: mode }),
      setIsApproximate: (v) => set({ isApproximate: v }),
      setLastBroadcastAt: (iso) => set({ lastBroadcastAt: iso, lastPingAt: iso }),
      setBatteryLevel: (level) => set({ batteryLevel: level }),

      setMyLocationMirror: (loc) => set({ myLocation: loc }),
      setCrewLocationMirror: (userId, loc) =>
        set((s) => ({ crewLocations: { ...s.crewLocations, [userId]: loc } })),
      setLastPingAt: (iso) => set({ lastPingAt: iso }),
    }),
    {
      name: 'location-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        groupBroadcastingStatus: s.groupBroadcastingStatus,
        sharingMode: s.sharingMode,
        isApproximate: s.isApproximate,
        isBroadcasting: s.isBroadcasting,
      }),
    },
  ),
);
