import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useBillingStore } from '@/store/useBillingStore';
import { ActionRow } from '@/components/ui/ActionRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useAuthStore();
  const { plan } = useBillingStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const planVariant = plan === 'free' ? 'offline' : plan === 'pro' ? 'live' : 'crew';
  const planLabel = plan === 'free' ? 'Free Plan' : plan === 'pro' ? 'Pro' : 'Crew';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <Avatar
            uri={profile?.avatar_url}
            initials={profile?.initials}
            displayName={profile?.display_name}
            size={60}
            color="#22c55e"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profile?.nickname || profile?.display_name || user?.email}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Badge label={planLabel} variant={planVariant as any} />
          </View>
        </View>

        <Divider margin={4} />

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <ActionRow
            label="Edit Profile"
            subtitle="Name, photo, initials"
            leftIcon={<Text>👤</Text>}
            onPress={() => router.push('/profile')}
          />
          <ActionRow
            label="Emergency Contacts"
            leftIcon={<Text>🆘</Text>}
            onPress={() => router.push('/emergency-contacts')}
          />
        </View>

        {/* Subscription */}
        <SectionHeader title="Subscription" />
        <View style={styles.section}>
          <ActionRow
            label={plan === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
            subtitle={plan === 'free' ? 'Unlock zones, trails & more' : `Current plan: ${plan}`}
            leftIcon={<Text>⚡</Text>}
            onPress={() => router.push('/subscription')}
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Account Actions" />
        <View style={styles.section}>
          <ActionRow
            label="Sign Out"
            leftIcon={<Text>🚪</Text>}
            onPress={handleSignOut}
            destructive
            showChevron={false}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerVersion}>Stalkr v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  title: { color: '#e8e8f0', fontSize: 24, fontWeight: '800', padding: 16, paddingTop: 8 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    margin: 16,
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  profileInfo: { flex: 1, gap: 6 },
  profileName: { color: '#e8e8f0', fontSize: 17, fontWeight: '700' },
  profileEmail: { color: '#8888aa', fontSize: 13 },
  section: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    overflow: 'hidden',
  },
  footer: { padding: 24, alignItems: 'center' },
  footerVersion: { color: '#5555aa', fontSize: 12 },
});
