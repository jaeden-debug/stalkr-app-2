/**
 * Manages Supabase realtime subscriptions for the active group.
 *
 * ── Population lifecycle (the "everything vanished" bug) ─────────────────────
 * This effect used to open with:
 *     useMapStore.setState({ crewLocations: {}, markers: [], savedPlaces: [] });
 * and then fire async reloads. Every marker and zone unmounted — native views
 * destroyed — and remounted a network round-trip later, so ANY re-run of this
 * effect blanked the map, including an ordinary same-crew resubscribe.
 *
 * The replacement distinguishes the two cases, because they have opposite
 * requirements:
 *   • crew A → crew B — clear immediately. Crew isolation is a correctness
 *     boundary; showing A's pins while B loads would render one crew's
 *     positions under another crew's context. Isolation beats continuity.
 *   • crew A → crew A — do not touch the screen. Fetch in the background and
 *     install atomically via commitPopulation.
 *
 * commitPopulation additionally rejects late responses whose groupId no longer
 * matches the active crew, so a slow fetch for A cannot land after a switch
 * to B.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getCrewColor } from '@/constants/map';
import { fetchGroupLiveLocations } from '@/services/liveLocations';
import { fetchGroupMarkers, isMarkerVisibleToGroup, normalizeMarker } from '@/services/markers';
import { fetchGroupSavedPlaces, normalizeSavedPlace } from '@/services/savedPlaces';
import { isValidLatitude, isValidLongitude, rejectRow, toFiniteNumber } from '@/services/normalize';
import { sendLocalNotification } from '@/services/notifications';
import { useCrewPrefsStore } from '@/store/useCrewPrefsStore';
import { useNotifCenterStore } from '@/store/useNotifCenterStore';
import type { MapCrewMember } from '@/types/models';

// Crew event types that should surface as a local alert when they arrive live.
const ALERT_EVENTS = new Set([
  'sos_triggered', 'deadman_triggered', 'checkin_timer_missed', 'arrival', 'member_offline', 'member_online',
]);

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Map a live_locations DB row → MapCrewMember, validating at ingress.
 * Honors explicit offline/paused rather than waiting for last_ping_at to age.
 */
export function mapLiveRow(row: any): MapCrewMember | null {
  if (!row?.user_id) return rejectRow('live_location', 'missing user_id', row);

  const lat = toFiniteNumber(row.is_approximate ? row.approximate_latitude : row.latitude);
  const lng = toFiniteNumber(row.is_approximate ? row.approximate_longitude : row.longitude);
  if (!isValidLatitude(lat)) return rejectRow('live_location', `invalid latitude ${lat}`, row);
  if (!isValidLongitude(lng)) return rejectRow('live_location', `invalid longitude ${lng}`, row);

  // Raw status passes through untouched. Deriving freshness here duplicated the
  // policy and, worse, collapsed 'paused' (deliberately dark) into 'offline'
  // (we lost them). resolvePresence() is now the single decision point.
  return {
    user_id: row.user_id,
    group_id: row.group_id,
    latitude: lat,
    longitude: lng,
    // Preserved as null when the sender had no compass fix — CrewMarker hides
    // the direction cone rather than pointing it north.
    heading: toFiniteNumber(row.heading),
    speed: toFiniteNumber(row.speed) ?? 0,
    accuracy: toFiniteNumber(row.accuracy) ?? 0,
    battery_level: toFiniteNumber(row.battery_level),
    status: (row.status ?? null) as any,
    sharing_mode: row.sharing_mode,
    updated_at: row.updated_at,
    last_ping_at: row.last_ping_at,
    is_approximate: row.is_approximate ?? false,
    displayName: '',
    displayInitials: '?',
    displayAvatar: null,
    color: getCrewColor(row.user_id),
  };
}

export function useRealtimeGroup() {
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  // Primitive selector. The old `const { setCrewLocation, loadMarkers,
  // loadSavedPlaces } = useMapStore()` was a whole-store subscription, so the
  // host screen re-rendered on every single map-store write.
  const myUserId = useAuthStore((s) => s.session?.user?.id);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const loadGeneration = useRef(0);

  useEffect(() => {
    if (!isUuid(activeGroupId)) return;

    const gid = activeGroupId!;
    const myId = myUserId;
    const generation = ++loadGeneration.current;
    const channelName = `group_${gid}_${Date.now()}`;

    // 1. Clear ONLY on a genuine crew change (see header note).
    if (useMapStore.getState().populationGroupId !== gid) {
      useMapStore.getState().suspendPopulation();
    }

    // 2. Load the whole population, then install it in one atomic write so the
    //    user never sees a partially-filled or empty map for the active crew.
    (async () => {
      const [markers, savedPlaces, liveRows] = await Promise.all([
        fetchGroupMarkers(gid).catch(() => []),
        fetchGroupSavedPlaces(gid).catch(() => []),
        fetchGroupLiveLocations(gid).catch(() => []),
      ]);

      // Superseded by a newer crew switch — discard rather than render.
      if (loadGeneration.current !== generation) return;

      const crewLocations: Record<string, MapCrewMember> = {};
      for (const row of liveRows) {
        if (row.user_id === myId) continue; // self is owned by useLocationTracker
        const member = mapLiveRow(row);
        if (member) crewLocations[member.user_id] = member;
      }

      useMapStore.getState().commitPopulation(gid, { markers, savedPlaces, crewLocations });
    })();

    useGroupStore.getState().loadGroupMembers(gid);

    // 3. Realtime subscriptions.
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_locations', filter: `group_id=eq.${gid}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.user_id || row.user_id === myId) return;
          const member = mapLiveRow(row);
          if (member) useMapStore.getState().setCrewLocation(row.user_id, member);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'markers', filter: `group_id=eq.${gid}` },
        (payload) => {
          const store = useMapStore.getState();
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id;
            if (id) store.removeMarkerFromStore(id);
            return;
          }
          const raw = payload.new as any;
          // Realtime rows previously bypassed both normalization and the
          // `visible_to_group` filter that the initial fetch applies, so a
          // hidden marker appeared live and then vanished on the next reload.
          if (!isMarkerVisibleToGroup(raw)) {
            if (raw?.id) store.removeMarkerFromStore(raw.id);
            return;
          }
          const marker = normalizeMarker(raw);
          if (marker) store.upsertMarkerInStore(marker);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_places', filter: `group_id=eq.${gid}` },
        (payload) => {
          const store = useMapStore.getState();
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id;
            if (id) store.removeSavedPlaceFromStore(id);
            return;
          }
          const r = payload.new as any;
          // Realtime can deliver lat/lng as strings and polygon_coords as a JSON
          // string, which would make ZoneLayer silently drop the zone.
          if (r?.id) {
            const place = normalizeSavedPlace(r);
            if (place) store.upsertSavedPlaceInStore(place);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${gid}` },
        (payload) => {
          // Crew POLICY changes must reach members without an app restart.
          // Nothing subscribed to `groups` before, so turning on enforced
          // tracking (which overrides each member's default-dark choice) only
          // took effect for others at next launch — and turning it OFF left
          // members broadcasting under a policy that no longer existed.
          if (payload.eventType === 'DELETE') {
            useGroupStore.getState().loadGroups();
            return;
          }
          const row = payload.new as any;
          if (!row?.id) return;
          useGroupStore.setState((st) => ({
            groups: st.groups.map((g) =>
              g.id === row.id
                ? { ...g, name: row.name ?? g.name,
                    tracking_mode: row.tracking_mode ?? g.tracking_mode,
                    invite_enabled: row.invite_enabled ?? g.invite_enabled,
                    invite_code: row.invite_code ?? g.invite_code }
                : g,
            ),
          }));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${gid}` },
        () => {
          // Someone joined/left/changed role — refresh the roster so new crew
          // members appear (and their markers resolve names) without a reload.
          useGroupStore.getState().loadGroupMembers(gid);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${gid}` },
        (payload) => {
          // Surface crew safety events as a local alert (foreground delivery).
          const row = payload.new as any;
          if (!row || row.user_id === myId) return;
          useNotifCenterStore.getState().bumpUnseen();
          if (!ALERT_EVENTS.has(row.event_type)) return;
          if (useCrewPrefsStore.getState().getCrewPref(gid).muted) return;
          const isSos = row.event_type === 'sos_triggered' || row.event_type === 'deadman_triggered';
          sendLocalNotification(row.title ?? 'Crew alert', row.body ?? '', { type: isSos ? 'sos' : 'zone_crew' }, isSos ? 'sos' : 'safety').catch(() => {});
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[realtime] channel error, will retry');
          // A channel error can mean we lost read access to this crew (removed
          // by an admin), not just a transient network fault. Re-verifying
          // membership is cheap and is the only way the app learns it was
          // removed while open.
          useGroupStore.getState().loadGroups();
        }
      });

    channelRef.current = channel;

    // Returning to the foreground is the other moment membership may have
    // changed without us hearing about it — realtime does not deliver events
    // for rows we can no longer read.
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') useGroupStore.getState().loadGroups();
    };
    const appStateSub = AppState.addEventListener('change', onAppState);

    return () => {
      appStateSub.remove();
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeGroupId, myUserId]);
}
