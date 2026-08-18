import { supabase } from './supabase';
import type { Session, SessionMember, SessionWatcher } from '@/types/models';
import type { DbSessionInsert, DbSessionUpdate, DbSessionWatcherInsert } from '@/types/database';

const WATCH_BASE_URL = 'https://app.navtrl.com/watch';

/** Build the public watch URL for a session. */
export function buildWatchUrl(watchToken: string): string {
  return `${WATCH_BASE_URL}/${watchToken}`;
}

export async function fetchGroupSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false })
    // Bounded: this table only grows, and the sessions tab renders the whole
    // result. fetchMySessions already caps at 50.
    .limit(100);
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


/**
 * Tell every open watch page that a journey reached a terminal state.
 *
 * The watch page listens on the Realtime channel; without this it keeps
 * rendering the last known position as though the journey were still running,
 * and only discovers the truth if someone happens to reload the page. A
 * watcher looking at a live-looking map of a journey that ended twenty minutes
 * ago is the worst failure this feature has, because it reads as "still on
 * their way" when the real answer is "they stopped sharing".
 *
 * Fire-and-forget by design: a watcher's channel must never be able to block
 * or fail the traveller's own state change.
 */
/**
 * Push a journey's deadline back — "still going, I'm fine".
 *
 * Re-arms the overdue ladder server-side, so a journey that was already nudged
 * will nudge again against the new deadline instead of sliding past it in
 * silence.
 */
export async function extendJourneyEta(
  sessionId: string,
  minutes: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('extend_journey_eta', {
    p_session_id: sessionId,
    p_minutes: minutes,
  });
  if (error) return null;
  return data as string;
}

export async function markInvitesSent(
  sessionId: string,
  match: { channel: 'phone' } | { channel: 'email' } | { userIds: string[] },
): Promise<void> {
  let q = supabase.from('session_watchers').update({ invite_sent: true }).eq('session_id', sessionId);
  if ('userIds' in match) {
    if (!match.userIds.length) return;
    q = q.in('user_id', match.userIds);
  } else if (match.channel === 'phone') {
    q = q.not('phone', 'is', null);
  } else {
    q = q.is('phone', null).not('email', 'is', null);
  }
  await q;
}

export async function broadcastSessionEvent(
  watchToken: string,
  event: 'arrived' | 'ended',
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const ch = supabase.channel(`session:${watchToken}`);
    await ch.subscribe();
    await ch.send({ type: 'broadcast', event, payload });
    supabase.removeChannel(ch);
  } catch {
    // Best effort. The page also resolves terminal state on load via
    // get_session_by_watch_token, so a dropped broadcast degrades to "correct
    // on next refresh" rather than to a wrong answer.
  }
}

/**
 * Persist last-known position so the watch page has something to render the
 * instant it opens, instead of a blank map until the next GPS fix.
 */
export async function persistSessionPosition(
  sessionId: string,
  latitude: number,
  longitude: number,
  heading: number | null,
): Promise<void> {
  try {
    await supabase.rpc('update_session_position', {
      p_session_id: sessionId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_heading: heading,
    });
  } catch {}
}

export async function endSession(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      is_active: false,
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    } satisfies DbSessionUpdate)
    .eq('id', sessionId)
    .select('watch_token')
    .maybeSingle();
  if (error) return false;
  if (data?.watch_token) {
    await broadcastSessionEvent(data.watch_token, 'ended', {
      sessionId,
      status: 'cancelled',
      endedAt: new Date().toISOString(),
    });
  }
  return true;
}

/**
 * Mark a journey arrived.
 *
 * The old comment here claimed this broadcast to watchers; it did not. Only the
 * automatic arrival path in useLocationTracker broadcast, so a traveller who
 * tapped "I've arrived" manually left every open watch page showing them still
 * en route. It now broadcasts on every path.
 */
export async function markSessionArrived(sessionId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .update({
      is_active: false,
      status: 'arrived',
      arrived_at: now,
      ended_at: now,
    } satisfies DbSessionUpdate)
    .eq('id', sessionId)
    .select('watch_token')
    .maybeSingle();
  if (error) return false;
  if (data?.watch_token) {
    await broadcastSessionEvent(data.watch_token, 'arrived', { sessionId, arrivedAt: now });
  }
  return true;
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

/** Add any watcher (member, phone, email, or manual) to a journey. */
export async function addWatcher(
  sessionId: string,
  w: { userId?: string | null; name?: string | null; phone?: string | null; email?: string | null; pushToken?: string | null; inviteSent?: boolean },
): Promise<void> {
  // Skip rows with no identity at all.
  if (!w.userId && !w.email && !w.phone) return;
  await supabase.from('session_watchers').insert({
    session_id: sessionId,
    user_id: w.userId ?? null,
    name: w.name ?? null,
    phone: w.phone ?? null,
    email: w.email ?? null,
    push_token: w.pushToken ?? null,
    invite_sent: w.inviteSent ?? false,
  } as any);
}

/**
 * Subscribe an email address to a journey from the public watch page.
 *
 * Keyed on the WATCH TOKEN, not the session id. The token is the capability —
 * holding the link already grants live view of the journey, so it is the right
 * thing to gate subscription on. Keying on session id let anyone who learned a
 * session UUID subscribe an arbitrary address to someone else's journey.
 *
 * Throws with a machine-readable code so the caller can distinguish a full
 * watcher list from a dead link from a genuine failure.
 */
export async function addEmailWatcher(watchToken: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('add_watch_email_subscriber', {
    p_token: watchToken,
    p_email: email,
  });
  if (error) throw new Error(error.message);
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
