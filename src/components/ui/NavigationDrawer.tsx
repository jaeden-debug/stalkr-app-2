/**
 * NavigationDrawer — Stalkr tactical bottom-sheet drawer.
 * Aesthetic: BlurView glass, ALL CAPS weight-900, Ionicons, #4ADE80 green.
 *
 * Layout (premium 3-zone, fixed height — renders instantly, no mount wait):
 *   ── Collapsed peek: crew name + live count + GO DARK / GO LIVE pill
 *   ── Expanded (slides 3/4 up, blurs everything behind it):
 *        TOP    → NEW CREW / NEW JOURNEY create buttons
 *        CENTER → GO DARK / GO LIVE toggle (the hero)
 *        BOTTOM → quick actions: MARK · ZONES · INVITE · SETTINGS
 */
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  useWindowDimensions,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useGroupStore } from '@/store/useGroupStore';
import { useBillingStore } from '@/store/useBillingStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useMapStore } from '@/store/useMapStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useSafetyStore } from '@/store/useSafetyStore';
import { useNotifCenterStore } from '@/store/useNotifCenterStore';
import { useGoDark } from '@/hooks/useGoDark';
import { useAnalytics } from '@/hooks/useAnalytics';
import { resolvePresence } from '@/utils/presence';
import { loadDeviceContacts, needsSettings } from '@/services/deviceContacts';
import { buildWatchUrl } from '@/services/sessions';
import { shareWithLink } from '@/utils/contactActions';
import { requireFeature, requireLimit } from '@/utils/paywall';

/** Public invite link — opens the app (universal link) or the web invite page. */
const buildInviteUrl = (code: string) => `https://app.navtrl.com/invite/${code}`;
import { MARKER_TYPES } from '@/constants/markerTypes';
import { can } from '@/utils/roles';
import { C } from '@/constants/theme';
import type { GroupMember } from '@/types/models';
import type { MarkerType } from '@/types/database';

// Read per-render via useWindowDimensions rather than captured once at module
// load — a module-scope Dimensions.get() is stale after rotation, in
// split-screen, and on foldables.
const COLLAPSED_H = 118;


// Places Autocomplete uses the Google Places web API — needs a key with the
// Places API enabled. Falls back to the iOS maps key if the general one is unset.
const GOOGLE_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ||
  '';

// Minimal contact shape — decoupled from expo-contacts' versioned Contact type
type PickedContact = { id: string; name?: string | null; [key: string]: any };

// Ionicons marker map — no emojis
const MARKER_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  waypoint:     'pin',
  danger:       'warning',
  safe_zone:    'shield-checkmark',
  camp:         'bonfire',
  vehicle:      'car-sport',
  animal_sign:  'paw',
  evidence:     'search',
  supply_cache: 'cube',
  custom:       'add-circle',
};

const MARKER_COLORS: Record<string, string> = {
  waypoint:     '#4ADE80',
  danger:       '#EF4444',
  safe_zone:    '#60A5FA',
  camp:         '#F97316',
  vehicle:      '#FACC15',
  animal_sign:  '#A855F7',
  evidence:     '#22D3EE',
  supply_cache: '#EAB308',
  custom:       '#FFFFFF',
};

// ─── Module-level imperative ref ─────────────────────────────────────────────
let _sheetRef: React.RefObject<BottomSheet> | null = null;
export function openDrawer()  { _sheetRef?.current?.snapToIndex(1); }
export function closeDrawer() { _sheetRef?.current?.snapToIndex(0); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDisplayName(m: GroupMember): string {
  return (
    m.nickname_override ??
    m.profile?.nickname ??
    m.profile?.display_name ??
    'Unknown'
  );
}
function getInitials(m: GroupMember): string {
  if (m.initials_override) return m.initials_override.toUpperCase().slice(0, 2);
  if (m.profile?.initials) return m.profile.initials.toUpperCase().slice(0, 2);
  const name = m.profile?.nickname ?? m.profile?.display_name ?? '';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase() || '??';
}

// ─── Pulse hook ───────────────────────────────────────────────────────────────
function usePulse(active: boolean) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { anim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return anim;
}

// ─── NavigationDrawer ─────────────────────────────────────────────────────────
export const NavigationDrawer: React.FC = () => {
  const sheetRef = useRef<BottomSheet>(null);
  const router   = useRouter();

  useEffect(() => {
    _sheetRef = sheetRef as any;
    return () => { _sheetRef = null; };
  }, []);

  const { height: screenH } = useWindowDimensions();
  // Recomputed when the viewport changes, so the drawer still snaps to 3/4 of
  // the CURRENT screen rather than whatever it was when the app launched.
  const expandedH = useMemo(() => Math.round(screenH * 0.75), [screenH]);
  const snapPoints = useMemo(() => [COLLAPSED_H, expandedH], [expandedH]);
  const [idx, setIdx]               = useState(0);
  const [markerModal, setMarkerModal] = useState(false);
  const [zoneModal, setZoneModal]     = useState(false);
  const [crewModal, setCrewModal]     = useState(false);   // create-crew form
  const [crewsModal, setCrewsModal]   = useState(false);   // crew switcher list
  const [joinCrewModal, setJoinCrewModal] = useState(false);
  const [joinCode, setJoinCode]       = useState('');
  const [joiningCrew, setJoiningCrew] = useState(false);
  const [journeyModal, setJourneyModal] = useState(false);

  // ── Stores ──────────────────────────────────────────────────────────────────
  const userId           = useAuthStore((s) => s.user?.id);
  const groups           = useGroupStore((s) => s.groups);
  const activeGroupId    = useGroupStore((s) => s.activeGroupId);
  const groupMembers     = useGroupStore((s) => s.groupMembers);
  const setActiveGroupId = useGroupStore((s) => s.setActiveGroupId);
  const createGroup      = useGroupStore((s) => s.createGroup);
  const joinByInviteCode = useGroupStore((s) => s.joinByInviteCode);
  const loadGroupMembers = useGroupStore((s) => s.loadGroupMembers);
  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? null, [groups, activeGroupId]);
  const isAppAdmin = useBillingStore((s) => s.isAdmin);
  const myRole = useMemo(() => groupMembers.find((m) => m.user_id === userId)?.role, [groupMembers, userId]);
  // App-admin (admin@zylx.ai) has unrestricted access — bypasses crew-role gating.
  const canContribute = isAppAdmin || can(myRole, 'contribute');

  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const crewLocations  = useLocationStore((s) => s.crewLocations);
  const createSession  = useSessionStore((s) => s.createSession);

  const { isDark, isEnforced, isLoading: darkLoading, toggle: toggleDark } = useGoDark();
  const { track } = useAnalytics();

  useEffect(() => {
    if (activeGroupId) loadGroupMembers(activeGroupId);
  }, [activeGroupId]);

  const liveCount = useMemo(
    () => groupMembers.filter((m) => {
      const loc = crewLocations[m.user_id];
      return loc
        ? resolvePresence({ status: (loc as any).status, lastPingAt: (loc as any).last_ping_at ?? (loc as any).updated_at }).state === 'live'
        : m.status === 'live';
    }).length,
    [groupMembers, crewLocations],
  );

  const livePulse = usePulse(isBroadcasting && !isDark);
  const statusPulse = usePulse(true); // peek LIVE/DARK indicator always flashes
  const unseenCount = useNotifCenterStore((s) => s.unseenCount);

  // ── Create-crew form state ───────────────────────────────────────────────────
  const [crewName, setCrewName]   = useState('');
  const [enforce, setEnforce]     = useState(false);
  const [creatingCrew, setCreatingCrew] = useState(false);

  // ── New-journey form state ───────────────────────────────────────────────────
  const [journeyName, setJourneyName]   = useState('');
  const [journeyDest, setJourneyDest]   = useState('');
  const [journeyDestCoords, setJourneyDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [creatingJourney, setCreatingJourney] = useState(false);
  const journeyPlacesRef = useRef<any>(null);

  // ── Emergency-contacts (expo-contacts) state ─────────────────────────────────
  const [contactList, setContactList]       = useState<PickedContact[]>([]);
  const [allContacts, setAllContacts]       = useState<PickedContact[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch]   = useState('');
  const syncInFlight = useRef(false);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleGoDark = useCallback(() => {
    if (isEnforced || darkLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    track({ name: isDark ? 'go_live_activated' : 'go_dark_activated' });
    toggleDark();
  }, [isDark, isEnforced, darkLoading, toggleDark, track]);

  const handleShareInvite = useCallback(async () => {
    if (!activeGroup?.invite_code) {
      Alert.alert('NO ACTIVE CREW', 'Select or create a crew before sending an invite.');
      return;
    }
    try {
      await shareWithLink(
        `Join my crew "${activeGroup.name}" on Stalkr. Tap to join (invite code ${activeGroup.invite_code}):`,
        buildInviteUrl(activeGroup.invite_code),
        `Join ${activeGroup.name} on Stalkr`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track({ name: 'invite_shared', properties: { method: 'share_sheet' } });
    } catch {}
  }, [activeGroup, track]);

  const handleSelectMarkerType = useCallback((type: MarkerType) => {
    setMarkerModal(false);
    sheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useMapStore.getState().startMarkerPlacement(type);
    track({ name: 'marker_placed', properties: { marker_type: type } });
  }, [track]);

  const handleSelectZoneType = useCallback((type: 'circle' | 'polygon') => {
    // Paywall: zones are a paid feature + limited per plan.
    if (!requireFeature('polygonZones', router, 'Zones')) { setZoneModal(false); return; }
    const zoneCount = useMapStore.getState().savedPlaces.length;
    if (!requireLimit('maxSavedPlaces', zoneCount, router, 'zones')) { setZoneModal(false); return; }
    setZoneModal(false);
    sheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'circle') useMapStore.getState().startCircleZonePlacement();
    else useMapStore.getState().startPolygonZonePlacement();
  }, [router]);

  // ── Search bar → open the maps-style place search overlay ────────────────────
  const onSearchPress = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
    useMapStore.getState().setSearchOpen(true);
  }, []);

  // ── CREWS hub ────────────────────────────────────────────────────────────────
  const openCrewsList = useCallback(() => setCrewsModal(true), []);

  const openJourneys = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
    setCrewsModal(false);
    useSessionStore.getState().openJourneySheet(null);
  }, []);

  const handleSwitchCrew = useCallback((id: string) => {
    Haptics.selectionAsync();
    setActiveGroupId(id);
    setCrewsModal(false);
    sheetRef.current?.snapToIndex(0);
  }, [setActiveGroupId]);

  const handleManageCrew = useCallback((id: string) => {
    setActiveGroupId(id);
    setCrewsModal(false);
    sheetRef.current?.snapToIndex(0);
    router.push(`/groups/${id}`);
  }, [router, setActiveGroupId]);

  const handleJoinCrew = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { Alert.alert('CODE REQUIRED', 'Enter an invite code.'); return; }
    setJoiningCrew(true);
    try {
      const result = await joinByInviteCode(code);
      if (!result.ok) {
        Alert.alert(
          result.reason === 'network' ? 'CONNECTION PROBLEM' : 'INVALID CODE',
          result.message,
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track({ name: 'group_joined', properties: { method: 'invite_code' } });
      setJoinCrewModal(false);
      setJoinCode('');
      setCrewsModal(false);
      sheetRef.current?.snapToIndex(0);
      Alert.alert('CREW JOINED', `You joined ${result.group.name}.`);
    } catch (e: any) {
      Alert.alert('JOIN ERROR', e?.message ?? 'Unable to join crew.');
    } finally {
      setJoiningCrew(false);
    }
  }, [joinCode, joinByInviteCode, track]);

  // ── NEW CREW ─────────────────────────────────────────────────────────────────
  const openCrewSheet = useCallback(() => {
    setCrewName('');
    setEnforce(false);
    setCrewsModal(false);
    setCrewModal(true);
  }, []);

  const handleCreateCrew = useCallback(async () => {
    const name = crewName.trim();
    if (!name) { Alert.alert('CREW NAME REQUIRED', 'Name your crew before generating an invite.'); return; }
    // Paywall: plan limits how many crews you can create.
    if (!requireLimit('maxGroups', groups.length, router, 'crews')) return;
    setCreatingCrew(true);
    try {
      const group = await createGroup(name, 'custom', enforce);
      if (!group) { Alert.alert('CREW ERROR', 'Crew could not be created. Try again.'); return; }
      setActiveGroupId(group.id);
      track({ name: 'group_created' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCrewModal(false);
      setCrewName('');
      Alert.alert('CREW CREATED', `${group.name} is now active.\nInvite code: ${group.invite_code}`);
    } catch (e: any) {
      Alert.alert('CREW ERROR', e?.message ?? 'Unable to create crew.');
    } finally {
      setCreatingCrew(false);
    }
  }, [crewName, enforce, createGroup, setActiveGroupId, track]);

  // ── NEW JOURNEY ──────────────────────────────────────────────────────────────
  const openJourneySheet = useCallback(() => {
    setJourneyName('');
    setJourneyDest('');
    setJourneyDestCoords(null);
    setContactList([]);
    setContactSearch('');
    journeyPlacesRef.current?.setAddressText?.('');
    setJourneyModal(true);
  }, []);

  // Pull device contacts → open the multi-select picker (matches old project)
  const syncContacts = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    Keyboard.dismiss();
    try {
      // Was calling the deprecated 'expo-contacts' export, which throws in 56.x.
      // There was also no catch here, so the throw became an unhandled rejection
      // and the picker silently never opened. See services/deviceContacts.ts.
      const result = await loadDeviceContacts();

      if (result.ok) {
        setAllContacts(
          result.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            value: c.value,
            isEmail: c.isEmail,
            channels: c.channels,
            selected: c.selected,
          })),
        );
        setContactSearch('');
        setShowContactPicker(true);
        return;
      }

      if (__DEV__ && result.reason === 'error') {
        console.warn('[contacts] load failed:', result.detail);
      }

      Alert.alert(
        result.reason === 'blocked' ? 'CONTACTS ACCESS OFF'
          : result.reason === 'denied' ? 'PERMISSION NEEDED'
          : result.reason === 'limited_or_empty' ? 'NO CONTACTS SHARED'
          : result.reason === 'module_unavailable' ? 'CONTACTS UNAVAILABLE'
          : 'COULD NOT READ CONTACTS',
        result.message,
        needsSettings(result)
          ? [
              { text: 'Cancel', style: 'cancel' as const },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          : [{ text: 'OK' }],
      );
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  const contactKey = useCallback(
    (c: PickedContact) => String((c as any).id ?? (c as any).lookupKey ?? c.name ?? ''),
    [],
  );

  const toggleContact = useCallback((c: PickedContact) => {
    const key = contactKey(c);
    setContactList((prev) =>
      prev.some((x) => contactKey(x) === key)
        ? prev.filter((x) => contactKey(x) !== key)
        : [...prev, c],
    );
  }, [contactKey]);

  const handleCreateJourney = useCallback(async () => {
    const name = journeyName.trim();
    if (!name) { Alert.alert('JOURNEY NAME REQUIRED', 'Name this journey before starting.'); return; }
    setCreatingJourney(true);
    try {
      const session = await createSession({
        name,
        groupId: activeGroup?.id ?? null,
        destinationName: journeyDest.trim() || undefined,
        destinationLat: journeyDestCoords?.lat,
        destinationLng: journeyDestCoords?.lng,
        notifyOnEnd: true,
      });

      if (!session) { Alert.alert('JOURNEY ERROR', 'Unable to start journey.'); return; }

      track({ name: 'session_started' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJourneyModal(false);
      sheetRef.current?.snapToIndex(0);

      // Auto-open share sheet — send the watch link to the chosen emergency contacts
      const url = buildWatchUrl(session.watch_token);
      const destText = session.destination_name ? ` to ${session.destination_name}` : '';
      const contactNames = contactList.map((c) => c.name).filter(Boolean).join(', ');
      const contactLine = contactNames ? ` Notifying: ${contactNames}.` : '';
      await shareWithLink(
        `${session.traveler_name ?? 'Someone'} is on their way${destText}. Follow live and get notified on arrival:${contactLine}`,
        url,
        `Watch my journey${destText}`,
      );
    } catch (e: any) {
      Alert.alert('JOURNEY ERROR', e?.message ?? 'Unable to start journey.');
    } finally {
      setCreatingJourney(false);
    }
  }, [journeyName, journeyDest, journeyDestCoords, contactList, createSession, activeGroup, track]);

  // ── Backdrop: blur everything behind the drawer, fade in on expand ──────────
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={1}
      disappearsOnIndex={0}
      pressBehavior="collapse"
      opacity={1}
      style={[props.style, styles.backdrop]}
    >
      <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
    </BottomSheetBackdrop>
  ), []);

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={setIdx}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundComponent={({ style }) => (
          <BlurView intensity={95} tint="dark" style={[style, styles.glass]} />
        )}
        handleComponent={() => (
          <TouchableOpacity
            style={styles.handle}
            onPress={() => sheetRef.current?.snapToIndex(idx === 0 ? 1 : 0)}
            activeOpacity={0.9}
          >
            <View style={styles.handleBar} />
          </TouchableOpacity>
        )}
        style={{ zIndex: 5000, elevation: 5000 }}
      >
        {/* Content is ALWAYS mounted → expands instantly, no render wait */}
        <BottomSheetView style={styles.container}>
          {/* ── Collapsed peek: search bar + flashing LIVE/DARK ── */}
          <View style={styles.peek}>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={onSearchPress}
              activeOpacity={0.85}
            >
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.searchPlaceholder} numberOfLines={1}>Search places & addresses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => { sheetRef.current?.snapToIndex(0); router.push('/notifications'); }}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications" size={18} color="rgba(255,255,255,0.8)" />
              {unseenCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.peekToggle, isDark && styles.peekToggleDark]}
              onPress={handleGoDark}
              disabled={isEnforced || darkLoading}
              activeOpacity={0.8}
            >
              <Animated.View style={[styles.peekToggleDot, {
                backgroundColor: isDark ? C.red : C.green,
                opacity: statusPulse,
              }]} />
              <Text style={[styles.peekToggleText, { color: isDark ? C.red : C.green }]}>
                {darkLoading ? '...' : isDark ? 'DARK' : 'LIVE'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Expanded body: 3 zones (scrolls only if a short screen needs it) ── */}
          <BottomSheetScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* TOP ZONE — Crews / Journeys hubs */}
            <View style={styles.createRow}>
              <TouchableOpacity
                style={[styles.createBtn, styles.createBtnCrew]}
                onPress={openCrewsList}
                activeOpacity={0.85}
              >
                <Ionicons name="people" size={18} color={C.green} />
                <Text style={[styles.createBtnText, { color: C.green }]}>CREWS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createBtn, styles.createBtnJourney]}
                onPress={openJourneys}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={18} color={C.blue} />
                <Text style={[styles.createBtnText, { color: C.blue }]}>JOURNEYS</Text>
              </TouchableOpacity>
            </View>

            {/* CENTER ZONE — GO DARK / GO LIVE hero */}
            <View style={styles.centerZone}>
              {activeGroup ? (
                <View style={[styles.heroCard, isDark && styles.heroCardDark]}>
                  <View style={styles.heroTop}>
                    <Animated.View style={[styles.heroDot, {
                      backgroundColor: isDark ? C.red : C.green,
                      opacity: isDark ? 1 : livePulse,
                    }]} />
                    <Text style={[styles.heroStatus, { color: isDark ? C.red : C.green }]}>
                      {isDark ? 'STEALTH ACTIVE' : 'BROADCASTING LIVE'}
                    </Text>
                  </View>

                  <Text style={styles.heroCrew} numberOfLines={1}>
                    {activeGroup.name.toUpperCase()}
                  </Text>
                  <Text style={styles.heroDesc}>
                    {isEnforced
                      ? 'Tracking enforced by crew owner'
                      : isDark
                        ? 'Your location is hidden from the crew'
                        : 'Your location is visible to the crew'}
                  </Text>

                  <TouchableOpacity
                    style={[styles.goBtn, isDark && styles.goBtnActive, (isEnforced || darkLoading) && { opacity: 0.45 }]}
                    onPress={handleGoDark}
                    disabled={isEnforced || darkLoading}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isDark ? 'radio' : 'eye-off'}
                      size={17}
                      color={isDark ? '#000' : C.red}
                    />
                    <Text style={[styles.goBtnText, { color: isDark ? '#000' : C.red }]}>
                      {darkLoading ? 'SYNCING...' : isEnforced ? 'TRACKING ENFORCED' : isDark ? 'GO LIVE' : 'GO DARK / STEALTH'}
                    </Text>
                  </TouchableOpacity>

                  {!!activeGroup.invite_code && (
                    <TouchableOpacity style={styles.inviteRow} onPress={handleShareInvite} activeOpacity={0.8}>
                      <Text style={styles.inviteLabel}>INVITE CODE</Text>
                      <Text style={styles.inviteCode}>{activeGroup.invite_code}</Text>
                      <Ionicons name="share-social-outline" size={14} color="rgba(255,255,255,0.35)" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity style={styles.emptyHero} onPress={openCrewSheet} activeOpacity={0.85}>
                  <Ionicons name="radio-outline" size={34} color={C.green} />
                  <Text style={styles.emptyHeroText}>INITIALIZE NEW CREW</Text>
                  <Text style={styles.emptyHeroSub}>Create a crew to start broadcasting.</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* BOTTOM ZONE — quick actions */}
            <View style={styles.bottomZone}>
              <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => { sheetRef.current?.snapToIndex(0); useSafetyStore.getState().setCenterOpen(true); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actionIcon, { borderColor: C.redBorder, backgroundColor: C.redDim }]}><Ionicons name="shield-half" size={22} color={C.red} /></View>
                  <Text style={styles.actionLabel}>SAFETY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionTile, (!activeGroup || !canContribute) && styles.actionTileDisabled]}
                  onPress={() => {
                    if (!activeGroupId) { Alert.alert('NO ACTIVE CREW', 'Select a crew first.'); return; }
                    if (!canContribute) { Alert.alert('VIEWER ROLE', 'Viewers have read-only access and cannot place markers.'); return; }
                    setMarkerModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}><Ionicons name="pin" size={22} color={C.green} /></View>
                  <Text style={styles.actionLabel}>MARK</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionTile, (!activeGroup || !canContribute) && styles.actionTileDisabled]}
                  onPress={() => {
                    if (!activeGroupId) { Alert.alert('NO ACTIVE CREW', 'Select a crew first.'); return; }
                    if (!canContribute) { Alert.alert('VIEWER ROLE', 'Viewers have read-only access and cannot create zones.'); return; }
                    setZoneModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}><Ionicons name="scan" size={22} color={C.green} /></View>
                  <Text style={styles.actionLabel}>ZONES</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionTile, !activeGroup && styles.actionTileDisabled]}
                  onPress={handleShareInvite}
                  activeOpacity={0.75}
                  disabled={!activeGroup}
                >
                  <View style={styles.actionIcon}><Ionicons name="share-social" size={22} color={C.green} /></View>
                  <Text style={styles.actionLabel}>INVITE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => { sheetRef.current?.snapToIndex(0); router.push('/(tabs)/settings'); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}><Ionicons name="settings" size={22} color={C.green} /></View>
                  <Text style={styles.actionLabel}>SETTINGS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>

      {/* ── CREATE CREW SHEET ── */}
      <Modal visible={crewModal} transparent animationType="slide" onRequestClose={() => setCrewModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={mod.sheet}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.green }]}>INITIALIZE NEW CREW</Text>
            <Text style={mod.sub}>Create a permanent intel group.</Text>

            <Text style={mod.label}>CREW NAME</Text>
            <TextInput
              style={mod.input}
              placeholder="e.g. Ridge Hunters"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={crewName}
              onChangeText={setCrewName}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Text style={mod.label}>TRACKING PERMISSIONS</Text>
            <View style={mod.policyRow}>
              <TouchableOpacity
                style={[mod.policyBtn, !enforce && mod.policyBtnActive]}
                onPress={() => setEnforce(false)}
                activeOpacity={0.85}
              >
                <Text style={[mod.policyText, !enforce && { color: C.green }]}>FLEXIBLE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mod.policyBtn, enforce && mod.policyBtnActiveRed]}
                onPress={() => setEnforce(true)}
                activeOpacity={0.85}
              >
                <Text style={[mod.policyText, enforce && { color: C.red }]}>ENFORCED</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[mod.primaryBtn, creatingCrew && { opacity: 0.6 }]}
              onPress={handleCreateCrew}
              disabled={creatingCrew}
              activeOpacity={0.85}
            >
              <Text style={mod.primaryText}>{creatingCrew ? 'CREATING CREW...' : 'GENERATE ENCRYPTED INVITE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mod.cancelBtn} onPress={() => setCrewModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>CLOSE</Text>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CREWS SWITCHER SHEET ── */}
      <Modal visible={crewsModal} transparent animationType="slide" onRequestClose={() => setCrewsModal(false)}>
        <View style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={[mod.sheet, { maxHeight: screenH * 0.8 }]}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.green }]}>YOUR CREWS</Text>
            <Text style={mod.sub}>Switch between crews or start a new one.</Text>

            <View style={cs.actionRow}>
              <TouchableOpacity style={cs.actionBtn} onPress={openCrewSheet} activeOpacity={0.85}>
                <Ionicons name="add-circle" size={18} color={C.green} />
                <Text style={[cs.actionText, { color: C.green }]}>NEW CREW</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={cs.actionBtnAlt}
                onPress={() => { setJoinCode(''); setJoinCrewModal(true); }}
                activeOpacity={0.85}
              >
                <Ionicons name="key" size={18} color={C.blue} />
                <Text style={[cs.actionText, { color: C.blue }]}>JOIN CODE</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
              {groups.length === 0 ? (
                <Text style={cs.emptyText}>No crews yet. Create one or join with a code.</Text>
              ) : (
                groups.map((g) => {
                  const isActive = g.id === activeGroupId;
                  return (
                    <View key={g.id} style={[cs.row, isActive && cs.rowActive]}>
                      <TouchableOpacity style={cs.rowMain} onPress={() => handleSwitchCrew(g.id)} activeOpacity={0.8}>
                        <View style={[cs.dot, { backgroundColor: isActive ? C.green : 'rgba(255,255,255,0.25)' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={cs.name} numberOfLines={1}>{g.name.toUpperCase()}</Text>
                          <Text style={cs.meta}>
                            {isActive ? 'ACTIVE' : 'TAP TO ACTIVATE'}
                            {g.member_role === 'owner' ? '  ·  OWNER' : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={cs.manageBtn} onPress={() => handleManageCrew(g.id)} activeOpacity={0.8}>
                        <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity style={mod.cancelBtn} onPress={() => setCrewsModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>CLOSE</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

      {/* ── JOIN CREW SHEET ── */}
      <Modal visible={joinCrewModal} transparent animationType="slide" onRequestClose={() => setJoinCrewModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={mod.sheet}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.blue }]}>JOIN A CREW</Text>
            <Text style={mod.sub}>Enter the invite code shared with you.</Text>
            <TextInput
              style={[mod.input, { letterSpacing: 4, textAlign: 'center', fontSize: 20 }]}
              placeholder="ABCD1234"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={handleJoinCrew}
            />
            <TouchableOpacity
              style={[mod.primaryBtn, { backgroundColor: C.blue }, joiningCrew && { opacity: 0.6 }]}
              onPress={handleJoinCrew}
              disabled={joiningCrew}
              activeOpacity={0.85}
            >
              <Text style={mod.primaryText}>{joiningCrew ? 'JOINING...' : 'JOIN CREW'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mod.cancelBtn} onPress={() => setJoinCrewModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── NEW JOURNEY SHEET ── */}
      <Modal visible={journeyModal} transparent animationType="slide" onRequestClose={() => setJourneyModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={[mod.sheet, { maxHeight: screenH * 0.82 }]}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.blue }]}>NEW JOURNEY SESSION</Text>
            <Text style={mod.sub}>Share a live session to a destination.</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={mod.label}>JOURNEY NAME</Text>
              <TextInput
                style={mod.input}
                placeholder="e.g. Drive home"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={journeyName}
                onChangeText={setJourneyName}
                returnKeyType="next"
              />

              <Text style={mod.label}>DESTINATION (OPTIONAL)</Text>
              <View style={mod.placesWrap}>
                <GooglePlacesAutocomplete
                  ref={journeyPlacesRef}
                  placeholder="Search address or place"
                  fetchDetails
                  minLength={1}
                  debounce={250}
                  enablePoweredByContainer={false}
                  keepResultsAfterBlur
                  keyboardShouldPersistTaps="handled"
                  onFail={(e) => console.log('JOURNEY PLACES FAIL:', e)}
                  textInputProps={{
                    placeholderTextColor: 'rgba(255,255,255,0.3)',
                    returnKeyType: 'search',
                    clearButtonMode: 'always',
                  }}
                  onPress={(data: any, details: any = null) => {
                    const loc = details?.geometry?.location;
                    setJourneyDest(data?.description || details?.formatted_address || '');
                    setJourneyDestCoords(loc ? { lat: loc.lat, lng: loc.lng } : null);
                    Keyboard.dismiss();
                  }}
                  query={{ key: GOOGLE_API_KEY, language: 'en' }}
                  styles={{
                    container: mod.placesContainer,
                    textInputContainer: mod.placesInputContainer,
                    textInput: mod.input,
                    listView: mod.placesList,
                    row: mod.placesRow,
                    description: { color: '#FFFFFF', fontSize: 13 },
                    separator: { backgroundColor: '#222', height: 0.5 },
                  }}
                />
              </View>

              {!!journeyDest && (
                <View style={mod.destPreview}>
                  <Ionicons name="location" size={16} color={C.blue} />
                  <Text style={mod.destPreviewText} numberOfLines={2}>{journeyDest}</Text>
                </View>
              )}

              <Text style={mod.label}>EMERGENCY CONTACTS</Text>
              <TouchableOpacity style={mod.contactBtn} onPress={syncContacts} activeOpacity={0.85}>
                <Ionicons name="person-add" size={18} color={C.blue} />
                <Text style={mod.contactBtnText}>
                  {contactList.length > 0 ? `${contactList.length} CONTACTS SELECTED` : 'ADD EMERGENCY CONTACTS'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[mod.primaryBtn, { backgroundColor: C.blue }, creatingJourney && { opacity: 0.6 }]}
              onPress={handleCreateJourney}
              disabled={creatingJourney}
              activeOpacity={0.85}
            >
              <Text style={mod.primaryText}>{creatingJourney ? 'STARTING...' : 'START JOURNEY SESSION'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mod.cancelBtn} onPress={() => setJourneyModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>ABORT</Text>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CONTACT PICKER MODAL ── */}
      <Modal visible={showContactPicker} animationType="slide" onRequestClose={() => setShowContactPicker(false)}>
        <SafeAreaView style={cm.root}>
          <View style={cm.header}>
            <Text style={[mod.title, { color: C.blue, marginBottom: 0 }]}>SELECT CONTACTS</Text>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <Ionicons name="close-circle" size={30} color={C.red} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={cm.search}
            placeholder="Search contacts"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={contactSearch}
            onChangeText={setContactSearch}
            autoCapitalize="none"
          />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {allContacts
              .filter((c) => !contactSearch.trim() || (c.name ?? '').toLowerCase().includes(contactSearch.trim().toLowerCase()))
              .map((c) => {
                const key = contactKey(c);
                const selected = contactList.some((x) => contactKey(x) === key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[cm.row, selected && cm.rowActive]}
                    onPress={() => toggleContact(c)}
                    activeOpacity={0.8}
                  >
                    <View style={[cm.avatar, { backgroundColor: selected ? C.blue : 'rgba(255,255,255,0.1)' }]}>
                      <Text style={cm.avatarText}>{(c.name?.[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <Text style={cm.name} numberOfLines={1}>{c.name ?? 'Unknown'}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={C.blue} />}
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <TouchableOpacity
            style={[mod.primaryBtn, { backgroundColor: C.blue, marginTop: 12 }]}
            onPress={() => setShowContactPicker(false)}
            activeOpacity={0.85}
          >
            <Text style={mod.primaryText}>
              {contactList.length > 0 ? `CONFIRM ${contactList.length} CONTACTS` : 'DONE'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ── MARKER PICKER MODAL ── */}
      <Modal visible={markerModal} transparent animationType="slide" onRequestClose={() => setMarkerModal(false)}>
        <View style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={mod.sheet}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.green }]}>PLACE TACTICAL MARKER</Text>
            <Text style={mod.sub}>Choose the type of intel to drop on the map.</Text>
            <View style={mod.grid}>
              {MARKER_TYPES.map((cfg) => {
                const iconName = MARKER_ICONS[cfg.type] ?? 'pin';
                const color    = MARKER_COLORS[cfg.type] ?? C.green;
                return (
                  <TouchableOpacity
                    key={cfg.type}
                    style={mod.tile}
                    onPress={() => handleSelectMarkerType(cfg.type)}
                    activeOpacity={0.8}
                  >
                    <View style={[mod.tileIcon, { borderColor: color + '55', backgroundColor: color + '18' }]}>
                      <Ionicons name={iconName} size={22} color={color} />
                    </View>
                    <Text style={mod.tileLabel}>{cfg.label.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={mod.cancelBtn} onPress={() => setMarkerModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

      {/* ── ZONE PICKER MODAL ── */}
      <Modal visible={zoneModal} transparent animationType="slide" onRequestClose={() => setZoneModal(false)}>
        <View style={mod.backdrop}>
          <BlurView intensity={95} tint="dark" style={[mod.sheet, { minHeight: 280 }]}>
            <View style={mod.handle}><View style={mod.handleBar} /></View>
            <Text style={[mod.title, { color: C.green }]}>CREATE ZONE</Text>
            <Text style={mod.sub}>Choose the zone shape.</Text>
            <View style={mod.zoneRow}>
              <TouchableOpacity style={mod.zoneTile} onPress={() => handleSelectZoneType('circle')} activeOpacity={0.8}>
                <View style={[mod.tileIcon, { borderColor: C.greenBorder, backgroundColor: C.greenDim }]}>
                  <Ionicons name="radio-button-on" size={26} color={C.green} />
                </View>
                <Text style={mod.tileLabel}>CIRCLE</Text>
                <Text style={mod.zoneSub}>Tap, then drag to size</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mod.zoneTile} onPress={() => handleSelectZoneType('polygon')} activeOpacity={0.8}>
                <View style={[mod.tileIcon, { borderColor: C.greenBorder, backgroundColor: C.greenDim }]}>
                  <Ionicons name="git-network" size={26} color={C.green} />
                </View>
                <Text style={mod.tileLabel}>POLYGON</Text>
                <Text style={mod.zoneSub}>Tap points to draw</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={mod.cancelBtn} onPress={() => setZoneModal(false)} activeOpacity={0.8}>
              <Text style={mod.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  glass: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.25)' },
  handle: { height: 26, alignItems: 'center', justifyContent: 'center' },
  handleBar: { width: 40, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },

  container: { flex: 1 },

  // Collapsed peek
  peek: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchPlaceholder: { flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  bellBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bellBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  peekToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: C.greenBorder,
    backgroundColor: C.greenDim, borderRadius: 999,
    paddingHorizontal: 14, height: 44,
  },
  peekToggleDark: { borderColor: C.redBorder, backgroundColor: C.redDim },
  peekToggleDot: { width: 8, height: 8, borderRadius: 4 },
  peekToggleText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },

  // Expanded body — 3 zones, generous vertical rhythm.
  // flexGrow lets the center zone fill on tall screens (bottom stays pinned),
  // while the ScrollView still scrolls if a short screen can't fit everything.
  bodyScroll: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22 },

  // TOP — create buttons (styled like GO DARK / GO LIVE)
  createRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  createBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1.5,
  },
  createBtnCrew:    { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  createBtnJourney: { borderColor: C.blueBorder,  backgroundColor: C.blueDim },
  createBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  // CENTER — hero (the focal point), floats with equal air above and below
  centerZone: { flex: 1, justifyContent: 'center', paddingVertical: 22 },
  heroCard: {
    backgroundColor: C.greenDim, borderRadius: 24, borderWidth: 1.5,
    borderColor: C.greenBorder, paddingVertical: 24, paddingHorizontal: 22, gap: 4,
  },
  heroCardDark: { borderColor: C.redBorder, backgroundColor: C.redDim },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heroDot: { width: 9, height: 9, borderRadius: 5 },
  heroStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroCrew: { color: C.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  heroDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 16, lineHeight: 18 },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.redBorder, backgroundColor: C.redDim,
    borderRadius: 16, paddingVertical: 17,
  },
  goBtnActive: { backgroundColor: C.green, borderColor: C.green },
  goBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },

  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  inviteLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  inviteCode:  { flex: 1, color: C.green, fontSize: 15, fontWeight: '900', letterSpacing: 2 },

  emptyHero: {
    alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20,
    borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.greenBorder,
    backgroundColor: C.greenDim,
  },
  emptyHeroText: { color: C.green, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  emptyHeroSub:  { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },

  // BOTTOM — quick actions
  bottomZone: { paddingTop: 4 },
  sectionHeader: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 16, marginLeft: 2 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  actionTile: { alignItems: 'center', gap: 7 },
  actionTileDisabled: { opacity: 0.4 },
  actionIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  actionLabel: { color: C.textPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const mod = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:    { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  handle:   { alignItems: 'center', marginBottom: 16 },
  handleBar:{ width: 40, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  title:    { fontSize: 16, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  sub:      { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginBottom: 20 },

  label:    { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', color: '#FFFFFF', padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', fontSize: 14, fontWeight: '600',
  },

  // Google Places autocomplete
  placesWrap: { minHeight: 56, zIndex: 9000 },
  placesContainer: { flex: 0, zIndex: 9001 },
  placesInputContainer: { zIndex: 9002 },
  placesList: {
    backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#333',
    marginTop: 8, maxHeight: 200, overflow: 'hidden', zIndex: 9003,
  },
  placesRow: { backgroundColor: '#111', padding: 13, height: 50 },
  destPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
    backgroundColor: C.blueDim, borderWidth: 1, borderColor: C.blueBorder,
    borderRadius: 12, padding: 12,
  },
  destPreviewText: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 17 },

  // Emergency contacts button
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12,
    backgroundColor: C.blueDim, borderWidth: 1.5, borderColor: C.blueBorder,
  },
  contactBtnText: { color: C.blue, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },

  policyRow: { flexDirection: 'row', gap: 10 },
  policyBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  policyBtnActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  policyBtnActiveRed: { borderColor: C.redBorder, backgroundColor: C.redDim },
  policyText: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  watcherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent' },
  watcherRowActive: { backgroundColor: C.blueDim, borderColor: C.blueBorder },
  watcherAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  watcherInitials: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  watcherName: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  primaryBtn: { backgroundColor: C.green, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 22 },
  primaryText: { color: '#000000', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  zoneRow:  { flexDirection: 'row', gap: 12 },
  tile:     { width: '30.5%', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, gap: 6 },
  zoneTile: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 8 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileLabel:{ color: C.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center' },
  zoneSub:  { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  cancelBtn:{ marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  cancelText:{ color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});

// ─── Contact picker styles ──────────────────────────────────────────────────
const cm = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', fontSize: 14, fontWeight: '600', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'transparent',
  },
  rowActive: { backgroundColor: C.blueDim, borderColor: C.blueBorder },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  name: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ─── Crews switcher styles ──────────────────────────────────────────────────
const cs = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.greenBorder, backgroundColor: C.greenDim,
  },
  actionBtnAlt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.blueBorder, backgroundColor: C.blueDim,
  },
  actionText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  emptyText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600',
    textAlign: 'center', paddingVertical: 28,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, marginTop: 10, paddingRight: 6,
  },
  rowActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  meta: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 3 },
  manageBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
