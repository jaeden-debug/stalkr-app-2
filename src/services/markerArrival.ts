/**
 * Marker arrival detection — "Jaeden arrived at camp".
 *
 * Zones already notify on enter/leave. This is the same idea one level down: a
 * marker can carry a small radius, so arriving at a specific point of interest
 * inside a zone produces its own alert.
 *
 * The two nest deliberately. Walking onto a property fires the ZONE alert
 * ("arrived at North Field"), then reaching the camp pin inside it fires the
 * MARKER alert ("arrived at Camp"). Zone alerts are not a prerequisite —
 * each marker carries its own notify flag — but when both are on the crew
 * gets the coarse event first and the precise one second, which is the order
 * that actually helps someone looking for you.
 *
 * ── Why arrival needs hysteresis ────────────────────────────────────────────
 * A raw "am I within R metres" test flaps: GPS noise around the boundary
 * produces arrived/left/arrived within seconds, and each flap is a push
 * notification to the whole crew. So arrival requires the fix to be
 * meaningfully inside, and departure requires it to be meaningfully outside,
 * with a gap between the two thresholds that noise cannot cross.
 */
import { supabase } from './supabase';
import { getDistance } from '@/utils/distance';
import type { Marker } from '@/types/models';

/** Default radius when a user enables arrival without choosing one. */
export const DEFAULT_ARRIVAL_RADIUS_M = 50;
export const MIN_ARRIVAL_RADIUS_M = 15;
export const MAX_ARRIVAL_RADIUS_M = 500;

/**
 * Departure threshold as a multiple of the arrival radius. 1.35 means you must
 * get ~35% further out than you came in before it counts as leaving — enough
 * to absorb typical GPS wander without needing to walk far.
 */
const EXIT_HYSTERESIS = 1.35;

/**
 * A fix worse than this cannot resolve a small radius at all. Accepting it
 * would fire "arrived at camp" while the user is still a field away.
 */
const MAX_USABLE_ACCURACY_M = 60;

export interface ArrivalEvaluation {
  markerId: string;
  markerTitle: string;
  /** True when this fix should flip the user to 'inside'. */
  arrived: boolean;
  /** True when this fix should flip the user to 'outside'. */
  departed: boolean;
}

export interface ArrivalInput {
  latitude: number;
  longitude: number;
  /** Reported horizontal accuracy in metres. */
  accuracy: number;
}

/**
 * Decide arrival/departure transitions for one fix across all markers.
 *
 * Pure and synchronous so it can be unit-tested without a device or network.
 * `wasInside` is the caller's memory of the previous state per marker id.
 */
export function evaluateArrivals(
  markers: Marker[],
  fix: ArrivalInput,
  wasInside: Record<string, boolean>,
): ArrivalEvaluation[] {
  // A fix too imprecise to place the user within a 50m circle must not drive
  // arrival at all — better silent than wrong.
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > MAX_USABLE_ACCURACY_M) return [];

  const out: ArrivalEvaluation[] = [];

  for (const marker of markers) {
    const radius = marker.arrival_radius_m;
    if (!radius || radius <= 0) continue;
    if (!Number.isFinite(marker.latitude) || !Number.isFinite(marker.longitude)) continue;

    const distance = getDistance(
      { latitude: fix.latitude, longitude: fix.longitude },
      { latitude: marker.latitude, longitude: marker.longitude },
    );

    const previously = wasInside[marker.id] ?? false;

    // Shrink the arrival ring by the fix's own uncertainty, so a ±40m fix does
    // not claim arrival at a 50m marker from 85m away. Never below a floor —
    // otherwise a poor fix makes arrival unreachable.
    const arriveWithin = Math.max(MIN_ARRIVAL_RADIUS_M / 2, radius - fix.accuracy);
    const departBeyond = radius * EXIT_HYSTERESIS;

    if (!previously && distance <= arriveWithin) {
      out.push({ markerId: marker.id, markerTitle: marker.title, arrived: true, departed: false });
    } else if (previously && distance > departBeyond) {
      out.push({ markerId: marker.id, markerTitle: marker.title, arrived: false, departed: true });
    }
  }

  return out;
}

/** Persist presence so the crew can see who is currently at a marker. */
export async function upsertMarkerPresence(
  markerId: string,
  groupId: string,
  userId: string,
  isInside: boolean,
): Promise<boolean> {
  const { error } = await supabase.from('marker_presence').upsert(
    {
      marker_id: markerId,
      group_id: groupId,
      user_id: userId,
      is_inside: isInside,
      arrived_at: isInside ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'marker_id,user_id' },
  );
  if (error) {
    console.error('[markerArrival] presence upsert failed:', error.message);
    return false;
  }
  return true;
}
