/**
 * TacticalHud — map overlay matching Stalkr 1's field-ops aesthetic.
 *
 * Layout:
 *   Top-left   : compass bearing pill (heading degrees + cardinal direction)
 *   Top-center : active group chip with live-dot pulse
 *   Top-right  : broadcasting status indicator
 *   Right-edge : center-on-me + satellite toggle buttons (mid-screen)
 *   Bottom     : active session/journey timer pill (above the drawer)
 *
 * Wired to: useMapStore, useGroupStore, useLocationStore, useSessionStore, useHeading
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useHeading } from '@/hooks/useHeading';

// ─── Elapsed-time hook ────────────────────────────────────────────────────────
function useElapsedTime(startIso: string | null | undefined): string {
  const [elapsed, setElapsed] = React.useState('00:00');
  useEffect(() => {
    if (!startIso) { setElapsed('00:00'); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) {
        setElapsed(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setElapsed(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startIso]);
  return elapsed;
}

// ─── Live-dot pulse animation ─────────────────────────────────────────────────
function usePulse(active: boolean) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { anim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return anim;
}

// ─── TacticalHud ─────────────────────────────────────────────────────────────
export const TacticalHud: React.FC = () => {
  const { magHeading, direction } = useHeading();

  // Map
  const isSatellite = useMapStore((s) => s.isSatellite);
  const toggleSatellite = useMapStore((s) => s.toggleSatellite);
  const triggerCenterMap = useMapStore((s) => s.triggerCenterMap);
  const myLocation = useMapStore((s) => s.myLocation);

  // Group
  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const groupMembers = useGroupStore((s) => s.groupMembers);
  const liveCount = useLocationStore((s) =>
    Object.values(s.crewLocations).filter((m) => m.status === 'live').length,
  );

  // Broadcasting
  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);

  // Active session
  const activeSession = useSessionStore((s) => s.activeSession);
  const sessionElapsed = useElapsedTime(activeSession?.started_at);

  // Animations
  const livePulse = usePulse(isBroadcasting);
  const sessionPulse = usePulse(!!activeSession);

  const handleCenter = useCallback(() => {
    if (myLocation) triggerCenterMap();
  }, [myLocation, triggerCenterMap]);

  return (
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">

      {/* ── Top bar ── */}
      <View style={styles.topBar} pointerEvents="box-none">

        {/* Compass pill */}
        <View style={styles.compassPill} pointerEvents="none">
          <Text style={styles.compassDeg}>{String(Math.round(magHeading)).padStart(3, '0')}°</Text>
          <Text style={styles.compassDir}>{direction}</Text>
        </View>

        {/* Group chip */}
        {activeGroup ? (
          <View style={styles.groupChip} pointerEvents="none">
            <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
            <Text style={styles.groupName} numberOfLines={1}>
              {activeGroup.name.toUpperCase()}
            </Text>
            {groupMembers.length > 0 && (
              <Text style={styles.memberCount}>{groupMembers.length}</Text>
            )}
          </View>
        ) : (
          <View style={styles.groupChipEmpty} pointerEvents="none">
            <Text style={styles.groupNameEmpty}>NO CREW</Text>
          </View>
        )}

        {/* Broadcasting status */}
        <View style={styles.broadcastPill} pointerEvents="none">
          {isBroadcasting ? (
            <>
              <Animated.View style={[styles.broadcastDot, { opacity: livePulse }]} />
              <Text style={styles.broadcastLabel}>LIVE</Text>
            </>
          ) : (
            <>
              <View style={styles.broadcastDotOff} />
              <Text style={styles.broadcastLabelOff}>OFF</Text>
            </>
          )}
        </View>
      </View>

      {/* ── Right-side controls ── */}
      <View style={styles.rightControls} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleCenter}
          activeOpacity={0.75}
        >
          <Text style={styles.controlIcon}>⊕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isSatellite && styles.controlBtnActive]}
          onPress={toggleSatellite}
          activeOpacity={0.75}
        >
          <Text style={styles.controlIcon}>🛰</Text>
        </TouchableOpacity>
      </View>

      {/* ── Active session pill ── */}
      {activeSession && (
        <Animated.View style={[styles.sessionPill, { opacity: sessionPulse }]} pointerEvents="none">
          <View style={styles.sessionDot} />
          <Text style={styles.sessionLabel}>
            {activeSession.name.toUpperCase()}
          </Text>
          <Text style={styles.sessionTimer}>{sessionElapsed}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },

  // Compass
  compassPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(10,10,15,0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 4,
    minWidth: 72,
  },
  compassDeg: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  compassDir: {
    color: '#8888aa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Group chip
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.88)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 7,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 200,
  },
  groupChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.7)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    flex: 1,
    justifyContent: 'center',
    maxWidth: 200,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
  },
  groupName: {
    color: '#e8e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    flex: 1,
    textAlign: 'center',
  },
  groupNameEmpty: {
    color: '#4a4a60',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  memberCount: {
    color: '#8888aa',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1a1a24',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  // Broadcasting pill
  broadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.88)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 5,
    minWidth: 56,
    justifyContent: 'center',
  },
  broadcastDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
  },
  broadcastDotOff: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4a4a60',
  },
  broadcastLabel: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  broadcastLabelOff: {
    color: '#4a4a60',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // Right controls
  rightControls: {
    position: 'absolute',
    right: 14,
    top: '40%',
    gap: 10,
  },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  controlBtnActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  controlIcon: {
    fontSize: 20,
  },

  // Session pill
  sessionPill: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.92)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  sessionLabel: {
    color: '#e8e8f0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    maxWidth: 140,
  },
  sessionTimer: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
