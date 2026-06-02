/**
 * NavigationDrawer — Stalkr 1-style bottom-up tactical drawer.
 *
 * Architecture:
 *   • @gorhom/bottom-sheet v4  (snap: collapsed handle → full panel)
 *   • Two snap points: 120px collapsed peek, 88% expanded
 *   • Exports `openDrawer()` / `closeDrawer()` via module-level ref so
 *     TacticalHud or any screen can open it without prop drilling
 *
 * Panels:
 *   • Crew tab  — live member list with status dots, battery, last-seen
 *   • Groups tab — group switcher
 *   • Controls   — GO LIVE toggle, share invite, session link, settings
 *
 * Wired to:
 *   useGroupStore, useAuthStore, useLocationStore, useMapStore, useSessionStore
 */
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Share } from 'react-native';
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
  StyleSheet,
  Switch,
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
import { getCrewColor, CREW_COLORS } from '@/constants/map';
import { MARKER_TYPES } from '@/constants/markerTypes';
import { timeAgo, getLocationStatus } from '@/utils/time';
import type { GroupMember } from '@/types/models';
import type { MarkerType } from '@/types/database';

const { height: SCREEN_H } = Dimensions.get('window');
const COLLAPSED_H = 120;

// ─── Module-level ref so any component can imperatively open/close ─────────────
let _sheetRef: React.RefObject<BottomSheet> | null = null;

export function openDrawer() {
  _sheetRef?.current?.snapToIndex(1);
}
export function closeDrawer() {
  _sheetRef?.current?.snapToIndex(0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(member: GroupMember): string {
  if (member.initials_override) return member.initials_override.toUpperCase().slice(0, 2);
  if (member.profile?.initials) return member.profile.initials.toUpperCase().slice(0, 2);
  const name = member.profile?.nickname || member.profile?.display_name || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

function getDisplayName(member: GroupMember): string {
  return (
    member.nickname_override ||
    member.profile?.nickname ||
    member.profile?.display_name ||
    'Unknown'
  );
}

// ─── Status dot colour ────────────────────────────────────────────────────────
function statusColor(status: string): string {
  if (status === 'live') return '#22c55e';
  if (status === 'stale') return '#f59e0b';
  return '#4a4a60';
}

// ─── Crew member row ──────────────────────────────────────────────────────────
interface MemberRowProps {
  member: GroupMember;
  isMe: boolean;
  liveLocation?: { status: string; battery_level: number | null; updated_at: string } | null;
}

const MemberRow: React.FC<MemberRowProps> = ({ member, isMe, liveLocation }) => {
  const initials = getInitials(member);
  const name = getDisplayName(member);
  const color = getCrewColor(member.user_id);
  const status = liveLocation ? getLocationStatus(liveLocation.updated_at) : member.status;
  const dotColor = statusColor(status);
  const lastSeen = liveLocation?.updated_at ? timeAgo(liveLocation.updated_at) : 'offline';

  return (
    <View style={styles.memberRow}>
      {/* Status dot */}
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: color + '33', borderColor: color }]}>
        <Text style={[styles.avatarText, { color }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>
          {isMe ? `${name} (you)` : name}
        </Text>
        {member.role === 'owner' || member.role === 'admin' ? (
          <Text style={styles.memberRole}>{member.role.toUpperCase()}</Text>
        ) : null}
      </View>

      {/* Right side: last seen + battery */}
      <View style={styles.memberMeta}>
        {liveLocation?.battery_level != null && (
          <Text style={styles.batteryText}>
            🔋{liveLocation.battery_level}%
          </Text>
        )}
        <Text style={[styles.lastSeen, { color: dotColor }]}>
          {status === 'live' ? 'LIVE' : lastSeen}
        </Text>
      </View>
    </View>
  );
};

// ─── NavigationDrawer ────────────────────────────────────────────────────────
export const NavigationDrawer: React.FC = () => {
  const sheetRef = useRef<BottomSheet>(null);
  const router = useRouter();

  // Wire module-level ref
  useEffect(() => {
    _sheetRef = sheetRef as any;
    return () => { _sheetRef = null; };
  }, []);

  const snapPoints = useMemo(() => [COLLAPSED_H, '88%'], []);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'crew' | 'groups'>('crew');
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);

  // ── Stores ──────────────────────────────────────────────────────────────────
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);

  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupMembers = useGroupStore((s) => s.groupMembers);
  const membersLoading = useGroupStore((s) => s.membersLoading);
  const setActiveGroupId = useGroupStore((s) => s.setActiveGroupId);
  const loadGroupMembers = useGroupStore((s) => s.loadGroupMembers);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const setIsBroadcasting = useLocationStore((s) => s.setIsBroadcasting);
  const crewLocations = useLocationStore((s) => s.crewLocations);

  const activeSession = useSessionStore((s) => s.activeSession);

  // Load members when active group changes
  useEffect(() => {
    if (activeGroupId) loadGroupMembers(activeGroupId);
  }, [activeGroupId]);

  // ── Go Dark ───────────────────────────────────────────────────────────────
  const { isDark, isEnforced, isLoading: darkLoading, toggle: toggleDark } = useGoDark();
  const { track } = useAnalytics();

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleBroadcast = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsBroadcasting(!isBroadcasting);
  }, [isBroadcasting, setIsBroadcasting]);

  const handleGoDark = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    track({ name: isDark ? 'go_live_activated' : 'go_dark_activated' });
    toggleDark();
  }, [toggleDark, isDark, track]);

  const handleShareInvite = useCallback(async () => {
    if (!activeGroup?.invite_code) return;
    try {
      await Share.share({
        title: `Join ${activeGroup.name} on Stalkr`,
        message: `Join my crew "${activeGroup.name}" with invite code: ${activeGroup.invite_code}`,
      });
      track({ name: 'invite_shared', properties: { method: 'share_sheet' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Share failed', 'Could not share invite code.');
    }
  }, [activeGroup, track]);

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      Haptics.selectionAsync();
      setActiveGroupId(groupId);
      track({ name: 'active_group_switched' });
      sheetRef.current?.snapToIndex(0);
      setActiveTab('crew');
    },
    [setActiveGroupId, track],
  );

  const handleOpenSettings = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
    router.push('/(tabs)/settings');
  }, [router]);

  const handleOpenSessions = useCallback(() => {
    sheetRef.current?.snapToIndex(0);
    router.push('/(tabs)/sessions');
  }, [router]);

  const handleOpenMarkerPicker = useCallback(() => {
    if (!activeGroupId) {
      Alert.alert('NO ACTIVE CREW', 'Select or create a crew before placing a marker.');
      return;
    }
    setShowMarkerModal(true);
  }, [activeGroupId]);

  const handleSelectMarkerType = useCallback((type: MarkerType) => {
    setShowMarkerModal(false);
    sheetRef.current?.snapToIndex(0);
    track({ name: 'marker_placed', properties: { marker_type: type } });
    useMapStore.getState().startMarkerPlacement(type);
    setTimeout(() => {
      Alert.alert('DROP A PIN', 'Tap anywhere on the map to place this marker.', [
        { text: 'OK', style: 'default' },
      ]);
    }, 350);
  }, [track]);

  const handleOpenZonePicker = useCallback(() => {
    if (!activeGroupId) {
      Alert.alert('NO ACTIVE CREW', 'Select or create a crew before placing a zone.');
      return;
    }
    setShowZoneModal(true);
  }, [activeGroupId]);

  const handleSelectZoneType = useCallback((type: 'circle' | 'polygon') => {
    setShowZoneModal(false);
    sheetRef.current?.snapToIndex(0);
    if (type === 'circle') {
      useMapStore.getState().startCircleZonePlacement();
      setTimeout(() => {
        Alert.alert('PLACE CIRCLE ZONE', 'Tap the map to set the zone center.', [
          { text: 'OK', style: 'default' },
        ]);
      }, 350);
    } else {
      useMapStore.getState().startPolygonZonePlacement();
      setTimeout(() => {
        Alert.alert('DRAW POLYGON ZONE', 'Tap the map to add points. Tap Finish when done.', [
          { text: 'OK', style: 'default' },
        ]);
      }, 350);
    }
  }, []);

  // ── Live counts ────────────────────────────────────────────────────────────
  const liveCount = useMemo(
    () => groupMembers.filter((m) => {
      const loc = crewLocations[m.user_id];
      return loc ? getLocationStatus(loc.updated_at) === 'live' : m.status === 'live';
    }).length,
    [groupMembers, crewLocations],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const isExpanded = sheetIndex > 0;

  return (
    <>
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={setSheetIndex}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handleIndicator}
      enablePanDownToClose={false}
    >
      {/* ── Collapsed peek ─────────────────────────────────────────────────── */}
      <BottomSheetView style={styles.peekRow}>
        {/* Group name + live count */}
        <TouchableOpacity
          style={styles.peekGroup}
          onPress={() => sheetRef.current?.snapToIndex(1)}
          activeOpacity={0.8}
        >
          <View style={[styles.peekDot, { backgroundColor: isBroadcasting ? '#22c55e' : '#4a4a60' }]} />
          <Text style={styles.peekGroupName} numberOfLines={1}>
            {activeGroup ? activeGroup.name.toUpperCase() : 'NO CREW'}
          </Text>
          {liveCount > 0 && (
            <View style={styles.peekBadge}>
              <Text style={styles.peekBadgeText}>{liveCount} LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick GO DARK / GO LIVE toggle */}
        <TouchableOpacity
          style={[styles.peekToggleRow, isDark && styles.peekToggleRowDark]}
          onPress={handleGoDark}
          disabled={isEnforced || darkLoading}
          activeOpacity={0.75}
        >
          <Text style={[styles.peekToggleLabel, isDark && styles.peekToggleLabelDark]}>
            {isDark ? '🌑 DARK' : '⚡ LIVE'}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>

      {/* ── Expanded content ────────────────────────────────────────────────── */}
      {isExpanded && (
        <>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'crew' && styles.tabActive]}
              onPress={() => setActiveTab('crew')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'crew' && styles.tabTextActive]}>
                MEMBERS {groupMembers.length > 0 ? `(${groupMembers.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
              onPress={() => setActiveTab('groups')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
                CREWS {groups.length > 0 ? `(${groups.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Crew tab ── */}
            {activeTab === 'crew' && (
              <>
                {activeGroup ? (
                  <>
                    {membersLoading && groupMembers.length === 0 ? (
                      // Skeleton rows while loading
                      [0, 1, 2].map((i) => (
                        <View key={i} style={[styles.memberRow, { opacity: 0.4 }]}>
                          <View style={[styles.statusDot, { backgroundColor: '#2a2a3a' }]} />
                          <View style={[styles.avatar, { backgroundColor: '#1e1e28', borderColor: '#2a2a3a' }]} />
                          <View style={styles.memberInfo}>
                            <View style={{ width: 90, height: 12, backgroundColor: '#2a2a3a', borderRadius: 4 }} />
                          </View>
                        </View>
                      ))
                    ) : groupMembers.length === 0 && !membersLoading ? (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>👥</Text>
                        <Text style={styles.emptyText}>No crew members yet.</Text>
                        <Text style={styles.emptySubtext}>
                          Share your invite code to add people.
                        </Text>
                      </View>
                    ) : (
                      groupMembers.map((member) => (
                        <MemberRow
                          key={member.id}
                          member={member}
                          isMe={member.user_id === userId}
                          liveLocation={crewLocations[member.user_id] as any ?? null}
                        />
                      ))
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>⚡</Text>
                    <Text style={styles.emptyText}>No active crew.</Text>
                    <Text style={styles.emptySubtext}>
                      Select a crew below or create one.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ── Groups tab ── */}
            {activeTab === 'groups' && (
              <>
                {groups.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📡</Text>
                    <Text style={styles.emptyText}>No crews yet.</Text>
                    <Text style={styles.emptySubtext}>
                      Create or join a crew to get started.
                    </Text>
                  </View>
                ) : (
                  groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupRow,
                        group.id === activeGroupId && styles.groupRowActive,
                      ]}
                      onPress={() => handleSelectGroup(group.id)}
                      activeOpacity={0.75}
                    >
                      {group.id === activeGroupId && (
                        <View style={styles.groupActiveDot} />
                      )}
                      <View style={styles.groupRowInfo}>
                        <Text
                          style={[
                            styles.groupRowName,
                            group.id === activeGroupId && styles.groupRowNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {group.name.toUpperCase()}
                        </Text>
                        <Text style={styles.groupRowType}>
                          {group.type?.toUpperCase() ?? 'CUSTOM'}
                          {group.tracking_mode === 'enforced' ? ' · ENFORCED' : ''}
                        </Text>
                      </View>
                      {group.id === activeGroupId && (
                        <Text style={styles.groupActiveLabel}>ACTIVE</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {/* ── Controls strip ── */}
            <View style={styles.divider} />

            {/* Go Dark / Go Live button */}
            <View style={styles.goDarkBlock}>
              {/* Status row */}
              <View style={styles.goDarkStatus}>
                <View style={[
                  styles.goDarkDot,
                  { backgroundColor: isDark ? '#ef4444' : '#22c55e' },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goDarkStatusLabel, isDark && styles.goDarkStatusLabelDark]}>
                    {isDark ? 'STEALTH ACTIVE' : 'BROADCASTING LIVE'}
                  </Text>
                  <Text style={styles.goDarkStatusSub}>
                    {isEnforced
                      ? 'Tracking enforced by crew owner'
                      : isDark
                        ? 'Location hidden from crew'
                        : 'Location visible to crew'}
                  </Text>
                </View>
              </View>

              {/* Main button */}
              <TouchableOpacity
                style={[
                  styles.goDarkBtn,
                  isDark && styles.goDarkBtnActive,
                  (isEnforced || darkLoading) && styles.goDarkBtnDisabled,
                ]}
                onPress={handleGoDark}
                disabled={isEnforced || darkLoading}
                activeOpacity={0.8}
              >
                <Text style={[styles.goDarkBtnText, isDark && styles.goDarkBtnTextActive]}>
                  {darkLoading
                    ? 'SYNCING...'
                    : isEnforced
                      ? 'TRACKING ENFORCED'
                      : isDark
                        ? '⚡ GO LIVE'
                        : '🌑 GO DARK'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Place marker CTA */}
            <TouchableOpacity
              style={[styles.placeMarkerBtn, !activeGroup && styles.placeMarkerBtnDisabled]}
              onPress={handleOpenMarkerPicker}
              activeOpacity={0.8}
              disabled={!activeGroup}
            >
              <Text style={styles.placeMarkerIcon}>📍</Text>
              <Text style={[styles.placeMarkerLabel, !activeGroup && styles.placeMarkerLabelDisabled]}>
                PLACE MARKER
              </Text>
            </TouchableOpacity>

            {/* Place zone CTA */}
            <TouchableOpacity
              style={[styles.placeZoneBtn, !activeGroup && styles.placeMarkerBtnDisabled]}
              onPress={handleOpenZonePicker}
              activeOpacity={0.8}
              disabled={!activeGroup}
            >
              <Text style={styles.placeMarkerIcon}>🎯</Text>
              <Text style={[styles.placeZoneLabel, !activeGroup && styles.placeMarkerLabelDisabled]}>
                PLACE ZONE
              </Text>
            </TouchableOpacity>

            {/* Action buttons row */}
            <View style={styles.actionRow}>
              {/* Share invite */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleShareInvite}
                activeOpacity={0.8}
                disabled={!activeGroup}
              >
                <Text style={styles.actionBtnIcon}>🔗</Text>
                <Text style={styles.actionBtnLabel}>INVITE</Text>
              </TouchableOpacity>

              {/* Sessions */}
              <TouchableOpacity
                style={[styles.actionBtn, activeSession && styles.actionBtnActive]}
                onPress={handleOpenSessions}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>⚡</Text>
                <Text style={[styles.actionBtnLabel, activeSession && styles.actionBtnLabelActive]}>
                  {activeSession ? 'SESSION' : 'SESSIONS'}
                </Text>
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleOpenSettings}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>⚙️</Text>
                <Text style={styles.actionBtnLabel}>SETTINGS</Text>
              </TouchableOpacity>
            </View>

            {/* Invite code display */}
            {activeGroup?.invite_code && (
              <TouchableOpacity
                style={styles.inviteCodeRow}
                onPress={handleShareInvite}
                activeOpacity={0.8}
              >
                <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
                <Text style={styles.inviteCode}>{activeGroup.invite_code}</Text>
                <Text style={styles.inviteCodeCopy}>TAP TO COPY</Text>
              </TouchableOpacity>
            )}

            {/* Bottom padding for safe area */}
            <View style={{ height: 40 }} />
          </BottomSheetScrollView>
        </>
      )}
    </BottomSheet>

    {/* ── Marker type picker modal ── */}
    <Modal
      visible={showMarkerModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowMarkerModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>PLACE MARKER</Text>
            <TouchableOpacity onPress={() => setShowMarkerModal(false)} activeOpacity={0.7}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type grid */}
          <View style={styles.markerGrid}>
            {MARKER_TYPES.map((cfg) => (
              <TouchableOpacity
                key={cfg.type}
                style={styles.markerTile}
                onPress={() => handleSelectMarkerType(cfg.type)}
                activeOpacity={0.75}
              >
                <View style={[styles.markerTileIcon, { backgroundColor: `${cfg.color}22`, borderColor: `${cfg.color}55` }]}>
                  <Text style={styles.markerTileEmoji}>{cfg.emoji}</Text>
                </View>
                <Text style={styles.markerTileLabel}>{cfg.label.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
    {/* ── Zone type picker modal ── */}
    <Modal
      visible={showZoneModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowZoneModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>PLACE ZONE</Text>
            <TouchableOpacity onPress={() => setShowZoneModal(false)} activeOpacity={0.7}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.zoneTileRow}>
            <TouchableOpacity
              style={styles.zoneTile}
              onPress={() => handleSelectZoneType('circle')}
              activeOpacity={0.75}
            >
              <View style={[styles.zoneTileIcon, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' }]}>
                <Text style={styles.zoneTileEmoji}>⭕</Text>
              </View>
              <Text style={styles.zoneTileLabel}>CIRCLE</Text>
              <Text style={styles.zoneTileSub}>Tap to set center & radius</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zoneTile}
              onPress={() => handleSelectZoneType('polygon')}
              activeOpacity={0.75}
            >
              <View style={[styles.zoneTileIcon, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' }]}>
                <Text style={styles.zoneTileEmoji}>📐</Text>
              </View>
              <Text style={styles.zoneTileLabel}>POLYGON</Text>
              <Text style={styles.zoneTileSub}>Tap points to draw shape</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </View>
    </Modal>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Sheet
  sheetBg: {
    backgroundColor: '#0f0f17',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a2a3a',
  },
  handleIndicator: {
    backgroundColor: '#3a3a4e',
    width: 40,
    height: 4,
  },

  // Collapsed peek row
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: COLLAPSED_H - 24,
  },
  peekGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  peekDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  peekGroupName: {
    color: '#e8e8f0',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    flex: 1,
  },
  peekBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  peekBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  peekToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    minWidth: 68,
  },
  peekToggleRowDark: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  peekToggleLabel: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  peekToggleLabelDark: {
    color: '#ef4444',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#22c55e',
  },
  tabText: {
    color: '#8888aa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tabTextActive: {
    color: '#22c55e',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  memberRole: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  memberMeta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  batteryText: {
    color: '#8888aa',
    fontSize: 10,
    fontWeight: '600',
  },
  lastSeen: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Groups tab
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#1e1e28',
    gap: 10,
  },
  groupRowActive: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  groupActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  groupRowInfo: {
    flex: 1,
    gap: 2,
  },
  groupRowName: {
    color: '#a0a0b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  groupRowNameActive: {
    color: '#e8e8f0',
  },
  groupRowType: {
    color: '#4a4a60',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  groupActiveLabel: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // Controls
  divider: {
    height: 1,
    backgroundColor: '#2a2a3a',
    marginVertical: 16,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  controlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  controlLabel: {
    color: '#e8e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  controlSubLabel: {
    color: '#8888aa',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#12121a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  actionBtnIcon: {
    fontSize: 20,
  },
  actionBtnLabel: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  actionBtnLabelActive: {
    color: '#22c55e',
  },

  // Invite code
  inviteCodeRow: {
    backgroundColor: '#12121a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 4,
    marginBottom: 8,
  },
  inviteCodeLabel: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  inviteCode: {
    color: '#4ADE80',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  inviteCodeCopy: {
    color: '#4a4a60',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyText: {
    color: '#e8e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#8888aa',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Go Dark block
  goDarkBlock: {
    backgroundColor: '#0a0a0f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  goDarkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goDarkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goDarkStatusLabel: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  goDarkStatusLabelDark: {
    color: '#ef4444',
  },
  goDarkStatusSub: {
    color: '#8888aa',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  goDarkBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  goDarkBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  goDarkBtnDisabled: {
    backgroundColor: '#1a1a24',
    borderColor: '#2a2a3a',
    opacity: 0.6,
  },
  goDarkBtnText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  goDarkBtnTextActive: {
    color: '#ffffff',
  },

  // Place marker button
  placeMarkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    paddingVertical: 13,
    gap: 8,
    marginBottom: 10,
  },
  placeMarkerBtnDisabled: {
    backgroundColor: 'rgba(42,42,58,0.5)',
    borderColor: '#2a2a3a',
  },
  placeMarkerIcon: {
    fontSize: 18,
  },
  placeMarkerLabel: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  placeMarkerLabelDisabled: {
    color: '#4a4a60',
  },

  // Marker picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f0f17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2a2a3a',
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a',
  },
  modalTitle: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalClose: {
    color: '#8888aa',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  markerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  markerTile: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 6,
  },
  markerTileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  markerTileEmoji: {
    fontSize: 22,
  },
  markerTileLabel: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },

  // Place zone button
  placeZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    paddingVertical: 13,
    gap: 8,
    marginBottom: 10,
  },
  placeZoneLabel: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Zone type picker
  zoneTileRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  zoneTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 14,
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 8,
  },
  zoneTileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  zoneTileEmoji: {
    fontSize: 26,
  },
  zoneTileLabel: {
    color: '#e8e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  zoneTileSub: {
    color: '#8888aa',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
