import { supabase } from './supabase';
import type { Session, SessionMember, SessionWatcher } from '@/types/models';
import type { DbSessionInsert, DbSessionUpdate, DbSessionWatcherInsert } from '@/types/database';

const WATCH_BASE_URL = 'https://stalkr.app/watch';

/** Build the public watch URL for a session. */
export function buildWatchUrl(watchToken: string): string {
  return `${WATCH_BASE_URL}/${watchToken}`;
}

export async function fetchGroupSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false });
  if (error || !data) return [];
  return data as Session[];
}

/** Fetch all sessions created by the current user (group + standalone). */
export async function fetchMySessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('created_by', userId)
    .order('started_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as Session[];
}

export async function fetchActiveSession(groupId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as Session;
}

export async function fetchMyActiveJourneySession(userId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('created_by', userId)
    .eq('is_active', true)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as Session;
}

export async function createSession(insert: DbSessionInsert): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert(insert)
    .select()
    .single();
  if (error || !data) return null;

  // Add creator as owner member
  await supabase.from('session_members').insert({
    session_id: data.id,
    user_id: insert.created_by,
    role: 'owner',
    status: 'live',
  });

  return data as Session;
}

export async function joinSessionByInviteCode(
  code: string,
  userId: string,
): Promise<Session | null> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('is_active', true)
    .single();
  if (error || !session) return null;

  await supabase.from('session_members').upsert(
    { session_id: session.id, user_id: userId, role: 'member', status: 'live' },
    { onConflict: 'session_id,user_id' },
  );

  return session as Session;
}

export async function endSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sessions')
    .update({
      is_active: false,
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    } satisfies DbSessionUpdate)
    .eq('id', sessionId);
  return !error;
}

/** Mark session as arrived — sets status, ended_at, broadcasts to watchers. */
export async function markSessionArrived(sessionId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('sessions')
    .update({
      is_active: false,
      status: 'arrived',
      arrived_at: now,
      ended_at: now,
    } satisfies DbSessionUpdate)
    .eq('id', sessionId);
  return !error;
}

export async function updateSession(sessionId: string, updates: DbSessionUpdate): Promise<boolean> {
  const { error } = await supabase.from('sessions').update(updates).eq('id', sessionId);
  return !error;
}

export async function fetchSessionMembers(sessionId: string): Promise<SessionMember[]> {
  const { data, error } = await supabase
    .from('session_members')
    .select(`*, profile:profiles(id, display_name, nickname, initials, avatar_url)`)
    .eq('session_id', sessionId);
  if (error || !data) return [];
  return data as SessionMember[];
}

export async function fetchSessionWatchers(sessionId: string): Promise<SessionWatcher[]> {
  const { data, error } = await supabase
    .from('session_watchers')
    .select(`*, profile:profiles(id, display_name, nickname, initials, avatar_url)`)
    .eq('session_id', sessionId);
  if (error || !data) return [];
  return data as SessionWatcher[];
}

/** Add an app member as a watcher (gets push notification). */
export async function addMemberWatcher(
  sessionId: string,
  userId: string,
  pushToken: string | null,
): Promise<void> {
  await supabase.from('session_watchers').upsert(
    { session_id: sessionId, user_id: userId, push_token: pushToken } satisfies DbSessionWatcherInsert,
    { onConflict: 'session_id,user_id' },
  );
}

/** Add a non-member watcher by email (called from watch page via RPC). */
export async function addEmailWatcher(sessionId: string, email: string): Promise<void> {
  await supabase.rpc('add_session_email_watcher', {
    p_session_id: sessionId,
    p_email: email,
  });
}

/** Get all push tokens for watchers of a session (for arrival push). */
export async function getWatcherPushTokens(sessionId: string): Promise<{ userId: string; token: string }[]> {
  const { data } = await supabase
    .from('session_watchers')
    .select('user_id, push_token')
    .eq('session_id', sessionId)
    .not('push_token', 'is', null);
  if (!data) return [];
  return data
    .filter((r: any) => r.push_token)
    .map((r: any) => ({ userId: r.user_id, token: r.push_token }));
}

export async function addWatcherToken(sessionId: string, pushToken: string): Promise<void> {
  const { data } = await supabase
    .from('sessions')
    .select('watcher_push_tokens')
    .eq('id', sessionId)
    .single();
  const existing: string[] = (data as any)?.watcher_push_tokens ?? [];
  if (existing.includes(pushToken)) return;
  await supabase
    .from('sessions')
    .update({ watcher_push_tokens: [...existing, pushToken] })
    .eq('id', sessionId);
}
