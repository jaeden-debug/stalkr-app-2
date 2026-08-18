/**
 * RevenueCat SDK key selection.
 *
 * Two failures this pins, both of which actually happened:
 *   1. The Android key was never read at all — configureRevenueCat took the iOS
 *      key unconditionally, so no Android user could purchase anything.
 *   2. The Android value in .env was the literal placeholder `your-...`, which
 *      was very nearly promoted into the build environment. A placeholder is
 *      worse than a missing key: it passes a truthiness check, so the SDK
 *      configures with a bogus key and fails later, at purchase time.
 */

/** Mirrors the prefix rule in services/revenuecat.ts. */
const isRevenueCatKey = (k: string | undefined) => !!k && /^(appl|goog|amzn)_/.test(k);

describe('RevenueCat key validation', () => {
  it('accepts a real App Store key', () => {
    expect(isRevenueCatKey('appl_MUxKMQWcvihgJjqSBxpwSoVKkOC')).toBe(true);
  });

  it('accepts a real Play Store key', () => {
    expect(isRevenueCatKey('goog_aBcDeFgHiJkLmNoPqRsTuVwXyZ')).toBe(true);
  });

  it('rejects the placeholder that was nearly shipped', () => {
    expect(isRevenueCatKey('your-android-key-here')).toBe(false);
  });

  it('rejects an empty or missing key', () => {
    expect(isRevenueCatKey('')).toBe(false);
    expect(isRevenueCatKey(undefined)).toBe(false);
  });

  it('rejects a key from the wrong service', () => {
    // A Stripe or Supabase key pasted into the wrong variable would otherwise
    // sail through a bare truthiness check.
    expect(isRevenueCatKey('pk_live_51Rrv5HEBL7kaqsc5')).toBe(false);
    expect(isRevenueCatKey('sb_secret_abc123')).toBe(false);
  });

  it('does not accept a key that merely contains the prefix', () => {
    // Must be a prefix, not a substring, or "not-appl_x" would pass.
    expect(isRevenueCatKey('not-appl_x')).toBe(false);
  });
});
