import React from 'react';
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../theme/tokens';

const icon = (name: keyof typeof MaterialCommunityIcons.glyphMap) =>
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.inkFaint,
        headerStyle: { backgroundColor: COLORS.surface },
        headerTitleStyle: { fontWeight: '800', color: COLORS.ink },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: COLORS.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('view-dashboard-outline') }} />
      <Tabs.Screen name="movements" options={{ title: 'Movimentações', tabBarLabel: 'Movimentos', tabBarIcon: icon('swap-horizontal') }} />
      <Tabs.Screen name="fixed" options={{ title: 'Lançamentos fixos', tabBarLabel: 'Fixos', tabBarIcon: icon('calendar-check-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'Mais', tabBarIcon: icon('dots-horizontal-circle-outline') }} />
    </Tabs>
  );
}
