/**
 * Heading maths — the compass is modular, and every bug in this area comes from
 * treating it as if it were not.
 */
import {
  createHeadingSmoother,
  normalizeDegrees,
  shortestAngleDelta,
} from '@/utils/heading';

describe('shortestAngleDelta', () => {
  it('crosses the 0/360 seam the short way', () => {
    // The invariant the whole self-marker rotation depends on: turning from
    // 358° to 2° is a 4° movement, not 356°.
    expect(shortestAngleDelta(358, 2)).toBe(4);
    expect(shortestAngleDelta(2, 358)).toBe(-4);
    expect(shortestAngleDelta(350, 10)).toBe(20);
  });

  it('is signed and bounded to (-180, 180]', () => {
    expect(shortestAngleDelta(0, 90)).toBe(90);
    expect(shortestAngleDelta(90, 0)).toBe(-90);
    expect(Math.abs(shortestAngleDelta(0, 180))).toBe(180);
    for (const [a, b] of [[0, 179], [10, 350], [200, 20], [359, 181]]) {
      expect(Math.abs(shortestAngleDelta(a, b))).toBeLessThanOrEqual(180);
    }
  });
});

describe('normalizeDegrees', () => {
  it('wraps negatives and overflow into [0, 360)', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(360)).toBe(0);
  });
});

describe('createHeadingSmoother', () => {
  it('adopts the first reading instead of easing up from zero', () => {
    // Easing from an implicit 0 would sweep the arrow across the dial on launch.
    const s = createHeadingSmoother();
    expect(s.push(270)).toBe(270);
  });

  it('suppresses sub-deadband jitter so a stationary phone holds still', () => {
    const s = createHeadingSmoother({ deadbandDeg: 1.5 });
    s.push(100);
    expect(s.push(100.8)).toBe(100);
    expect(s.push(99.4)).toBe(100);
  });

  it('snaps on a real turn so turning never feels laggy', () => {
    const s = createHeadingSmoother({ snapDeg: 25 });
    s.push(0);
    expect(s.push(90)).toBe(90);
  });

  it('eases intermediate movement toward the target', () => {
    const s = createHeadingSmoother({ alpha: 0.5, deadbandDeg: 1, snapDeg: 100 });
    s.push(0);
    expect(s.push(10)).toBeCloseTo(5, 5);
    expect(s.push(10)).toBeCloseTo(7.5, 5);
  });

  it('eases across the 0/360 seam without sweeping the long way', () => {
    // A naive linear average of 358 and 2 gives 180 — the arrow would swing
    // through south. It must stay near the seam.
    const s = createHeadingSmoother({ alpha: 0.5, deadbandDeg: 0.1, snapDeg: 100 });
    s.push(358);
    const next = s.push(2);
    expect(Math.abs(shortestAngleDelta(0, next!))).toBeLessThanOrEqual(2);
  });

  it('never emits a value outside [0, 360)', () => {
    const s = createHeadingSmoother({ alpha: 0.4, deadbandDeg: 0.1, snapDeg: 400 });
    for (const raw of [359, 1, 358, 3, 355, 10, -5, 400]) {
      const out = s.push(raw);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThan(360);
    }
  });

  it('ignores unusable readings and keeps the last good value', () => {
    const s = createHeadingSmoother();
    s.push(120);
    expect(s.push(null)).toBe(120);
    expect(s.push(undefined)).toBe(120);
    expect(s.push(NaN)).toBe(120);
  });

  it('returns null before any reading, so "unknown" is distinguishable from north', () => {
    // SelfMarker renders the arrowless puck on null. Coercing to 0 would assert
    // the user is facing north.
    const s = createHeadingSmoother();
    expect(s.value()).toBeNull();
    expect(s.push(null)).toBeNull();
  });

  it('forgets history on reset', () => {
    const s = createHeadingSmoother();
    s.push(200);
    s.reset();
    expect(s.value()).toBeNull();
    expect(s.push(10)).toBe(10);
  });
});
