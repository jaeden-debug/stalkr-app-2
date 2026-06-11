/**
 * Native /watch/[token] handler. Watch pages are a WEB experience (app.navtrl.com)
 * for people who don't have the app. If a watch deep link ever reaches the native
 * app (e.g. universal-link edge case), bounce it out to the browser instead of
 * showing "Unmatched Route", then return to the map.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function WatchRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    const url = `https://app.navtrl.com/watch/${token ?? ''}`;
    Linking.openURL(url).catch(() => {});
    const t = setTimeout(() => {
      try { router.replace('/(tabs)/map'); } catch { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [token, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#22c55e" />
    </View>
  );
}
