/**
 * Realtime ordering.
 *
 * Invariant: an older location update can never move a marker backwards in
 * time, no matter when it arrives. Network arrival order is not causal order.
 */
import { eventTimeMs, isStaleUpdate } from '@/utils/eventOrder';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import type { MapCrewMember } from '@/types/models';

jest.mock('@/services/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn() } }));
jest.mock('@/services/markers', () => ({
  fetchGroupMarkers: jest.fn(async () => []), createMarker: jest.fn(), deleteMarker: jest.fn(),
  updateMarker: jest.fn(), normalizeMarker: (r: any) => r, isMarkerVisibleToGroup: () => true,
}));
jest.mock('@/services/savedPlaces', () => ({
  fetchGroupSavedPlaces: jest.fn(async () => []), createSavedPlace: jest.fn(),
  updateSavedPlace: jest.fn(), normalizeSavedPlace: (r: any) => r, upsertPresence: jest.fn(),
}));
jest.mock('@/services/groupEvents', () => ({ logEvent: jest.fn(async () => {}) }));

const at = (iso: string, extra: Partial<MapCrewMember> = {}): MapCrewMember =>
  ({
    user_id: 'u1', group_id: 'g1', latitude: 1, longitude: 1, heading: 0,
    status: 'live', updated_at: iso, last_ping_at: iso, ...extra,
  }) as MapCrewMember;

describe('eventTimeMs', () => {
  it('prefers updated_at, which changes on status-only writes', () => {
    // Going dark writes a status without moving, so last_ping_at can lag.
    expect(eventTimeMs({ updated_at: '2024-01-01T10:04:08Z', last_ping_at: '2024-01-01T10:00:00Z' }))
      .toBe(new Date('2024-01-01T10:04:08Z').getTime());
  });

  it('falls back to last_ping_at', () => {
    expect(eventTimeMs({ last_ping_at: '2024-01-01T10:04:08Z' }))
      .toBe(new Date('2024-01-01T10:04:08Z').getTime());
  });

  it('returns null for missing or malformed timestamps', () => {
    expect(eventTimeMs(null)).toBeNull();
    expect(eventTimeMs({})).toBeNull();
    expect(eventTimeMs({ updated_at: 'not-a-date' })).toBeNull();
  });
});

describe('isStaleUpdate', () => {
  const newer = { updated_at: '2024-01-01T10:04:08Z' };
  const older = { updated_at: '2024-01-01T10:04:04Z' };

  it('rejects a strictly older update', () => {
    expect(isStaleUpdate(newer, older)).toBe(true);
  });

  it('accepts a newer update', () => {
    expect(isStaleUpdate(older, newer)).toBe(false);
  });

  it('accepts an equal timestamp so a same-second status change is not stranded', () => {
    expect(isStaleUpdate(newer, { ...newer })).toBe(false);
  });

  it('accepts anything when nothing is held yet', () => {
    expect(isStaleUpdate(null, older)).toBe(false);
  });

  it('refuses an undated row over a dated one', () => {
    // An untimestamped row cannot be proven newer, so it must not clobber a
    // known-good position.
    expect(isStaleUpdate(newer, {})).toBe(true);
  });

  it('accepts a dated row over an undated one', () => {
    expect(isStaleUpdate({}, newer)).toBe(false);
  });
});

describe('setCrewLocation ordering', () => {
  beforeEach(() => {
    useGroupStore.setState({ activeGroupId: 'g1' } as never);
    useMapStore.setState({ crewLocations: {} });
  });

  it('keeps the newer position when an older packet arrives late', () => {
    // The canonical scenario: 10:04:08 lands, then a delayed 10:04:04 arrives.
    const set = useMapStore.getState().setCrewLocation;
    set('u1', at('2024-01-01T10:04:08Z', { latitude: 8 }));
    set('u1', at('2024-01-01T10:04:04Z', { latitude: 4 }));

    expect(useMapStore.getState().crewLocations.u1.latitude).toBe(8);
  });

  it('does not even change the object identity when rejecting', () => {
    // A rejected update must not cause a re-render of the crew layer.
    const set = useMapStore.getState().setCrewLocation;
    set('u1', at('2024-01-01T10:04:08Z'));
    const before = useMapStore.getState().crewLocations;

    set('u1', at('2024-01-01T10:04:04Z'));

    expect(useMapStore.getState().crewLocations).toBe(before);
  });

  it('a stale live ping cannot undo a Go Dark transition', () => {
    // The privacy-relevant case: the user goes dark at 10:05, but a 'live' ping
    // sent at 10:04 is still in flight and lands afterwards.
    const set = useMapStore.getState().setCrewLocation;
    set('u1', at('2024-01-01T10:05:00Z', { status: 'paused' }));
    set('u1', at('2024-01-01T10:04:00Z', { status: 'live' }));

    expect(useMapStore.getState().crewLocations.u1.status).toBe('paused');
  });

  it('still applies genuinely newer updates after a rejection', () => {
    const set = useMapStore.getState().setCrewLocation;
    set('u1', at('2024-01-01T10:04:08Z', { latitude: 8 }));
    set('u1', at('2024-01-01T10:04:04Z', { latitude: 4 }));
    set('u1', at('2024-01-01T10:04:12Z', { latitude: 12 }));

    expect(useMapStore.getState().crewLocations.u1.latitude).toBe(12);
  });

  it('orders each member independently', () => {
    const set = useMapStore.getState().setCrewLocation;
    set('u1', at('2024-01-01T10:04:08Z', { latitude: 8 }));
    set('u2', { ...at('2024-01-01T10:00:00Z', { latitude: 1 }), user_id: 'u2' } as MapCrewMember);

    // u2's older-but-first update is fine — ordering is per member.
    expect(useMapStore.getState().crewLocations.u2.latitude).toBe(1);
    expect(useMapStore.getState().crewLocations.u1.latitude).toBe(8);
  });

  it('converges to the newest regardless of delivery permutation', () => {
    const set = useMapStore.getState().setCrewLocation;
    const updates = [
      at('2024-01-01T10:04:04Z', { latitude: 4 }),
      at('2024-01-01T10:04:08Z', { latitude: 8 }),
      at('2024-01-01T10:04:06Z', { latitude: 6 }),
    ];
    // Every arrival order must end at the same state.
    for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2], [2, 0, 1]]) {
      useMapStore.setState({ crewLocations: {} });
      order.forEach((i) => set('u1', updates[i]));
      expect(useMapStore.getState().crewLocations.u1.latitude).toBe(8);
    }
  });
});

describe('the guard applies to every realtime entity, not just locations', () => {
  // Realtime gives no ordering guarantee. Locations were protected from day
  // one; markers and zones were not, despite carrying the same updated_at. A
  // delayed UPDATE arriving after a newer one silently reverted an edit the
  // user was already looking at.
  const at = (iso: string) => ({ updated_at: iso }) as never;

  it('rejects an older marker update', () => {
    expect(isStaleUpdate(at('2026-01-01T10:05:00Z'), at('2026-01-01T10:00:00Z'))).toBe(true);
  });

  it('accepts a newer marker update', () => {
    expect(isStaleUpdate(at('2026-01-01T10:00:00Z'), at('2026-01-01T10:05:00Z'))).toBe(false);
  });

  it('accepts an identical timestamp rather than dropping a real edit', () => {
    // Two edits inside the same second are indistinguishable by timestamp.
    // Dropping the second would lose a genuine change; applying it is the
    // safer failure, since the only cost is redundant work.
    expect(isStaleUpdate(at('2026-01-01T10:00:00Z'), at('2026-01-01T10:00:00Z'))).toBe(false);
  });

  it('accepts anything when nothing is stored yet', () => {
    expect(isStaleUpdate(undefined, at('2026-01-01T10:00:00Z'))).toBe(false);
  });

  it('rejects an incoming row with no usable timestamp over one that has it', () => {
    // An undateable row cannot be shown to be newer, and overwriting known-good
    // state with unknown-age state is how a stale position becomes "current".
    expect(isStaleUpdate(at('2026-01-01T10:00:00Z'), at('not-a-date'))).toBe(true);
  });
});
