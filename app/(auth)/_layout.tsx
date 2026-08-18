import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { C } from '@/constants/theme';

export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Redirect href="/(tabs)/map" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
