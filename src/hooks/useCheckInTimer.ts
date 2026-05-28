/**
 * Safety Check-In Timer — user sets "check on me in N minutes."
 * If not resolved, alerts are sent to group admins / selected users.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { createCheckInTimer, resolveCheckInTimer, fetchActiveTimer, deleteCheckInTimer } from '@/services/checkInTimers';
import { sendLocalNotification, sendPushNotification } from '@/services/notifications';
import { logEvent } from '@/services/groupEvents';
import { formatCountdown } from '@/utils/time';
import { FEATURES } from '@/config/features';
import type { CheckInTimer } from '@/types/models';

export function useCheckInTimer() {
  const [activeTimer, setActiveTimer] = useState<CheckInTimer | null>(null);
  const [countdown, setCountdown] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupMembers = useGroupStore((s) => s.groupMembers);

  // Reload timer on mount
  useEffect(() => {
    if (!FEATURES.CHECKIN_TIMER || !userId) return;
    fetchActiveTimer(userId).then(setActiveTimer).catch(() => {});
  }, [userId]);

  // Countdown interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeTimer || activeTimer.is_resolved) return;

    intervalRef.current = setInterval(() => {
      const remaining = formatCountdown(activeTimer.check_in_at);
      setCountdown(remaining);

      const now = Date.now();
      const target = new Date(activeTimer.check_in_at).getTime();

      if (now >= target) {
        clearInterval(intervalRef.current!);
        handleTimerExpired(activeTimer);
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer]);

  const handleTimerExpired = async (timer: CheckInTimer) => {
    // Local alert
    await sendLocalNotification(
      '⚠️ Check-In Missed',
      timer.label ? `"${timer.label}" check-in was not confirmed.` : 'Your safety check-in was not confirmed.',
      { type: 'checkin_missed' },
      'safety',
    );
    // Log group event
    if (userId && activeGroupId) {
      await logEvent(
        activeGroupId,
        userId,
        'checkin_timer_missed',
        'Check-in missed',
        `A safety check-in was not confirmed.`,
      );
    }
    setActiveTimer((t) => (t ? { ...t, is_resolved: true } : null));
  };

  const startTimer = useCallback(async (minutes: number, label?: string) => {
    if (!FEATURES.CHECKIN_TIMER || !userId) return null;
    const adminIds = groupMembers
      .filter((m) => m.role === 'owner' || m.role === 'admin')
      .map((m) => m.user_id);

    const timer = await createCheckInTimer(userId, minutes, adminIds, activeGroupId, label ?? null);
    if (timer) {
      setActiveTimer(timer);
      await sendLocalNotification(
        '✓ Check-In Timer Set',
        `You will be checked in ${minutes} minutes.`,
        { type: 'checkin_set' },
        'safety',
      );
    }
    return timer;
  }, [userId, activeGroupId, groupMembers]);

  const confirmOk = useCallback(async () => {
    if (!activeTimer) return;
    await resolveCheckInTimer(activeTimer.id);
    setActiveTimer(null);
    setCountdown('');
    await sendLocalNotification('✓ Check-In Confirmed', 'You are confirmed safe.', { type: 'checkin_confirmed' });
  }, [activeTimer]);

  const cancelTimer = useCallback(async () => {
    if (!activeTimer) return;
    await deleteCheckInTimer(activeTimer.id);
    setActiveTimer(null);
    setCountdown('');
  }, [activeTimer]);

  return { activeTimer, countdown, startTimer, confirmOk, cancelTimer };
}
