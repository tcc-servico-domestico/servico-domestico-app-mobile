import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PlatformPressable } from '@react-navigation/elements';
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/src/context/AuthContext';

function FocusableTabButton({ style, onFocus, onBlur, ...props }: BottomTabBarButtonProps) {
  const [focused, setFocused] = useState(false);
  return <PlatformPressable {...props} onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[style, { borderWidth: 2, borderColor: focused ? '#175E55' : 'transparent', borderRadius: 6 }]} />;
}

function AccessibleTabs({ state, descriptors, navigation, canManageProperties }: BottomTabBarProps & { canManageProperties: boolean }) {
  const insets = useSafeAreaInsets();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const items = state.routes.filter((route) => route.name !== 'imoveis' || canManageProperties);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'white', paddingBottom: insets.bottom }}>
    {items.map((route) => {
      const index = state.routes.findIndex((item) => item.key === route.key);
      const selected = index === state.index;
      const options = descriptors[route.key].options;
      const color = selected ? '#175E55' : '#465550';
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel}
        accessibilityState={{ selected }} aria-selected={selected} onFocus={() => setFocusedKey(route.key)} onBlur={() => setFocusedKey(null)} onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={{ width: '50%', minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 4, borderWidth: focusedKey === route.key ? 2 : 0, borderColor: '#175E55' }}>
        {options.tabBarIcon?.({ focused: selected, color, size: 22 })}
        <Text style={{ color, fontSize: 10, flexShrink: 1 }}>{options.title}</Text>
      </Pressable>;
    })}
  </View>;
}

export default function TabsLayout() {
  const { session } = useAuth();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Tabs tabBar={fontScale > 1.3 ? (props) => <AccessibleTabs {...props} canManageProperties={!!session?.roles.includes('Cliente')} /> : undefined} screenOptions={{
      tabBarActiveTintColor: '#175E55',
      tabBarInactiveTintColor: '#465550',
      tabBarButton: (props) => <FocusableTabButton {...props} />,
      tabBarStyle: { height: 64 + insets.bottom },
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Ir para início',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" color={color} size={size} />,
          headerRight: () => null,
        }}
      />
      <Tabs.Screen name="imoveis" options={{ title: 'Imóveis', tabBarAccessibilityLabel: 'Ir para imóveis', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-city-outline" color={color} size={size} />, href: session?.roles.includes('Cliente') ? undefined : null }} />
      <Tabs.Screen name="servicos" options={{ title: 'Serviços', tabBarAccessibilityLabel: 'Ir para serviços', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="pagamentos" options={{
        title: 'Pagamentos',
        tabBarAccessibilityLabel: 'Ir para pagamentos',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="credit-card-outline" color={color} size={size} />,
        ...(fontScale <= 1.3 ? { tabBarLabel: ({ color }: { color: string }) => <Text style={{ color, fontSize: 11, textAlign: 'center', lineHeight: 13 }}>Pagamentos</Text> } : {}),
      }} />
    </Tabs>
  );
}
