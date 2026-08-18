/**
 * Crew lifecycle.
 *
 * The defects these lock down were all reachable from normal use:
 *   • joining by invite code was impossible (RLS blocked the pre-join read)
 *   • creating a crew was not atomic and could orphan it
 *   • double-tapping Create made two crews
 *   • the last owner could abandon a crew, making it unadministrable
 *   • switching to a crew opted you into broadcasting
 */
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isBroadcastingToCrew } from '@/utils/broadcast';
import type { Group } from '@/types/models';

jest.mock('@/services/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn(), rpc: jest.fn() } }));
jest.mock('@/services/groupEvents', () => ({ logEvent: jest.fn(async () => true) }));
jest.mock('@/services/groups', () => ({
  __esModule: true,
  createGroup: jest.fn(),
  joinCrewByInviteCode: jest.fn(),
  joinGroupByInviteCode: jest.fn(),
  leaveCrew: jest.fn(),
  leaveGroup: jest.fn(),
  deleteGroup: jest.fn(async () => true),
  updateGroup: jest.fn(async () => true),
  fetchMyGroups: jest.fn(async () => []),
  fetchGroupMembers: jest.fn(async () => []),
  updateGroupMember: jest.fn(async () => true),
  removeGroupMember: jest.fn(async () => true),
  regenerateInviteCode: jest.fn(),
  transferOwnership: jest.fn(async () => true),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const groupService = require('@/services/groups');

const crew = (id: string, name = id): Group =>
  ({ id, name, type: 'custom', created_by: 'me', invite_code: 'ABC12345', invite_enabled: true, tracking_mode: 'flexible' }) as Group;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'me' } }, user: { id: 'me' } } as never);
  useGroupStore.setState({ groups: [], activeGroupId: null, groupMembers: [] });
  useLocationStore.setState({ groupBroadcastingStatus: {}, isBroadcasting: false } as never);
});

describe('crew creation', () => {
  it('adds the crew and makes it active on success', async () => {
    groupService.createGroup.mockResolvedValue(crew('g1', 'Alpha'));
    const created = await useGroupStore.getState().createGroup('Alpha');

    expect(created?.id).toBe('g1');
    expect(useGroupStore.getState().groups.map((g) => g.id)).toEqual(['g1']);
    expect(useGroupStore.getState().activeGroupId).toBe('g1');
  });

  it('a double-tapped Create produces exactly one crew', async () => {
    // Two taps used to fire two inserts and leave two identically-named crews.
    let resolveFirst: (v: unknown) => void = () => {};
    groupService.createGroup.mockImplementationOnce(
      () => new Promise((r) => { resolveFirst = r; }),
    );

    const first = useGroupStore.getState().createGroup('Alpha');
    const second = await useGroupStore.getState().createGroup('Alpha'); // while in flight
    resolveFirst(crew('g1', 'Alpha'));
    await first;

    expect(second).toBeNull();
    expect(groupService.createGroup).toHaveBeenCalledTimes(1);
    expect(useGroupStore.getState().groups).toHaveLength(1);
  });

  it('releases the guard so a later create still works', async () => {
    groupService.createGroup.mockResolvedValue(crew('g1'));
    await useGroupStore.getState().createGroup('Alpha');
    groupService.createGroup.mockResolvedValue(crew('g2'));
    await useGroupStore.getState().createGroup('Bravo');

    expect(useGroupStore.getState().groups).toHaveLength(2);
  });

  it('leaves state untouched when creation fails', async () => {
    groupService.createGroup.mockResolvedValue(null);
    const created = await useGroupStore.getState().createGroup('Alpha');

    expect(created).toBeNull();
    expect(useGroupStore.getState().groups).toEqual([]);
  });
});

describe('joining by invite code', () => {
  it('adds the crew on success', async () => {
    groupService.joinCrewByInviteCode.mockResolvedValue({ ok: true, group: crew('g1', 'Alpha') });
    const result = await useGroupStore.getState().joinByInviteCode('abc12345');

    expect(result.ok).toBe(true);
    expect(useGroupStore.getState().groups).toHaveLength(1);
    expect(useGroupStore.getState().activeGroupId).toBe('g1');
  });

  it('accepting the same invite twice yields exactly one membership', async () => {
    // Idempotency is guaranteed by UNIQUE (group_id, user_id) + ON CONFLICT
    // server-side; this pins the STORE half so the crew list cannot duplicate.
    groupService.joinCrewByInviteCode.mockResolvedValue({ ok: true, group: crew('g1', 'Alpha') });
    await useGroupStore.getState().joinByInviteCode('ABC12345');
    await useGroupStore.getState().joinByInviteCode('ABC12345');

    expect(useGroupStore.getState().groups).toHaveLength(1);
  });

  it('does not re-log a join event when already a member', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logEvent } = require('@/services/groupEvents');
    groupService.joinCrewByInviteCode.mockResolvedValue({ ok: true, group: crew('g1') });
    await useGroupStore.getState().joinByInviteCode('ABC12345');
    await useGroupStore.getState().joinByInviteCode('ABC12345');

    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a bad code from a network failure', async () => {
    groupService.joinCrewByInviteCode.mockResolvedValue({
      ok: false, reason: 'invalid_code', message: 'That invite code is not valid or has been turned off.',
    });
    const bad = await useGroupStore.getState().joinByInviteCode('NOPE');
    expect(bad).toMatchObject({ ok: false, reason: 'invalid_code' });

    groupService.joinCrewByInviteCode.mockResolvedValue({
      ok: false, reason: 'network', message: 'Could not reach the server.',
    });
    const net = await useGroupStore.getState().joinByInviteCode('ABC12345');
    expect(net).toMatchObject({ ok: false, reason: 'network' });
  });

  it('does not add a crew when the join fails', async () => {
    groupService.joinCrewByInviteCode.mockResolvedValue({
      ok: false, reason: 'invalid_code', message: 'nope',
    });
    await useGroupStore.getState().joinByInviteCode('NOPE');

    expect(useGroupStore.getState().groups).toEqual([]);
  });
});

describe('leaving a crew', () => {
  it('removes the crew and reassigns the active one', async () => {
    useGroupStore.setState({ groups: [crew('g1'), crew('g2')], activeGroupId: 'g1' });
    groupService.leaveCrew.mockResolvedValue({ ok: true });

    const result = await useGroupStore.getState().leaveGroup('g1');

    expect(result.ok).toBe(true);
    expect(useGroupStore.getState().groups.map((g) => g.id)).toEqual(['g2']);
    expect(useGroupStore.getState().activeGroupId).toBe('g2');
  });

  it('refuses to orphan a crew and keeps it in the list', async () => {
    // The sole owner of a crew that still has members cannot walk away: nobody
    // would be able to administer or delete it afterwards.
    useGroupStore.setState({ groups: [crew('g1')], activeGroupId: 'g1' });
    groupService.leaveCrew.mockResolvedValue({
      ok: false, reason: 'last_owner', message: 'You are the only owner.',
    });

    const result = await useGroupStore.getState().leaveGroup('g1');

    expect(result).toMatchObject({ ok: false, reason: 'last_owner' });
    expect(useGroupStore.getState().groups).toHaveLength(1);
    expect(useGroupStore.getState().activeGroupId).toBe('g1');
  });

  it('clears the active crew when the last one is left', async () => {
    useGroupStore.setState({ groups: [crew('g1')], activeGroupId: 'g1' });
    groupService.leaveCrew.mockResolvedValue({ ok: true });
    await useGroupStore.getState().leaveGroup('g1');

    expect(useGroupStore.getState().activeGroupId).toBeNull();
  });
});

describe('switching crews does not change privacy', () => {
  it('activating a never-opted-into crew leaves you dark', async () => {
    // setActiveGroupId used to mirror the per-crew flag into the global one and
    // DEFAULT IT TO TRUE, so merely switching marked you as broadcasting.
    useGroupStore.setState({ groups: [crew('g1'), crew('g2')], activeGroupId: 'g1' });
    useGroupStore.getState().setActiveGroupId('g2');

    const map = useLocationStore.getState().groupBroadcastingStatus;
    expect(isBroadcastingToCrew(map, 'g2')).toBe(false);
  });

  it('switching never writes broadcasting state at all', () => {
    useLocationStore.setState({ groupBroadcastingStatus: { g1: true } } as never);
    useGroupStore.getState().setActiveGroupId('g2');
    useGroupStore.getState().setActiveGroupId('g1');

    // g1's opt-in survives, g2 never gained one.
    const map = useLocationStore.getState().groupBroadcastingStatus;
    expect(map).toEqual({ g1: true });
  });

  it('opting into one crew does not opt you into another', () => {
    useLocationStore.getState().setGroupBroadcasting('g1', true);
    const map = useLocationStore.getState().groupBroadcastingStatus;

    expect(isBroadcastingToCrew(map, 'g1')).toBe(true);
    expect(isBroadcastingToCrew(map, 'g2')).toBe(false);
  });

  it('an enforced crew broadcasts regardless of the personal flag', () => {
    const map = useLocationStore.getState().groupBroadcastingStatus;
    expect(isBroadcastingToCrew(map, 'g3', { enforced: true })).toBe(true);
  });
});
