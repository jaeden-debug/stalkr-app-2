/**
 * SOSButton — floating hold-to-activate emergency button.
 *
 * Behaviour (matching Stalkr 1):
 *   • Press and hold for 3 seconds to trigger SOS
 *   • Animated red progress ring fills while holding
 *   • Releases early → ring resets
 *   • After trigger → 60-second cooldown before it can fire again
 *   • Wired to useSOSMode hook (which logs events and sends push notifications)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
import { useSOSMode } from '@/hooks/useSOSMode';
import { FEATURES } from '@/config/features';

const HOLD_MS = 3000;
const COOLDOWN_MS = 60_000;

export const SOSButton: React.FC = () => {
  const { triggerSOS } = useSOSMode();
  const [holding, setHolding] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [fired, setFired] = useState(false);

  // Progress 0 → 1 while holding
  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse animation when idle
  const idlePulse = useRef(new Animated.Value(1)).current;
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);

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
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const startHold = useCallback(() => {
    if (cooldown) return;
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
        setFired(true);
        setHolding(false);
        setCooldown(true);
        triggerSOS();
        progress.setValue(0);
        idleLoop.current?.start();
        cooldownTimer.current = setTimeout(() => {
          setCooldown(false);
          setFired(false);
        }, COOLDOWN_MS);
      }
    });
  }, [cooldown, triggerSOS, progress]);

  const cancelHold = useCallback(() => {
    holdAnim.current?.stop();
    holdAnim.current = null;
    setHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      idleLoop.current?.start();
    });
  }, [progress]);

  if (!FEATURES.SOS_MODE) return null;

  // Convert progress 0-1 → SVG-like stroke dashoffset equivalent
  // We use a simple approach: rotate a border-based arc
  const ringRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const buttonScale = holding
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
    : idlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

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
          {/* Progress ring — half-circle trick using rotation + clip */}
          {(holding || fired) && (
            <Animated.View
              style={[
                styles.progressRing,
                { transform: [{ rotate: ringRotation }] },
              ]}
            />
          )}
          {/* Button body */}
          <View
            style={[
              styles.button,
              holding && styles.buttonHolding,
              cooldown && styles.buttonCooldown,
            ]}
          >
            <Text style={styles.sosLabel}>SOS</Text>
            <Text style={styles.sosHint}>
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 148,
    left: 16,
    pointerEvents: 'box-none',
  },
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
  sosHint: {
    color: 'rgba(239,68,68,0.6)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1,
  },
});
