/**
 * NavigationDrawer — Stalkr tactical bottom-sheet drawer.
 * Aesthetic: BlurView glass, ALL CAPS weight-900, Ionicons, #4ADE80 green.
 *
 * Collapsed: crew name + live count + GO DARK / GO LIVE toggle
 * Expanded:  MEMBERS tab | CREWS tab | quick-action grid | stealth card
 */
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
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
  Dimensions,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useMapStore } from '@/store/useMapStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useGoDark } from '@/hooks/useGoDark';
import { useAnalytics } from '@/hooks/useAnalytics';
import { getCrewColor } from '@/constants/map';
import { MARKER_TYPES } from '@/constants/markerTypes';
import { timeAgo, getLocationStatus } from '@/utils/time';
import { getDistance, formatDistance } from '@/utils/distance';
import { C } from '@/constants/theme';
import type { GroupMember } from '@/types/models';
import type { MarkerType } from '@/types/database';

const { height: SCREEN_H } = Dimensions.get('window');
const COLLAPSED_H = 118;

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
function getInitials(m: GroupMember): string {
  if (m.initials_override) return m.initials_override.toUpperCase().slice(0, 2);
  if (m.profile?.initials) return m.profile.initials.toUpperCase().slice(0, 2);
  const name = m.profile?.nickname ?? m.profile?.display_name ?? '';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase() || '??';
}
function getDisplayName(m: GroupMember): string {
  return (
    m.nickname_override ??
    m.profile?.nickname ??
    m.profile?.display_name ??
    'Unknown'
  );
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

// ─── Member row ───────────────────────────────────────────────────────────────
interface MemberRowProps {
  member: GroupMember;
  isMe: boolean;
  liveLocation?: { status: string; battery_level: number | null; updated_at: string } | null;
  myLat?: number;
  myLng?: number;
}

const MemberRow: React.FC<MemberRowProps> = ({ member, isMe, liveLocation, myLat, myLng }) => {
  const initials  = getInitials(member);
  const name      = getDisplayName(member);
  const color     = getCrewColor(member.user_id);
  const status    = liveLocation ? getLocationStatus(liveLocation.updated_at) : member.status;
  const isLive    = status === 'live';
  const lastSeen  = liveLocation?.updated_at ? timeAgo(liveLocation.updated_at) : null;

  const distText = useMemo(() => {
    const loc = liveLocation as any;
    if (!myLat || !myLng || !loc?.latitude || !loc?.longitude) return null;
    return formatDistance(getDistance(
      { latitude: myLat, longitude: myLng },
      { latitude: loc.latitude, longitude: loc.longitude },
    ));
  }, [myLat, myLng, (liveLocation as any)?.latitude, (liveLocation as any)?.longitude]);

  return (
    <View style={ms.row}>
      {/* Status dot */}
      <View style={[ms.dot, {
        backgroundColor: isLive ? C.green : status === 'stale' ? C.amber : 'rgba(255,255,255,0.2)',
      }]} />

      {/* Avatar */}
      <View style={[ms.avatar, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <Text style={[ms.initials, { color }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={ms.info}>
        <Text style={ms.name} numberOfLines={1}>
          {isMe ? `${name.toUpperCase()} (YOU)` : name.toUpperCase()}
        </Text>
        <View style={ms.metaRow}>
          {member.role !== 'member' && (
            <Text style={[ms.badge, { color: C.green }]}>{member.role.toUpperCase()} · </Text>
          )}
          <Text style={[ms.status, { color: isLive ? C.green : C.amber }]}>
            {isLive ? 'LIVE' : lastSeen ? `${lastSeen}` : 'OFFLINE'}
          </Text>
          {distText && <Text style={ms.dist}> · {distText}</Text>}
        </View>
      </View>

      {/* Battery */}
      {liveLocation?.battery_level != null && (
        <View style={ms.battery}>
          <Ionicons
            name={liveLocation.battery_level > 50 ? 'battery-half' : 'battery-dead'}
            size={13}
            color={liveLocation.battery_level < 20 ? C.red : 'rgba(255,255,255,0.4)'}
          />
          <Text style={ms.battText}>{liveLocation.battery_level}%</Text>
        </View>
      )}
    </View>
  );
};

const ms = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dot:     { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  avatar:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  initials:{ fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  info:    { flex: 1 },
  name:    { color: C.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  status:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  dist:    { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  battText:{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' },
});

// ─── NavigationDrawer ─────────────────────────────────────────────────────────
export const NavigationDrawer: React.FC = () => {
  const sheetRef = useRef<BottomSheet>(null);
  const router   = useRouter();

  useEffect(() => {
    _sheetRef = sheetRef as any;
    return () => { _sheetRef = null; };
  }, []);

  const snapPoints = useMemo(() => [COLLAPSED_H, Math.round(SCREEN_H * 0.88)], []);
  const [idx, setIdx]         = useState(0);
  const [tab, setTab]         = useState<'crew' | 'groups'>('crew');
  const [markerModal, setMarkerModal] = useState(false);
  const [zoneModal, setZoneModal]     = useState(false);

  // ── Stores ──────────────────────────────────────────────────────────────────
  const userId    = useAuthStore((s) => s.user?.id);
  const groups    = useGroupStore((s) => s.groups);
  const activeGroupId  = useGroupStore((s) => s.activeGroupId);
  const groupMembers   = useGroupStore((s) => s.groupMembers);
  const membersLoading = useGroupStore((s) => s.membersLoading);
  const setActiveGroupId = useGroupStore((s) => s.setActiveGroupId);
  const loadGroupMembers = useGroupStore((s) => s.loadGroupMembers);
  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? null, [groups, activeGroupId]);

  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const crewLocations  = useLocationStore((s) => s.crewLocations);
  const myLocation     = useMapStore((s) => s.myLocation);
  const activeSession  = useSessionStore((s) => s.activeSession);

  const { isDark, isEnforced, isLoading: darkLoading, toggle: toggleDark } = useGoDark();
  const { track } = useAnalytics();

  useEffect(() => {
    if (activeGroupId) loadGroupMembers(activeGroupId);
  }, [activeGroupId]);

  const liveCount = useMemo(
    () => groupMembers.filter((m) => {
      const loc = crewLocations[m.user_id];
      return loc ? getLocationStatus((loc as any).updated_at) === 'live' : m.status === 'live';
    }).length,
    [groupMembers, crewLocations],
  );

  const livePulse = usePulse(isBroadcasting && !isDark);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGoDark = useCallback(() => {
    if (isEnforced || darkLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    track({ name: isDark ? 'go_live_activated' : 'go_dark_activated' });
    toggleDark();
  }, [isDark, isEnforced, darkLoading, toggleDark, track]);

  const handleShareInvite = useCallback(async () => {
    if (!activeGroup?.invite_code) return;
    try {
      await Share.share({
        title: `Join ${activeGroup.name} on Stalkr`,
        message: `Join my crew "${activeGroup.name}"\nInvite code: ${activeGroup.invite_code}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track({ name: 'invite_shared', properties: { method: 'share_sheet' } });
    } catch {}
  }, [activeGroup, track]);

  const handleSelectGroup = useCallback((groupId: string) => {
    Haptics.selectionAsync();
    setActiveGroupId(groupId);
    sheetRef.current?.snapToIndex(0);
    setTab('crew');
  }, [setActiveGroupId]);

  const handleSelectMarkerType = useCallback((type: MarkerType) => {
    setMarkerModal(false);
    sheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useMapStore.getState().startMarkerPlacement(type);
    track({ name: 'marker_placed', properties: { marker_type: type } });
  }, [track]);

  const handleSelectZoneType = useCallback((type: 'circle' | 'polygon') => {
    setZoneModal(false);
    sheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'circle') useMapStore.getState().startCircleZonePlacement();
    else useMapStore.getState().startPolygonZonePlacement();
  }, []);

  const isExpanded = idx > 0;

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={setIdx}
        enablePanDownToClose={false}
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

        {/* ── Collapsed peek ── */}
        <BottomSheetView style={styles.peek}>
          <TouchableOpacity
            style={styles.peekLeft}
            onPress={() => sheetRef.current?.snapToIndex(1)}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.peekDot, {
              backgroundColor: isDark ? C.red : C.green,
              opacity: isDark ? 1 : livePulse,
            }]} />
            <View>
              <Text style={styles.peekCrew} numberOfLines={1}>
                {activeGroup?.name?.toUpperCase() ?? 'NO ACTIVE CREW'}
              </Text>
              {liveCount > 0 && (
                <Text style={styles.peekSub}>{liveCount} LIVE</Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.peekToggle, isDark && styles.peekToggleDark]}
            onPress={handleGoDark}
            disabled={isEnforced || darkLoading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isDark ? 'eye-off' : 'radio'}
              size={13}
              color={isDark ? C.red : C.green}
            />
            <Text style={[styles.peekToggleText, { color: isDark ? C.red : C.green }]}>
              {darkLoading ? '...' : isDark ? 'DARK' : 'LIVE'}
            </Text>
          </TouchableOpacity>
        </BottomSheetView>

        {/* ── Expanded ── */}
        {isExpanded && (
          <>
            {/* Tab bar */}
            <View style={styles.tabBar}>
              {(['crew', 'groups'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabItem, tab === t && styles.tabItemActive]}
                  onPress={() => setTab(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'crew'
                      ? `MEMBERS${groupMembers.length ? ` (${groupMembers.length})` : ''}`
                      : `CREWS${groups.length ? ` (${groups.length})` : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <BottomSheetScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {/* MEMBERS TAB */}
              {tab === 'crew' && (
                activeGroup ? (
                  membersLoading && groupMembers.length === 0 ? (
                    [0,1,2].map((i) => (
                      <View key={i} style={[ms.row, { opacity: 0.3 }]}>
                        <View style={[ms.dot, { backgroundColor: '#333' }]} />
                        <View style={[ms.avatar, { backgroundColor: '#1a1a28', borderColor: '#2a2a3a' }]} />
                        <View style={[ms.info]}>
                          <View style={{ width: 80, height: 10, backgroundColor: '#2a2a3a', borderRadius: 4 }} />
                        </View>
                      </View>
                    ))
                  ) : groupMembers.length === 0 ? (
                    <View style={styles.empty}>
                      <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.15)" />
                      <Text style={styles.emptyTitle}>NO CREW MEMBERS</Text>
                      <Text style={styles.emptySub}>Share your invite code to add people.</Text>
                    </View>
                  ) : (
                    groupMembers.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        isMe={m.user_id === userId}
                        liveLocation={crewLocations[m.user_id] as any ?? null}
                        myLat={myLocation?.latitude}
                        myLng={myLocation?.longitude}
                      />
                    ))
                  )
                ) : (
                  <View style={styles.empty}>
                    <Ionicons name="radio-outline" size={36} color="rgba(255,255,255,0.15)" />
                    <Text style={styles.emptyTitle}>NO ACTIVE CREW</Text>
                    <Text style={styles.emptySub}>Select or create a crew below.</Text>
                  </View>
                )
              )}

              {/* CREWS TAB */}
              {tab === 'groups' && (
                groups.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="people-circle-outline" size={36} color="rgba(255,255,255,0.15)" />
                    <Text style={styles.emptyTitle}>NO CREWS YET</Text>
                    <Text style={styles.emptySub}>Create or join a crew to get started.</Text>
                  </View>
                ) : (
                  groups.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupRow, g.id === activeGroupId && styles.groupRowActive]}
                      onPress={() => handleSelectGroup(g.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.groupRowLeft}>
                        {g.id === activeGroupId && (
                          <View style={styles.groupActiveDot} />
                        )}
                        <View>
                          <Text style={[styles.groupName, g.id === activeGroupId && styles.groupNameActive]} numberOfLines={1}>
                            {g.name.toUpperCase()}
                          </Text>
                          <Text style={styles.groupMeta}>
                            {g.type?.toUpperCase() ?? 'CUSTOM'}
                            {g.tracking_mode === 'enforced' ? ' · ENFORCED' : ''}
                          </Text>
                        </View>
                      </View>
                      {g.id === activeGroupId && (
                        <View style={styles.groupActiveBadge}>
                          <Text style={styles.groupActiveBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )
              )}

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ── STEALTH CARD ── */}
              <View style={[styles.stealthCard, isDark && styles.stealthCardDark]}>
                <View style={styles.stealthTop}>
                  <Animated.View style={[styles.stealthDot, {
                    backgroundColor: isDark ? C.red : C.green,
                    opacity: isDark ? 1 : livePulse,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stealthStatus, { color: isDark ? C.red : C.green }]}>
                      {isDark ? 'STEALTH ACTIVE' : 'BROADCASTING LIVE'}
                    </Text>
                    <Text style={styles.stealthSub}>
                      {isEnforced
                        ? 'Tracking enforced by crew owner'
                        : isDark
                          ? 'Your location is hidden from crew'
                          : 'Your location is visible to crew'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.stealthBtn, isDark && styles.stealthBtnActive, (isEnforced || darkLoading) && { opacity: 0.45 }]}
                  onPress={handleGoDark}
                  disabled={isEnforced || darkLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isDark ? 'radio' : 'eye-off'}
                    size={15}
                    color={isDark ? '#000' : C.red}
                  />
                  <Text style={[styles.stealthBtnText, isDark && styles.stealthBtnTextActive]}>
                    {darkLoading ? 'SYNCING...' : isEnforced ? 'TRACKING ENFORCED' : isDark ? 'GO LIVE' : 'GO DARK / STEALTH'}
                  </Text>
                </TouchableOpacity>

                {activeGroup?.invite_code && (
                  <TouchableOpacity style={styles.inviteRow} onPress={handleShareInvite} activeOpacity={0.8}>
                    <Text style={styles.inviteLabel}>INVITE CODE</Text>
                    <Text style={styles.inviteCode}>{activeGroup.invite_code}</Text>
                    <Ionicons name="share-social-outline" size={14} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── QUICK ACTION GRID ── */}
              <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
              <View style={styles.actionGrid}>
                {/* Place Marker */}
                <TouchableOpacity
                  style={[styles.actionTile, !activeGroup && styles.actionTileDisabled]}
                  onPress={() => {
                    if (!activeGroupId) { Alert.alert('NO ACTIVE CREW', 'Select a crew first.'); return; }
                    setMarkerModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="pin" size={22} color={C.green} />
                  </View>
                  <Text style={styles.actionLabel}>MARK</Text>
                </TouchableOpacity>

                {/* Place Zone */}
                <TouchableOpacity
                  style={[styles.actionTile, !activeGroup && styles.actionTileDisabled]}
                  onPress={() => {
                    if (!activeGroupId) { Alert.alert('NO ACTIVE CREW', 'Select a crew first.'); return; }
                    setZoneModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="scan" size={22} color={C.green} />
                  </View>
                  <Text style={styles.actionLabel}>ZONE</Text>
                </TouchableOpacity>

                {/* Invite */}
                <TouchableOpacity
                  style={[styles.actionTile, !activeGroup && styles.actionTileDisabled]}
                  onPress={handleShareInvite}
                  activeOpacity={0.75}
                  disabled={!activeGroup}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="share-social" size={22} color={C.green} />
                  </View>
                  <Text style={styles.actionLabel}>INVITE</Text>
                </TouchableOpacity>

                {/* Settings */}
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => { sheetRef.current?.snapToIndex(0); router.push('/(tabs)/settings'); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="settings" size={22} color={C.green} />
                  </View>
                  <Text style={styles.actionLabel}>SETTINGS</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 48 }} />
            </BottomSheetScrollView>
          </>
        )}
      </BottomSheet>

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
              {/* Circle */}
              <TouchableOpacity style={mod.zoneTile} onPress={() => handleSelectZoneType('circle')} activeOpacity={0.8}>
                <View style={[mod.tileIcon, { borderColor: C.greenBorder, backgroundColor: C.greenDim }]}>
                  <Ionicons name="radio-button-on" size={26} color={C.green} />
                </View>
                <Text style={mod.tileLabel}>CIRCLE</Text>
                <Text style={mod.zoneSub}>Tap to set center</Text>
              </TouchableOpacity>
              {/* Polygon */}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  handle: { height: 26, alignItems: 'center', justifyContent: 'center' },
  handleBar: { width: 38, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Collapsed peek
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  peekLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  peekDot:  { width: 9, height: 9, borderRadius: 5 },
  peekCrew: { color: C.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  peekSub:  { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 1 },
  peekToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.greenBorder,
    backgroundColor: C.greenDim, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  peekToggleDark: { borderColor: C.redBorder, backgroundColor: C.redDim },
  peekToggleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
  },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: C.green },
  tabText: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  tabTextActive: { color: C.green },

  scroll: { paddingBottom: 20 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  emptySub:   { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: 32 },

  // Group rows
  groupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  groupRowActive: { backgroundColor: C.greenDim },
  groupRowLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  groupActiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  groupName:      { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  groupNameActive:{ color: C.textPrimary },
  groupMeta:      { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  groupActiveBadge: { backgroundColor: C.greenDim, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  groupActiveBadgeText: { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 20, marginHorizontal: 20 },

  // Stealth card
  stealthCard: {
    marginHorizontal: 16, borderRadius: 20, borderWidth: 1,
    borderColor: C.greenBorder, backgroundColor: C.greenDim,
    padding: 16, gap: 12,
  },
  stealthCardDark: { borderColor: C.redBorder, backgroundColor: C.redDim },
  stealthTop:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stealthDot:   { width: 9, height: 9, borderRadius: 5 },
  stealthStatus:{ fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  stealthSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  stealthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: C.redBorder, backgroundColor: C.redDim,
    borderRadius: 14, paddingVertical: 13,
  },
  stealthBtnActive: { backgroundColor: C.green, borderColor: C.green },
  stealthBtnText:   { color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  stealthBtnTextActive: { color: '#000' },

  // Invite row
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  inviteLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  inviteCode:  { flex: 1, color: C.green, fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  // Section header
  sectionHeader: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 24, marginBottom: 14, marginHorizontal: 20 },

  // Quick action grid
  actionGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16 },
  actionTile: { alignItems: 'center', gap: 6 },
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
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  zoneRow:  { flexDirection: 'row', gap: 12 },
  tile:     { width: '30.5%', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, gap: 6 },
  zoneTile: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 8 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileLabel:{ color: C.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center' },
  zoneSub:  { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  cancelBtn:{ marginTop: 20, alignItems: 'center', paddingVertical: 14 },
  cancelText:{ color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
