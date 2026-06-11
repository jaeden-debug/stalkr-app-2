import { supabase } from './supabase';
import type { SavedPlace, SavedPlacePresence, SavedPlacePhoto } from '@/types/models';
import type { DbSavedPlaceInsert, DbSavedPlaceUpdate } from '@/types/database';

export async function fetchGroupSavedPlaces(groupId: string): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SavedPlace[];
}

export async function createSavedPlace(insert: DbSavedPlaceInsert): Promise<SavedPlace | null> {
  const { data, error } = await supabase
    .from('saved_places')
    .insert(insert)
    .select()
    .single();
  if (error || !data) {
    // Surface the real cause (e.g. missing column / RLS) instead of silently
    // returning null, which made zones "disappear" with no explanation.
    console.error('createSavedPlace failed:', error?.message, error?.details, error?.code);
    return null;
  }
  return data as SavedPlace;
}

export async function updateSavedPlace(
  placeId: string,
  updates: DbSavedPlaceUpdate,
): Promise<boolean> {
  const { error } = await supabase
    .from('saved_places')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', placeId);
  return !error;
}

export async function deleteSavedPlace(placeId: string): Promise<boolean> {
  const { error } = await supabase.from('saved_places').delete().eq('id', placeId);
  return !error;
}

export async function upsertPresence(
  savedPlaceId: string,
  groupId: string,
  userId: string,
  isInside: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from('saved_place_presence').upsert(
    {
      saved_place_id: savedPlaceId,
      group_id: groupId,
      user_id: userId,
      is_inside: isInside,
      last_entered_at: isInside ? now : undefined,
      last_left_at: !isInside ? now : undefined,
      updated_at: now,
    },
    { onConflict: 'saved_place_id,user_id' },
  );
}

export async function fetchPresence(groupId: string): Promise<SavedPlacePresence[]> {
  const { data, error } = await supabase
    .from('saved_place_presence')
    .select('*')
    .eq('group_id', groupId);
  if (error || !data) return [];
  return data as SavedPlacePresence[];
}

export async function fetchSavedPlacePhotos(savedPlaceId: string): Promise<SavedPlacePhoto[]> {
  const { data, error } = await supabase
    .from('saved_place_photos')
    .select('*')
    .eq('saved_place_id', savedPlaceId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((p: any) => ({
    ...p,
    url: supabase.storage.from('zone-photos').getPublicUrl(p.storage_path).data.publicUrl,
  })) as SavedPlacePhoto[];
}

export async function uploadSavedPlacePhoto(
  savedPlaceId: string,
  groupId: string,
  userId: string,
  uri: string,
  caption?: string,
): Promise<SavedPlacePhoto | null> {
  try {
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${groupId}/${savedPlaceId}/${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error: uploadErr } = await supabase.storage
      .from('zone-photos')
      .upload(path, blob, { contentType: `image/${ext}` });
    if (uploadErr) return null;

    const { data, error } = await supabase
      .from('saved_place_photos')
      .insert({ saved_place_id: savedPlaceId, group_id: groupId, uploaded_by: userId, storage_path: path, caption: caption ?? null })
      .select()
      .single();
    if (error || !data) return null;
    return { ...data, url: supabase.storage.from('zone-photos').getPublicUrl(path).data.publicUrl } as SavedPlacePhoto;
  } catch {
    return null;
  }
}
