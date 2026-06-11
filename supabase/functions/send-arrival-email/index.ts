/**
 * send-arrival-email
 * Called when a session arrives. Emails all session_watchers rows
 * that have an email address via Resend.
 *
 * Expected body: { sessionId: string }
 *
 * Secrets required (set in Supabase dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY — your Resend API key
 *
 * Deploy:
 *   supabase functions deploy send-arrival-email --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = 'noreply@navtrl.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const { sessionId } = await req.json() as { sessionId: string };
    if (!sessionId) {
      return json({ error: 'sessionId required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch session info
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('id, name, traveler_name, destination_name')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) {
      return json({ error: 'session not found' }, 404);
    }

    // Fetch email watchers
    const { data: watchers, error: wErr } = await supabase
      .from('session_watchers')
      .select('email')
      .eq('session_id', sessionId)
      .not('email', 'is', null);

    if (wErr || !watchers || watchers.length === 0) {
      return json({ sent: 0 });
    }

    const emails = watchers
      .map((w: any) => w.email as string)
      .filter(Boolean);

    const traveler = session.traveler_name ?? 'Your contact';
    const dest = session.destination_name ? ` at ${session.destination_name}` : '';
    const subject = `${traveler} arrived safely${dest}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="font-size: 48px; text-align: center; margin-bottom: 16px;">✅</div>
        <h2 style="text-align: center; margin: 0 0 8px;">${traveler} arrived safely</h2>
        ${session.destination_name ? `<p style="text-align:center;color:#555;margin:0 0 24px;">Destination: ${session.destination_name}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          You received this because you opted in to arrival notifications for this journey.<br/>
          Powered by <strong>Stalkr</strong>
        </p>
      </div>
    `;

    let sent = 0;
    for (const to of emails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      });
      if (res.ok) sent++;
    }

    // Mark watchers as notified
    await supabase
      .from('session_watchers')
      .update({ is_notified: true })
      .eq('session_id', sessionId)
      .not('email', 'is', null);

    return json({ sent });
  } catch (err) {
    console.error('[send-arrival-email]', err);
    return json({ error: String(err) }, 500);
  }
});

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
