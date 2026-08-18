/**
 * Trail sampling.
 *
 * The property under test: real movement survives, GPS noise does not, and the
 * line never claims a path the user did not take.
 */
import {
  TRAIL_POLICY,
  decideTrailPoint,
  haversineMeters,
  segmentTrail,
  type TrailAnchor,
} from '@/utils/trailPolicy';

const T0 = 1_700_000_000_000;

/** Offset metres north of a base latitude (≈111.32 km per degree). */
const north = (lat: number, metres: number) => lat + metres / 111_320;

const anchor = (over: Partial<TrailAnchor> = {}): TrailAnchor => ({
  latitude: 45, longitude: -75, heading: 0, timestamp: T0, ...over,
});

const fix = (over: Partial<Parameters<typeof decideTrailPoint>[1]> = {}) => ({
  latitude: 45, longitude: -75, accuracy: 10, speed: 1.4, heading: 0,
  timestamp: T0 + 10_000, ...over,
});

describe('rejection', () => {
  it('rejects fixes too imprecise to draw a path from', () => {
    const d = decideTrailPoint(anchor(), fix({ accuracy: TRAIL_POLICY.MAX_ACCURACY_M + 1 }));
    expect(d).toEqual({ record: false, reason: 'poor_accuracy' });
  });

  it('rejects an out-of-order fix', () => {
    // A queued offline write or a retry can deliver a fix older than the anchor.
    const d = decideTrailPoint(anchor({ timestamp: T0 + 60_000 }), fix({ timestamp: T0 }));
    expect(d).toEqual({ record: false, reason: 'out_of_order' });
  });

  it('rejects an impossible jump', () => {
    // 10 km in 10 s is a GPS glitch, not travel.
    const d = decideTrailPoint(anchor(), fix({ latitude: north(45, 10_000) }));
    expect(d).toEqual({ record: false, reason: 'implausible_jump' });
  });

  it('rejects a burst of fixes arriving too close together', () => {
    const d = decideTrailPoint(anchor(), fix({ timestamp: T0 + 1_000, latitude: north(45, 30) }));
    expect(d).toEqual({ record: false, reason: 'too_soon' });
  });

  it('does not scribble while standing still', () => {
    // The core anti-noise property: a stationary phone wandering a few metres
    // must not produce a path.
    let a = anchor();
    for (let i = 1; i <= 20; i++) {
      const drift = (i % 2 === 0 ? 3 : -3);
      const d = decideTrailPoint(a, fix({
        latitude: north(45, drift), speed: 0.1, timestamp: T0 + i * 10_000,
      }));
      expect(d.record).toBe(false);
    }
    expect(a).toBeDefined();
  });
});

describe('recording real movement', () => {
  it('always records the first point and starts a segment', () => {
    const d = decideTrailPoint(null, fix());
    expect(d).toMatchObject({ record: true, startsNewSegment: true, reason: 'first' });
  });

  it('records once a walker has covered the adaptive distance', () => {
    // Walking ~1.4 m/s → gate ≈ 11 m, so 15 m qualifies.
    const d = decideTrailPoint(anchor(), fix({ latitude: north(45, 15), speed: 1.4 }));
    expect(d).toMatchObject({ record: true, reason: 'distance' });
  });

  it('does not flood while driving', () => {
    // 20 m/s → gate = 60 m (capped), so 30 m is not yet worth a point.
    const d = decideTrailPoint(anchor(), fix({ latitude: north(45, 30), speed: 20 }));
    expect(d.record).toBe(false);

    const far = decideTrailPoint(anchor(), fix({ latitude: north(45, 80), speed: 20 }));
    expect(far).toMatchObject({ record: true, reason: 'distance' });
  });

  it('preserves a corner even below the distance gate', () => {
    // The old policy erased turns: it only wrote every 90 s, which at walking
    // pace is ~126 m apart, so a winding path rendered as a straight line.
    const d = decideTrailPoint(
      anchor({ heading: 0 }),
      fix({ latitude: north(45, 7), heading: 90, speed: 1.4 }),
    );
    expect(d).toMatchObject({ record: true, reason: 'turn' });
  });

  it('ignores a heading change with no real movement', () => {
    // Turning on the spot is not a path.
    const d = decideTrailPoint(anchor({ heading: 0 }), fix({ latitude: 45, heading: 180, speed: 0 }));
    expect(d.record).toBe(false);
  });

  it('keeps the line alive with a heartbeat while moving slowly', () => {
    const d = decideTrailPoint(
      anchor(),
      fix({ latitude: north(45, 8), speed: 1.0, heading: 0, timestamp: T0 + TRAIL_POLICY.HEARTBEAT_MS }),
    );
    expect(d).toMatchObject({ record: true, reason: 'heartbeat' });
  });
});

describe('segment breaks', () => {
  it('starts a new segment after a long gap instead of drawing across it', () => {
    // Going dark for an hour then reappearing 5 km away must not claim the user
    // walked a straight line between the two.
    const d = decideTrailPoint(
      anchor(),
      fix({ latitude: north(45, 5_000), timestamp: T0 + 60 * 60_000 }),
    );
    expect(d).toMatchObject({ record: true, startsNewSegment: true, reason: 'segment_gap' });
  });

  it('checks the gap before the jump filter, so a real gap is not discarded', () => {
    // Distance/elapsed here is under the speed cap only because the gap is long;
    // the ordering of the two checks is what makes this record rather than be
    // rejected as implausible.
    const d = decideTrailPoint(
      anchor(),
      fix({ latitude: north(45, 100_000), timestamp: T0 + TRAIL_POLICY.SEGMENT_GAP_MS }),
    );
    expect(d.record).toBe(true);
  });

  it('splits a point list at long gaps', () => {
    const pts = [
      { timestamp: T0 },
      { timestamp: T0 + 30_000 },
      { timestamp: T0 + 60_000 },
      { timestamp: T0 + 60_000 + TRAIL_POLICY.SEGMENT_GAP_MS },
      { timestamp: T0 + 90_000 + TRAIL_POLICY.SEGMENT_GAP_MS },
    ];
    const segments = segmentTrail(pts);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(3);
    expect(segments[1]).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(segmentTrail([])).toEqual([]);
  });
});

describe('a realistic walk keeps its shape', () => {
  it('records enough points to preserve a right-angle route', () => {
    // 200 m north, turn east, 200 m east — at 1.4 m/s, sampled every 10 s.
    let current: TrailAnchor | null = null;
    const recorded: { lat: number; lng: number }[] = [];
    let t = T0;

    const step = (lat: number, lng: number, heading: number) => {
      t += 10_000;
      const d = decideTrailPoint(current, {
        latitude: lat, longitude: lng, accuracy: 8, speed: 1.4, heading, timestamp: t,
      });
      if (d.record) {
        current = { latitude: lat, longitude: lng, heading, timestamp: t };
        recorded.push({ lat, lng });
      }
    };

    for (let m = 0; m <= 200; m += 14) step(north(45, m), -75, 0);
    for (let m = 0; m <= 200; m += 14) step(north(45, 200), -75 + m / 78_800, 90);

    // The old gate would have produced ~3 points across 400 m. The corner must
    // be present, not cut.
    expect(recorded.length).toBeGreaterThan(15);

    const cornerIdx = recorded.findIndex((p) => p.lng > -75);
    expect(cornerIdx).toBeGreaterThan(0);
    // The point immediately before the turn must still be at the corner
    // latitude, i.e. the path went up and then across, not diagonally.
    expect(recorded[cornerIdx - 1].lat).toBeCloseTo(north(45, 200), 3);
  });

  it('total recorded distance tracks the real route, not a shortcut', () => {
    let current: TrailAnchor | null = null;
    const pts: { lat: number; lng: number }[] = [];
    let t = T0;
    for (let m = 0; m <= 300; m += 14) {
      t += 10_000;
      const d = decideTrailPoint(current, {
        latitude: north(45, m), longitude: -75, accuracy: 8, speed: 1.4, heading: 0, timestamp: t,
      });
      if (d.record) {
        current = { latitude: north(45, m), longitude: -75, heading: 0, timestamp: t };
        pts.push({ lat: north(45, m), lng: -75 });
      }
    }
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    // Within 10% of the 300 m actually walked.
    expect(total).toBeGreaterThan(270);
    expect(total).toBeLessThan(330);
  });
});
