/**
 * JourneyOverduePrompt — "still on your way?"
 *
 * When a journey passes its expected arrival time the server nudges the
 * traveller before it tells anyone else. This is where that nudge is answered.
 *
 * It lives in the app rather than behind a notification tap for a reason: the
 * push may be missed, swiped, silenced, or arrive while the phone is face-down
 * in a pocket. The consequence of it going unanswered is that this person's
 * emergency contacts get alarmed, so the question has to be waiting whenever
 * they next look at their phone — not only in the three seconds the banner was
 * on screen.
 *
 * Answering is deliberately two-tap-free: extending is one tap, because someone
 * running late is busy, and the whole point is to make the honest answer
 * cheaper than ignoring it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/store/useSessionStore';
import { supabase } from '@/services/supabase';
import { C } from '@/constants/theme';

export const JourneyOverduePrompt: React.FC = () => {
  const session = useSessionStore((s) => s.activeJourneySession);
  const extendEta = useSessionStore((s) => s.extendJourneyEta);
  const markArrived = useSessionStore((s) => s.markArrived);
  const [busy, setBusy] = useState(false);

  const sessionId = session?.id ?? null;
  const state = session?.overdue_state ?? 'none';

  // The escalation happens server-side, so the app has to be told. Without this
  // the prompt would only appear after some unrelated refresh happened to pull
  // a fresh row.
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`session-overdue:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        ({ new: row }: { new: Record<string, unknown> }) => {
          useSessionStore.setState((st) =>
            st.activeJourneySession?.id === sessionId
              ? { activeJourneySession: { ...st.activeJourneySession, ...(row as object) } as never }
              : st,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  const onExtend = useCallback(
    async (minutes: number) => {
      if (!sessionId) return;
      setBusy(true);
      await extendEta(sessionId, minutes);
      setBusy(false);
    },
    [sessionId, extendEta],
  );

  const onArrived = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    await markArrived(sessionId);
    setBusy(false);
  }, [sessionId, markArrived]);

  if (!session || (state !== 'nudged' && state !== 'alerted')) return null;

  const alerted = state === 'alerted';

  return (
    <View style={[styles.wrap, alerted && styles.wrapAlerted]}>
      <View style={styles.row}>
        <Ionicons
          name={alerted ? 'alert-circle' : 'time-outline'}
          size={18}
          color={alerted ? C.red : C.green}
        />
        <Text style={styles.title}>
          {alerted ? 'Your watchers have been alerted' : 'Still on your way?'}
        </Text>
      </View>

      <Text style={styles.body}>
        {alerted
          ? 'You passed your expected arrival time, so the people watching your journey were told. Let them know you are safe.'
          : `You were due to arrive by now. Extend your time, or mark yourself arrived — otherwise we'll let your watchers know.`}
      </Text>

      {busy ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={() => onExtend(30)} activeOpacity={0.85}>
            <Text style={styles.btnText}>+30 MIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onExtend(60)} activeOpacity={0.85}>
            <Text style={styles.btnText}>+1 HR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onArrived} activeOpacity={0.85}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>I'VE ARRIVED</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 96,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.green,
    backgroundColor: 'rgba(8,8,8,0.94)',
  },
  wrapAlerted: { borderColor: C.red },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  body: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800' },
  btnPrimary: { borderColor: C.green, backgroundColor: C.green },
  btnPrimaryText: { color: '#000' },
});
