/**
 * og — Stalkr dynamic Open Graph renderer (Edge Function)
 *
 * Returns crawler-visible HTML with PER-LINK Open Graph + Twitter meta, then
 * redirects real browsers to the live page. This is what makes Facebook /
 * iMessage / Discord / WhatsApp / X / LinkedIn previews dynamic — client-side
 * meta (the Expo web pages) is NOT seen by crawlers.
 *
 * Usage (point share links here, or rewrite stalkr.app/invite|watch/* to it):
 *   /og?type=invite&code=ABCD1234
 *   /og?type=watch&token=<uuid>
 *
 * Deploy:  supabase functions deploy og --no-verify-jwt
 *
 * Recommended production wiring: a host rewrite at stalkr.app that routes
 * crawler User-Agents (facebookexternalhit, Twitterbot, Discordbot, WhatsApp,
 * LinkedInBot, Slackbot, TelegramBot, iMessage/AppleBot) for /invite/* and
 * /watch/* to this function, and everyone else to the normal web page.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGIN = 'https://stalkr.app';
const IMG_CREW = `${ORIGIN}/stalkr-crew-invite-og-image.png`;
const IMG_JOURNEY = `${ORIGIN}/stalkr-crew-invite-og-image-new.png`;
const IMG_APP = `${ORIGIN}/stalkr-app-social-preview-og-image.png`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(opts: { title: string; description: string; image: string; url: string; redirect: string }) {
  const { title, description, image, url, redirect } = opts;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:site_name" content="Stalkr" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@stalkrapp" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta name="theme-color" content="#080808" />
<meta http-equiv="refresh" content="0; url=${esc(redirect)}" />
</head><body style="background:#080808;color:#fff;font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:40px">
<p>Opening Stalkr…</p><script>location.replace(${JSON.stringify(redirect)});</script>
</body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let html: string;

  if (type === 'invite') {
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    const { data: group } = await supabase
      .from('groups').select('id, name').eq('invite_code', code).eq('invite_enabled', true).maybeSingle();
    if (group) {
      const { count } = await supabase
        .from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', group.id);
      const members = count ?? 0;
      html = page({
        title: `Join ${group.name} on Stalkr`,
        description: `${group.name} invited you to their crew (${members} member${members === 1 ? '' : 's'}). Real-time location awareness, safety zones and crew coordination.`,
        image: IMG_CREW,
        url: `${ORIGIN}/invite/${code}`,
        redirect: `${ORIGIN}/invite/${code}`,
      });
    } else {
      html = page({ title: 'Join Our Crew', description: 'Track locations, stay connected, and explore safely together.', image: IMG_CREW, url: `${ORIGIN}/invite/${code}`, redirect: `${ORIGIN}/invite/${code}` });
    }
  } else if (type === 'watch') {
    const token = url.searchParams.get('token') ?? '';
    const { data } = await supabase.rpc('get_session_by_watch_token', { p_token: token });
    const s = Array.isArray(data) ? data[0] : null;
    if (s) {
      const traveler = s.traveler_name ?? 'Someone';
      const dest = s.destination_name as string | null;
      const arrived = s.status === 'arrived' || s.is_active === false;
      const title = arrived
        ? `${traveler} arrived safely`
        : dest ? `${traveler} is traveling to ${dest}` : `Follow ${traveler}'s journey on Stalkr`;
      const description = arrived
        ? `${traveler} reached ${dest ?? 'their destination'} safely.`
        : `Follow ${traveler}'s live progress${dest ? ` to ${dest}` : ''} and get notified on arrival. No app required.`;
      html = page({ title, description, image: IMG_JOURNEY, url: `${ORIGIN}/watch/${token}`, redirect: `${ORIGIN}/watch/${token}` });
    } else {
      html = page({ title: 'Follow My Journey on Stalkr', description: 'Track my progress in real time and get notified when I arrive safely.', image: IMG_JOURNEY, url: `${ORIGIN}/watch/${token}`, redirect: `${ORIGIN}/watch/${token}` });
    }
  } else {
    html = page({ title: 'Stalkr | Real-Time Location Awareness & Safety Tracking', description: 'Know where your people are. Real-time location awareness built for modern outdoor life.', image: IMG_APP, url: ORIGIN, redirect: ORIGIN });
  }

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120' } });
});
