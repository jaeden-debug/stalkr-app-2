import { supabase } from './supabase';
import type { Session, SessionMember } from '@/types/models';
import type { DbSessionInsert, DbSessionUpdate } from '@/types/database';

export async function fetchGroupSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false });
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
      ended_at: new Date().toISOString(),
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
