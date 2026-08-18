/**
 * Collection lifecycle and crew isolation.
 *
 * The audit's central invariant: mutating one map entity must not disturb an
 * unrelated one. In a React Native map, "disturb" means losing OBJECT IDENTITY —
 * a marker whose record is replaced by an equivalent-but-new object re-renders,
 * re-rasterises, and (before the snapshot fix) could blank out. So these tests
 * assert identity with `toBe`, not deep equality.
 */
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import type { Marker, SavedPlace, MapCrewMember } from '@/types/models';

jest.mock('@/services/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn() } }));
jest.mock('@/services/markers', () => ({
  fetchGroupMarkers: jest.fn(async () => []),
  createMarker: jest.fn(async () => null),
  deleteMarker: jest.fn(async () => true),
  updateMarker: jest.fn(async () => true),
  normalizeMarker: (r: any) => r,
  isMarkerVisibleToGroup: () => true,
}));
jest.mock('@/services/savedPlaces', () => ({
  fetchGroupSavedPlaces: jest.fn(async () => []),
  createSavedPlace: jest.fn(async () => null),
  updateSavedPlace: jest.fn(async () => true),
  normalizeSavedPlace: (r: any) => r,
  upsertPresence: jest.fn(),
}));
jest.mock('@/services/groupEvents', () => ({ logEvent: jest.fn(async () => {}) }));

const marker = (id: string): Marker =>
  ({ id, group_id: 'g1', type: 'waypoint', title: id, latitude: 1, longitude: 1 }) as Marker;
const zone = (id: string): SavedPlace =>
  ({ id, group_id: 'g1', name: id, shape_type: 'circle', latitude: 1, longitude: 1, radius_meters: 50 }) as SavedPlace;
const crew = (id: string): MapCrewMember => ({ user_id: id, group_id: 'g1', latitude: 1, longitude: 1 }) as MapCrewMember;

beforeEach(() => {
  useMapStore.setState({
    markers: [],
    savedPlaces: [],
    crewLocations: {},
    populationGroupId: null,
    selectedFieldMarkerId: null,
    selectedSavedPlaceId: null,
  });
  useGroupStore.setState({ activeGroupId: 'g1' } as never);
});

describe('marker collection', () => {
  it('adding one preserves every other marker BY IDENTITY', () => {
    const [a, b] = [marker('a'), marker('b')];
    useMapStore.setState({ markers: [a, b] });

    useMapStore.getState().upsertMarkerInStore(marker('c'));

    const after = useMapStore.getState().markers;
    expect(after).toHaveLength(3);
    expect(after.find((m) => m.id === 'a')).toBe(a);
    expect(after.find((m) => m.id === 'b')).toBe(b);
  });

  it('deleting one removes exactly one and leaves the rest untouched', () => {
    const [a, b, c] = [marker('a'), marker('b'), marker('c')];
    useMapStore.setState({ markers: [a, b, c] });

    useMapStore.getState().removeMarkerFromStore('b');

    const after = useMapStore.getState().markers;
    expect(after.map((m) => m.id)).toEqual(['a', 'c']);
    expect(after[0]).toBe(a);
    expect(after[1]).toBe(c);
  });

  it('updating one affects exactly one record', () => {
    const [a, b] = [marker('a'), marker('b')];
    useMapStore.setState({ markers: [a, b] });

    useMapStore.getState().updateMarkerInStore('a', { latitude: 9 });

    const after = useMapStore.getState().markers;
    expect(after.find((m) => m.id === 'a')!.latitude).toBe(9);
    expect(after.find((m) => m.id === 'b')).toBe(b); // untouched neighbour
  });

  it('a realtime echo of an existing marker does not duplicate it', () => {
    useMapStore.setState({ markers: [marker('a')] });
    useMapStore.getState().upsertMarkerInStore(marker('a'));
    expect(useMapStore.getState().markers).toHaveLength(1);
  });

  it('selection does not mutate the marker collection', () => {
    const markers = [marker('a'), marker('b')];
    useMapStore.setState({ markers });

    useMapStore.getState().setSelectedFieldMarkerId('a');

    expect(useMapStore.getState().markers).toBe(markers);
  });
});

describe('zone collection', () => {
  it('adding a zone preserves existing zones by identity', () => {
    const [a, b] = [zone('a'), zone('b')];
    useMapStore.setState({ savedPlaces: [a, b] });

    useMapStore.getState().upsertSavedPlaceInStore(zone('c'));

    const after = useMapStore.getState().savedPlaces;
    expect(after).toHaveLength(3);
    expect(after.find((p) => p.id === 'a')).toBe(a);
  });

  it('deleting one removes only that zone', () => {
    const [a, b] = [zone('a'), zone('b')];
    useMapStore.setState({ savedPlaces: [a, b] });

    useMapStore.getState().removeSavedPlaceFromStore('a');

    expect(useMapStore.getState().savedPlaces).toEqual([b]);
  });

  it('editing one zone leaves unrelated zones identical', () => {
    const [a, b] = [zone('a'), zone('b')];
    useMapStore.setState({ savedPlaces: [a, b] });

    useMapStore.getState().updateSavedPlaceInStore('a', { name: 'renamed' });

    const after = useMapStore.getState().savedPlaces;
    expect(after.find((p) => p.id === 'a')!.name).toBe('renamed');
    expect(after.find((p) => p.id === 'b')).toBe(b);
  });
});

describe('cross-collection isolation', () => {
  it('mutating markers does not touch zones or crew', () => {
    const zones = [zone('z')];
    const crewLocations = { u1: crew('u1') };
    useMapStore.setState({ markers: [marker('a')], savedPlaces: zones, crewLocations });

    useMapStore.getState().upsertMarkerInStore(marker('b'));
    useMapStore.getState().removeMarkerFromStore('a');

    expect(useMapStore.getState().savedPlaces).toBe(zones);
    expect(useMapStore.getState().crewLocations).toBe(crewLocations);
  });

  it('mutating zones does not touch markers or crew', () => {
    const markers = [marker('a')];
    const crewLocations = { u1: crew('u1') };
    useMapStore.setState({ markers, savedPlaces: [zone('z')], crewLocations });

    useMapStore.getState().upsertSavedPlaceInStore(zone('z2'));

    expect(useMapStore.getState().markers).toBe(markers);
    expect(useMapStore.getState().crewLocations).toBe(crewLocations);
  });

  it('a crew position update does not touch markers or zones', () => {
    const markers = [marker('a')];
    const zones = [zone('z')];
    useMapStore.setState({ markers, savedPlaces: zones, crewLocations: {} });

    useMapStore.getState().setCrewLocation('u1', crew('u1'));

    expect(useMapStore.getState().markers).toBe(markers);
    expect(useMapStore.getState().savedPlaces).toBe(zones);
  });
});

describe('crew population lifecycle', () => {
  it('commitPopulation installs everything in one write', () => {
    useMapStore.getState().commitPopulation('g1', {
      markers: [marker('a')],
      savedPlaces: [zone('z')],
      crewLocations: { u1: crew('u1') },
    });

    const s = useMapStore.getState();
    expect(s.markers).toHaveLength(1);
    expect(s.savedPlaces).toHaveLength(1);
    expect(s.populationGroupId).toBe('g1');
  });

  it('discards a late response for a crew the user already left', () => {
    // The isolation boundary: a slow fetch for crew A must never render after
    // the user has switched to crew B.
    useGroupStore.setState({ activeGroupId: 'g2' } as never);

    useMapStore.getState().commitPopulation('g1', {
      markers: [marker('stale')],
      savedPlaces: [],
      crewLocations: {},
    });

    expect(useMapStore.getState().markers).toEqual([]);
    expect(useMapStore.getState().populationGroupId).toBeNull();
  });

  it('suspendPopulation clears everything and drops the trusted crew', () => {
    useMapStore.setState({
      markers: [marker('a')],
      savedPlaces: [zone('z')],
      crewLocations: { u1: crew('u1') },
      populationGroupId: 'g1',
    });

    useMapStore.getState().suspendPopulation();

    const s = useMapStore.getState();
    expect(s.markers).toEqual([]);
    expect(s.savedPlaces).toEqual([]);
    expect(s.crewLocations).toEqual({});
    expect(s.populationGroupId).toBeNull();
  });

  it('a same-crew refetch never needs to clear first', () => {
    // This is the wipe-before-load regression. useRealtimeGroup only calls
    // suspendPopulation when populationGroupId !== the crew being loaded, so a
    // resubscribe for the SAME crew must find them already equal.
    useMapStore.getState().commitPopulation('g1', {
      markers: [marker('a'), marker('b')],
      savedPlaces: [],
      crewLocations: {},
    });

    expect(useMapStore.getState().populationGroupId).toBe('g1');

    const before = useMapStore.getState().markers;
    useMapStore.getState().commitPopulation('g1', {
      markers: [marker('a'), marker('b'), marker('c')],
      savedPlaces: [],
      crewLocations: {},
    });

    // Never passed through an empty state.
    expect(before).toHaveLength(2);
    expect(useMapStore.getState().markers).toHaveLength(3);
  });
});

describe('draft point identity', () => {
  it('gives every polygon vertex a stable unique id', () => {
    // Array-index keys were reused across undo/redo, so React handed a stale
    // native view to a different point.
    useMapStore.setState({ polygonDraftPoints: [] });
    const add = useMapStore.getState().addPolygonPoint;
    add({ latitude: 1, longitude: 1 });
    add({ latitude: 2, longitude: 2 });
    add({ latitude: 3, longitude: 3 });

    const ids = useMapStore.getState().polygonDraftPoints.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('does not reuse an id after undo', () => {
    useMapStore.setState({ polygonDraftPoints: [] });
    const { addPolygonPoint, removeLastPolygonPoint } = useMapStore.getState();
    addPolygonPoint({ latitude: 1, longitude: 1 });
    const firstId = useMapStore.getState().polygonDraftPoints[0].id;

    removeLastPolygonPoint();
    addPolygonPoint({ latitude: 2, longitude: 2 });

    expect(useMapStore.getState().polygonDraftPoints[0].id).not.toBe(firstId);
  });
});
