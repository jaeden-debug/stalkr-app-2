import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.icon}>
      <Text style={[tabStyles.emoji, focused && tabStyles.emojiActive]}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  icon: { alignItems: 'center', gap: 2, paddingTop: 4 },
  emoji: { fontSize: 22, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: { fontSize: 10, color: '#8888aa', fontWeight: '500' },
  labelActive: { color: '#22c55e', fontWeight: '700' },
});

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#2a2a3a',
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 20,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="map" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🗺" label="Map" focused={focused} /> }} />
      <Tabs.Screen name="groups" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Crew" focused={focused} /> }} />
      <Tabs.Screen name="sessions" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" label="Sessions" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Settings" focused={focused} /> }} />
    </Tabs>
  );
}
