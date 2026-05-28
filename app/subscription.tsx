import React from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBillingStore } from '@/store/useBillingStore';
import { getPlanFeatures } from '@/constants/plans';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { SubscriptionPlan } from '@/types/database';

const PLAN_DISPLAY: Record<SubscriptionPlan, { label: string; color: string; tagline: string; price: string }> = {
  free: { label: 'Free', color: '#8888aa', tagline: 'The basics, forever free.', price: 'Free' },
  pro: { label: 'Pro', color: '#22c55e', tagline: 'Zones, trails, and advanced features.', price: '$4.99/mo' },
  crew: { label: 'Crew', color: '#f59e0b', tagline: 'Full control for serious groups.', price: '$9.99/mo' },
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const { plan } = useBillingStore();

  const plans: SubscriptionPlan[] = ['free', 'pro', 'crew'];

  const handleUpgrade = (targetPlan: SubscriptionPlan) => {
    // On mobile, route to App Store / Google Play in-app purchase.
    // For now, deep-link to App Store subscription management.
    // In production this calls expo-in-app-purchases or react-native-purchases.
    Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
  };

  const handleRestore = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Plans</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>Choose Your Plan</Text>
        <Text style={styles.subheadline}>
          Stalkr grows with your crew. Upgrade anytime.
        </Text>

        {plans.map((p) => {
          const display = PLAN_DISPLAY[p];
          const features = getPlanFeatures(p);
          const isCurrent = p === plan;

          const featureLines = [
            `${features.maxGroups >= 50 ? 'Unlimited' : features.maxGroups} groups`,
            `Up to ${features.maxMembersPerGroup} members/group`,
            `${features.maxSavedPlaces} saved zones`,
            `${features.trailHistoryHours}h trail history`,
            (features as any).polygonZones ? '✓ Polygon zones' : '✗ Polygon zones',
            (features as any).zoneAlerts ? '✓ Zone alerts' : '✗ Zone alerts',
            (features as any).emergencyContacts ? '✓ Emergency contacts' : '✗ Emergency contacts',
          ].filter(Boolean) as string[];

          return (
            <View key={p} style={[styles.planCard, isCurrent && styles.planCardActive]}>
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: display.color }]}>{display.label}</Text>
                {isCurrent && <Badge label="Current" variant="live" dot />}
                <Text style={styles.planPrice}>{display.price}</Text>
              </View>
              <Text style={styles.planTagline}>{display.tagline}</Text>

              <View style={styles.featureList}>
                {featureLines.map((f, i) => (
                  <Text
                    key={i}
                    style={[styles.featureItem, f.startsWith('✗') && styles.featureDisabled]}
                  >
                    {f}
                  </Text>
                ))}
              </View>

              {p !== 'free' && !isCurrent && (
                <Button
                  label={`Get ${display.label} — ${display.price}`}
                  variant="primary"
                  onPress={() => handleUpgrade(p)}
                  fullWidth
                  size="md"
                />
              )}
              {isCurrent && p !== 'free' && (
                <Text style={styles.currentLabel}>✓ Your current plan</Text>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreBtnText}>Restore Purchases</Text>
        </TouchableOpacity>
        <Text style={styles.legal}>
          Subscriptions auto-renew. Cancel anytime in App Store / Google Play settings.
          Prices may vary by region.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
  },
  back: { color: '#22c55e', fontSize: 16, fontWeight: '600', width: 60 },
  title: { color: '#e8e8f0', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  headline: { color: '#e8e8f0', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subheadline: { color: '#8888aa', fontSize: 14, textAlign: 'center' },
  planCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 16,
    gap: 12,
  },
  planCardActive: { borderColor: '#22c55e' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 20, fontWeight: '800' },
  planPrice: { color: '#8888aa', fontSize: 14, marginLeft: 'auto' },
  planTagline: { color: '#8888aa', fontSize: 13 },
  featureList: { gap: 4 },
  featureItem: { color: '#e8e8f0', fontSize: 13 },
  featureDisabled: { color: '#4a4a60' },
  currentLabel: { color: '#22c55e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  restoreBtn: { paddingVertical: 12, alignItems: 'center' },
  restoreBtnText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  legal: { color: '#5555aa', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
