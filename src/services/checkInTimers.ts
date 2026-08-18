import { supabase } from './supabase';
import type { CheckInTimer } from '@/types/models';

export async function createCheckInTimer(
  userId: string,
  minutesFromNow: number,
  notifyUserIds: string[],
  groupId?: string | null,
  label?: string | null,
  mode: 'checkin' | 'deadman' = 'checkin',
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
      mode,
      interval_minutes: minutesFromNow,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as CheckInTimer;
}

/** Clear any prior unresolved timers for a user (one active safety timer at a time). */
export async function clearActiveTimers(userId: string): Promise<void> {
  await supabase.from('check_in_timers').delete().eq('user_id', userId).eq('is_resolved', false);
}

/**
 * Claim a timer's escalation so the server sweep does not repeat it.
 *
 * The client escalates immediately when the app is alive, which is faster than
 * waiting up to a minute for the cron sweep. But the sweep is what covers the
 * case that actually matters — a phone that is dead or offline — so both paths
 * exist. Writing escalated here is what stops the crew being alerted twice for
 * one missed check-in, with two feed entries to match.
 */
export async function markTimerEscalated(timerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('check_in_timers')
    .update({ escalated: true, escalated_at: new Date().toISOString() })
    .eq('id', timerId)
    .eq('escalated', false);
  return !error;
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
