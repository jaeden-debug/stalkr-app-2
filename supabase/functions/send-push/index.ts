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
    } = await req.json() as {
      tokens: string[];
      title: string;
      body: string;
      data?: Record<string, unknown>;
      channelId?: string;
      type: string;
      recipientUserIds?: string[];
    };

    if (!tokens?.length) {
      return json({ sent: 0, filtered: 0 });
    }

    // Determine which tokens to actually send to
    let allowedTokens = tokens.filter((t) => t?.startsWith('ExponentPushToken'));

    // If we have user IDs and a mappable type, filter by prefs
    const prefColumn = TYPE_TO_COLUMN[type];
    if (prefColumn && recipientUserIds?.length && recipientUserIds.length === tokens.length) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: prefs } = await supabase
        .from('user_notification_prefs')
        .select(`user_id, ${prefColumn}`)
        .in('user_id', recipientUserIds);

      if (prefs) {
        // Build a set of opted-out user IDs
        const optedOut = new Set<string>(
          prefs
            .filter((row: any) => row[prefColumn] === false)
            .map((row: any) => row.user_id as string),
        );

        // Filter tokens: keep only tokens whose paired user has NOT opted out
        allowedTokens = tokens.filter((token, i) => {
          const uid = recipientUserIds[i];
          return token?.startsWith('ExponentPushToken') && !optedOut.has(uid);
        });
      }
    }

    if (allowedTokens.length === 0) {
      return json({ sent: 0, filtered: tokens.length });
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
      filtered: tokens.length - allowedTokens.length,
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
