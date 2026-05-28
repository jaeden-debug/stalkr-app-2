import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuthStore } from '@/store/useAuthStore';
import { useBillingStore } from '@/store/useBillingStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const loadEntitlement = useBillingStore((s) => s.loadEntitlement);

  useEffect(() => {
    initialize();
    loadEntitlement();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ToastProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0f' },
                animation: 'fade',
              }}
            />
          </ToastProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
