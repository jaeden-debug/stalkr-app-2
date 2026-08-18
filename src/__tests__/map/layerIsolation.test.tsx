/**
 * Cross-layer isolation — the single most important regression guard.
 *
 * Every bug in the map audit was a violation of one property:
 *
 *     mutating one map concern must not re-render an unrelated map concern.
 *
 * These tests use React.Profiler to count COMMITS of each layer's subtree,
 * because "it still rendered" assertions pass happily while the underlying
 * defect (needless re-render → re-rasterisation → blank native marker) is fully
 * present. Render counts are the thing that actually regressed.
 */
import React, { Profiler } from 'react';
import { act, render } from '@testing-library/react-native';
import { MarkerLayer } from '@/components/map/MarkerLayer';
import { ZoneLayer } from '@/components/map/ZoneLayer';
import { useMapStore } from '@/store/useMapStore';
import { useSelfPoseStore } from '@/store/useSelfPoseStore';
import { useGroupStore } from '@/store/useGroupStore';
import type { Marker as MarkerModel, SavedPlace } from '@/types/models';

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

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (name: string) => {
    const C = (props: any) => React.createElement(View, props, props.children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('MapView'),
    Marker: stub('Marker'),
    Circle: stub('Circle'),
    Polygon: stub('Polygon'),
    Polyline: stub('Polyline'),
    PROVIDER_GOOGLE: 'google',
  };
});

const marker = (id: string): MarkerModel =>
  ({ id, group_id: 'g1', type: 'waypoint', title: id, latitude: 1, longitude: 1 }) as MarkerModel;
const zone = (id: string): SavedPlace =>
  ({ id, group_id: 'g1', name: id, type: 'custom', shape_type: 'circle', latitude: 1, longitude: 1, radius_meters: 50 }) as SavedPlace;

function renderLayers() {
  const markerCommits = jest.fn();
  const zoneCommits = jest.fn();
  const utils = render(
    <>
      <Profiler id="markers" onRender={markerCommits}>
        <MarkerLayer />
      </Profiler>
      <Profiler id="zones" onRender={zoneCommits}>
        <ZoneLayer />
      </Profiler>
    </>,
  );
  // Ignore mount commits — we only care about what subsequent mutations cost.
  markerCommits.mockClear();
  zoneCommits.mockClear();
  return { ...utils, markerCommits, zoneCommits };
}

beforeEach(() => {
  useGroupStore.setState({ activeGroupId: 'g1' } as never);
  useMapStore.setState({
    markers: [marker('a'), marker('b')],
    savedPlaces: [zone('z1'), zone('z2')],
    crewLocations: {},
    hiddenMarkerTypes: [],
    showZones: true,
    selectedFieldMarkerId: null,
    selectedSavedPlaceId: null,
    populationGroupId: 'g1',
  });
  useSelfPoseStore.setState({ heading: null, headingAccuracy: null });
});

describe('compass activity is invisible to the collection layers', () => {
  it('a heading update re-renders NEITHER MarkerLayer NOR ZoneLayer', () => {
    // This is the defect that made turning the phone a map-wide render event:
    // heading used to be written into useMapStore, which both layers subscribe
    // to. It now lives in useSelfPoseStore.
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useSelfPoseStore.getState().setHeading(90);
      useSelfPoseStore.getState().setHeading(180);
      useSelfPoseStore.getState().setHeading(271.5);
    });

    expect(markerCommits).not.toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });

  it('a self POSITION update also leaves both layers alone', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().setMyLocation({
        latitude: 51.5, longitude: -0.12, heading: 0, accuracy: 8, speed: 1,
      });
    });

    // myLocation still lives in useMapStore, so this only holds because the
    // layers select stable references rather than allocating arrays per call.
    expect(markerCommits).not.toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });
});

describe('marker mutations do not disturb zones', () => {
  it('adding a marker leaves ZoneLayer untouched', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().upsertMarkerInStore(marker('c'));
    });

    expect(markerCommits).toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });

  it('deleting a marker leaves ZoneLayer untouched', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().removeMarkerFromStore('a');
    });

    expect(markerCommits).toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });
});

describe('zone mutations do not disturb markers', () => {
  it('adding a zone leaves MarkerLayer untouched', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().upsertSavedPlaceInStore(zone('z3'));
    });

    expect(zoneCommits).toHaveBeenCalled();
    expect(markerCommits).not.toHaveBeenCalled();
  });

  it('editing one zone leaves MarkerLayer untouched', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().updateSavedPlaceInStore('z1', { name: 'renamed' });
    });

    expect(markerCommits).not.toHaveBeenCalled();
  });
});

describe('crew and trail activity do not disturb markers or zones', () => {
  it('a crew position update touches neither layer', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().setCrewLocation('u1', {
        user_id: 'u1', group_id: 'g1', latitude: 1, longitude: 1, heading: 12,
      } as never);
    });

    expect(markerCommits).not.toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });

  it('a trail update touches neither layer', () => {
    const { markerCommits, zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().setUserTrail('u1', [{ latitude: 1, longitude: 1 }]);
    });

    expect(markerCommits).not.toHaveBeenCalled();
    expect(zoneCommits).not.toHaveBeenCalled();
  });
});

describe('selection is scoped', () => {
  it('selecting a zone does not re-render MarkerLayer', () => {
    const { markerCommits } = renderLayers();

    act(() => {
      useMapStore.getState().setSelectedSavedPlaceId('z1');
    });

    expect(markerCommits).not.toHaveBeenCalled();
  });

  it('selecting a marker does not re-render ZoneLayer', () => {
    const { zoneCommits } = renderLayers();

    act(() => {
      useMapStore.getState().setSelectedFieldMarkerId('a');
    });

    expect(zoneCommits).not.toHaveBeenCalled();
  });
});
