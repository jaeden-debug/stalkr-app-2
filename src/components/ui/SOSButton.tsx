/**
 * SOSButton — floating hold-to-activate emergency button.
 *
 * States:
 *   idle     → pulse animation, hold 3s to trigger
 *   holding  → red ring fills while held
 *   active   → SOS fired; shows "CANCEL SOS" tap target
 *   cooldown → 60s after cancel before re-arm
 *
 * Wired to useSOSMode (logs group event, pushes crew).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSOSMode } from '@/hooks/useSOSMode';
import { FEATURES } from '@/config/features';

const HOLD_MS = 3000;
const COOLDOWN_MS = 60_000;

export const SOSButton: React.FC = () => {
  const { triggerSOS, dismissSOS } = useSOSMode();

  const [holding, setHolding] = useState(false);
  const [sosActive, setSosActive] = useState(false); // SOS has fired and not yet cancelled
  const [cooldown, setCooldown] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse animation when idle
  const idlePulse = useRef(new Animated.Value(1)).current;
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Active SOS pulse — faster, more urgent
  const activePulse = useRef(new Animated.Value(1)).current;
  const activeLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    idleLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(idlePulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    );
    idleLoop.current.start();
    return () => {
      idleLoop.current?.stop();
      activeLoop.current?.stop();
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const startActiveLoop = useCallback(() => {
    idleLoop.current?.stop();
    activeLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(activePulse, { toValue: 0.95, duration: 600, useNativeDriver: true }),
      ]),
    );
    activeLoop.current.start();
  }, [activePulse]);

  const stopActiveLoop = useCallback(() => {
    activeLoop.current?.stop();
    activePulse.setValue(1);
    idleLoop.current?.start();
  }, [activePulse]);

  const startHold = useCallback(() => {
    if (cooldown || sosActive) return;
    setHolding(true);
    idleLoop.current?.stop();
    progress.setValue(0);
    holdAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) {
        setHolding(false);
        progress.setValue(0);
        // ALWAYS confirm before activating — SOS was being tripped accidentally.
        // Strong warning haptic + an explicit confirm dialog.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(
          'Send SOS?',
          'This alerts your crew and emergency contacts with your live location.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => idleLoop.current?.start() },
            {
              text: 'Send SOS',
              style: 'destructive',
              onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setSosActive(true);
                triggerSOS();
                startActiveLoop();
              },
            },
          ],
        );
      }
    });
  }, [cooldown, sosActive, triggerSOS, progress, startActiveLoop]);

  const cancelHold = useCallback(() => {
    holdAnim.current?.stop();
    holdAnim.current = null;
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false })
      .start(() => idleLoop.current?.start());
  }, [progress]);

  const handleCancelSOS = useCallback(() => {
    Alert.alert(
      'Cancel SOS?',
      'This will notify your crew that you are safe.',
      [
        { text: 'Keep SOS Active', style: 'cancel' },
        {
          text: 'Yes, Cancel SOS',
          style: 'destructive',
          onPress: () => {
            dismissSOS();
            setSosActive(false);
            setCooldown(true);
            stopActiveLoop();
            cooldownTimer.current = setTimeout(() => {
              setCooldown(false);
            }, COOLDOWN_MS);
          },
        },
      ],
    );
  }, [dismissSOS, stopActiveLoop]);

  if (!FEATURES.SOS_MODE) return null;

  const ringRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const buttonScale = sosActive
    ? activePulse
    : holding
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
    : idlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  // ── Active SOS state — large cancel button ─────────────────────────────────
  if (sosActive) {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity onPress={handleCancelSOS} activeOpacity={0.85}>
          <Animated.View style={[styles.cancelWrapper, { transform: [{ scale: activePulse }] }]}>
            <View style={styles.cancelButton}>
              <Text style={styles.cancelLabel}>🆘 SOS</Text>
              <Text style={styles.cancelSub}>TAP TO CANCEL</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Idle / holding / cooldown state ───────────────────────────────────────
  return (
    <View style={styles.container} pointerEvents="box-none">
      <LongPressGestureHandler
        minDurationMs={0}
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE || nativeEvent.state === State.BEGAN) {
            startHold();
          } else if (
            nativeEvent.state === State.END ||
            nativeEvent.state === State.CANCELLED ||
            nativeEvent.state === State.FAILED
          ) {
            if (holding) cancelHold();
          }
        }}
      >
        <Animated.View style={[styles.wrapper, { transform: [{ scale: buttonScale }] }]}>
          {holding && (
            <Animated.View
              style={[styles.progressRing, { transform: [{ rotate: ringRotation }] }]}
            />
          )}
          <View
            style={[
              styles.button,
              holding && styles.buttonHolding,
              cooldown && styles.buttonCooldown,
            ]}
          >
            <Text style={[styles.sosLabel, cooldown && styles.sosLabelCooldown]}>SOS</Text>
            <Text style={[styles.sosHint, cooldown && styles.sosHintCooldown]}>
              {cooldown ? 'WAIT' : holding ? 'HOLD' : 'HOLD'}
            </Text>
          </View>
        </Animated.View>
      </LongPressGestureHandler>
    </View>
  );
};

const BUTTON_SIZE = 64;
const RING_SIZE = BUTTON_SIZE + 14;
const CANCEL_SIZE = 80;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 148,
    left: 16,
    pointerEvents: 'box-none',
  },

  // ── Idle/hold/cooldown ────────────────────────────────────────────────────
  wrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ef4444',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonHolding: {
    backgroundColor: 'rgba(239,68,68,0.35)',
    borderColor: '#ff6b6b',
    shadowOpacity: 0.7,
    shadowRadius: 14,
  },
  buttonCooldown: {
    backgroundColor: 'rgba(75,85,99,0.3)',
    borderColor: '#4b5563',
    shadowOpacity: 0,
  },
  sosLabel: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sosLabelCooldown: { color: '#6b7280' },
  sosHint: {
    color: 'rgba(239,68,68,0.6)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1,
  },
  sosHintCooldown: { color: 'rgba(107,114,128,0.6)' },

  // ── Active SOS cancel button ──────────────────────────────────────────────
  cancelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    width: CANCEL_SIZE,
    height: CANCEL_SIZE,
    borderRadius: CANCEL_SIZE / 2,
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 2.5,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
  cancelLabel: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelSub: {
    color: 'rgba(239,68,68,0.75)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
    textAlign: 'center',
  },
});
