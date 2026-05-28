/**
 * Manages Supabase realtime subscriptions for the active group.
 * Subscribes once, cleans up properly on group change.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getCrewColor } from '@/constants/map';
import { getLocationStatus } from '@/utils/time';
import type { MapCrewMember } from '@/types/models';

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function useRealtimeGroup() {
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const session = useAuthStore((s) => s.session);
  const { setCrewLocation, loadMarkers, loadSavedPlaces } = useMapStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isUuid(activeGroupId)) return;

    const gid = activeGroupId!;
    const channelName = `group_${gid}_${Date.now()}`;

    // Initial loads
    loadMarkers(gid);
    loadSavedPlaces(gid);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_locations', filter: `group_id=eq.${gid}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.user_id) return;
          // Skip own location (handled by useLocationTracker)
          if (row.user_id === session?.user?.id) return;

          const lat = row.is_approximate ? row.approximate_latitude : row.latitude;
          const lng = row.is_approximate ? row.approximate_longitude : row.longitude;
          if (!lat || !lng) return;

          const member: MapCrewMember = {
            user_id: row.user_id,
            group_id: row.group_id,
            latitude: lat,
            longitude: lng,
            heading: row.heading ?? 0,
            speed: row.speed ?? 0,
            accuracy: row.accuracy ?? 0,
            battery_level: row.battery_level ?? null,
            status: getLocationStatus(row.last_ping_at) as any,
            sharing_mode: row.sharing_mode,
            updated_at: row.updated_at,
            last_ping_at: row.last_ping_at,
            is_approximate: row.is_approximate ?? false,
            displayName: '',
            displayInitials: '?',
            displayAvatar: null,
            color: getCrewColor(row.user_id),
          };
          setCrewLocation(row.user_id, member);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'markers', filter: `group_id=eq.${gid}` },
        () => loadMarkers(gid),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_places', filter: `group_id=eq.${gid}` },
        () => loadSavedPlaces(gid),
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
