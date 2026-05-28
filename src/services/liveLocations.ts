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
export async function upsertLiveLocation(payload: LiveLocationPayload): Promise<boolean> {
  const now = new Date().toISOString();
  const row: DbLiveLocationUpsert = {
    group_id: payload.groupId,
    user_id: payload.userId,
    latitude: payload.isApproximate ? null : payload.latitude,
    longitude: payload.isApproximate ? null : payload.longitude,
    approximate_latitude: payload.isApproximate ? payload.approximateLatitude ?? payload.latitude : null,
    approximate_longitude: payload.isApproximate ? payload.approximateLongitude ?? payload.longitude : null,
    heading: payload.heading,
    speed: payload.speed,
    accuracy: payload.accuracy,
    battery_level: payload.batteryLevel ?? null,
    status: payload.status,
    sharing_mode: payload.sharingMode,
    is_approximate: payload.isApproximate,
    last_ping_at: now,
    updated_at: now,
  };

  const { error } = await supabase
    .from('live_locations')
    .upsert(row, { onConflict: 'group_id,user_id' });

  return !error;
}

/**
 * Mark user as offline in a group (stop broadcasting).
 */
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
