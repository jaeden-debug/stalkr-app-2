import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBillingStore } from '@/store/useBillingStore';
import type { PlanFeatures } from '@/constants/plans';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}) => {
  const hasFeature = useBillingStore((s) => s.hasFeature);
  const router = useRouter();

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (!showUpgradePrompt) return null;

  return (
    <View style={styles.locked}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.text}>Pro feature</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/subscription')}
      >
        <Text style={styles.btnText}>Upgrade</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  locked: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    backgroundColor: '#12121a',
  },
  lockIcon: { fontSize: 28 },
  text: { color: '#8888aa', fontSize: 14 },
  btn: { backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 13 },
});
