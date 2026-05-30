/**
 * Invite deep link handler — stalkr://invite/CODE
 *
 * Flow:
 *   1. Read invite code from URL params
 *   2. Show confirmation prompt with group name (fetched via code lookup)
 *   3. On confirm — call joinByInviteCode, navigate to map
 *   4. If not signed in — redirect to login with the code preserved
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { joinGroupByInviteCode } from '@/services/groups';
import { supabase } from '@/services/supabase';
import { track } from '@/services/analytics';

type Phase = 'loading' | 'confirm' | 'joining' | 'error';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const userId = useAuthStore((s) => s.user?.id);
  const joinByInviteCode = useGroupStore((s) => s.joinByInviteCode);

  const [phase, setPhase] = useState<Phase>('loading');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) {
      setErrorMsg('Invalid invite link.');
      setPhase('error');
      return;
    }

    if (!userId) {
      // Not signed in — go to login; after sign-in the link should be re-opened
      router.replace('/(auth)/login');
      return;
    }

    // Pre-fetch group info so we can show the group name before joining
    (async () => {
      try {
        const { data } = await supabase
          .from('groups')
          .select('name')
          .eq('invite_code', code.toUpperCase())
          .eq('invite_enabled', true)
          .single();
        if (data?.name) {
          setGroupName(data.name);
          setPhase('confirm');
        } else {
          setErrorMsg('This invite link is invalid or has been disabled.');
          setPhase('error');
        }
      } catch {
        setErrorMsg('Could not look up this invite. Check your connection.');
        setPhase('error');
      }
    })();
  }, [code, userId]);

  const handleJoin = async () => {
    if (!code) return;
    setPhase('joining');
    const group = await joinByInviteCode(code.toUpperCase());
    if (group) {
      track({ name: 'group_joined', properties: { method: 'invite_code' } });
      router.replace('/(tabs)/map');
    } else {
      setErrorMsg('Failed to join crew. You may already be a member.');
      setPhase('error');
    }
  };

  const handleDecline = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/map');
  };

  return (
    <SafeAreaView style={styles.root}>
      {(phase === 'loading' || phase === 'joining') && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>
            {phase === 'joining' ? 'Joining crew...' : 'Checking invite...'}
          </Text>
        </View>
      )}

      {phase === 'confirm' && (
        <View style={styles.card}>
          <Text style={styles.emoji}>📡</Text>
          <Text style={styles.headline}>CREW INVITE</Text>
          <Text style={styles.groupName}>{groupName}</Text>
          <Text style={styles.subtext}>
            You've been invited to join this crew. Accept to start sharing your location with them.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.codeText}>{code?.toUpperCase()}</Text>
          </View>

          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} activeOpacity={0.85}>
            <Text style={styles.joinBtnText}>JOIN CREW</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
            <Text style={styles.declineBtnText}>DECLINE</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.card}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.headline}>INVITE ERROR</Text>
          <Text style={styles.subtext}>{errorMsg}</Text>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
            <Text style={styles.declineBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    padding: 24,
  },
  center: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#12121a',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  headline: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  groupName: {
    color: '#22c55e',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtext: {
    color: '#8888aa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  codeLabel: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  codeText: {
    color: '#22c55e',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  joinBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  joinBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  declineBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  declineBtnText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
