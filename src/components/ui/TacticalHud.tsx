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
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useHeading } from '@/hooks/useHeading';
import { getDistance, formatDistanceBoth } from '@/utils/distance';
import { formatSpeed } from '@/utils/heading';
import { C } from '@/constants/theme';
import { buildWatchUrl } from '@/services/sessions';

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

  const activeJourney = useSessionStore((s) => s.activeJourneySession);
  const endSession    = useSessionStore((s) => s.endSession);
  const elapsed       = useElapsedTime(activeJourney?.started_at);

  const journeyPulse = usePulse(!!activeJourney, true);

  const handleCenter = useCallback(() => {
    if (myLocation) { Haptics.selectionAsync(); triggerCenter(); }
  }, [myLocation, triggerCenter]);

  const toggleMapType = useCallback(() => {
    Haptics.selectionAsync();
    toggleSatellite();
  }, [toggleSatellite]);

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

  // ETA / arrival time / speed (live)
  const etaInfo = React.useMemo(() => {
    if (
      !activeJourney || !myLocation ||
      activeJourney.destination_latitude == null ||
      activeJourney.destination_longitude == null
    ) return null;
    const spd = myLocation.speed ?? 0;
    if (spd < 0.5) return null;
    const dist = getDistance(
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      { latitude: activeJourney.destination_latitude, longitude: activeJourney.destination_longitude },
    );
    const secs = dist / spd;
    if (secs > 86400) return null;
    const mins = Math.round(secs / 60);
    const label = mins < 1 ? '< 1 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    const arrival = new Date(Date.now() + secs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { label, arrival, speed: spd };
  }, [activeJourney, myLocation]);

  // Distance to destination
  const distToDest = React.useMemo(() => {
    if (
      !activeJourney ||
      !myLocation ||
      activeJourney.destination_latitude == null ||
      activeJourney.destination_longitude == null
    ) return null;
    return formatDistanceBoth(getDistance(
      { latitude: myLocation.latitude, longitude: myLocation.longitude },
      { latitude: activeJourney.destination_latitude, longitude: activeJourney.destination_longitude },
    ));
  }, [activeJourney, myLocation]);

  return (
    <SafeAreaView style={s.root} pointerEvents="box-none">
      {/* Blackout gradient behind the header */}
      <View style={s.topFade} pointerEvents="none" />

      {/* ── Single header bar: STALKR · crew · compass (glass) ── */}
      <BlurView intensity={95} tint="dark" style={s.header} pointerEvents="box-none">
        <Text style={s.brand}>STALKR</Text>
        <Text style={s.crewName} numberOfLines={1}>
          {activeGroup?.name?.toUpperCase() ?? 'NO ACTIVE CREW'}
        </Text>
        <View style={s.compassWrap}>
          <Text style={s.compass}>
            {direction} · {String(Math.round(magHeading)).padStart(3, '0')}°
          </Text>
        </View>
      </BlurView>

      {/* ── Active journey band (below header) ── */}
      {activeJourney && (
        <BlurView intensity={95} tint="dark" style={s.journeyBand} pointerEvents="box-none">
          <Animated.View style={[s.dot, { backgroundColor: C.blue, opacity: journeyPulse }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.journeyLabel}>JOURNEY · {elapsed}</Text>
            <Text style={s.journeyDest} numberOfLines={1}>
              {activeJourney.destination_name ?? activeJourney.name}
            </Text>
            <Text style={s.journeyMeta} numberOfLines={1}>
              {distToDest ? `${distToDest} left` : 'En route'}
              {etaInfo ? `  ·  ETA ${etaInfo.label}  ·  ${etaInfo.arrival}` : ''}
            </Text>
            {etaInfo && (
              <Text style={s.journeyMeta} numberOfLines={1}>{formatSpeed(etaInfo.speed)}</Text>
            )}
            {/* The DEADLINE the traveller set, which is distinct from the
                speed-derived ETA above. This is what overdue detection fires
                against, so it has to be visible — a nudge whose deadline the
                traveller never saw arrives as an ambush. */}
            {!!activeJourney.eta_at && (
              <Text
                style={[
                  s.journeyMeta,
                  Date.now() > new Date(activeJourney.eta_at).getTime() && { color: C.red },
                ]}
                numberOfLines={1}
              >
                {Date.now() > new Date(activeJourney.eta_at).getTime()
                  ? 'PAST YOUR EXPECTED ARRIVAL'
                  : `Due by ${new Date(activeJourney.eta_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
              </Text>
            )}
          </View>
          <TouchableOpacity style={s.journeyShareBtn} onPress={handleShareJourney} activeOpacity={0.8}>
            <Ionicons name="share-social" size={13} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={s.journeyEndBtn} onPress={handleEndJourney} activeOpacity={0.8}>
            <Ionicons name="stop-circle" size={13} color={C.red} />
            <Text style={[s.journeyBtnText, { color: C.red }]}>END</Text>
          </TouchableOpacity>
        </BlurView>
      )}

      {/* ── Right control stack: map/satellite toggle + center button (glass) ── */}
      <View style={s.rightControls} pointerEvents="box-none">
        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={toggleMapType}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isSatellite ? 'Switch to map view' : 'Switch to satellite view'}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Ionicons name={isSatellite ? 'earth' : 'map'} size={22} color={isSatellite ? C.blue : C.green} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={handleCenter}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Center on my location"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Ionicons name="locate" size={22} color={C.green} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={() => { Haptics.selectionAsync(); useMapStore.getState().setFilterSheetOpen(true); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Map layers"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Ionicons name="layers" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={() => { Haptics.selectionAsync(); useMapStore.getState().startMeasure(); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Measure distance"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Ionicons name="resize" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' } as any,

  topFade: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 150,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  // ── Single header bar (BlurView glass — matches NavigationDrawer) ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 8,
    height: 46,
    paddingHorizontal: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,16,0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  brand: {
    color: C.green,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    width: 78,
  },
  crewName: {
    flex: 1,
    textAlign: 'center',
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  compassWrap: { width: 78, alignItems: 'flex-end' },
  compass: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },

  dot: { width: 8, height: 8, borderRadius: 4 },

  // ── Active journey band ──
  journeyBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,18,40,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.blueBorder,
  },
  journeyLabel: { color: C.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  journeyDest: { color: C.textPrimary, fontSize: 14, fontWeight: '900', marginTop: 2 },
  journeyMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', marginTop: 1 },
  journeyShareBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.blueDim, borderWidth: 1, borderColor: C.blueBorder,
  },
  journeyEndBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, height: 38, borderRadius: 19,
    backgroundColor: C.redDim, borderWidth: 1, borderColor: C.redBorder,
  },
  journeyBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },

  // ── Right control stack: map/satellite toggle + center ──
  rightControls: {
    position: 'absolute',
    right: 14,
    top: '40%',
    gap: 12,
  },
  ctrlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,16,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
});
