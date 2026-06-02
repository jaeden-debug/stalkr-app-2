/**
 * TacticalHud — tactical map overlay matching Stalkr 1 aesthetic.
 *
 * Layout:
 *   Top-left col  : STALKR brand pill · signal pill
 *   Top-center    : crew name + stealth state pill
 *   Top-right col : compass pill · CENTER pill
 *   Right-mid     : MAP / SAT toggle
 *   Top            : journey active band (blue, replaces crew pill)
 *   Bottom-center  : placement-mode banner (handled by MapControls)
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useHeading } from '@/hooks/useHeading';
import { getDistance, formatDistance } from '@/utils/distance';
import { C } from '@/constants/theme';
import { buildWatchUrl } from '@/services/sessions';

const PILL_W = 130;
const PILL_H = 42;

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useElapsedTime(startIso: string | null | undefined): string {
  const [elapsed, setElapsed] = React.useState('00:00');
  useEffect(() => {
    if (!startIso) { setElapsed('00:00'); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startIso]);
  return elapsed;
}

function usePulse(active: boolean, fast = false) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { anim.setValue(1); return; }
    const dur = fast ? 500 : 800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: dur, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: dur, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, fast]);
  return anim;
}

// ─── ETA helper ───────────────────────────────────────────────────────────────
function calcEta(
  myLat: number, myLng: number,
  destLat: number, destLng: number,
  speedMps: number,
): string | null {
  if (speedMps < 0.5) return null;
  const dist = getDistance(
    { latitude: myLat, longitude: myLng },
    { latitude: destLat, longitude: destLng },
  );
  const secs = dist / speedMps;
  if (secs > 86400) return null;
  const m = Math.round(secs / 60);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// ─── TacticalHud ─────────────────────────────────────────────────────────────
export const TacticalHud: React.FC = () => {
  const { magHeading, direction } = useHeading();

  const isSatellite     = useMapStore((s) => s.isSatellite);
  const toggleSatellite = useMapStore((s) => s.toggleSatellite);
  const triggerCenter   = useMapStore((s) => s.triggerCenterMap);
  const myLocation      = useMapStore((s) => s.myLocation);

  const groups       = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const activeGroup  = groups.find((g) => g.id === activeGroupId) ?? null;

  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);

  const activeJourney = useSessionStore((s) => s.activeJourneySession);
  const markArrived   = useSessionStore((s) => s.markArrived);
  const endSession    = useSessionStore((s) => s.endSession);
  const elapsed       = useElapsedTime(activeJourney?.started_at);

  const livePulse    = usePulse(isBroadcasting);
  const journeyPulse = usePulse(!!activeJourney, true);

  const handleCenter = useCallback(() => {
    if (myLocation) { Haptics.selectionAsync(); triggerCenter(); }
  }, [myLocation, triggerCenter]);

  const handleSat = useCallback((toSat: boolean) => {
    if (toSat !== isSatellite) { Haptics.selectionAsync(); toggleSatellite(); }
  }, [isSatellite, toggleSatellite]);

  const handleShareJourney = useCallback(async () => {
    if (!activeJourney) return;
    const url = buildWatchUrl(activeJourney.watch_token);
    try {
      await Share.share({
        title: 'Track my journey',
        message: `Follow ${activeJourney.traveler_name ?? 'me'} live → ${url}`,
        url,
      });
    } catch {}
  }, [activeJourney]);

  const handleEndJourney = useCallback(() => {
    if (!activeJourney) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    endSession(activeJourney.id);
  }, [activeJourney, endSession]);

  // ETA
  const eta = React.useMemo(() => {
    if (
      !activeJourney ||
      !myLocation ||
      activeJourney.destination_latitude == null ||
      activeJourney.destination_longitude == null
    ) return null;
    return calcEta(
      myLocation.latitude, myLocation.longitude,
      activeJourney.destination_latitude, activeJourney.destination_longitude,
      myLocation.heading >= 0 ? 0 : 0, // speed not in myLocation; skip for now
    );
  }, [activeJourney, myLocation]);

  // Distance to destination
  const distToDest = React.useMemo(() => {
    if (
      !activeJourney ||
      !myLocation ||
      activeJourney.destination_latitude == null ||
      activeJourney.destination_longitude == null
    ) return null;
    return formatDistance(getDistance(
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      { latitude: activeJourney.destination_latitude, longitude: activeJourney.destination_longitude },
    ));
  }, [activeJourney, myLocation]);

  return (
    <SafeAreaView style={s.root} pointerEvents="box-none">
      {/* Blackout gradient behind top pills */}
      <View style={s.topFade} pointerEvents="none" />

      <View style={s.topRow} pointerEvents="box-none">
        {/* ── Left col ── */}
        <View style={s.col} pointerEvents="box-none">
          <View style={s.pill}>
            <Text style={s.brand}>STALKR</Text>
          </View>
          <View style={[s.pill, { marginTop: 10 }]}>
            <Animated.View style={[s.dot, { backgroundColor: isBroadcasting ? C.green : C.red, opacity: livePulse }]} />
            <Text style={[s.pillSub, { color: isBroadcasting ? C.green : C.red }]}>
              {isBroadcasting ? 'LIVE' : 'DARK'}
            </Text>
          </View>
        </View>

        {/* ── Center — crew pill or journey pill ── */}
        <View style={s.centerCol} pointerEvents="none">
          {activeJourney ? (
            <View style={[s.crewPill, s.journeyPill]}>
              <Animated.View style={[s.dot, { backgroundColor: C.blue, opacity: journeyPulse }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.journeyLabel}>JOURNEY · {elapsed}</Text>
                <Text style={s.journeyDest} numberOfLines={1}>
                  {activeJourney.destination_name ?? activeJourney.name}
                </Text>
                {distToDest && (
                  <Text style={s.journeyMeta}>{distToDest} away</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={s.crewPill}>
              <View style={s.crewPillInner}>
                <Text style={s.crewLabel}>CREW</Text>
                <Text style={s.crewName} numberOfLines={1}>
                  {activeGroup?.name?.toUpperCase() ?? 'NO ACTIVE CREW'}
                </Text>
              </View>
            </View>
          )}

          {/* Journey action row */}
          {activeJourney && (
            <View style={s.journeyActions} pointerEvents="box-none">
              <TouchableOpacity style={s.journeyShareBtn} onPress={handleShareJourney} activeOpacity={0.8}>
                <Ionicons name="share-social" size={13} color={C.blue} />
                <Text style={[s.journeyBtnText, { color: C.blue }]}>SHARE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.journeyEndBtn} onPress={handleEndJourney} activeOpacity={0.8}>
                <Ionicons name="stop-circle" size={13} color={C.red} />
                <Text style={[s.journeyBtnText, { color: C.red }]}>END</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Right col ── */}
        <View style={[s.col, { alignItems: 'flex-end' }]} pointerEvents="box-none">
          <View style={s.pill}>
            <Text style={s.compass}>
              {direction} · {String(Math.round(magHeading)).padStart(3, '0')}°
            </Text>
          </View>
          <TouchableOpacity style={[s.pill, s.centerBtn]} onPress={handleCenter} activeOpacity={0.8}>
            <Text style={s.centerBtnText}>CENTER</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAP / SAT toggle — right mid ── */}
      <View style={s.satWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.satBtn, !isSatellite && s.satBtnActive]}
          onPress={() => handleSat(false)}
          activeOpacity={0.8}
        >
          <Text style={[s.satText, !isSatellite && s.satTextActive]}>MAP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.satBtn, isSatellite && s.satBtnActive]}
          onPress={() => handleSat(true)}
          activeOpacity={0.8}
        >
          <Text style={[s.satText, isSatellite && s.satTextActive]}>SAT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' } as any,

  topFade: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },

  col:       { width: PILL_W, gap: 0 },
  centerCol: { flex: 1, alignItems: 'center' },

  // Pills
  pill: {
    height: PILL_H,
    width: PILL_W,
    backgroundColor: 'rgba(14,14,20,0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  brand: {
    color: C.green,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pillSub: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  compass: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  centerBtn: {
    backgroundColor: C.green,
    borderColor: C.green,
    marginTop: 10,
  },
  centerBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  dot: {
    width: 7, height: 7, borderRadius: 4,
  },

  // Crew pill
  crewPill: {
    backgroundColor: 'rgba(14,14,20,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  crewPillInner: { alignItems: 'center' },
  crewLabel: {
    color: C.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  crewName: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Journey pill
  journeyPill: {
    borderColor: C.blueBorder,
    backgroundColor: 'rgba(6,18,40,0.97)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  journeyLabel: {
    color: C.blue,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  journeyDest: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  journeyMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },

  journeyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  journeyShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.blueDim,
    borderWidth: 1,
    borderColor: C.blueBorder,
    borderRadius: 999,
    paddingVertical: 8,
  },
  journeyEndBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.redDim,
    borderWidth: 1,
    borderColor: C.redBorder,
    borderRadius: 999,
    paddingVertical: 8,
  },
  journeyBtnText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // MAP / SAT toggle
  satWrap: {
    position: 'absolute',
    right: 14,
    top: '42%',
    backgroundColor: 'rgba(14,14,20,0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  satBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  satBtnActive: { backgroundColor: C.green },
  satText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  satTextActive: { color: '#000' },
});
