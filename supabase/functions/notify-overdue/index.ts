/**
 * notify-overdue — a journey has passed its expected arrival time.
 *
 * Invoked only by process_overdue_journeys() on the database side, which owns
 * the escalation state machine. This function does delivery, nothing more: it
 * makes no decision about whether an alert is warranted, because that decision
 * needs transactional state the database already holds.
 *
 * Two kinds:
 *   nudge — the traveller alone, at the ETA. Most overdue journeys are someone
 *           who lost track of time. Alarming their family for that is how you
 *           train everyone to swipe these away, and then the one that matters
 *           gets swiped away too.
 *   alert — the watchers, once the grace window has passed. Carries last known
 *           position and WHEN it was recorded, because "no position since
 *           21:14" is something a person can act on; "hasn't arrived" is not.
 *
 * Requires a trusted server caller. Nothing here should ever be reachable from
 * a client: the ability to send someone's emergency contacts an overdue alarm
 * is not a capability an app user should hold.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = 'noreply@navtrl.com';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.navtrl.com';
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer || bearer !== SERVICE_ROLE_KEY) return json({ error: 'forbidden' }, 403);

  try {
    const { sessionId, kind } = (await req.json()) as {
      sessionId?: string;
      kind?: 'nudge' | 'alert';
    };
    if (!sessionId || (kind !== 'nudge' && kind !== 'alert')) {
      return json({ error: 'sessionId and kind required' }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: s } = await db
      .from('sessions')
      .select(
        'id, name, traveler_name, destination_name, created_by, watch_token, eta_at, last_latitude, last_longitude, last_position_at',
      )
      .eq('id', sessionId)
      .single();

    if (!s) return json({ error: 'session not found' }, 404);

    const traveler = s.traveler_name ?? 'Your contact';
    const dest = s.destination_name ? ` to ${s.destination_name}` : '';
    const watchUrl = `${APP_ORIGIN}/watch/${s.watch_token}`;

    if (kind === 'nudge') {
      // The traveller's own device only.
      const { data: profile } = await db
        .from('profiles')
        .select('push_token')
        .eq('id', s.created_by)
        .single();

      if (!profile?.push_token) return json({ nudged: 0, reason: 'no_push_token' });

      await pushMany([profile.push_token], {
        title: 'Still on your way?',
        body: `You were due to arrive${dest}. Tap to extend or mark yourself arrived — otherwise we'll let your watchers know.`,
        data: { type: 'journey_overdue_nudge', sessionId: s.id },
      });
      return json({ nudged: 1 });
    }

    // ── alert ────────────────────────────────────────────────────────────────
    const seenAt = s.last_position_at ? new Date(s.last_position_at) : null;
    const seenLine = seenAt
      ? `Last seen ${formatTime(seenAt)} (${minutesAgo(seenAt)} min ago)`
      : 'No location was recorded for this journey';
    const mapLink =
      s.last_latitude != null && s.last_longitude != null
        ? `https://www.google.com/maps?q=${s.last_latitude},${s.last_longitude}`
        : null;

    const { data: watchers } = await db
      .from('session_watchers')
      .select('id, email, push_token, user_id')
      .eq('session_id', sessionId);

    const tokens = (watchers ?? []).map((w) => w.push_token).filter(Boolean) as string[];
    const emails = (watchers ?? []).map((w) => w.email).filter(Boolean) as string[];

    let pushed = 0;
    if (tokens.length) {
      pushed = await pushMany(tokens, {
        title: `${traveler} hasn't arrived`,
        body: `${seenLine}. Tap to see their last known location.`,
        data: { type: 'journey_overdue_alert', sessionId: s.id },
      });
    }

    let sent = 0;
    const subject = `${traveler} hasn't arrived${dest}`;
    const html = alertHtml(esc(traveler), s.destination_name ? esc(s.destination_name) : null, seenLine, mapLink, watchUrl);
    for (const to of emails) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
        });
        if (res.ok) sent++;
        else console.error('[notify-overdue] resend rejected', res.status, await res.text());
      } catch (e) {
        console.error('[notify-overdue] email failed', e);
      }
    }

    return json({ pushed, sent, watchers: watchers?.length ?? 0 });
  } catch (err) {
    console.error('[notify-overdue]', err);
    return json({ error: 'internal error' }, 500);
  }
});

async function pushMany(
  tokens: string[],
  msg: { title: string; body: string; data: Record<string, unknown> },
): Promise<number> {
  // Expo caps a request at 100 messages.
  let ok = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({
      to,
      sound: 'default',
      priority: 'high',
      ...msg,
    }));
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) ok += batch.length;
      else console.error('[notify-overdue] expo rejected', res.status, await res.text());
    } catch (e) {
      console.error('[notify-overdue] push failed', e);
    }
  }
  return ok;
}

function minutesAgo(d: Date): number {
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 16) + ' UTC';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function alertHtml(
  traveler: string,
  destination: string | null,
  seenLine: string,
  mapLink: string | null,
  watchUrl: string,
): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;">
      <div style="font-size:44px;text-align:center;margin-bottom:12px;">⚠️</div>
      <h2 style="text-align:center;margin:0 0 8px;">${traveler} hasn't arrived</h2>
      ${destination ? `<p style="text-align:center;color:#555;margin:0 0 8px;">Expected at ${destination}</p>` : ''}
      <p style="text-align:center;color:#555;margin:0 0 24px;">${esc(seenLine)}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${watchUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">See their journey</a>
      </div>
      ${mapLink ? `<p style="text-align:center;margin:0 0 24px;"><a href="${mapLink}" style="color:#2563eb;">Open last known location in Maps</a></p>` : ''}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">
        This may simply mean they lost track of time or their phone died.<br/>
        You received this because you were added as a watcher for this journey.
      </p>
    </div>
  `;
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
