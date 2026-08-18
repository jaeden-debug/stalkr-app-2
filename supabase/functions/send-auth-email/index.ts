/**
 * send-auth-email — Supabase Auth "Send Email" hook, delivered via Resend.
 *
 * Supabase's built-in mailer sends unbranded, generic emails from a shared IP
 * pool. This hook intercepts EVERY auth email — signup confirmation, magic
 * link, password recovery, email change, invite — and sends a branded STALKR
 * message through Resend instead.
 *
 * ── Setup ───────────────────────────────────────────────────────────────────
 * 1. Deploy:
 *      supabase functions deploy send-auth-email --no-verify-jwt
 *
 *    --no-verify-jwt is required: Supabase Auth calls this hook itself, so
 *    there is no end-user JWT. Authenticity is proven by the webhook signature
 *    below instead, which is why that check must never be skipped.
 *
 * 2. Secrets (Dashboard → Edge Functions → Secrets):
 *      RESEND_API_KEY        Resend API key (server-side only, never EXPO_PUBLIC_)
 *      SEND_EMAIL_HOOK_SECRET  the v1,whsec_... value Supabase generates below
 *
 * 3. Dashboard → Authentication → Hooks → Send Email Hook
 *      Enable, point at this function's URL, copy the generated secret into
 *      SEND_EMAIL_HOOK_SECRET.
 *
 * 4. Resend → Domains → verify navtrl.com (SPF + DKIM), so these do not land
 *    in spam. Until the domain is verified Resend will only deliver to your own
 *    address.
 *
 * ── Security ────────────────────────────────────────────────────────────────
 * The payload carries a one-time token that grants account access. It is
 * therefore never logged, and the request is rejected unless the Standard
 * Webhooks HMAC signature verifies. An unauthenticated caller who could reach
 * this endpoint without that check could harvest tokens for arbitrary emails.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { renderAuthEmail, type AuthEmailKind } from './template.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '';
const FROM = 'STALKR <noreply@navtrl.com>';

interface HookPayload {
  user: { email: string; user_metadata?: Record<string, unknown> };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

/** Map Supabase's action types onto our template variants. */
function kindFor(action: string): AuthEmailKind {
  switch (action) {
    case 'signup':
													return 'signup';
    case 'magiclink':
      return 'magiclink';
    case 'recovery':
      return 'recovery';
    case 'invite':
      return 'invite';
    case 'email_change':
    case 'email_change_current':
    case 'email_change_new':
      return 'email_change';
    default:
      return 'magiclink';
  }
}

const SUBJECTS: Record<AuthEmailKind, string> = {
  signup: 'Confirm your STALKR account',
  magiclink: 'Your STALKR sign-in link',
  recovery: 'Reset your STALKR password',
  invite: "You've been invited to STALKR",
  email_change: 'Confirm your new STALKR email',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const raw = await req.text();

  // Verify BEFORE parsing. The body contains a live credential.
  if (!HOOK_SECRET) {
    console.error('[send-auth-email] SEND_EMAIL_HOOK_SECRET not configured');
    return json({ error: 'hook not configured' }, 500);
  }

  let payload: HookPayload;
  try {
    // Supabase prefixes the secret with "v1,whsec_"; the library wants the
    // base64 portion only.
    const secret = HOOK_SECRET.replace(/^v1,whsec_/, '');
    const wh = new Webhook(secret);
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch (err) {
    // Deliberately terse: a signature failure is either a misconfiguration or
    // someone probing the endpoint. Neither deserves detail in the response.
    console.error('[send-auth-email] signature verification failed:', String(err));
    return json({ error: 'invalid signature' }, 401);
  }

  const email = payload.user?.email;
  const data = payload.email_data;
  if (!email || !data?.token_hash) {
    return json({ error: 'malformed payload' }, 400);
  }

  const kind = kindFor(data.email_action_type);

  // Build the verification URL Supabase expects. Using token_hash (not the raw
  // token) means the link is single-use and verified server-side.
  const base = (data.site_url || '').replace(/\/$/, '');
  const confirmUrl =
    `${base}/auth/v1/verify` +
    `?token=${encodeURIComponent(data.token_hash)}` +
    `&type=${encodeURIComponent(data.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(data.redirect_to || base)}`;

  const html = renderAuthEmail({
    kind,
    confirmUrl,
    // The 6-digit code is shown as a fallback for clients that mangle links.
    code: data.token,
  });

  if (!RESEND_API_KEY) {
    console.error('[send-auth-email] RESEND_API_KEY missing — email NOT sent');
    return json({ error: 'mailer not configured' }, 500);
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: SUBJECTS[kind],
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[send-auth-email] resend rejected:', res.status, detail);
      // Returning non-2xx makes Supabase Auth surface a failure to the caller
      // rather than silently pretending the email was sent.
      return json({ error: 'send failed' }, 502);
    }
  } catch (err) {
    console.error('[send-auth-email] resend error:', String(err));
    return json({ error: 'send failed' }, 502);
  }

  // Never echo the token or the URL back in the response body.
  return json({ ok: true });
});

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, webhook-id, webhook-timestamp, webhook-signature',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
