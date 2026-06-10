import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tab bar fully hidden — navigation is handled through the map's
        // NavigationDrawer (Crews / Journeys / Settings). Screens remain
        // registered and reachable via router.push().
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="map" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="sessions" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
