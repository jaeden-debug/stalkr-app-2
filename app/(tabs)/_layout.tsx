import { Ionicons } from '@expo/vector-icons';
import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { C } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  icon,
  iconFocused,
  label,
  focused,
}: {
  icon: IoniconName;
  iconFocused: IoniconName;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={s.wrap}>
      <Ionicons
        name={focused ? iconFocused : icon}
        size={22}
        color={focused ? C.green : 'rgba(255,255,255,0.35)'}
      />
      <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { alignItems: 'center', gap: 3, paddingTop: 6 },
  label:      { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)' },
  labelActive:{ color: C.green },
});

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(8,8,8,0.97)',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 20,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="map-outline" iconFocused="map" label="MAP" focused={focused} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="people-outline" iconFocused="people" label="CREW" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="navigate-outline" iconFocused="navigate" label="JOURNEYS" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="settings-outline" iconFocused="settings" label="SETTINGS" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
