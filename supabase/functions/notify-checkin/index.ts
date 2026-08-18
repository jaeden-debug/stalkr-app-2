/**
 * notify-checkin — a safety timer lapsed without confirmation.
 *
 * Invoked only by escalate_overdue_checkins() on the database side, which owns
 * the state machine and has already marked the timer escalated and written the
 * crew activity event. This function does delivery, nothing more.
 *
 * Why it exists: escalation previously wrote a group_events row and stopped
 * there. Crew members learned that someone's deadman switch had lapsed only if
 * they happened to open the app. For the one feature whose entire purpose is
 * "tell someone if I stop responding", a passive feed entry is not delivery.
 *
 * Recipients are the users recorded on the timer at ARM time, not the crew's
 * current admins. The person who armed it was shown who would be told, and
 * that promise should not silently change if the crew roster does.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isTrustedServerCaller } from '../_shared/trustedCaller.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!isTrustedServerCaller(bearer, SERVICE_ROLE_KEY)) return json({ error: 'forbidden' }, 403);

  try {
    const { timerId } = (await req.json()) as { timerId?: string };
    if (!timerId) return json({ error: 'timerId required' }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: timer } = await db
      .from('check_in_timers')
      .select('id, user_id, label, mode, check_in_at, notify_user_ids, is_resolved')
      .eq('id', timerId)
      .single();

    if (!timer) return json({ error: 'timer not found' }, 404);

    // The traveller may have confirmed between the sweep and this call. Sending
    // "they did not check in" after they did is a false alarm, and false alarms
    // are how people learn to ignore the real ones.
    if (timer.is_resolved) return json({ pushed: 0, reason: 'resolved_before_send' });

    const recipients = (timer.notify_user_ids ?? []) as string[];
    if (!recipients.length) return json({ pushed: 0, reason: 'no_recipients' });

    const { data: profiles } = await db
      .from('profiles')
      .select('id, push_token, display_name, nickname')
      .in('id', recipients);

    const tokens = (profiles ?? []).map((p) => p.push_token).filter(Boolean) as string[];

    const { data: subject } = await db
      .from('profiles')
      .select('display_name, nickname')
      .eq('id', timer.user_id)
      .single();

    const name = subject?.nickname || subject?.display_name || 'Someone in your crew';
    const deadman = timer.mode === 'deadman';

    const title = deadman ? `Dead-man alert — ${name}` : `${name} missed a check-in`;
    const body = timer.label
      ? `${timer.label} — they did not confirm they were safe. Try to reach them.`
      : deadman
        ? 'Their dead-man switch lapsed without confirmation. Try to reach them.'
        : 'They did not confirm they were safe. Try to reach them.';

    if (!tokens.length) return json({ pushed: 0, reason: 'no_push_tokens', recipients: recipients.length });

    const pushed = await pushMany(tokens, {
      title,
      body,
      data: { type: deadman ? 'checkin_missed' : 'checkin_due', timerId: timer.id },
    });

    return json({ pushed, recipients: recipients.length });
  } catch (err) {
    console.error('[notify-checkin]', err);
    return json({ error: 'internal error' }, 500);
  }
});

async function pushMany(
  tokens: string[],
  msg: { title: string; body: string; data: Record<string, unknown> },
): Promise<number> {
  let ok = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({
      to,
      sound: 'default',
      // A lapsed safety timer must survive a quiet-hours schedule; this is the
      // category of notification those settings exist to make room for.
      priority: 'high',
      channelId: 'sos',
      ...msg,
    }));
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) ok += batch.length;
      else console.error('[notify-checkin] expo rejected', res.status, await res.text());
    } catch (e) {
      console.error('[notify-checkin] push failed', e);
    }
  }
  return ok;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
