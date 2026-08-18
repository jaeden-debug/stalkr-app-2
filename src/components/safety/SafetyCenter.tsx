/**
 * SafetyCenter — arm a check-in timer or dead-man switch, or stand down the
 * active one. Driven by useSafetyStore so the on-map badge stays in sync.
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { useSafetyStore } from '@/store/useSafetyStore';
import { useGroupStore } from '@/store/useGroupStore';
import { formatCountdown } from '@/utils/time';
import { C } from '@/constants/theme';

const PRESETS = [15, 30, 60];

export const SafetyCenter: React.FC = () => {
  const open = useSafetyStore((s) => s.centerOpen);
  const setOpen = useSafetyStore((s) => s.setCenterOpen);
  const activeTimer = useSafetyStore((s) => s.activeTimer);
  const arm = useSafetyStore((s) => s.arm);
  const confirm = useSafetyStore((s) => s.confirm);
  const cancel = useSafetyStore((s) => s.cancel);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);

  const [mode, setMode] = useState<'checkin' | 'deadman'>('checkin');
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => setCountdown(formatCountdown(activeTimer.check_in_at));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeTimer?.id]);

  const handleArm = () => {
    if (!activeGroupId) { Alert.alert('No active crew', 'Join or select a crew so it can be alerted if you miss a check-in.'); return; }
    const m = custom.trim() ? Math.max(1, parseInt(custom, 10) || 0) : minutes;
    if (!m) { Alert.alert('Pick an interval', 'Choose how long until your check-in is due.'); return; }
    // Awaited, and the sheet only closes on success. Previously this was
    // fire-and-forget: the sheet closed regardless, so a failed arm was
    // indistinguishable from a successful one.
    void (async () => {
      const armed = await arm(mode, m);
      if (armed) {
        setOpen(false);
      } else {
        Alert.alert(
          'Could not start your safety timer',
          'Your timer was not saved, so no one will be alerted if you miss it. Check your connection and try again.',
        );
      }
    })();
  };

  const handleStandDown = () => {
    Alert.alert('Stand down?', 'This turns off your active safety timer.', [
      { text: 'Keep active', style: 'cancel' },
      { text: 'Stand down', style: 'destructive', onPress: () => { cancel(); } },
    ]);
  };

  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title="Safety Center" snapHeight={activeTimer ? 380 : 520}>
      <View style={s.body}>
        {activeTimer ? (
          <>
            <View style={s.activeCard}>
              <View style={s.activeHead}>
                <Ionicons name={(activeTimer.mode ?? 'checkin') === 'deadman' ? 'pulse' : 'timer'} size={18} color={C.green} />
                <Text style={s.activeTitle}>{(activeTimer.mode ?? 'checkin') === 'deadman' ? 'DEAD-MAN SWITCH ACTIVE' : 'CHECK-IN TIMER ACTIVE'}</Text>
              </View>
              <Text style={s.countdown}>{countdown}</Text>
              <Text style={s.activeSub}>Confirm before it runs out, or your crew{(activeTimer.mode ?? 'checkin') === 'deadman' ? ' and emergency contacts' : ''} will be alerted.</Text>
            </View>
            <TouchableOpacity style={s.okBtn} onPress={() => { confirm(); setOpen(false); }} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color="#000" />
              <Text style={s.okText}>I'M OK — RESET TIMER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.standDown} onPress={handleStandDown} activeOpacity={0.85}>
              <Text style={s.standDownText}>STAND DOWN</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.sectionLabel}>MODE</Text>
            <View style={s.modeRow}>
              <TouchableOpacity style={[s.modeBtn, mode === 'checkin' && s.modeBtnActive]} onPress={() => setMode('checkin')} activeOpacity={0.85}>
                <Ionicons name="timer-outline" size={18} color={mode === 'checkin' ? C.green : 'rgba(255,255,255,0.5)'} />
                <Text style={[s.modeBtnText, mode === 'checkin' && { color: C.green }]}>CHECK-IN</Text>
                <Text style={s.modeDesc}>Reminds you to confirm you're OK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modeBtn, mode === 'deadman' && s.modeBtnActiveRed]} onPress={() => setMode('deadman')} activeOpacity={0.85}>
                <Ionicons name="pulse" size={18} color={mode === 'deadman' ? C.red : 'rgba(255,255,255,0.5)'} />
                <Text style={[s.modeBtnText, mode === 'deadman' && { color: C.red }]}>DEAD-MAN</Text>
                <Text style={s.modeDesc}>Auto-alerts crew + contacts if no response</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionLabel}>INTERVAL</Text>
            <View style={s.chipRow}>
              {PRESETS.map((p) => (
                <TouchableOpacity key={p} style={[s.chip, !custom && minutes === p && s.chipActive]} onPress={() => { setMinutes(p); setCustom(''); }} activeOpacity={0.85}>
                  <Text style={[s.chipText, !custom && minutes === p && s.chipTextActive]}>{p} min</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[s.customInput, !!custom && s.chipActive]}
                value={custom}
                onChangeText={setCustom}
                placeholder="Custom"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="number-pad"
                maxLength={4}
                selectionColor={C.green}
              />
            </View>

            <TouchableOpacity style={[s.armBtn, mode === 'deadman' && { backgroundColor: C.red }]} onPress={handleArm} activeOpacity={0.85}>
              <Ionicons name="shield-checkmark" size={18} color="#000" />
              <Text style={s.armText}>ARM {mode === 'deadman' ? 'DEAD-MAN SWITCH' : 'CHECK-IN'}</Text>
            </TouchableOpacity>
            <Text style={s.note}>If you don't confirm in time, your crew is alerted with your last known location. Works in the background; keep notifications enabled.</Text>
          </>
        )}
      </View>
    </Sheet>
  );
};

const s = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  sectionLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 12, gap: 4 },
  modeBtnActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  modeBtnActiveRed: { borderColor: C.redBorder, backgroundColor: C.redDim },
  modeBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  modeDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 10, lineHeight: 14 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: C.green },
  customInput: { minWidth: 84, paddingHorizontal: 14, height: 42, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  armBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  armText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  activeCard: { backgroundColor: C.greenDim, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 16, padding: 18, alignItems: 'center', gap: 6 },
  activeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeTitle: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  countdown: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  activeSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  okBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 16, paddingVertical: 16 },
  okText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  standDown: { alignItems: 'center', paddingVertical: 12 },
  standDownText: { color: C.red, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
