/**
 * SharingConsentPrompt — one-time, per-crew location-sharing decision.
 *
 * Location sharing defaults to DARK: an absent entry in
 * groupBroadcastingStatus means the member has never opted in, and an
 * un-opted-in member does not broadcast. That is the right fail-closed default,
 * but silently means a new crew shows you as dark with no explanation, and an
 * existing user who never touched the toggle goes dark on upgrade.
 *
 * This makes the transition explicit and consented rather than invisible.
 *
 * ── Why no extra "seen" state ───────────────────────────────────────────────
 * The absence of an entry IS the "never decided" signal. Answering either way
 * writes an explicit boolean, so the prompt cannot reappear for that crew. No
 * separate seen-flag to keep in sync, and no way for the two to disagree.
 */
import React, { useCallback } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGroupStore } from '@/store/useGroupStore';
import { useLocationStore } from '@/store/useLocationStore';
import { C } from '@/constants/theme';

export const SharingConsentPrompt: React.FC = () => {
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const crewName = useGroupStore(
    (s) => s.groups.find((g) => g.id === s.activeGroupId)?.name ?? 'this crew',
  );
  const enforced = useGroupStore(
    (s) => s.groups.find((g) => g.id === s.activeGroupId)?.tracking_mode === 'enforced',
  );

  // Undefined means no decision has been recorded for this crew yet.
  const undecided = useLocationStore((s) =>
    activeGroupId ? s.groupBroadcastingStatus[activeGroupId] === undefined : false,
  );
  const setGroupBroadcasting = useLocationStore((s) => s.setGroupBroadcasting);

  const decide = useCallback(
    (share: boolean) => {
      if (!activeGroupId) return;
      Haptics.selectionAsync().catch(() => {});
      setGroupBroadcasting(activeGroupId, share);
    },
    [activeGroupId, setGroupBroadcasting],
  );

  if (!activeGroupId || !undecided) return null;

  // An enforced crew leaves no choice to offer, but the member still deserves to
  // be told before their location starts transmitting.
  if (enforced) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={s.backdrop}>
          <View style={s.card}>
            <View style={[s.iconWrap, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' }]}>
              <Ionicons name="lock-closed" size={22} color="#f59e0b" />
            </View>
            <Text style={s.title}>{crewName} requires location sharing</Text>
            <Text style={s.body}>
              This crew has enforced tracking turned on, so your location is shared with its members
              while you are in it. You can leave the crew at any time.
            </Text>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={() => decide(true)} activeOpacity={0.85}>
              <Text style={s.btnPrimaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name="navigate" size={22} color={C.green} />
          </View>

          <Text style={s.title}>Share your location with {crewName}?</Text>
          <Text style={s.body}>
            Your crew will see where you are on the map. You are not sharing yet — Stalkr keeps you
            dark until you choose. You can change this any time from your own marker.
          </Text>

          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={() => decide(true)} activeOpacity={0.85}>
            <Text style={s.btnPrimaryText}>Start sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => decide(false)} activeOpacity={0.85}>
            <Text style={s.btnGhostText}>Stay dark for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#12161A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenDim,
    borderWidth: 1,
    borderColor: C.greenBorder,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  body: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13.5,
    lineHeight: 19.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: C.green },
  btnPrimaryText: { color: '#04140A', fontSize: 15, fontWeight: '800' },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  btnGhostText: { color: 'rgba(255,255,255,0.75)', fontSize: 14.5, fontWeight: '700' },
});
