/**
 * send-push — Stalkr Edge Function
 *
 * Receives a push notification request from the app, looks up each
 * recipient's notification preferences, filters out opted-out users,
 * then forwards the remaining tokens to Expo's push API.
 *
 * Request body (JSON):
 * {
 *   tokens:    string[]              // Expo push tokens
 *   title:     string
 *   body:      string
 *   data?:     Record<string, unknown>
 *   channelId?: string               // Android channel
 *   type:      'zone_enter' | 'zone_leave' | 'zone_stay' | 'zone_crew' | 'sos' | 'sos_cancel'
 *   recipientUserIds?: string[]      // If provided, used to look up prefs.
 *                                    // Must be parallel-indexed with tokens.
 * }
 *
 * Deploy:
 *   supabase functions deploy send-push --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Notification type → column name in user_notification_prefs
const TYPE_TO_COLUMN: Record<string, string> = {
  zone_enter: 'notify_zone_enter',
  zone_leave: 'notify_zone_leave',
  zone_stay:  'notify_zone_overstay',
  zone_crew:  'notify_crew_zone_activity',
  sos:        'notify_sos_alerts',
  sos_cancel: 'notify_sos_cancel',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const {
      tokens,
      title,
      body,
      data = {},
      channelId = 'default',
      type,
      recipientUserIds,
      groupId,
      fromUserId,
    } = await req.json() as {
      tokens: string[];
      title: string;
      body: string;
      data?: Record<string, unknown>;
      channelId?: string;
      type: string;
      recipientUserIds?: string[];
      groupId?: string;
      fromUserId?: string;
    };

    const isSafetyOverride = type === 'sos'; // SOS always delivers (life-safety)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Recipient resolution ─────────────────────────────────────────────────
    // Build (token, userId) PAIRS rather than trusting two parallel arrays.
    //
    // Two problems this solves:
    //  1. device_push_tokens was written on every registration but never read by
    //     anything, so a user signed into two devices only received pushes on
    //     whichever registered last.
    //  2. Requiring the CLIENT to supply tokens means each crew member holds
    //     every other member's push token, which is enough to send them
    //     arbitrary notifications via Expo's public API. Resolving server-side
    //     with the service role removes that exposure.
    //
    // Client-supplied tokens are still honoured so an older app build keeps
    // working, but server resolution wins when recipient ids are present.
    let pairs: { token: string; userId?: string }[] = [];

    if (recipientUserIds?.length) {
      const { data: devices } = await supabase
        .from('device_push_tokens')
        .select('user_id, token')
        .in('user_id', recipientUserIds);

      pairs = (devices ?? []).map((d: any) => ({ token: d.token, userId: d.user_id }));

      // Fall back to whatever the client sent for anyone with no registered
      // device row yet (e.g. registered before device_push_tokens existed).
      if (tokens?.length && tokens.length === recipientUserIds.length) {
        const covered = new Set(pairs.map((p) => p.userId));
        recipientUserIds.forEach((uid, i) => {
          if (!covered.has(uid) && tokens[i]) pairs.push({ token: tokens[i], userId: uid });
        });
      }
    } else if (tokens?.length) {
      pairs = tokens.map((t) => ({ token: t }));
    }

    // De-duplicate: the same physical device can appear via both paths.
    const seenTokens = new Set<string>();
    pairs = pairs.filter((p) => {
      if (!p.token || seenTokens.has(p.token)) return false;
      seenTokens.add(p.token);
      return true;
    });

    if (pairs.length === 0) {
      return json({ sent: 0, filtered: 0, reason: 'no_registered_devices' });
    }

    const haveRecipients = pairs.some((p) => p.userId);
    const optedOut = new Set<string>();

    // Layered server-side filtering: global → per-crew → per-member.
    if (haveRecipients && !isSafetyOverride) {
      const ids = [...new Set(pairs.map((p) => p.userId).filter(Boolean))] as string[];

      const prefColumn = TYPE_TO_COLUMN[type];
      if (prefColumn) {
        const { data: prefs } = await supabase
          .from('user_notification_prefs')
          .select(`user_id, ${prefColumn}`)
          .in('user_id', ids);
        prefs?.forEach((row: any) => { if (row[prefColumn] === false) optedOut.add(row.user_id); });
      }

      if (groupId) {
        const { data: crewPrefs } = await supabase
          .from('crew_notification_prefs')
          .select('user_id, muted, notify_crew_zone_activity')
          .eq('group_id', groupId)
          .in('user_id', ids);
        crewPrefs?.forEach((row: any) => {
          if (row.muted === true) optedOut.add(row.user_id);
          if (type === 'zone_crew' && row.notify_crew_zone_activity === false) optedOut.add(row.user_id);
        });
      }

      if (groupId && fromUserId) {
        const { data: memPrefs } = await supabase
          .from('member_notification_prefs')
          .select('user_id, muted, notify_enter, notify_leave, notify_overstay')
          .eq('group_id', groupId)
          .eq('target_user_id', fromUserId)
          .in('user_id', ids);
        memPrefs?.forEach((row: any) => {
          if (row.muted === true) optedOut.add(row.user_id);
          if (type === 'zone_enter' && row.notify_enter === false) optedOut.add(row.user_id);
          if (type === 'zone_leave' && row.notify_leave === false) optedOut.add(row.user_id);
          if (type === 'zone_stay' && row.notify_overstay === false) optedOut.add(row.user_id);
        });
      }
    }

    const allowedTokens = pairs
      .filter((p) => {
        if (!p.token?.startsWith('ExponentPushToken')) return false;
        if (!p.userId) return true;
        return !optedOut.has(p.userId);
      })
      .map((p) => p.token);

    if (allowedTokens.length === 0) {
      return json({ sent: 0, filtered: pairs.length });
    }

    const messages = allowedTokens.map((to) => ({
      to,
      title,
      body,
      data: { ...data, type },
      sound: 'default',
      channelId,
      priority: 'high',
    }));

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const expoBody = await expoRes.json();

    return json({
      sent: allowedTokens.length,
      filtered: pairs.length - allowedTokens.length,
      expo: expoBody,
    });
  } catch (err) {
    console.error('[send-push]', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
