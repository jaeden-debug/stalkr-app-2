/**
 * Low Signal / Stale Risk Monitor.
 * Detects: recent stale ping, low battery, poor accuracy.
 * Returns a risk level for the map to display a badge.
 */
import { useMemo } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useLocationStore } from '@/store/useLocationStore';
import { getLocationStatus } from '@/utils/time';
import { FEATURES } from '@/config/features';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

interface SignalRisk {
  level: RiskLevel;
  reasons: string[];
}

export function useLowSignalMonitor(): SignalRisk {
  const myLocation = useMapStore((s) => s.myLocation);
  const lastPingAt = useLocationStore((s) => s.lastBroadcastAt);
  const batteryLevel = useLocationStore((s) => s.batteryLevel);
  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);

  return useMemo(() => {
    if (!FEATURES.LOW_SIGNAL_MONITOR || !isBroadcasting) return { level: 'none', reasons: [] };

    const reasons: string[] = [];
    let score = 0;

    // Stale ping
    const pingStatus = getLocationStatus(lastPingAt);
    if (pingStatus === 'stale') { score += 1; reasons.push('Signal stale'); }
    if (pingStatus === 'offline') { score += 3; reasons.push('Signal lost'); }

    // Poor accuracy
    if (myLocation?.accuracy && myLocation.accuracy > 50) {
      score += 1;
      reasons.push(`Low accuracy (±${Math.round(myLocation.accuracy)}m)`);
    }

    // Low battery
    if (batteryLevel !== null && batteryLevel <= 20) {
      score += batteryLevel <= 10 ? 2 : 1;
      reasons.push(`Battery ${batteryLevel}%`);
    }

    const level: RiskLevel =
      score === 0 ? 'none' : score === 1 ? 'low' : score === 2 ? 'medium' : 'high';

    return { level, reasons };
  }, [lastPingAt, myLocation?.accuracy, batteryLevel, isBroadcasting]);
}
