/**
 * Self-marker lifecycle.
 *
 * The puck must survive everything: position updates, heading updates, other
 * entities being created and destroyed, and its own drawer opening and closing.
 * Selection is additive — it may only ADD a sibling node.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SelfMarker } from '@/components/map/SelfMarker';
import { useMapStore } from '@/store/useMapStore';
import { useSelfPoseStore } from '@/store/useSelfPoseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useGroupStore } from '@/store/useGroupStore';
import { SELF_PUCK_IMAGE } from '@/constants/mapMarkerImages';
import type { Marker as MarkerModel } from '@/types/models';

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

const setPosition = (accuracy = 10) =>
  useMapStore.getState().setMyLocation({
    latitude: 51.5, longitude: -0.12, heading: 0, accuracy, speed: 0,
  });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'me' }, profile: { initials: 'JD' } } as never);
  useGroupStore.setState({ activeGroupId: 'g1' } as never);
  // Broadcasting is now OPT-IN per crew — an empty map means dark. The fixture
  // opts g1 in explicitly so these tests exercise the live puck.
  useLocationStore.setState({
    isBroadcasting: true,
    groupBroadcastingStatus: { g1: true },
  } as never);
  useMapStore.setState({
    myLocation: null,
    markers: [],
    savedPlaces: [],
    crewLocations: {},
    selectedMapUser: null,
  });
  useSelfPoseStore.setState({ heading: null, headingAccuracy: null });
});

describe('puck stability', () => {
  it('renders nothing before a fix, then exactly one puck', () => {
    render(<SelfMarker />);
    expect(screen.queryByTestId('self-puck')).toBeNull();

    act(() => setPosition());

    expect(screen.getAllByTestId('self-puck')).toHaveLength(1);
  });

  it('stays mounted as the same instance across position updates', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    const first = screen.getByTestId('self-puck');

    act(() => {
      useMapStore.getState().setMyLocation({
        latitude: 51.51, longitude: -0.13, heading: 0, accuracy: 10, speed: 2,
      });
    });

    // Same node identity => the native marker was updated, never recreated.
    expect(screen.getByTestId('self-puck')).toBe(first);
  });

  it('updates rotation on heading change without remounting', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    const before = screen.getByTestId('self-puck');

    act(() => useSelfPoseStore.getState().setHeading(137));

    const after = screen.getByTestId('self-puck');
    expect(after).toBe(before);
    expect(after.props.rotation).toBe(137);
    expect(after.props.flat).toBe(true);
  });

  it('survives marker and zone mutations', () => {
    render(<SelfMarker />);
    act(() => setPosition());

    act(() => {
      useMapStore.getState().upsertMarkerInStore(marker('a'));
      useMapStore.getState().upsertMarkerInStore(marker('b'));
      useMapStore.getState().removeMarkerFromStore('a');
      useMapStore.getState().setSelectedFieldMarkerId('b');
    });

    expect(screen.getAllByTestId('self-puck')).toHaveLength(1);
  });
});

describe('heading honesty', () => {
  it('uses the arrowless puck and 0 rotation when heading is unknown', () => {
    // A directional puck at 0 degrees would assert the user is facing north.
    render(<SelfMarker />);
    act(() => setPosition());

    const puck = screen.getByTestId('self-puck');
    expect(puck.props.image).toBe(SELF_PUCK_IMAGE.noHeading);
    expect(puck.props.rotation).toBe(0);
  });

  it('switches to the directional puck once a heading arrives', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useSelfPoseStore.getState().setHeading(42));

    expect(screen.getByTestId('self-puck').props.image).toBe(SELF_PUCK_IMAGE.live);
  });

  it('renders the DARK puck when the crew has never been opted into', () => {
    // Default-dark posture: no entry for this crew means not sharing.
    useLocationStore.setState({ isBroadcasting: true, groupBroadcastingStatus: {} } as never);
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useSelfPoseStore.getState().setHeading(42));

    expect(screen.getByTestId('self-puck').props.image).toBe(SELF_PUCK_IMAGE.dark);
  });

  it('shows the dark, non-directional puck when the crew is dark', () => {
    useLocationStore.setState({
      isBroadcasting: false, groupBroadcastingStatus: { g1: false },
    } as never);
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useSelfPoseStore.getState().setHeading(42));

    const puck = screen.getByTestId('self-puck');
    expect(puck.props.image).toBe(SELF_PUCK_IMAGE.dark);
    expect(puck.props.rotation).toBe(0);
  });
});

describe('accuracy halo', () => {
  it('draws at the reported radius, quantised', () => {
    render(<SelfMarker />);
    act(() => setPosition(23));
    expect(screen.getByTestId('self-accuracy').props.radius).toBe(25);
  });

  it('follows the puck coordinate', () => {
    render(<SelfMarker />);
    act(() => setPosition(20));
    expect(screen.getByTestId('self-accuracy').props.center).toEqual(
      screen.getByTestId('self-puck').props.coordinate,
    );
  });

  it('is omitted when accuracy is unusable rather than faking precision', () => {
    render(<SelfMarker />);
    act(() => setPosition(2)); // finer than the puck itself
    expect(screen.queryByTestId('self-accuracy')).toBeNull();

    act(() => setPosition(5000)); // too poor to depict honestly
    expect(screen.queryByTestId('self-accuracy')).toBeNull();
  });
});

describe('self selection is additive', () => {
  it('adds exactly one avatar pin and keeps the puck', () => {
    render(<SelfMarker />);
    act(() => setPosition());

    act(() => useMapStore.getState().setSelectedMapUser({ userId: 'me', type: 'self' }));

    expect(screen.getAllByTestId('self-selection-pin')).toHaveLength(1);
    expect(screen.getAllByTestId('self-puck')).toHaveLength(1);
  });

  it('anchors the pin to the same coordinate as the puck', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useMapStore.getState().setSelectedMapUser({ userId: 'me', type: 'self' }));

    expect(screen.getByTestId('self-selection-pin').props.coordinate).toEqual(
      screen.getByTestId('self-puck').props.coordinate,
    );
  });

  it('cannot be duplicated by repeated taps', () => {
    render(<SelfMarker />);
    act(() => setPosition());

    act(() => {
      for (let i = 0; i < 20; i++) {
        useMapStore.getState().setSelectedMapUser({ userId: 'me', type: 'self' });
      }
    });

    expect(screen.getAllByTestId('self-selection-pin')).toHaveLength(1);
  });

  it('removes only the pin on deselect, never the puck', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useMapStore.getState().setSelectedMapUser({ userId: 'me', type: 'self' }));
    const puck = screen.getByTestId('self-puck');

    act(() => useMapStore.getState().setSelectedMapUser(null));

    expect(screen.queryByTestId('self-selection-pin')).toBeNull();
    expect(screen.getByTestId('self-puck')).toBe(puck);
  });

  it('does not disturb the puck while selected and moving', () => {
    render(<SelfMarker />);
    act(() => setPosition());
    act(() => useMapStore.getState().setSelectedMapUser({ userId: 'me', type: 'self' }));

    act(() => {
      useSelfPoseStore.getState().setHeading(200);
      useMapStore.getState().setMyLocation({
        latitude: 51.52, longitude: -0.14, heading: 0, accuracy: 12, speed: 3,
      });
    });

    expect(screen.getAllByTestId('self-puck')).toHaveLength(1);
    expect(screen.getAllByTestId('self-selection-pin')).toHaveLength(1);
    expect(screen.getByTestId('self-puck').props.rotation).toBe(200);
  });

  it('selecting a CREW member does not show the self avatar pin', () => {
    render(<SelfMarker />);
    act(() => setPosition());

    act(() => useMapStore.getState().setSelectedMapUser({ userId: 'other', type: 'crew' }));

    expect(screen.queryByTestId('self-selection-pin')).toBeNull();
    expect(screen.getAllByTestId('self-puck')).toHaveLength(1);
  });
});
