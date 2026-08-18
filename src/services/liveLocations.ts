import { supabase } from './supabase';
import type { DbLiveLocationUpsert, LocationStatus, SharingMode } from '@/types/database';

export interface LiveLocationPayload {
  groupId: string;
  userId: string;
  latitude: number;
  longitude: number;
  approximateLatitude?: number;
  approximateLongitude?: number;
  heading: number;
  speed: number;
  accuracy: number;
  batteryLevel?: number | null;
  status: LocationStatus;
  sharingMode: SharingMode;
  isApproximate: boolean;
}

/**
 * Upsert the current user's live location for a group.
 * Uses ON CONFLICT (group_id, user_id) DO UPDATE to ensure one row per user/group.
 */
/**
 * Write this device's position for a crew, newest-fix-wins.
 *
 * live_locations is UNIQUE (group_id, user_id), so a plain upsert let whoever
 * wrote LAST win regardless of when the fix was taken. That breaks in two real
 * situations: one account signed into two devices (the crew sees the marker
 * flick between them), and a single device on a flaky network replaying a
 * delayed write over a newer one.
 *
 * The client-side guard in utils/eventOrder.ts protects the READ path only — by
 * the time a stale row is in the database, every other client fetches it. The
 * RPC applies `ON CONFLICT ... DO UPDATE ... WHERE excluded.last_ping_at >
 * live_locations.last_ping_at`, so ordering is enforced where it actually
 * matters. It runs SECURITY INVOKER, so ll_insert / ll_update RLS still apply.
 *
 * Returns false only on a real error — a write rejected for being stale is a
 * successful no-op, not a failure.
 */
export async function upsertLiveLocation(payload: LiveLocationPayload): Promise<boolean> {
  const now = new Date().toISOString();

  const { error } = await supabase.rpc('upsert_live_location', {
    p_group_id: payload.groupId,
    p_latitude: payload.isApproximate ? null : payload.latitude,
    p_longitude: payload.isApproximate ? null : payload.longitude,
    p_approximate_latitude: payload.isApproximate
      ? payload.approximateLatitude ?? payload.latitude
      : null,
    p_approximate_longitude: payload.isApproximate
      ? payload.approximateLongitude ?? payload.longitude
      : null,
    p_heading: payload.heading,
    p_speed: payload.speed,
    p_accuracy: payload.accuracy,
    p_battery_level: payload.batteryLevel ?? null,
    p_status: payload.status,
    p_sharing_mode: payload.sharingMode,
    p_is_approximate: payload.isApproximate,
    p_last_ping_at: now,
  });

  if (error) {
    console.error('[liveLocations] upsert failed:', error.message, error.code);
    return false;
  }
  return true;
}

export async function setLocationOffline(groupId: string, userId: string): Promise<void> {
  await supabase
    .from('live_locations')
    .update({
      status: 'offline',
      updated_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);
}

/**
 * Mark user as paused.
 */
export async function setLocationPaused(groupId: string, userId: string): Promise<void> {
  await supabase
    .from('live_locations')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);
}

/**
 * Fetch all live locations for a group (initial load).
 */
export async function fetchGroupLiveLocations(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('live_locations')
    .select('*')
    .eq('group_id', groupId);
  if (error || !data) return [];
  return data;
}
