/**
 * useHeading — read-only view of the device compass for UI consumers.
 *
 * This hook used to open its OWN Location.watchHeadingAsync subscription (and
 * request permissions again), so with TacticalHud mounted the app ran two
 * concurrent magnetometer streams. There is now exactly one heading watcher,
 * owned by useLocationTracker, which publishes into useSelfPoseStore. This hook
 * is a pure consumer of that store and starts no sensors of its own.
 */
import { useSelfPoseStore } from '@/store/useSelfPoseStore';
import { degreesToCardinal } from '@/utils/heading';

export interface HeadingData {
  /** Smoothed heading in degrees, or null when the compass is unavailable. */
  heading: number | null;
  /**
   * Kept for backwards compatibility with existing HUD code. Reads the same
   * smoothed value; the app no longer distinguishes magnetic from true north at
   * the UI layer because useLocationTracker already prefers trueHeading and
   * falls back to magHeading at the source.
   */
  magHeading: number;
  trueHeading: number;
  /** Cardinal abbreviation (N, NE, E…), or '--' when heading is unknown. */
  direction: string;
  /** False when no trustworthy compass reading exists — do not render a bearing. */
  available: boolean;
}

export function useHeading(): HeadingData {
  const heading = useSelfPoseStore((s) => s.heading);

  if (heading == null) {
    return { heading: null, magHeading: 0, trueHeading: 0, direction: '--', available: false };
  }

  const rounded = Math.round(heading);
  return {
    heading,
    magHeading: rounded,
    trueHeading: rounded,
    direction: degreesToCardinal(rounded),
    available: true,
  };
}
