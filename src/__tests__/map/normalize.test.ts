/**
 * Ingress validation.
 *
 * Before this layer existed, a malformed row was dropped at RENDER time by
 * `Number.isFinite` guards inside the marker components — the entity simply was
 * not there, with no diagnostic anywhere. These tests pin the rejection to
 * ingress instead.
 */
import {
  isValidLatitude,
  isValidLongitude,
  toArray,
  toFiniteNumber,
} from '@/services/normalize';
import { isMarkerVisibleToGroup, normalizeMarker } from '@/services/markers';
import { normalizeSavedPlace } from '@/services/savedPlaces';

jest.mock('@/services/supabase', () => ({ supabase: { from: jest.fn() } }));

const validMarker = {
  id: 'm1',
  group_id: 'g1',
  type: 'waypoint',
  title: 'Camp',
  latitude: 51.5,
  longitude: -0.12,
};

describe('primitive coercion', () => {
  it('accepts numerics delivered as strings', () => {
    // Realtime does not always match PostgREST's JSON shape.
    expect(toFiniteNumber('51.5')).toBe(51.5);
    expect(toFiniteNumber(51.5)).toBe(51.5);
  });

  it('rejects unusable values rather than producing NaN', () => {
    for (const bad of ['', '  ', 'abc', null, undefined, {}, [], NaN, Infinity]) {
      expect(toFiniteNumber(bad)).toBeNull();
    }
  });

  it('bounds-checks coordinates', () => {
    expect(isValidLatitude(51.5)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(null)).toBe(false);
    expect(isValidLongitude(-0.12)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
  });

  it('parses a jsonb column delivered as a JSON string', () => {
    expect(toArray('[{"latitude":1,"longitude":2}]')).toEqual([{ latitude: 1, longitude: 2 }]);
    expect(toArray('not json')).toEqual([]);
    expect(toArray(null)).toEqual([]);
  });
});

describe('normalizeMarker', () => {
  it('accepts a well-formed row', () => {
    expect(normalizeMarker(validMarker)).toMatchObject({ id: 'm1', latitude: 51.5, longitude: -0.12 });
  });

  it('coerces string coordinates', () => {
    const out = normalizeMarker({ ...validMarker, latitude: '51.5', longitude: '-0.12' });
    expect(out).toMatchObject({ latitude: 51.5, longitude: -0.12 });
  });

  it('rejects rows that would silently vanish at render', () => {
    expect(normalizeMarker({ ...validMarker, latitude: null })).toBeNull();
    expect(normalizeMarker({ ...validMarker, longitude: 'east' })).toBeNull();
    expect(normalizeMarker({ ...validMarker, latitude: 91 })).toBeNull();
    expect(normalizeMarker({ ...validMarker, id: undefined })).toBeNull();
    expect(normalizeMarker(null)).toBeNull();
  });
});

describe('marker visibility', () => {
  it('applies the same rule the initial fetch applies', () => {
    // The realtime path previously ignored visible_to_group entirely, so a
    // hidden marker appeared live and then disappeared on the next reload.
    expect(isMarkerVisibleToGroup({ visible_to_group: true })).toBe(true);
    expect(isMarkerVisibleToGroup({ visible_to_group: false })).toBe(false);
    // Absent means visible — matches the column's DEFAULT true.
    expect(isMarkerVisibleToGroup({})).toBe(true);
  });
});

describe('normalizeSavedPlace', () => {
  const circle = { id: 'z1', shape_type: 'circle', latitude: 51.5, longitude: -0.12, radius_meters: 100 };

  it('accepts a circle zone', () => {
    expect(normalizeSavedPlace(circle)).toMatchObject({ id: 'z1', radius_meters: 100 });
  });

  it('defaults a missing radius rather than rendering a zero-size circle', () => {
    expect(normalizeSavedPlace({ ...circle, radius_meters: null })?.radius_meters).toBe(100);
  });

  it('parses polygon_coords delivered as a JSON string', () => {
    const out = normalizeSavedPlace({
      id: 'z2',
      shape_type: 'polygon',
      latitude: 51.5,
      longitude: -0.12,
      polygon_coords: JSON.stringify([
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
        { latitude: 3, longitude: 3 },
      ]),
    });
    expect(out?.polygon_coords).toHaveLength(3);
  });

  it('drops individual malformed vertices', () => {
    const out = normalizeSavedPlace({
      id: 'z3',
      shape_type: 'polygon',
      latitude: 51.5,
      longitude: -0.12,
      polygon_coords: [
        { latitude: 1, longitude: 1 },
        { latitude: 'x', longitude: 2 },
        { latitude: 3, longitude: 3 },
        { latitude: 4, longitude: 4 },
      ],
    });
    expect(out?.polygon_coords).toHaveLength(3);
  });

  it('rejects a polygon that cannot form an area', () => {
    expect(
      normalizeSavedPlace({
        id: 'z4',
        shape_type: 'polygon',
        latitude: 51.5,
        longitude: -0.12,
        polygon_coords: [{ latitude: 1, longitude: 1 }],
      }),
    ).toBeNull();
  });

  it('rejects invalid centres', () => {
    expect(normalizeSavedPlace({ ...circle, latitude: 'north' })).toBeNull();
    expect(normalizeSavedPlace({ ...circle, id: null })).toBeNull();
  });
});
