import { supabase } from './supabase';
import type { Marker, MarkerPhoto } from '@/types/models';
import type { DbMarkerInsert, DbMarkerUpdate } from '@/types/database';
import { isValidLatitude, isValidLongitude, rejectRow, toFiniteNumber } from './normalize';

/**
 * Single source of truth for whether a marker row may appear on the map.
 *
 * The initial fetch filtered `visible_to_group = true` in SQL but the realtime
 * upsert applied no filter at all, so a hidden marker would pop onto the map
 * live and then disappear on the next reload. Both paths now call this.
 */
export function isMarkerVisibleToGroup(row: any): boolean {
  return row?.visible_to_group !== false;
}

/**
 * Validate + coerce a markers row from either PostgREST or realtime.
 * Returns null (and reports in dev) when the row cannot be rendered.
 */
export function normalizeMarker(row: any): Marker | null {
  if (!row?.id) return rejectRow('marker', 'missing id', row);
  if (!row?.group_id) return rejectRow('marker', 'missing group_id', row);

  const latitude = toFiniteNumber(row.latitude);
  const longitude = toFiniteNumber(row.longitude);
  if (!isValidLatitude(latitude)) return rejectRow('marker', `invalid latitude ${row.latitude}`, row);
  if (!isValidLongitude(longitude)) return rejectRow('marker', `invalid longitude ${row.longitude}`, row);

  // Arrival fields normalise too: realtime can deliver an integer column as a
  // string, and a string radius would fail the `> 0` guard in evaluateArrivals,
  // silently disabling arrival alerts for that marker.
  const arrivalRadius = toFiniteNumber(row.arrival_radius_m);

  return {
    ...row,
    latitude,
    longitude,
    arrival_radius_m: arrivalRadius,
    notify_on_arrival: row.notify_on_arrival === true,
  } as Marker;
}

export async function fetchGroupMarkers(groupId: string): Promise<Marker[]> {
  const { data, error } = await supabase
    .from('markers')
    .select('*')
    .eq('group_id', groupId)
    .eq('visible_to_group', true)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(normalizeMarker).filter((m): m is Marker => m !== null);
}

export async function createMarker(insert: DbMarkerInsert): Promise<Marker | null> {
  const { data, error } = await supabase
    .from('markers')
    .insert(insert)
    .select()
    .single();
  if (error || !data) return null;
  return normalizeMarker(data);
}

export async function updateMarker(markerId: string, updates: DbMarkerUpdate): Promise<boolean> {
  const { error } = await supabase
    .from('markers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', markerId);
  return !error;
}

export async function deleteMarker(markerId: string): Promise<boolean> {
  const { error } = await supabase.from('markers').delete().eq('id', markerId);
  return !error;
}

export async function fetchMarkerPhotos(markerId: string): Promise<MarkerPhoto[]> {
  const { data, error } = await supabase
    .from('marker_photos')
    .select('*')
    .eq('marker_id', markerId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];

  return data.map((p: any) => ({
    ...p,
    url: supabase.storage.from('marker-photos').getPublicUrl(p.storage_path).data.publicUrl,
  })) as MarkerPhoto[];
}

export async function uploadMarkerPhoto(
  markerId: string,
  groupId: string,
  userId: string,
  uri: string,
  caption?: string,
): Promise<MarkerPhoto | null> {
  try {
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${groupId}/${markerId}/${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error: uploadErr } = await supabase.storage
      .from('marker-photos')
      .upload(path, blob, { contentType: `image/${ext}` });
    if (uploadErr) return null;

    const { data, error } = await supabase
      .from('marker_photos')
      .insert({
        marker_id: markerId,
        group_id: groupId,
        uploaded_by: userId,
        storage_path: path,
        caption: caption ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;

    return {
      ...data,
      url: supabase.storage.from('marker-photos').getPublicUrl(path).data.publicUrl,
    } as MarkerPhoto;
  } catch {
    return null;
  }
}

export async function deleteMarkerPhoto(photoId: string, storagePath: string): Promise<boolean> {
  await supabase.storage.from('marker-photos').remove([storagePath]);
  const { error } = await supabase.from('marker_photos').delete().eq('id', photoId);
  return !error;
}
