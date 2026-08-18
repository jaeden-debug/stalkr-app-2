/**
 * SOSButton — deliberate hold-to-arm emergency control.
 *
 * ── Safety model ────────────────────────────────────────────────────────────
 * SOS is safety-critical in BOTH directions: it must fire when someone needs
 * it, and it must never fire because a phone brushed a pocket. The gate is:
 *
 *     press and hold ─► uninterrupted 5s ─► confirm dialog ─► activation
 *
 * A tap does nothing. Releasing early does nothing. Sliding off the button,
 * backgrounding the app, or unmounting the screen all cancel immediately, and
 * no timer can survive to fire later.
 *
 * The hold was previously 3s and — more seriously — nothing cancelled it on
 * unmount or backgrounding, so a hold interrupted by an incoming call could
 * still surface the confirm dialog afterwards.
 *
 * ── Honesty ─────────────────────────────────────────────────────────────────
 * Activation reports what actually happened. "Your crew has been alerted" is
 * only shown when the push endpoint accepted the dispatch; a persisted-but-
 * undispatched SOS and a device-only SOS say so explicitly.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSOSMode, type SosActivationResult } from '@/hooks/useSOSMode';
import { FEATURES } from '@/config/features';

/** Deliberate hold required before the confirmation gate. */
const HOLD_MS = 5000;
const HOLD_SECONDS = HOLD_MS / 1000;
/** Finger travel that cancels the hold. */
const MAX_SLIDE_PX = 24;
const COOLDOWN_MS = 60_000;

export const SOSButton: React.FC = () => {
  const { triggerSOS, dismissSOS } = useSOSMode();

  const [holding, setHolding] = useState(false);
  const [remaining, setRemaining] = useState(HOLD_SECONDS);
  const [sosActive, setSosActive] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [lastResult, setLastResult] = useState<SosActivationResult | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * One gesture may produce at most one activation. Guards against a second
   * ACTIVE event, a re-entrant confirm, or a double tap racing the dialog.
   */
  const armedRef = useRef(false);
  const mountedRef = useRef(true);

  const idlePulse = useRef(new Animated.Value(1)).current;
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);
  const activePulse = useRef(new Animated.Value(1)).current;
  const activeLoop = useRef<Animated.CompositeAnimation | null>(null);

  /** Tear down every hold-related timer. Safe to call repeatedly. */
  const clearHoldTimers = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = null; }
    holdAnim.current?.stop();
    holdAnim.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    idleLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(idlePulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    );
    idleLoop.current.start();

    return () => {
      // Unmount must kill the hold. Without this a pending timer could fire the
      // confirm dialog after the user had already navigated away.
      mountedRef.current = false;
      armedRef.current = false;
      clearHoldTimers();
      idleLoop.current?.stop();
      activeLoop.current?.stop();
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, [idlePulse, clearHoldTimers]);

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

  const cancelHold = useCallback(() => {
    // onPressOut fires on every release, including ones where no hold started
    // (cooldown, already active). Bail out rather than churning state.
    if (!armedRef.current) return;
    clearHoldTimers();
    armedRef.current = false;
    if (!mountedRef.current) return;
    setHolding(false);
    setRemaining(HOLD_SECONDS);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false })
      .start(() => idleLoop.current?.start());
  }, [clearHoldTimers, progress]);

  // Backgrounding, an incoming call, or the app being interrupted cancels.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active' && armedRef.current) cancelHold();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [cancelHold]);

  /** Reached only after a full, uninterrupted hold. */
  const onHoldComplete = useCallback(() => {
    clearHoldTimers();
    if (!mountedRef.current || !armedRef.current) return;
    armedRef.current = false;

    setHolding(false);
    setRemaining(HOLD_SECONDS);
    progress.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

    // The hold is an ADDITIONAL gate — it does not replace the confirmation
    // step, which remains the last chance to back out.
    Alert.alert(
      'Send SOS?',
      'This alerts your crew and opens a message to your emergency contacts with your location.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => idleLoop.current?.start() },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setSosActive(true);
            startActiveLoop();
            const result = await triggerSOS();
            if (!mountedRef.current) return;
            setLastResult(result);

            // Report what actually happened, never a blanket success claim.
            if (result.dispatched) {
              Alert.alert(
                'SOS ACTIVE',
                `Your crew has been alerted (${result.recipients} ${result.recipients === 1 ? 'device' : 'devices'}).` +
                  (result.hasLocation ? '' : '\n\nNo GPS fix yet — your location was not included.') +
                  (result.smsComposerOpened ? '\n\nSend the emergency-contact message to notify them too.' : ''),
              );
            } else if (result.persisted) {
              Alert.alert(
                'SOS ACTIVE — alert not confirmed',
                'Your SOS was recorded and your crew will see it when they reconnect, but we could not confirm a push alert was sent. Contact someone directly if you can.',
              );
            } else {
              Alert.alert(
                'SOS ACTIVE ON THIS DEVICE ONLY',
                'We could not reach the server, so your crew may not have been alerted. Contact someone directly if you can.',
              );
            }
          },
        },
      ],
    );
  }, [clearHoldTimers, progress, startActiveLoop, triggerSOS]);

  const startHold = useCallback(() => {
    if (cooldown || sosActive || armedRef.current) return;
    armedRef.current = true;

    setHolding(true);
    setRemaining(HOLD_SECONDS);
    idleLoop.current?.stop();
    progress.setValue(0);

    holdAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holdAnim.current.start();

    // The countdown is driven by real timers rather than the animation's
    // completion callback, so a stopped animation can never complete the hold.
    const startedAt = Date.now();
    tickTimer.current = setInterval(() => {
      const left = Math.max(0, HOLD_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      if (mountedRef.current) setRemaining(left);
      if (left > 0) Haptics.selectionAsync().catch(() => {});
    }, 1000);

    holdTimer.current = setTimeout(onHoldComplete, HOLD_MS);
  }, [cooldown, sosActive, progress, onHoldComplete]);

  const handleCancelSOS = useCallback(() => {
    Alert.alert('Cancel SOS?', 'This will notify your crew that you are safe.', [
      { text: 'Keep SOS Active', style: 'cancel' },
      {
        text: 'Yes, Cancel SOS',
        style: 'destructive',
        onPress: () => {
          dismissSOS();
          setSosActive(false);
          setLastResult(null);
          setCooldown(true);
          stopActiveLoop();
          cooldownTimer.current = setTimeout(() => {
            if (mountedRef.current) setCooldown(false);
          }, COOLDOWN_MS);
        },
      },
    ]);
  }, [dismissSOS, stopActiveLoop]);

  if (!FEATURES.SOS_MODE) return null;

  const ringRotation = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const buttonScale = sosActive
    ? activePulse
    : holding
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
      : idlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  // ── Active SOS ────────────────────────────────────────────────────────────
  if (sosActive) {
    const unconfirmed = lastResult != null && !lastResult.dispatched;
    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity
          onPress={handleCancelSOS}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="SOS is active. Tap to cancel."
        >
          <Animated.View style={[styles.cancelWrapper, { transform: [{ scale: activePulse }] }]}>
            <View style={styles.cancelButton}>
              <Text style={styles.cancelLabel}>SOS</Text>
              <Text style={styles.cancelSub}>TAP TO CANCEL</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
        <View style={[styles.statusPill, unconfirmed && styles.statusPillWarn]}>
          <Text style={[styles.statusText, unconfirmed && styles.statusTextWarn]} numberOfLines={2}>
            {unconfirmed ? 'ALERT NOT CONFIRMED' : 'CREW ALERTED'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Idle / holding / cooldown ─────────────────────────────────────────────
  return (
    <View style={styles.container} pointerEvents="box-none">
      {holding && (
        <View style={styles.holdCoach} pointerEvents="none">
          <Text style={styles.holdCoachText}>Hold for SOS</Text>
          <Text style={styles.holdCoachCount}>{remaining}</Text>
        </View>
      )}

      {/* Pressable, not LongPressGestureHandler.
          The gesture-handler version was the LEGACY RNGH API, and under the New
          Architecture its onHandlerStateChange did not reliably deliver the END
          state — so releasing early never cancelled and the countdown ran to
          completion anyway. The "hold" was cosmetic: a tap armed SOS.

          onPressIn/onPressOut are deterministic and map exactly to the
          requirement: count down only while held, stop the instant you let go.
          pressRetentionOffset is zeroed so sliding off the button counts as
          releasing rather than keeping the press alive. */}
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        pressRetentionOffset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        hitSlop={0}
        accessibilityRole="button"
        accessibilityLabel={`SOS. Hold for ${HOLD_SECONDS} seconds to arm.`}
        accessibilityHint="A tap will not activate SOS."
      >
        <Animated.View style={[styles.wrapper, { transform: [{ scale: buttonScale }] }]}>
          {holding && (
            <Animated.View style={[styles.progressRing, { transform: [{ rotate: ringRotation }] }]} />
          )}
          <View
            style={[styles.button, holding && styles.buttonHolding, cooldown && styles.buttonCooldown]}
          >
            <Text style={[styles.sosLabel, cooldown && styles.sosLabelCooldown]}>
              {holding ? remaining : 'SOS'}
            </Text>
            <Text style={[styles.sosHint, cooldown && styles.sosHintCooldown]}>
              {cooldown ? 'WAIT' : holding ? 'KEEP HOLDING' : `HOLD ${HOLD_SECONDS}s`}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const BUTTON_SIZE = 64;
const RING_SIZE = BUTTON_SIZE + 14;
const CANCEL_SIZE = 80;

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 148, left: 16, pointerEvents: 'box-none' },

  holdCoach: {
    position: 'absolute',
    bottom: RING_SIZE + 10,
    left: -8,
    minWidth: RING_SIZE + 16,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  holdCoachText: { color: '#fca5a5', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  holdCoachCount: { color: '#ef4444', fontSize: 22, fontWeight: '900', lineHeight: 26 },

  wrapper: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
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
  sosLabel: { color: '#ef4444', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  sosLabelCooldown: { color: '#6b7280' },
  sosHint: {
    color: 'rgba(239,68,68,0.6)',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  sosHintCooldown: { color: 'rgba(107,114,128,0.6)' },

  cancelWrapper: { alignItems: 'center', justifyContent: 'center' },
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
  cancelLabel: { color: '#ef4444', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  cancelSub: {
    color: 'rgba(239,68,68,0.75)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
    textAlign: 'center',
  },

  statusPill: {
    marginTop: 8,
    maxWidth: CANCEL_SIZE + 40,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusPillWarn: { borderColor: '#f59e0b' },
  statusText: { color: '#fca5a5', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  statusTextWarn: { color: '#fbbf24' },
});
