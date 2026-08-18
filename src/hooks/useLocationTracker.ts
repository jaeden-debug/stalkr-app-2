/**
 * Core GPS tracking hook.
 * - Single global watch (no duplicates)
 * - Filters weak/stationary ticks
 * - Writes to Supabase live_locations
 * - Zone presence detection
 * - Arrival detection
 * - Trail writing delegated to useTrailWriter
 */
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useMapStore } from '@/store/useMapStore';
import { useSelfPoseStore } from '@/store/useSelfPoseStore';
import { createHeadingSmoother, shortestAngleDelta } from '@/utils/heading';
import { isBroadcastingToCrew } from '@/utils/broadcast';
import { upsertLiveLocation, setLocationPaused } from '@/services/liveLocations';
import { isInsideCircle } from '@/utils/distance';
import { isInsidePolygon } from '@/utils/polygon';
import { isQuietHours } from '@/utils/time';
import { upsertPresence } from '@/services/savedPlaces';
import { sendZoneNotification, sendPushNotification } from '@/services/notifications';
import { logEvent } from '@/services/groupEvents';
import * as Haptics from 'expo-haptics';
import { getWatcherPushTokens } from '@/services/sessions';
import { useSessionStore } from '@/store/useSessionStore';
import { supabase } from '@/services/supabase';
import type { SavedPlace } from '@/types/models';
import type { AlertRules } from '@/types/database';

const MAX_FIRST_FIX_ACCURACY = 65;
const MAX_TRACKING_ACCURACY = 35;
const STATIONARY_SPEED_MPS = 0.8;
const STATIONARY_DRIFT_M = 12;
const MAX_SPEED_MPS = 45;

// ── Sensor ownership ────────────────────────────────────────────────────────
// Exactly one position watcher and one heading watcher may exist at a time.
//
// The previous guard checked `if (globalWatch && ...) return;` but only
// assigned `globalWatch` AFTER two awaits inside an async start(). Two hook
// instances mounting in the same tick therefore both saw null, both passed the
// guard, and both called watchPositionAsync — and since only the last
// assignment was retained, the first subscription leaked permanently.
//
// Ownership is now claimed SYNCHRONOUSLY with a token, before any await, and
// re-validated after each await so a subscription created by a losing or
// unmounted instance is disposed rather than stored.
let watchOwnerToken: symbol | null = null;
let positionSub: Location.LocationSubscription | null = null;
let headingSub: Location.LocationSubscription | null = null;

/** Test-only introspection for the sensor-lifecycle regression tests. */
export function __getSensorSubscriptionCounts() {
  return {
    position: positionSub ? 1 : 0,
    heading: headingSub ? 1 : 0,
    owned: watchOwnerToken !== null,
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function useLocationTracker() {
  const lastAccepted = useRef<{ lat: number; lng: number; acc: number; spd: number; t: number } | null>(null);
  const lastHeadingPoint = useRef<{ lat: number; lng: number } | null>(null);
  const lastStableHeading = useRef(0);
  // Circular low-pass over the raw magnetometer. Compass readings swing ±5–15°
  // indoors, so the unfiltered value made the puck shiver while standing still.
  // Averaging plain numbers would be wrong across the 0/360 seam, so the
  // smoother always moves along the shortest arc.
  const headingSmoother = useRef(createHeadingSmoother({ alpha: 0.25, deadbandDeg: 1.5, snapDeg: 25 }));
  const lastLiveWritePerGroup = useRef<Record<string, number>>({});
  const offlineMarkedGroups = useRef<Set<string>>(new Set());
  const lastTrailWrite = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const zonePresence = useRef<Record<string, boolean>>({});
  const zoneLastAlert = useRef<Record<string, number>>({});
  const zoneEnteredAt = useRef<Record<string, number>>({});
  const arrivedSessions = useRef<Set<string>>(new Set());
  const broadcastChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastChannelToken = useRef<string | null>(null);
  const mounted = useRef(true);

  // Primitive / stable selectors only. These were previously whole-store
  // destructures — `useGroupStore()`, `useLocationStore()`, `useMapStore()` with
  // no selector each subscribe to EVERY field, so the host screen re-rendered on
  // any write to any of those stores. `isApproximate` and `sharingMode` are read
  // through getState() inside the GPS callback and never needed subscriptions.
  const sessionUserId = useAuthStore((s) => s.session?.user?.id);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const setBatteryLevel = useLocationStore((s) => s.setBatteryLevel);
  const setLastBroadcastAt = useLocationStore((s) => s.setLastBroadcastAt);

  const savedPlacesRef = useRef<SavedPlace[]>(savedPlaces);
  useEffect(() => {
    savedPlacesRef.current = savedPlaces;
  }, [savedPlaces]);

  const checkZones = useCallback(
    async (lat: number, lng: number, userId: string, groupId: string) => {
      const zones = savedPlacesRef.current.filter((z) => {
        const appliesToAll = !z.applies_to_user_ids || z.applies_to_user_ids.length === 0;
        return appliesToAll || z.applies_to_user_ids.includes(userId);
      });

      for (const zone of zones) {
        const isInside =
          zone.shape_type === 'polygon'
            ? isInsidePolygon({ latitude: lat, longitude: lng }, zone.polygon_coords)
            : isInsideCircle({ latitude: lat, longitude: lng }, { latitude: zone.latitude, longitude: zone.longitude }, zone.radius_meters);

        const wasInside = zonePresence.current[zone.id] ?? false;
        const changed = isInside !== wasInside;

        if (changed) {
          zonePresence.current[zone.id] = isInside;
          if (isInside) {
            zoneEnteredAt.current[zone.id] = Date.now();
          }
          await upsertPresence(zone.id, groupId, userId, isInside);
          logEvent(
            groupId, userId,
            isInside ? 'zone_entered' : 'zone_left',
            `${isInside ? 'Entered' : 'Left'} ${zone.name}`,
            undefined,
            { zone_id: zone.id },
          ).catch(() => {});
        }

        const now = Date.now();
        const lastAlert = zoneLastAlert.current[zone.id] ?? 0;
        const rules: AlertRules = zone.alert_rules ?? {};
        const cooldownMs = (rules.repeat_cooldown_minutes ?? 5) * 60_000;

        // Skip if quiet hours
        if (rules.quiet_hours_start && rules.quiet_hours_end) {
          if (isQuietHours(rules.quiet_hours_start, rules.quiet_hours_end)) continue;
        }

        if (changed && now - lastAlert > cooldownMs) {
          zoneLastAlert.current[zone.id] = now;
          if (isInside && zone.notify_on_arrival) {
            await sendZoneNotification(
              `Entered ${zone.name}`,
              rules.message_template ?? `You entered the ${zone.name} zone.`,
              zone.id,
              'zone_enter',
            );
          } else if (!isInside && zone.notify_on_leave) {
            await sendZoneNotification(
              `Left ${zone.name}`,
              `You left the ${zone.name} zone.`,
              zone.id,
              'zone_leave',
            );
          }
        }

        // Stay-too-long alert
        if (isInside && rules.stay_too_long_minutes) {
          const enteredAt = zoneEnteredAt.current[zone.id] ?? now;
          const minutesInside = (now - enteredAt) / 60_000;
          if (minutesInside >= rules.stay_too_long_minutes && now - lastAlert > cooldownMs) {
            zoneLastAlert.current[zone.id] = now;
            await sendZoneNotification(
              `Still in ${zone.name}`,
              `You've been in ${zone.name} for ${Math.round(minutesInside)} minutes.`,
              zone.id,
              'zone_stay',
            );
          }
        }
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;

    // Claim ownership synchronously — before any await — so a second instance
    // mounting in the same tick cannot race through this guard.
    if (watchOwnerToken !== null) return;
    const token = Symbol('stalkr.locationWatch');
    watchOwnerToken = token;

    /** True once this effect is torn down or ownership has moved on. */
    const isStale = () => !mounted.current || watchOwnerToken !== token;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isStale()) {
        if (watchOwnerToken === token) watchOwnerToken = null;
        return;
      }

      // ── Compass watch: rotates the self puck to the phone's facing direction
      // in real time. Fires far more often than GPS and works while stationary.
      //
      // Publishes to useSelfPoseStore, NOT useMapStore. Writing heading into the
      // map collection store re-rendered MarkerLayer and ZoneLayer ~10x/second
      // because Zustand compares with Object.is and those layers subscribe to
      // the same store. Nothing but the puck and the HUD reads heading now.
      const hSub = await Location.watchHeadingAsync((h) => {
        if (isStale()) return;
        // trueHeading is relative to geographic north, which is what the map's
        // marker rotation expects. It reads -1 until a location fix exists, so
        // fall back to magnetic north until then.
        const raw = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (!isFinite(raw)) return;

        const smoothed = headingSmoother.current.push(raw);
        if (smoothed == null) return;

        const prev = useSelfPoseStore.getState().heading;
        // The smoother already applies a deadband; this only avoids a redundant
        // store write when the eased value has not visibly moved.
        if (prev != null && Math.abs(shortestAngleDelta(prev, smoothed)) < 0.5) return;
        useSelfPoseStore.getState().setHeading(smoothed, h.accuracy ?? null);
      });
      if (isStale()) {
        hSub.remove();
        return;
      }
      headingSub = hSub;

      const pSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 },
        async (loc) => {
          if (!mounted.current) return;

          const { latitude, longitude, heading, speed, accuracy } = loc.coords;
          const spd = Math.max(0, speed ?? 0);
          const acc = typeof accuracy === 'number' && isFinite(accuracy) ? accuracy : Infinity;
          const now = Date.now();

          if (!isFinite(latitude) || !isFinite(longitude)) return;
          if (!lastAccepted.current && acc > MAX_FIRST_FIX_ACCURACY) return;
          if (lastAccepted.current && acc > MAX_TRACKING_ACCURACY) return;

          const prev = lastAccepted.current;
          if (prev) {
            const moved = haversineMeters(prev.lat, prev.lng, latitude, longitude);
            const dt = Math.max((now - prev.t) / 1000, 1);
            const impliedSpd = moved / dt;
            if (moved <= STATIONARY_DRIFT_M && spd <= STATIONARY_SPEED_MPS && acc >= prev.acc) return;
            if (impliedSpd > MAX_SPEED_MPS && spd < 3) return;
          }

          // Resolve heading for BROADCAST and display only — the self puck reads
          // the live compass straight from useSelfPoseStore and never waits for
          // a GPS tick. The device compass stays the primary source (the puck
          // faces where the phone faces); GPS course-over-ground and a computed
          // bearing remain fallbacks for when no compass reading exists.
          const compassHeading = headingSmoother.current.value();
          let resolvedHeading: number;
          if (compassHeading != null) {
            resolvedHeading = compassHeading;
          } else if (heading != null && heading >= 0 && heading !== 0) {
            resolvedHeading = heading;
          } else if (lastHeadingPoint.current) {
            const moved = haversineMeters(lastHeadingPoint.current.lat, lastHeadingPoint.current.lng, latitude, longitude);
            resolvedHeading = moved >= 2
              ? calcBearing(lastHeadingPoint.current.lat, lastHeadingPoint.current.lng, latitude, longitude)
              : lastStableHeading.current;
          } else {
            resolvedHeading = heading ?? 0;
          }
          lastStableHeading.current = resolvedHeading;
          lastHeadingPoint.current = { lat: latitude, lng: longitude };
          lastAccepted.current = { lat: latitude, lng: longitude, acc, spd, t: now };

          // Update map store
          useMapStore.getState().setMyLocation({ latitude, longitude, heading: resolvedHeading, accuracy: acc, speed: spd });

          const userId = useAuthStore.getState().session?.user?.id;
          const approximate = useLocationStore.getState().isApproximate;
          const mode = useLocationStore.getState().sharingMode;

          // Battery
          try {
            const level = await Battery.getBatteryLevelAsync();
            setBatteryLevel(Math.round(level * 100));
          } catch {}

          // ── Broadcast to EVERY crew the user is live in ─────────────────────
          // Per-group broadcasting state lives in groupBroadcastingStatus
          // (undefined → live by default). Going dark in one crew leaves the
          // others untouched.
          if (userId) {
            const groups = useGroupStore.getState().groups;
            const statusMap = useLocationStore.getState().groupBroadcastingStatus;
            const throttleMs = 8000;
            let wroteAny = false;

            for (const g of groups) {
              const liveForGroup = isBroadcastingToCrew(statusMap, g.id);
              if (!liveForGroup) {
                // Mark offline once when a crew is dark (keeps last known position).
                if (!offlineMarkedGroups.current.has(g.id)) {
                  offlineMarkedGroups.current.add(g.id);
                  // 'paused' = deliberate go-dark. Writing 'offline' here made a
                  // private user indistinguishable from a user we had lost.
                  setLocationPaused(g.id, userId).catch(() => {});
                }
                continue;
              }
              offlineMarkedGroups.current.delete(g.id);

              const last = lastLiveWritePerGroup.current[g.id] ?? 0;
              if (now - last <= throttleMs) continue;
              lastLiveWritePerGroup.current[g.id] = now;
              wroteAny = true;

              await upsertLiveLocation({
                groupId: g.id,
                userId,
                latitude,
                longitude,
                heading: resolvedHeading,
                speed: spd,
                accuracy: acc,
                batteryLevel: useLocationStore.getState().batteryLevel,
                status: 'live',
                sharingMode: mode,
                isApproximate: approximate,
                approximateLatitude: approximate ? Math.round(latitude * 100) / 100 : undefined,
                approximateLongitude: approximate ? Math.round(longitude * 100) / 100 : undefined,
              });
            }

            if (wroteAny) setLastBroadcastAt(new Date().toISOString());

            // Zone checks run against the active crew's zones (local awareness).
            const activeGid = useGroupStore.getState().activeGroupId;
            if (activeGid && isBroadcastingToCrew(statusMap, activeGid)) {
              await checkZones(latitude, longitude, userId, activeGid);
            }
          }

          // ── Broadcast live location to web viewer ────────────────────────────
          if (userId) {
            const journeySession = useSessionStore.getState().activeJourneySession;
            if (journeySession && !arrivedSessions.current.has(journeySession.id)) {
              // Ensure we have a subscribed channel for this session's watch token
              if (broadcastChannelToken.current !== journeySession.watch_token) {
                if (broadcastChannel.current) {
                  supabase.removeChannel(broadcastChannel.current);
                }
                const ch = supabase.channel(`session:${journeySession.watch_token}`);
                ch.subscribe();
                broadcastChannel.current = ch;
                broadcastChannelToken.current = journeySession.watch_token;
              }
              try {
                await broadcastChannel.current!.send({
                  type: 'broadcast',
                  event: 'location',
                  payload: { latitude, longitude, heading: resolvedHeading, updatedAt: new Date().toISOString() },
                });
              } catch {}
            } else if (!journeySession && broadcastChannel.current) {
              // Session ended — clean up channel
              supabase.removeChannel(broadcastChannel.current);
              broadcastChannel.current = null;
              broadcastChannelToken.current = null;
            }
          }

          // ── Arrival detection (runs for any active journey session) ──────────
          if (userId) {
            const journeySession = useSessionStore.getState().activeJourneySession;
            if (
              journeySession &&
              journeySession.destination_latitude != null &&
              journeySession.destination_longitude != null &&
              !arrivedSessions.current.has(journeySession.id)
            ) {
              const dist = haversineMeters(
                latitude,
                longitude,
                journeySession.destination_latitude,
                journeySession.destination_longitude,
              );
              if (dist <= 100) {
                arrivedSessions.current.add(journeySession.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Mark arrived in DB + store
                await useSessionStore.getState().markArrived(journeySession.id);
                // Dedicated arrival activity event (streams to crew feed).
                if (journeySession.group_id) {
                  logEvent(
                    journeySession.group_id,
                    userId,
                    'arrival',
                    `Arrived: ${journeySession.destination_name ?? journeySession.name}`,
                    `${journeySession.traveler_name ?? 'A crew member'} reached their destination safely.`,
                  ).catch(() => {});
                }
                // Broadcast arrival on Realtime channel for web viewer
                const channel = supabase.channel(`session:${journeySession.watch_token}`);
                await channel.subscribe();
                await channel.send({
                  type: 'broadcast',
                  event: 'arrived',
                  payload: { sessionId: journeySession.id, arrivedAt: new Date().toISOString() },
                });
                supabase.removeChannel(channel);
                // Push member watchers
                try {
                  const watcherTokens = await getWatcherPushTokens(journeySession.id);
                  if (watcherTokens.length) {
                    const tokens = watcherTokens.map((w) => w.token);
                    const userIds = watcherTokens.map((w) => w.userId);
                    await sendPushNotification(
                      tokens,
                      `${journeySession.traveler_name ?? 'Someone'} arrived safely`,
                      journeySession.destination_name
                        ? `Arrived at ${journeySession.destination_name}`
                        : 'Journey complete',
                      { type: 'session_arrived', sessionId: journeySession.id },
                      undefined,
                      userIds,
                    );
                  }
                } catch {}
              }
            }
          }
        },
      );
      // Re-validate after the await: if this effect was torn down while the
      // subscription was being created, dispose it instead of storing it.
      if (isStale()) {
        pSub.remove();
        return;
      }
      positionSub = pSub;
    };

    start();

    return () => {
      mounted.current = false;
      if (watchOwnerToken === token) {
        watchOwnerToken = null;
        positionSub?.remove();
        positionSub = null;
        headingSub?.remove();
        headingSub = null;
        headingSmoother.current.reset();
        // Clear the published heading so a remount cannot briefly render a
        // stale direction from the previous session.
        useSelfPoseStore.getState().reset();
      }
      if (broadcastChannel.current) {
        supabase.removeChannel(broadcastChannel.current);
        broadcastChannel.current = null;
        broadcastChannelToken.current = null;
      }
    };
  }, []);

  // When broadcasting stops, mark offline
  useEffect(() => {
    if (!isBroadcasting) {
      const userId = sessionUserId;
      const groupId = activeGroupId;
      if (userId && groupId) {
        setLocationPaused(groupId, userId).catch(() => {});
      }
    }
  }, [isBroadcasting, sessionUserId, activeGroupId]);
}
