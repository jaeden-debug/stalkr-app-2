/**
 * send-arrival-email — tells a journey's email watchers that the traveller
 * arrived safely.
 *
 * ── Why this function is security-sensitive ─────────────────────────────────
 * "Arrived safely" is the single most consequential message this product
 * sends. The people receiving it are watching because they are worried, and a
 * false one ends their concern at exactly the moment it should not.
 *
 * It previously ran with verify_jwt:false and trusted a raw sessionId from the
 * request body, so anyone who could guess or observe a session id could send a
 * forged arrival notice to that journey's watchers, repeatedly. It also never
 * checked whether the journey had actually arrived — a cancelled journey would
 * still produce "arrived safely" — and never read is_notified before sending,
 * so every call re-emailed everyone.
 *
 * Now:
 *   - the caller must be the traveller themselves, or a trusted server context
 *   - the DATABASE decides whether arrival happened, not the request body
 *   - each watcher is emailed at most once (is_notified is read, not just set)
 *   - user-controlled text is escaped before it reaches HTML
 *
 * Accepting a trusted server caller is deliberate: arrival notification is
 * moving off the client, because a fire-and-forget fetch from a phone that may
 * be dying at that exact moment is not a delivery guarantee.
 *
 * Deploy:
 *   supabase functions deploy send-arrival-email
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const FROM_EMAIL = 'noreply@navtrl.com';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.navtrl.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };
    if (!sessionId) return json({ error: 'sessionId required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    if (!bearer) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // The database is the authority on whether this journey arrived. Trusting
    // the caller's word would let a forged request announce an arrival that
    // never happened.
    const { data: session, error: sErr } = await admin
      .from('sessions')
      .select('id, name, traveler_name, destination_name, status, created_by, watch_token')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) return json({ error: 'session not found' }, 404);

    // Authorization: the traveller themselves, or a trusted server context.
    const isServerCaller = bearer === SERVICE_ROLE_KEY;
    if (!isServerCaller) {
      const asUser = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: userRes } = await asUser.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid || uid !== session.created_by) return json({ error: 'forbidden' }, 403);
    }

    if (session.status !== 'arrived') {
      // A cancelled or still-running journey must never produce "arrived
      // safely". Not an error — just nothing to announce.
      return json({ sent: 0, reason: 'not_arrived' });
    }

    // Only watchers who have not already been told. is_notified was previously
    // written but never read, so repeated calls re-emailed everyone.
    const { data: watchers } = await admin
      .from('session_watchers')
      .select('id, email')
      .eq('session_id', sessionId)
      .not('email', 'is', null)
      .or('is_notified.is.null,is_notified.eq.false');

    if (!watchers?.length) return json({ sent: 0 });

    const traveler = esc(session.traveler_name ?? 'Your contact');
    const destination = session.destination_name ? esc(session.destination_name) : null;
    const subject = `${session.traveler_name ?? 'Your contact'} arrived safely${
      session.destination_name ? ` at ${session.destination_name}` : ''
    }`;
    const html = arrivalHtml(traveler, destination);

    let sent = 0;
    const notified: string[] = [];
    for (const w of watchers) {
      const to = (w as { email: string }).email;
      if (!to) continue;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
        });
        if (res.ok) {
          sent++;
          notified.push((w as { id: string }).id);
        } else {
          console.error('[send-arrival-email] resend rejected', res.status, await res.text());
        }
      } catch (e) {
        console.error('[send-arrival-email] send failed', e);
      }
    }

    // Mark only the ones that actually went out, so a partial failure retries
    // the rest instead of silently dropping them.
    if (notified.length) {
      await admin.from('session_watchers').update({ is_notified: true }).in('id', notified);
    }

    return json({ sent, attempted: watchers.length });
  } catch (err) {
    console.error('[send-arrival-email]', err);
    return json({ error: 'internal error' }, 500);
  }
});

/**
 * traveler_name comes from a user-editable profile field and lands inside an
 * HTML document. Escaping keeps a display name from injecting markup — a
 * forged link in an arrival email is a credible phishing vector precisely
 * because the recipient is expecting that email.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function arrivalHtml(traveler: string, destination: string | null): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;">
      <div style="font-size:48px;text-align:center;margin-bottom:16px;">✅</div>
      <h2 style="text-align:center;margin:0 0 8px;">${traveler} arrived safely</h2>
      ${destination ? `<p style="text-align:center;color:#555;margin:0 0 24px;">Destination: ${destination}</p>` : ''}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">
        You received this because you opted in to arrival notifications for this journey.<br/>
        <a href="${APP_ORIGIN}" style="color:#9ca3af;">Stalkr</a>
      </p>
    </div>
  `;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
