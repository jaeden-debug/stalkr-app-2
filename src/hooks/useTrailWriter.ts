/**
 * Writes trail points to Supabase when the user moves beyond thresholds.
 * Reads location from store — does NOT create its own GPS watch.
 */
import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { insertTrailPoint } from '@/services/trails';
import { isUuid } from '@/utils/async';

const MIN_DIST_M = 18;
const MIN_TIME_MS = 90_000;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useTrailWriter() {
  const lastWrite = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const inFlight = useRef(false);
  const myLocation = useMapStore((s) => s.myLocation);
  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);

  useEffect(() => {
    if (!myLocation || !isBroadcasting) return;
    const userId = useAuthStore.getState().session?.user?.id;
    const groupId = useGroupStore.getState().activeGroupId;
    if (!userId || !isUuid(groupId)) return;

    const { latitude, longitude, heading } = myLocation;
    const now = Date.now();
    const prev = lastWrite.current;

    const distOk = !prev || haversine(prev.lat, prev.lng, latitude, longitude) >= MIN_DIST_M;
    const timeOk = !prev || now - prev.t >= MIN_TIME_MS;

    if ((!distOk || !timeOk) && prev) return;
    if (inFlight.current) return;

    inFlight.current = true;
    lastWrite.current = { lat: latitude, lng: longitude, t: now };

    insertTrailPoint({
      group_id: groupId!,
      user_id: userId,
      latitude,
      longitude,
      heading,
    })
      .catch(console.error)
      .finally(() => {
        inFlight.current = false;
      });
  }, [myLocation]);
}
