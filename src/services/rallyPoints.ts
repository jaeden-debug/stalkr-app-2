import { supabase } from './supabase';
import type { RallyPoint } from '@/types/models';

export async function fetchActiveRallyPoint(groupId: string): Promise<RallyPoint | null> {
  const { data, error } = await supabase
    .from('rally_points')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as RallyPoint;
}

export async function setRallyPoint(
  groupId: string,
  userId: string,
  name: string,
  latitude: number,
  longitude: number,
): Promise<RallyPoint | null> {
  // Deactivate existing
  await supabase
    .from('rally_points')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('rally_points')
    .insert({ group_id: groupId, created_by: userId, name, latitude, longitude, is_active: true })
    .select()
    .single();
  if (error || !data) return null;
  return data as RallyPoint;
}

export async function clearRallyPoint(groupId: string): Promise<boolean> {
  const { error } = await supabase
    .from('rally_points')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('is_active', true);
  return !error;
}
