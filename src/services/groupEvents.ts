import { supabase } from './supabase';
import type { GroupEvent } from '@/types/models';
import type { DbGroupEventInsert, GroupEventType } from '@/types/database';

export async function logEvent(
  groupId: string,
  userId: string,
  eventType: GroupEventType,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from('group_events').insert({
    group_id: groupId,
    user_id: userId,
    event_type: eventType,
    title,
    body: body ?? null,
    metadata: metadata ?? {},
  } satisfies DbGroupEventInsert);
  return !error;
}

export async function fetchGroupEvents(
  groupId: string,
  limit = 50,
): Promise<GroupEvent[]> {
  const { data, error } = await supabase
    .from('group_events')
    .select('*, profile:profiles(id, display_name, nickname, initials, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as GroupEvent[];
}
