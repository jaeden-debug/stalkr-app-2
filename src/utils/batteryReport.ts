/**
 * Battery reporting for an active journey.
 *
 * Read lazily and cached, because the value only matters at the resolution a
 * worried person cares about — "about 40%" versus "about 4%" — and querying
 * the native module on every GPS fix would spend battery to report battery.
 *
 * Every failure resolves to null rather than throwing. A journey must never
 * fail to broadcast a position because a battery reading was unavailable; the
 * position is the important half.
 */
import * as Battery from 'expo-battery';

export interface BatteryReport {
  /** 0..1, or null when unavailable. */
  level: number | null;
  charging: boolean | null;
}

/** How long a reading stays good enough to reuse. */
const CACHE_MS = 60_000;

let cached: BatteryReport | null = null;
let cachedAt = 0;

export async function readBattery(now: number = Date.now()): Promise<BatteryReport> {
  if (cached && now - cachedAt < CACHE_MS) return cached;
  try {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    cached = {
      // -1 is the documented "unknown" sentinel; passing it through would show
      // a watcher a battery at -100%.
      level: typeof level === 'number' && level >= 0 && level <= 1 ? level : null,
      charging:
        state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL
          ? true
          : state === Battery.BatteryState.UNPLUGGED
            ? false
            : null,
    };
    cachedAt = now;
    return cached;
  } catch {
    return { level: null, charging: null };
  }
}

/** Test seam — clears the module-level cache. */
export function __resetBatteryCache(): void {
  cached = null;
  cachedAt = 0;
}
