import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBillingStore } from '@/store/useBillingStore';

const PRO_PRICE_FALLBACK = '$9.99/mo';

const FREE_FEATURES = [
  '2 crews · 5 members each',
  '3 saved places',
  'Live crew location',
  '4h trail history',
];

const PRO_FEATURES = [
  'Unlimited crews & members',
  'Polygon safety zones + alerts',
  'Live journeys & safe-arrival',
  'Marker & zone photos',
  'Emergency contacts + SOS',
  'Dead-man switch & check-ins',
  'Enforced tracking & admin controls',
  '30-day trail history',
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const plan = useBillingStore((s) => s.plan);
  const isAdmin = useBillingStore((s) => s.isAdmin);
  const getPackages = useBillingStore((s) => s.getPackages);
  const purchase = useBillingStore((s) => s.purchase);
  const restore = useBillingStore((s) => s.restore);

  const isPro = isAdmin || plan === 'pro' || plan === 'crew';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pkg, setPkg] = useState<any>(null);
  const [price, setPrice] = useState(PRO_PRICE_FALLBACK);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    getPackages().then((pkgs) => {
      const p = pkgs?.[0];
      if (p) {
        setPkg(p);
        const s = p.product?.priceString;
        if (s) setPrice(`${s}/mo`);
      }
    }).catch(() => {});
  }, [getPackages]);

  const onBuy = async () => {
    if (!pkg) {
      Alert.alert('Almost ready', 'Subscriptions aren’t available yet on this build. Make sure you’re on a build with in-app purchases enabled.');
      return;
    }
    setBusy('buy');
    try {
      const ok = await purchase(pkg);
      if (ok) { Alert.alert('You’re Pro', 'Full access unlocked. Thank you!'); router.back(); }
    } catch {
      Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
    } finally { setBusy(null); }
  };

  const onRestore = async () => {
    setBusy('restore');
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Your Pro access is active.' : 'No previous purchases were found.');
      if (ok) router.back();
    } finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>STALKR PRO</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.logoMark}><Ionicons name="shield-checkmark" size={30} color="#22c55e" /></View>
          <Text style={s.headline}>Unlock everything</Text>
          <Text style={s.sub}>One plan. Full access to every safety and tracking feature.</Text>
        </View>

        {isPro ? (
          <View style={[s.card, s.cardActive]}>
            <View style={s.rowBetween}>
              <Text style={s.cardName}>PRO</Text>
              <View style={s.activePill}><Text style={s.activePillText}>{isAdmin ? 'ADMIN' : 'ACTIVE'}</Text></View>
            </View>
            <Text style={s.cardSub}>{isAdmin ? 'Admin account — full access.' : 'You have full access. Thank you!'}</Text>
            {PRO_FEATURES.map((f) => (
              <View key={f} style={s.featRow}><Ionicons name="checkmark-circle" size={16} color="#22c55e" /><Text style={s.feat}>{f}</Text></View>
            ))}
          </View>
        ) : (
          <>
            {/* PRO card */}
            <View style={[s.card, s.cardActive]}>
              <View style={s.rowBetween}>
                <Text style={[s.cardName, { color: '#22c55e' }]}>PRO</Text>
                <Text style={s.price}>{price}</Text>
              </View>
              <Text style={s.cardSub}>Everything in Stalkr, unlocked.</Text>
              {PRO_FEATURES.map((f) => (
                <View key={f} style={s.featRow}><Ionicons name="checkmark-circle" size={16} color="#22c55e" /><Text style={s.feat}>{f}</Text></View>
              ))}
              <TouchableOpacity style={s.buyBtn} onPress={onBuy} disabled={busy !== null} activeOpacity={0.85}>
                {busy === 'buy' ? <ActivityIndicator color="#04130a" /> : <Text style={s.buyText}>Go Pro — {price}</Text>}
              </TouchableOpacity>
            </View>

            {/* FREE card */}
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardName}>FREE</Text>
                <View style={s.currentPill}><Text style={s.currentPillText}>CURRENT</Text></View>
              </View>
              <Text style={s.cardSub}>The basics, forever free.</Text>
              {FREE_FEATURES.map((f) => (
                <View key={f} style={s.featRow}><Ionicons name="ellipse" size={7} color="#6b7280" style={{ marginHorizontal: 5 }} /><Text style={s.featDim}>{f}</Text></View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={s.restore} onPress={onRestore} disabled={busy !== null}>
          <Text style={s.restoreText}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
        </TouchableOpacity>
        <Text style={s.legal}>
          Billed monthly through your App Store account; auto-renews until cancelled.
          Manage or cancel anytime in Settings. Terms at navtrl.com/terms.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  back: { color: '#22c55e', fontSize: 16, fontWeight: '600', width: 56 },
  title: { color: '#f8fafc', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  content: { padding: 18, gap: 16 },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  logoMark: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  headline: { color: '#f8fafc', fontSize: 26, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', maxWidth: 300 },
  card: { backgroundColor: '#12121a', borderRadius: 18, borderWidth: 1, borderColor: '#262633', padding: 18, gap: 10 },
  cardActive: { borderColor: 'rgba(34,197,94,0.5)', backgroundColor: 'rgba(34,197,94,0.05)' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: '#f8fafc', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  cardSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  price: { color: '#22c55e', fontSize: 18, fontWeight: '900' },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feat: { color: '#e7eaee', fontSize: 14 },
  featDim: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  buyBtn: { marginTop: 8, backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buyText: { color: '#04130a', fontWeight: '900', fontSize: 15 },
  activePill: { backgroundColor: '#22c55e', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  activePillText: { color: '#04130a', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  currentPill: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  currentPillText: { color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  restore: { paddingVertical: 12, alignItems: 'center' },
  restoreText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  legal: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
