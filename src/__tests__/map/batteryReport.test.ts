/**
 * Battery reporting for journeys.
 *
 * This number is shown to someone who is worried, so a wrong one is worse than
 * none: "phone at 4%" changes how a person interprets silence, and so does a
 * bogus reading.
 */
import { readBattery, __resetBatteryCache } from '@/utils/batteryReport';
import * as Battery from 'expo-battery';

jest.mock('expo-battery', () => ({
  __esModule: true,
  getBatteryLevelAsync: jest.fn(),
  getBatteryStateAsync: jest.fn(),
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
}));

const mockLevel = Battery.getBatteryLevelAsync as jest.Mock;
const mockState = Battery.getBatteryStateAsync as jest.Mock;

beforeEach(() => {
  __resetBatteryCache();
  jest.clearAllMocks();
  mockLevel.mockResolvedValue(0.42);
  mockState.mockResolvedValue(Battery.BatteryState.UNPLUGGED);
});

describe('readBattery', () => {
  it('reports level and charging state', async () => {
    await expect(readBattery(1_000)).resolves.toEqual({ level: 0.42, charging: false });
  });

  it('treats the -1 unknown sentinel as no reading', async () => {
    // Passing it through would show a watcher a battery at -100%.
    mockLevel.mockResolvedValue(-1);
    await expect(readBattery(1_000)).resolves.toEqual({ level: null, charging: false });
  });

  it('rejects an out-of-range level', async () => {
    mockLevel.mockResolvedValue(4.2);
    expect((await readBattery(1_000)).level).toBeNull();
  });

  it('counts a full battery as charging', async () => {
    mockState.mockResolvedValue(Battery.BatteryState.FULL);
    expect((await readBattery(1_000)).charging).toBe(true);
  });

  it('does not claim to know the charging state when it does not', async () => {
    // Reporting "not charging" on an unknown state would be a guess presented
    // as a fact.
    mockState.mockResolvedValue(Battery.BatteryState.UNKNOWN);
    expect((await readBattery(1_000)).charging).toBeNull();
  });

  it('never throws when the native module fails', async () => {
    // A journey must not stop broadcasting position because a battery read
    // failed — the position is the important half.
    mockLevel.mockRejectedValue(new Error('no battery module'));
    await expect(readBattery(1_000)).resolves.toEqual({ level: null, charging: null });
  });
});

describe('caching', () => {
  it('reuses a recent reading instead of querying every fix', async () => {
    // Querying the native module on every GPS fix spends battery to report
    // battery.
    await readBattery(1_000);
    await readBattery(30_000);
    expect(mockLevel).toHaveBeenCalledTimes(1);
  });

  it('refreshes once the reading is stale', async () => {
    await readBattery(1_000);
    await readBattery(1_000 + 61_000);
    expect(mockLevel).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed read', async () => {
    mockLevel.mockRejectedValueOnce(new Error('boom'));
    expect((await readBattery(1_000)).level).toBeNull();
    expect((await readBattery(2_000)).level).toBe(0.42);
  });
});
