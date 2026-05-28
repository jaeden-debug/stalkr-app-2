import { supabase } from './supabase';
import type { CheckInTimer } from '@/types/models';

export async function createCheckInTimer(
  userId: string,
  minutesFromNow: number,
  notifyUserIds: string[],
  groupId?: string | null,
  label?: string | null,
): Promise<CheckInTimer | null> {
  const checkInAt = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
  const { data, error } = await supabase
    .from('check_in_timers')
    .insert({
      user_id: userId,
      group_id: groupId ?? null,
      label: label ?? null,
      check_in_at: checkInAt,
      is_resolved: false,
      notify_user_ids: notifyUserIds,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as CheckInTimer;
}

export async function resolveCheckInTimer(timerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('check_in_timers')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', timerId);
  return !error;
}

export async function fetchActiveTimer(userId: string): Promise<CheckInTimer | null> {
  const { data, error } = await supabase
    .from('check_in_timers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as CheckInTimer;
}

export async function deleteCheckInTimer(timerId: string): Promise<boolean> {
  const { error } = await supabase.from('check_in_timers').delete().eq('id', timerId);
  return !error;
}
