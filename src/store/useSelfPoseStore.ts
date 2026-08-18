/**
 * useSelfPoseStore — high-frequency local sensor state, deliberately kept OUT
 * of useMapStore.
 *
 * Why this store exists
 * The device compass fires ~10x/second. It used to be written into
 * useMapStore.myLocation, which also owns markers, zones, crew locations,
 * selection and drafts. Because Zustand compares with Object.is and several map
 * components subscribe to that store, physically rotating the phone re-rendered
 * MarkerLayer, ZoneLayer and the whole MapScreen ten times a second.
 *
 * The split is by UPDATE FREQUENCY and ownership, not by tidiness:
 *   useSelfPoseStore  — compass heading. ~10 Hz. Consumers: self puck, HUD.
 *   useMapStore       — markers, zones, crew, selection, position (~0.25 Hz).
 *
 * Not persisted: sensor readings are meaningless across launches, and writing
 * to AsyncStorage at 10 Hz would be its own performance bug.
 */
import { create } from 'zustand';

interface SelfPoseState {
  /**
   * Smoothed device-facing direction in degrees clockwise from true north,
   * or null when the compass is unavailable / not yet trusted.
   *
   * null is meaningful and must be preserved: a marker that renders 0° when
   * heading is unknown is claiming the user faces north, which is a lie. The
   * puck drops its arrow instead.
   */
  heading: number | null;
  /** Reported accuracy of the heading in degrees, when the platform supplies it. */
  headingAccuracy: number | null;

  setHeading: (heading: number | null, headingAccuracy?: number | null) => void;
  reset: () => void;
}

export const useSelfPoseStore = create<SelfPoseState>()((set) => ({
  heading: null,
  headingAccuracy: null,

  setHeading: (heading, headingAccuracy = null) => set({ heading, headingAccuracy }),

  reset: () => set({ heading: null, headingAccuracy: null }),
}));
