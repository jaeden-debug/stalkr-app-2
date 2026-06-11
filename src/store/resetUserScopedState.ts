/**
 * resetUserScopedState — wipe every per-user store when the signed-in account
 * changes, so one account NEVER sees another's crews, zones, markers, sessions,
 * or inherits its plan/admin status. Clears in-memory state AND the persisted
 * AsyncStorage copies. Lazy `require`s avoid circular imports with useAuthStore.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function resetUserScopedState(): Promise<void> {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { useGroupStore } = require('./useGroupStore');
  const { useMapStore } = require('./useMapStore');
  const { useLocationStore } = require('./useLocationStore');
  const { useSessionStore } = require('./useSessionStore');
  const { useBillingStore } = require('./useBillingStore');
  const { useCrewPrefsStore } = require('./useCrewPrefsStore');
  const { useNotifCenterStore } = require('./useNotifCenterStore');
  /* eslint-enable @typescript-eslint/no-var-requires */

  useGroupStore.setState({ groups: [], activeGroupId: null, groupMembers: [], isLoading: false, error: null });
  useMapStore.setState({
    crewLocations: {}, myLocation: null, markers: [], savedPlaces: [], userTrails: {},
    selectedMapUser: null, selectedMarkerId: null, selectedFieldMarkerId: null, selectedSavedPlaceId: null,
  });
  useLocationStore.setState({
    isBroadcasting: false, groupBroadcastingStatus: {}, lastBroadcastAt: null, batteryLevel: null, crewLocations: {},
  });
  useSessionStore.setState({ sessions: [], activeSession: null, activeJourneySession: null });
  // Reset to free/non-admin; loadEntitlement() re-derives the correct values for
  // the new account immediately after this runs.
  useBillingStore.setState({ plan: 'free', isAdmin: false, entitlement: null, lastFetchedAt: null });
  useCrewPrefsStore.setState({ crew: {}, member: {} });
  useNotifCenterStore.setState({ readIds: {}, dismissedIds: {}, unseenCount: 0 });

  // Drop persisted copies so a later rehydrate can't resurrect another account's data.
  await AsyncStorage.multiRemove([
    'group-store', 'location-store', 'session-store', 'billing-store', 'crew-prefs', 'notif-center', 'notification-prefs',
  ]).catch(() => {});
}
