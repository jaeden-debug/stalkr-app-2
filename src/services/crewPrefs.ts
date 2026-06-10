/**
 * crewPrefs service — Supabase sync for per-crew and per-member notification
 * preferences. All calls are best-effort: if the tables don't exist yet (the
 * migration hasn't been applied) they fail quietly and the client falls back to
 * its locally-persisted copy in useCrewPrefsStore.
 */
import { supabase } from './supabase';

export interface CrewPrefRow {
  group_id: string;
  muted: boolean;
  notify_crew_zone_activity: boolean | null;
  notify_sos: boolean | null;
}

export interface MemberPrefRow {
  group_id: string;
  target_user_id: string;
  notify_enter: boolean;
  notify_leave: boolean;
  notify_overstay: boolean;
  muted: boolean;
}

export async function fetchCrewPrefs(userId: string): Promise<CrewPrefRow[]> {
  try {
    const { data, error } = await supabase
      .from('crew_notification_prefs')
      .select('group_id, muted, notify_crew_zone_activity, notify_sos')
      .eq('user_id', userId);
    if (error || !data) return [];
    return data as CrewPrefRow[];
  } catch {
    return [];
  }
}

export async function fetchMemberPrefs(userId: string): Promise<MemberPrefRow[]> {
  try {
    const { data, error } = await supabase
      .from('member_notification_prefs')
      .select('group_id, target_user_id, notify_enter, notify_leave, notify_overstay, muted')
      .eq('user_id', userId);
    if (error || !data) return [];
    return data as MemberPrefRow[];
  } catch {
    return [];
  }
}

export async function upsertCrewPref(userId: string, row: CrewPrefRow): Promise<void> {
  try {
    await supabase
      .from('crew_notification_prefs')
      .upsert(
        { user_id: userId, ...row, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,group_id' },
      );
  } catch {
    /* offline / table missing — local copy is source of truth */
  }
}

export async function upsertMemberPref(userId: string, row: MemberPrefRow): Promise<void> {
  try {
    await supabase
      .from('member_notification_prefs')
      .upsert(
        { user_id: userId, ...row, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,group_id,target_user_id' },
      );
  } catch {
    /* offline / table missing */
  }
}
