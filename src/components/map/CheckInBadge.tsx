/**
 * CheckInBadge — floating pill on the map showing active check-in countdown.
 * Only visible when a check-in timer is active. Sits above the drawer.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCheckInTimer } from '@/hooks/useCheckInTimer';
import { C } from '@/constants/theme';
import { formatCountdown } from '@/utils/time';

export const CheckInBadge: React.FC = () => {
  const { activeTimer, confirmOk } = useCheckInTimer();
  const [countdown, setCountdown] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeTimer || activeTimer.is_resolved) return;
    const tick = () => setCountdown(formatCountdown(activeTimer.check_in_at));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeTimer?.id]);

  // Pulse red when < 5 minutes remain
  const isUrgent = (() => {
    if (!activeTimer) return false;
    const remaining = new Date(activeTimer.check_in_at).getTime() - Date.now();
    return remaining < 5 * 60_000;
  })();

  useEffect(() => {
    if (!isUrgent) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isUrgent]);

  if (!activeTimer || activeTimer.is_resolved) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <TouchableOpacity
        style={[s.pill, isUrgent && s.pillUrgent]}
        onPress={confirmOk}
        activeOpacity={0.85}
      >
        <Animated.View style={[s.dot, {
          backgroundColor: isUrgent ? C.red : C.amber,
          opacity: pulseAnim,
        }]} />
        <Ionicons
          name="timer-outline"
          size={14}
          color={isUrgent ? C.red : C.amber}
        />
        <View>
          <Text style={[s.label, { color: isUrgent ? C.red : C.amber }]}>
            CHECK-IN TIMER
          </Text>
          <Text style={s.countdown}>{countdown}</Text>
        </View>
        <View style={s.checkBtn}>
          <Text style={s.checkBtnText}>I'M OK</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    alignItems: 'center',
    pointerEvents: 'box-none',
  } as any,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(8,8,12,0.96)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.amberDim,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  pillUrgent: {
    borderColor: C.redBorder,
    shadowColor: C.red,
  },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  label:  { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  countdown: { color: C.textPrimary, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  checkBtn: {
    marginLeft: 6,
    backgroundColor: C.green,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  checkBtnText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
