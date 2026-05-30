/**
 * useZonePresence
 *
 * Monitors zone enter/leave events and:
 *   • Fires a local notification to this device (device user)
 *   • Sends a push notification to all crew members when zone has notify_on_arrival / notify_on_leave set
 *   • Persists presence to Supabase (saved_place_presence table)
 *   • Handles "stay too long" alerts when alert_rules.stay_too_long_minutes is set
 */
import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { sendZoneNotification, sendPushNotification } from '@/services/notifications';
import { upsertPresence } from '@/services/savedPlaces';
import { isInsideCircle } from '@/utils/distance';
import { isInsidePolygon } from '@/utils/polygon';
import type { SavedPlace } from '@/types/models';

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

    // Collect crew push tokens (everyone except self)
    const crewTokens = groupMembers
      .filter((m) => m.user_id !== userId)
      .map((m) => m.profile?.push_token)
      .filter(Boolean) as string[];

    const displayName = profile?.nickname || profile?.display_name || 'A crew member';

    for (const zone of savedPlaces) {
      const inside = checkInside(zone, latitude, longitude);
      const wasInside = insideRef.current[zone.id] ?? false;

      // ── Enter ─────────────────────────────────────────────────────────────
      if (inside && !wasInside) {
        insideRef.current[zone.id] = true;

        if (zone.notify_on_arrival) {
          // Local — notify the device user
          sendZoneNotification(
            `📍 Entered — ${zone.name}`,
            'You have entered this zone.',
            zone.id,
            'zone_enter',
          ).catch(console.error);

          // Push — notify crew
          if (crewTokens.length > 0) {
            sendPushNotification(
              crewTokens,
              `📍 ${displayName} entered ${zone.name}`,
              `${displayName} entered the zone.`,
              { type: 'zone_enter', zoneId: zone.id },
              'zone_alerts',
            ).catch(console.error);
          }
        }

        upsertPresence(zone.id, activeGroupId, userId, true).catch(console.error);

        const stayMins = zone.alert_rules?.stay_too_long_minutes;
        if (stayMins && stayMins > 0) {
          stayTimers.current[zone.id] = setTimeout(() => {
            if (insideRef.current[zone.id]) {
              sendZoneNotification(
                `⏱ Still in — ${zone.name}`,
                `You've been here for over ${stayMins} minute${stayMins === 1 ? '' : 's'}.`,
                zone.id,
                'zone_stay',
              ).catch(console.error);
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

        if (zone.notify_on_leave) {
          // Local
          sendZoneNotification(
            `🚶 Left — ${zone.name}`,
            'You have left this zone.',
            zone.id,
            'zone_leave',
          ).catch(console.error);

          // Push — notify crew
          if (crewTokens.length > 0) {
            sendPushNotification(
              crewTokens,
              `🚶 ${displayName} left ${zone.name}`,
              `${displayName} has left the zone.`,
              { type: 'zone_leave', zoneId: zone.id },
              'zone_alerts',
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
