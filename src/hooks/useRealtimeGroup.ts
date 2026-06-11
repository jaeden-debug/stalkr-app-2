/**
 * Manages Supabase realtime subscriptions for the active group.
 * Subscribes once, cleans up properly on group change.
 *
 * On every group switch we:
 *   1. Clear the previous crew's live positions / markers / zones (isolation).
 *   2. Load this group's markers, zones, members and current live positions.
 *   3. Subscribe to granular realtime changes for all of the above.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getCrewColor } from '@/constants/map';
import { getLocationStatus } from '@/utils/time';
import { fetchGroupLiveLocations } from '@/services/liveLocations';
import { normalizeSavedPlace } from '@/services/savedPlaces';
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

/** Map a live_locations DB row → MapCrewMember. Honors explicit offline/paused. */
function mapLiveRow(row: any): MapCrewMember | null {
  if (!row?.user_id) return null;
  const lat = row.is_approximate ? row.approximate_latitude : row.latitude;
  const lng = row.is_approximate ? row.approximate_longitude : row.longitude;
  if (lat == null || lng == null) return null;

  // A member who has gone dark is marked offline/paused in the DB — respect that
  // immediately rather than waiting for last_ping_at to age out.
  const explicit = row.status === 'offline' || row.status === 'paused';
  const status = explicit ? row.status : getLocationStatus(row.last_ping_at);

  return {
    user_id: row.user_id,
    group_id: row.group_id,
    latitude: lat,
    longitude: lng,
    heading: row.heading ?? 0,
    speed: row.speed ?? 0,
    accuracy: row.accuracy ?? 0,
    battery_level: row.battery_level ?? null,
    status: status as any,
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
  const session = useAuthStore((s) => s.session);
  const { setCrewLocation, loadMarkers, loadSavedPlaces } = useMapStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isUuid(activeGroupId)) return;

    const gid = activeGroupId!;
    const myId = session?.user?.id;
    const channelName = `group_${gid}_${Date.now()}`;

    // 1. Clear the previous crew's data so nothing bleeds across crews.
    useMapStore.setState({ crewLocations: {}, markers: [], savedPlaces: [] });

    // 2. Initial loads for this group.
    loadMarkers(gid);
    loadSavedPlaces(gid);
    useGroupStore.getState().loadGroupMembers(gid);
    fetchGroupLiveLocations(gid)
      .then((rows) => {
        rows.forEach((row) => {
          if (row.user_id === myId) return; // self handled by useLocationTracker
          const member = mapLiveRow(row);
          if (member) useMapStore.getState().setCrewLocation(member.user_id, member);
        });
      })
      .catch(() => {});

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
          if (member) setCrewLocation(row.user_id, member);
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
          } else {
            const r = payload.new as any;
            if (r?.id) store.upsertMarkerInStore(r);
          }
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
          } else {
            const r = payload.new as any;
            // Normalize: realtime can deliver lat/lng as strings + polygon_coords
            // as a JSON string, which would make ZoneLayer drop the zone.
            if (r?.id) store.upsertSavedPlaceInStore(normalizeSavedPlace(r));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${gid}` },
        () => {
          // Someone joined/left/changed role — refresh the roster so new crew
          // members appear (and their markers resolve names) without a manual reload.
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
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeGroupId, session?.user?.id]);
}
