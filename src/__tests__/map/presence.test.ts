/**
 * Presence policy + the Go Dark privacy boundary.
 *
 * The invariant these protect: a user who believes they are hidden IS hidden,
 * and a marker never claims a position is current when it is not.
 */
import {
  LIVE_WINDOW_MS,
  STALE_WINDOW_MS,
  describePresence,
  formatLastSeen,
  resolvePresence,
} from '@/utils/presence';
import { isBroadcastingToCrew, isDarkForCrew } from '@/utils/broadcast';

const NOW = 1_700_000_000_000;
const iso = (agoMs: number) => new Date(NOW - agoMs).toISOString();

describe('resolvePresence', () => {
  it('reports a recent ping as live and directional', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: iso(60_000), now: NOW });
    expect(p.state).toBe('live');
    expect(p.isDirectional).toBe(true);
    expect(p.isPositionCurrent).toBe(true);
  });

  it('ages into stale past the live window', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: iso(LIVE_WINDOW_MS + 1000), now: NOW });
    expect(p.state).toBe('stale');
    // Still moving, we are just behind — direction remains meaningful.
    expect(p.isDirectional).toBe(true);
    expect(p.isPositionCurrent).toBe(false);
  });

  it('ages into unknown past the stale window', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: iso(STALE_WINDOW_MS + 1000), now: NOW });
    expect(p.state).toBe('unknown');
    expect(p.isDirectional).toBe(false);
  });

  it('distinguishes DARK from an aged-out signal', () => {
    // The whole point of this module. 'paused' is a deliberate choice;
    // a stale ping is a loss of contact. Both used to be status 'offline'.
    const dark = resolvePresence({ status: 'paused', lastPingAt: iso(30_000), now: NOW });
    const lost = resolvePresence({ status: 'live', lastPingAt: iso(STALE_WINDOW_MS + 1), now: NOW });

    expect(dark.state).toBe('dark');
    expect(lost.state).toBe('unknown');
    expect(dark.state).not.toBe(lost.state);
  });

  it('keeps a dark user DARK no matter how fresh their last ping was', () => {
    // Dark must not decay into live/stale — staleness implies we still expect
    // updates, and from a dark user we do not.
    for (const age of [0, 1000, LIVE_WINDOW_MS - 1, STALE_WINDOW_MS + 1]) {
      expect(resolvePresence({ status: 'paused', lastPingAt: iso(age), now: NOW }).state).toBe('dark');
    }
  });

  it('never presents a dark user position as current, and drops direction', () => {
    const p = resolvePresence({ status: 'paused', lastPingAt: iso(30_000), now: NOW });
    expect(p.isPositionCurrent).toBe(false);
    // Continuing to draw a heading cone would assert a facing direction we no
    // longer receive.
    expect(p.isDirectional).toBe(false);
  });

  it('honours a local isDark override without waiting for the server', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: iso(1000), isDark: true, now: NOW });
    expect(p.state).toBe('dark');
  });

  it('retains the last-known timestamp for a dark user', () => {
    // Going dark must not erase where/when they were last seen.
    const at = iso(120_000);
    const p = resolvePresence({ status: 'paused', lastPingAt: at, now: NOW });
    expect(p.lastUpdatedAt).toBe(at);
    expect(p.ageMs).toBe(120_000);
  });

  it('reports unknown when there is no timestamp at all', () => {
    const p = resolvePresence({ status: null, lastPingAt: null, now: NOW });
    expect(p.state).toBe('unknown');
    expect(p.ageMs).toBeNull();
  });

  it('does not crash on a malformed timestamp', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: 'not-a-date', now: NOW });
    expect(p.state).toBe('unknown');
    expect(p.ageMs).toBeNull();
  });
});

describe('presence copy', () => {
  it('never describes a dark user as live', () => {
    const p = resolvePresence({ status: 'paused', lastPingAt: iso(60_000), now: NOW });
    const text = describePresence(p, 'Sam');
    expect(text).toContain('went dark');
    expect(text).toContain('last known');
    expect(text).not.toContain('sharing live');
  });

  it('flags a stale position as possibly out of date', () => {
    const p = resolvePresence({ status: 'live', lastPingAt: iso(LIVE_WINDOW_MS + 60_000), now: NOW });
    expect(describePresence(p, 'Sam')).toContain('out of date');
  });

  it('formats ages without ever claiming "now"', () => {
    expect(formatLastSeen(0)).toBe('just now');
    expect(formatLastSeen(5 * 60_000)).toBe('5 min ago');
    expect(formatLastSeen(3 * 3_600_000)).toBe('3 hrs ago');
    expect(formatLastSeen(2 * 86_400_000)).toBe('2 days ago');
    expect(formatLastSeen(null)).toBe('never');
  });
});

describe('Go Dark privacy boundary', () => {
  // Regression for a confirmed location leak: the self drawer's toggle wrote
  // useLocationStore.isBroadcasting (global), but useLocationTracker gates
  // broadcasting on groupBroadcastingStatus[groupId], which defaults to LIVE
  // when undefined. The marker greyed out while the position kept broadcasting.
  //
  // Both the tracker and the marker now call these, so they cannot diverge.
  const isBroadcastingToGroup = (statusMap: Record<string, boolean>, groupId: string) =>
    isBroadcastingToCrew(statusMap, groupId);

  it('DEFAULTS TO DARK — joining a crew does not start sharing on its own', () => {
    // Deliberate privacy posture: an absent entry means the member never opted
    // in, and an un-opted-in member does not broadcast.
    expect(isBroadcastingToGroup({}, 'g1')).toBe(false);
  });

  it('only an explicit opt-in starts the broadcast', () => {
    expect(isBroadcastingToGroup({ g1: true }, 'g1')).toBe(true);
    expect(isBroadcastingToGroup({ g1: false }, 'g1')).toBe(false);
  });

  it('opting into one crew does not opt you into another', () => {
    const map = { g1: true };
    expect(isBroadcastingToGroup(map, 'g1')).toBe(true);
    expect(isBroadcastingToGroup(map, 'g2')).toBe(false);
  });

  it('a crew that enforces tracking overrides both the default and an opt-out', () => {
    expect(isBroadcastingToCrew({}, 'g1', { enforced: true })).toBe(true);
    expect(isBroadcastingToCrew({ g1: false }, 'g1', { enforced: true })).toBe(true);
    // ...and the marker agrees, so an enforced crew never renders a false "dark".
    expect(isDarkForCrew({ g1: false }, 'g1', { enforced: true })).toBe(false);
  });

  it('the marker and the tracker agree on darkness for EVERY state', () => {
    // Both surfaces now derive from the same pair of functions, so the leak is
    // unreachable by construction rather than by remembering to write two
    // flags. Exhaustive over every representable per-crew value.
    const perCrewValues: Array<boolean | undefined> = [undefined, true, false];

    for (const perCrew of perCrewValues) {
      for (const enforced of [false, true]) {
        const map: Record<string, boolean> = perCrew === undefined ? {} : { g1: perCrew };
        const scope = { enforced };

        const uiSaysDark = isDarkForCrew(map, 'g1', scope);              // SelfMarker
        const actuallyBroadcasting = isBroadcastingToCrew(map, 'g1', scope); // tracker

        // The leak: UI claims hidden while the tracker is still transmitting.
        expect(uiSaysDark && actuallyBroadcasting).toBe(false);
        // The inverse confusion: UI claims live while nothing is sent.
        expect(!uiSaysDark && !actuallyBroadcasting).toBe(false);
      }
    }
  });

  it('a null crew is never treated as broadcasting', () => {
    expect(isBroadcastingToCrew({}, null)).toBe(false);
    expect(isBroadcastingToCrew({}, undefined)).toBe(false);
  });
});
