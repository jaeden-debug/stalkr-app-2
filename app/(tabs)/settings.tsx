import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useBillingStore } from '@/store/useBillingStore';
import { useGroupStore } from '@/store/useGroupStore';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationPrefsSheet } from '@/components/ui/NotificationPrefsSheet';
import { C } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, sub, onPress, danger = false }: {
  icon: IoniconName; label: string; sub?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.rowIcon, danger && s.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? C.red : C.green} />
      </View>
      <View style={s.rowInfo}>
        <Text style={[s.rowLabel, danger && { color: C.red }]}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, user, signOut, deleteAccount } = useAuthStore();
  const { plan } = useBillingStore();
  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const [notifSheet, setNotifSheet] = useState(false);

  const planColor = plan === 'free' ? 'rgba(255,255,255,0.3)' : C.green;
  const planLabel = plan === 'free' ? 'FREE' : plan.toUpperCase();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, profile, crews you own, journeys, and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — irreversible action.
            Alert.alert('Are you absolutely sure?', 'Your account will be erased immediately.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Forever',
                style: 'destructive',
                onPress: async () => {
                  const ok = await deleteAccount();
                  if (!ok) Alert.alert('Delete failed', 'Could not delete your account. Please try again or contact support.');
                },
              },
            ]);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={s.title}>SETTINGS</Text>
          <TouchableOpacity
            style={s.exitBtn}
            onPress={() => router.navigate('/(tabs)/map')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={C.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <TouchableOpacity style={s.profileCard} onPress={() => router.push('/profile')} activeOpacity={0.85}>
          <Avatar uri={profile?.avatar_url} initials={profile?.initials} displayName={profile?.display_name} size={56} color={C.green} />
          <View style={s.profileInfo}>
            <Text style={s.profileName} numberOfLines={1}>
              {(profile?.nickname ?? profile?.display_name ?? 'OPERATOR').toUpperCase()}
            </Text>
            <Text style={s.profileEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
          <View style={[s.planBadge, { borderColor: planColor }]}>
            <Text style={[s.planText, { color: planColor }]}>{planLabel}</Text>
          </View>
        </TouchableOpacity>

        <Section title="NOTIFICATIONS">
          <Row icon="notifications" label="NOTIFICATION PREFERENCES" sub="Global defaults — zones, SOS, crew activity" onPress={() => setNotifSheet(true)} />
        </Section>

        <Section title="CREW">
          <Row
            icon="people"
            label="CREW SETTINGS"
            sub={activeGroup ? `${activeGroup.name} — call sign, alerts, members` : 'No active crew selected'}
            onPress={() => {
              if (!activeGroupId) return;
              router.push(`/groups/${activeGroupId}`);
            }}
          />
          <View style={s.sep} />
          <Row icon="pulse" label="ACTIVITY FEED" sub="Crew movements, check-ins, journeys, SOS" onPress={() => router.push('/activity')} />
        </Section>

        <Section title="ACCOUNT">
          <Row icon="person" label="EDIT PROFILE" sub="Name, photo, call sign" onPress={() => router.push('/profile')} />
          <View style={s.sep} />
          <Row icon="call" label="EMERGENCY CONTACTS" sub="Who to alert in an SOS" onPress={() => router.push('/emergency-contacts')} />
          <View style={s.sep} />
          <Row icon="key" label="CHANGE PASSWORD" sub="Update your account password" onPress={() => router.push('/change-password')} />
        </Section>

        <Section title="SUBSCRIPTION">
          <Row
            icon="flash"
            label={plan === 'free' ? 'UPGRADE TO PRO' : 'MANAGE SUBSCRIPTION'}
            sub={plan === 'free' ? 'Unlock zones, trails & more' : `Current: ${plan.toUpperCase()}`}
            onPress={() => router.push('/subscription')}
          />
        </Section>

        <Section title="SUPPORT & LEGAL">
          <Row icon="help-buoy" label="HELP & SUPPORT" onPress={() => Linking.openURL('https://navtrl.com/')} />
          <View style={s.sep} />
          <Row icon="document-text" label="TERMS OF SERVICE" onPress={() => Linking.openURL('https://navtrl.com/terms')} />
          <View style={s.sep} />
          <Row icon="shield-checkmark" label="PRIVACY POLICY" onPress={() => Linking.openURL('https://navtrl.com/privacy')} />
        </Section>

        <Section title="DANGER ZONE">
          <Row icon="log-out" label="SIGN OUT" onPress={handleSignOut} danger />
          <View style={s.sep} />
          <Row icon="trash" label="DELETE ACCOUNT" sub="Permanently erase your account & data" onPress={handleDeleteAccount} danger />
        </Section>

        <Text style={s.version}>STALKR · v2.0.0</Text>
      </ScrollView>

      <NotificationPrefsSheet visible={notifSheet} onClose={() => setNotifSheet(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  title: { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  exitBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 28,
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 16,
  },
  profileInfo:  { flex: 1 },
  profileName:  { color: C.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  profileEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 },
  planBadge:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planText:     { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },

  section:      { marginBottom: 24, paddingHorizontal: 16 },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 10, marginLeft: 4 },
  card:         { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  sep:         { height: 1, backgroundColor: C.borderFaint, marginHorizontal: 16 },
  rowIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.greenDim, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: C.redDim },
  rowInfo:     { flex: 1 },
  rowLabel:    { color: C.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  rowSub:      { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  version: { textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, paddingBottom: 8 },
});
