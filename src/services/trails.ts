import { supabase } from './supabase';
import type { TrailPoint } from '@/types/models';
import type { DbTrailPointInsert } from '@/types/database';

export async function insertTrailPoint(insert: DbTrailPointInsert): Promise<boolean> {
  const { error } = await supabase.from('trail_points').insert(insert);
  return !error;
}

export async function fetchUserTrail(
  groupId: string,
  userId: string,
  hoursBack: number = 24,
): Promise<TrailPoint[]> {
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('trail_points')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as TrailPoint[];
}

export async function fetchSessionTrail(
  sessionId: string,
  userId: string,
): Promise<TrailPoint[]> {
  const { data, error } = await supabase
    .from('trail_points')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as TrailPoint[];
}

export async function deleteUserTrail(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('trail_points')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  return !error;
}
