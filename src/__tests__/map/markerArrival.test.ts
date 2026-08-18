/**
 * Marker arrival detection ("Jaeden arrived at camp").
 *
 * Every case here is a push notification to the whole crew, so the cost of a
 * false positive is real: an alert that fires while you are still a field away,
 * or a boundary flap that alerts four times in a minute.
 */
import {
  evaluateArrivals,
  arrivalThresholdFor,
  DEFAULT_ARRIVAL_RADIUS_M,
  JOURNEY_ARRIVAL_RADIUS_M,
} from '@/services/markerArrival';
import type { Marker } from '@/types/models';

jest.mock('@/services/supabase', () => ({ supabase: { from: jest.fn() } }));

const camp = (over: Partial<Marker> = {}): Marker =>
  ({
    id: 'camp', group_id: 'g1', type: 'camp', title: 'Camp',
    latitude: 45, longitude: -75,
    arrival_radius_m: DEFAULT_ARRIVAL_RADIUS_M, notify_on_arrival: true,
    ...over,
  }) as Marker;

/** Metres north of the marker, converted to a latitude offset. */
const northOf = (metres: number) => 45 + metres / 111_320;

const fixAt = (metres: number, accuracy = 5) => ({
  latitude: northOf(metres), longitude: -75, accuracy,
});

describe('arrival', () => {
  it('fires when you come inside the radius', () => {
    const out = evaluateArrivals([camp()], fixAt(20), {});
    expect(out).toEqual([
      { markerId: 'camp', markerTitle: 'Camp', arrived: true, departed: false },
    ]);
  });

  it('does not fire while you are still outside', () => {
    expect(evaluateArrivals([camp()], fixAt(120), {})).toEqual([]);
  });

  it('does not re-fire while you stay there', () => {
    // Only TRANSITIONS notify — otherwise sitting at camp would alert the crew
    // on every GPS fix.
    const out = evaluateArrivals([camp()], fixAt(10), { camp: true });
    expect(out).toEqual([]);
  });

  it('is off unless a radius is set', () => {
    expect(evaluateArrivals([camp({ arrival_radius_m: null })], fixAt(1), {})).toEqual([]);
    expect(evaluateArrivals([camp({ arrival_radius_m: 0 })], fixAt(1), {})).toEqual([]);
  });

  it('ignores markers with unusable coordinates', () => {
    expect(evaluateArrivals([camp({ latitude: NaN })], fixAt(1), {})).toEqual([]);
  });
});

describe('accuracy awareness', () => {
  it('refuses to decide on a fix too imprecise for the radius', () => {
    // A ±200m fix cannot place you inside a 50m circle. Claiming arrival would
    // tell the crew you are at camp while you are nowhere near it.
    expect(evaluateArrivals([camp()], fixAt(0, 200), {})).toEqual([]);
  });

  it('shrinks the arrival ring by the fix uncertainty', () => {
    // 50m radius with a ±40m fix should not trigger at 45m out — the true
    // position could be 85m away.
    expect(evaluateArrivals([camp()], fixAt(45, 40), {})).toEqual([]);
    // Well inside even after subtracting the uncertainty: fires.
    expect(evaluateArrivals([camp()], fixAt(5, 40), {})).toHaveLength(1);
  });

  it('keeps arrival reachable even with a mediocre fix', () => {
    // The shrink has a floor, so a poor-but-usable fix cannot make arrival
    // mathematically impossible.
    expect(evaluateArrivals([camp()], fixAt(2, 55), {})).toHaveLength(1);
  });
});

describe('departure hysteresis', () => {
  it('does not report leaving the moment you cross back out', () => {
    // GPS wander around the boundary would otherwise flap arrived/left/arrived,
    // pushing a notification to the crew every time.
    expect(evaluateArrivals([camp()], fixAt(55), { camp: true })).toEqual([]);
  });

  it('reports leaving once you are clearly away', () => {
    const out = evaluateArrivals([camp()], fixAt(90), { camp: true });
    expect(out).toEqual([
      { markerId: 'camp', markerTitle: 'Camp', arrived: false, departed: true },
    ]);
  });

  it('survives repeated boundary noise without flapping', () => {
    // Walk in, then jitter around the edge — exactly one arrival should occur.
    const state: Record<string, boolean> = {};
    const events: unknown[] = [];
    for (const metres of [10, 48, 52, 47, 53, 49, 51]) {
      const out = evaluateArrivals([camp()], fixAt(metres), state);
      out.forEach((t) => { state[t.markerId] = t.arrived; events.push(t); });
    }
    expect(events).toHaveLength(1);
    expect(state.camp).toBe(true);
  });
});

describe('multiple markers', () => {
  it('evaluates each independently', () => {
    const vehicle = camp({ id: 'truck', title: 'Truck', latitude: northOf(1000) });
    const out = evaluateArrivals([camp(), vehicle], fixAt(10), {});
    expect(out.map((t) => t.markerId)).toEqual(['camp']);
  });

  it('can arrive at one while already inside another', () => {
    // A camp pin can sit inside a wider "parking" marker; arriving at the inner
    // one must still notify.
    const wide = camp({ id: 'lot', title: 'Lot', arrival_radius_m: 400 });
    const out = evaluateArrivals([camp(), wide], fixAt(15), { lot: true });
    expect(out.map((t) => t.markerId)).toEqual(['camp']);
  });
});

describe('arrivalThresholdFor — the rule both marker and journey arrival obey', () => {
  it('refuses to decide when the fix is too coarse for the ring', () => {
    expect(arrivalThresholdFor(50, 200)).toBeNull();
    expect(arrivalThresholdFor(50, Number.NaN)).toBeNull();
  });

  it('scales the usable-accuracy cap with the ring, not a fixed number', () => {
    // A 100m journey destination can tolerate a coarser fix than a 15m pin.
    // A fixed 60m cap would have thrown away fixes that comfortably resolve a
    // 100m ring while still accepting ones far too vague for a tight pin.
    expect(arrivalThresholdFor(100, 80)).not.toBeNull();
    expect(arrivalThresholdFor(15, 80)).toBeNull();
  });

  it('shrinks the ring by the fix uncertainty', () => {
    expect(arrivalThresholdFor(100, 30)).toBe(70);
  });

  it('keeps arrival reachable via a floor', () => {
    // Without the floor a mediocre fix would make arrival mathematically
    // impossible and the journey would never complete.
    expect(arrivalThresholdFor(50, 55)).toBeGreaterThan(0);
  });

  it('rejects a nonsensical ring', () => {
    expect(arrivalThresholdFor(0, 5)).toBeNull();
    expect(arrivalThresholdFor(Number.NaN, 5)).toBeNull();
  });
});

describe('journey arrival', () => {
  // The journey destination check in useLocationTracker was a bare
  // `dist <= 100` with no accuracy gate, so a ±500m fix could send "arrived
  // safely" to the people watching while the traveller was nowhere near.
  it('does not claim arrival on a fix too vague to support it', () => {
    expect(arrivalThresholdFor(JOURNEY_ARRIVAL_RADIUS_M, 500)).toBeNull();
  });

  it('still completes a journey on a normal fix', () => {
    const within = arrivalThresholdFor(JOURNEY_ARRIVAL_RADIUS_M, 10);
    expect(within).not.toBeNull();
    expect(40).toBeLessThanOrEqual(within as number);
  });

  it('will not fire at the old 100m boundary when the fix is mediocre', () => {
    // Previously 95m out with a ±50m fix counted as arrived. True position
    // could have been 145m away.
    const within = arrivalThresholdFor(JOURNEY_ARRIVAL_RADIUS_M, 50) as number;
    expect(95).toBeGreaterThan(within);
  });
});
