/**
 * useZonePresence
 *
 * Monitors zone enter/leave events and:
 *   • Fires a local notification to this device (device user)
 *   • Sends a push notification to all crew members when zone has notify_on_arrival / notify_on_leave set
 *   • Persists presence to Supabase (saved_place_presence table)
 *   • Handles "stay too long" alerts when alert_rules.stay_too_long_minutes is set
 *   • Respects quiet hours configured per zone (no alerts between quiet_hours_start and quiet_hours_end)
 */
import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { sendZoneNotification, sendPushNotification } from '@/services/notifications';
import { upsertPresence } from '@/services/savedPlaces';
import { isInsideCircle } from '@/utils/distance';
import { isInsidePolygon } from '@/utils/polygon';
import type { AlertRules, SavedPlace } from '@/types/models';

export function useZonePresence() {
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const myLocation = useMapStore((s) => s.myLocation);
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupMembers = useGroupStore((s) => s.groupMembers);

  const insideRef = useRef<Record<string, boolean>>({});
  const stayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!myLocation || !userId || !activeGroupId) return;
    const { latitude, longitude } = myLocation;

    // Collect crew members (everyone except self), keep userId↔token paired
    const crewMembers = groupMembers.filter(
      (m) => m.user_id !== userId && m.profile?.push_token,
    );
    const crewTokens = crewMembers.map((m) => m.profile!.push_token as string);
    const crewUserIds = crewMembers.map((m) => m.user_id);

    const displayName = profile?.nickname || profile?.display_name || 'A crew member';

    for (const zone of savedPlaces) {
      const inside = checkInside(zone, latitude, longitude);
      const wasInside = insideRef.current[zone.id] ?? false;

      // ── Enter ─────────────────────────────────────────────────────────────
      if (inside && !wasInside) {
        insideRef.current[zone.id] = true;

        if (zone.notify_on_arrival && !isDuringQuietHours(zone.alert_rules)) {
          // Local — notify the device user
          sendZoneNotification(
            `📍 Entered — ${zone.name}`,
            'You have entered this zone.',
            zone.id,
            'zone_enter',
          ).catch(console.error);

          // Push — notify crew (type 'zone_crew' so crew can mute separately)
          if (crewTokens.length > 0) {
            sendPushNotification(
              crewTokens,
              `📍 ${displayName} entered ${zone.name}`,
              `${displayName} entered the zone.`,
              { type: 'zone_crew', event: 'enter', zoneId: zone.id },
              'zone_alerts',
              crewUserIds,
            ).catch(console.error);
          }
        }

        upsertPresence(zone.id, activeGroupId, userId, true).catch(console.error);

        const stayMins = zone.alert_rules?.stay_too_long_minutes;
        if (stayMins && stayMins > 0) {
          // Capture crew arrays for the closure
          const capturedCrewTokens = [...crewTokens];
          const capturedCrewUserIds = [...crewUserIds];
          const capturedAlertRules = zone.alert_rules;
          stayTimers.current[zone.id] = setTimeout(() => {
            if (insideRef.current[zone.id] && !isDuringQuietHours(capturedAlertRules)) {
              // Local alert to the user themselves
              sendZoneNotification(
                `⏱ Still in — ${zone.name}`,
                `You've been here for over ${stayMins} minute${stayMins === 1 ? '' : 's'}.`,
                zone.id,
                'zone_stay',
              ).catch(console.error);

              // Push crew so they know too (type 'zone_crew' so crew can mute separately)
              if (capturedCrewTokens.length > 0) {
                sendPushNotification(
                  capturedCrewTokens,
                  `⏱ ${displayName} still in ${zone.name}`,
                  `${displayName} has been inside for over ${stayMins} minute${stayMins === 1 ? '' : 's'}.`,
                  { type: 'zone_crew', event: 'overstay', zoneId: zone.id },
                  'zone_alerts',
                  capturedCrewUserIds,
                ).catch(console.error);
              }
            }
          }, stayMins * 60 * 1000);
        }
      }

      // ── Leave ─────────────────────────────────────────────────────────────
      if (!inside && wasInside) {
        insideRef.current[zone.id] = false;

        if (stayTimers.current[zone.id]) {
          clearTimeout(stayTimers.current[zone.id]);
          delete stayTimers.current[zone.id];
        }

        if (zone.notify_on_leave && !isDuringQuietHours(zone.alert_rules)) {
          // Local
          sendZoneNotification(
            `🚶 Left — ${zone.name}`,
            'You have left this zone.',
            zone.id,
            'zone_leave',
          ).catch(console.error);

          // Push — notify crew (type 'zone_crew' so crew can mute separately)
          if (crewTokens.length > 0) {
            sendPushNotification(
              crewTokens,
              `🚶 ${displayName} left ${zone.name}`,
              `${displayName} has left the zone.`,
              { type: 'zone_crew', event: 'leave', zoneId: zone.id },
              'zone_alerts',
              crewUserIds,
            ).catch(console.error);
          }
        }

        upsertPresence(zone.id, activeGroupId, userId, false).catch(console.error);
      }
    }
  }, [myLocation, savedPlaces, userId, activeGroupId, groupMembers, profile]);

  useEffect(() => {
    return () => { Object.values(stayTimers.current).forEach(clearTimeout); };
  }, []);

  return { insideZones: insideRef.current };
}

/**
 * Returns true if the current local time falls within the zone's quiet hours.
 * Quiet hours may wrap midnight (e.g. 22:00 – 06:00).
 * Format: "HH:MM" (24-hour).
 */
function isDuringQuietHours(rules: AlertRules | undefined): boolean {
  const start = rules?.quiet_hours_start;
  const end = rules?.quiet_hours_end;
  if (!start || !end) return false;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  if (startMins <= endMins) {
    // e.g. 09:00 – 17:00 (same day)
    return nowMins >= startMins && nowMins < endMins;
  } else {
    // e.g. 22:00 – 06:00 (wraps midnight)
    return nowMins >= startMins || nowMins < endMins;
  }
}

function checkInside(zone: SavedPlace, lat: number, lng: number): boolean {
  if (zone.shape_type === 'polygon' && zone.polygon_coords && zone.polygon_coords.length >= 3) {
    return isInsidePolygon({ latitude: lat, longitude: lng }, zone.polygon_coords);
  }
  return isInsideCircle(
    { latitude: lat, longitude: lng },
    { latitude: zone.latitude, longitude: zone.longitude },
    zone.radius_meters,
  );
}
