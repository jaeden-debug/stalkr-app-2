/**
 * Writes trail points to Supabase when movement is worth recording.
 * Reads location from the store — does NOT create its own GPS watch.
 *
 * The sampling decision lives in utils/trailPolicy.ts so it is testable without
 * a device. See that file for why the old distance-AND-time gate erased corners.
 */
import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { insertTrailPoint } from '@/services/trails';
import { isUuid } from '@/utils/async';
import { isBroadcastingToCrew } from '@/utils/broadcast';
import { decideTrailPoint, type TrailAnchor } from '@/utils/trailPolicy';

export function useTrailWriter() {
  const anchor = useRef<TrailAnchor | null>(null);
  const inFlight = useRef(false);
  const myLocation = useMapStore((s) => s.myLocation);

  // Gate on the SAME expression the location tracker uses. This previously read
  // useLocationStore.isBroadcasting — the vestigial global flag, which defaults
  // to false and is no longer the source of truth, so trails silently never
  // recorded until the user happened to toggle Go Dark twice.
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const enforced = useGroupStore(
    (s) => s.groups.find((g) => g.id === s.activeGroupId)?.tracking_mode === 'enforced',
  );
  const sharing = useLocationStore((s) =>
    isBroadcastingToCrew(s.groupBroadcastingStatus, activeGroupId, { enforced }),
  );

  useEffect(() => {
    if (!myLocation) return;

    // Going dark stops NEW shared points. Existing ones are deliberately kept:
    // the path leading up to someone's last known position is the most useful
    // thing about a dark user. The anchor is cleared so resuming later starts a
    // fresh segment rather than drawing a line across the dark period.
    if (!sharing) {
      anchor.current = null;
      return;
    }

    const userId = useAuthStore.getState().session?.user?.id;
    const groupId = activeGroupId;
    if (!userId || !isUuid(groupId)) return;
    if (inFlight.current) return;

    const decision = decideTrailPoint(anchor.current, {
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      accuracy: myLocation.accuracy,
      speed: myLocation.speed ?? null,
      heading: myLocation.heading,
      timestamp: Date.now(),
    });

    if (!decision.record) return;

    const point: TrailAnchor = {
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      heading: myLocation.heading,
      timestamp: Date.now(),
    };
    anchor.current = point;
    inFlight.current = true;

    insertTrailPoint({
      group_id: groupId!,
      user_id: userId,
      latitude: point.latitude,
      longitude: point.longitude,
      heading: myLocation.heading,
      speed: myLocation.speed ?? null,
      accuracy: myLocation.accuracy,
    } as never)
      .catch((err) => {
        // Roll the anchor back so the next fix is judged against the last
        // SUCCESSFULLY written point — otherwise a failed write silently
        // creates a hole the policy thinks it already filled.
        anchor.current = null;
        console.error('[trail] insert failed:', err);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [myLocation, sharing, activeGroupId]);
}
