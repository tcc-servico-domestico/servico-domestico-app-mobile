import { Tabs, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PlatformPressable } from '@react-navigation/elements';
import { useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/src/context/AuthContext';
import { ExperienceProvider, useExperience } from '@/src/context/ExperienceContext';

function TabIcon({ name, color, size, focused }: { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string; size: number; focused: boolean }) {
  return <View style={{ minWidth: 48, minHeight: 28, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#D3F0E2' : 'transparent' }}>
    <MaterialCommunityIcons name={name} color={color} size={size} />
  </View>;
}

function FocusableTabButton({ style, onFocus, onBlur, ...props }: BottomTabBarButtonProps) {
  const [focused, setFocused] = useState(false);
  return <PlatformPressable {...props} onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[style, { borderWidth: 2, borderColor: focused ? '#175E55' : 'transparent', borderRadius: 6 }]} />;
}

function AccessibleTabs({ state, descriptors, navigation, canManageProperties }: BottomTabBarProps & { canManageProperties: boolean }) {
  const insets = useSafeAreaInsets();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const items = state.routes.filter((route) => route.name !== 'conta' && (canManageProperties ? !['agenda', 'profissional-perfil'].includes(route.name) : !['home', 'imoveis'].includes(route.name)));
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
        style={{ width: '50%', minHeight: 64, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4, borderWidth: focusedKey === route.key ? 2 : 0, borderColor: '#175E55' }}>
        {options.tabBarIcon?.({ focused: selected, color, size: 22 })}
        <Text style={{ color, fontSize: 10, textAlign: 'center', flexShrink: 1 }}>{options.title}</Text>
      </Pressable>;
    })}
  </View>;
}

export default function TabsLayout() {
  return <ExperienceProvider><RoleTabs /></ExperienceProvider>;
}

function RoleTabs() {
  const { session, logout } = useAuth();
  const { role, selectRole } = useExperience();
  const router = useRouter();
  const isClient = role === 'Cliente';
  const changeRole = () => {
    const next = isClient ? 'Profissional' : 'Cliente';
    Alert.alert('Trocar experiência?', 'Rascunhos não enviados podem ser descartados ao trocar. Você pode permanecer nesta experiência.', [
      { text: 'Permanecer', style: 'cancel' },
      { text: 'Trocar', onPress: () => { selectRole(next); router.replace(next === 'Cliente' ? '/(tabs)/home' : '/(tabs)/servicos'); } },
    ]);
  };
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!session?.roles.some((item) => item === 'Cliente' || item === 'Profissional')) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text accessibilityRole="alert">Esta conta não possui uma experiência disponível.</Text>
    <Pressable accessibilityRole="button" onPress={async () => { await logout(); router.replace('/(auth)/login'); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text>Sair da conta</Text></Pressable>
  </View>;
  return (
    <Tabs tabBar={fontScale > 1.3 ? (props) => <AccessibleTabs {...props} canManageProperties={isClient} /> : undefined} screenOptions={{
      tabBarActiveTintColor: '#175E55',
      tabBarInactiveTintColor: '#465550',
      tabBarButton: (props) => <FocusableTabButton {...props} />,
      tabBarStyle: { height: 64 + insets.bottom, backgroundColor: '#FFFFFF', borderTopColor: '#D5DFD8' },
      headerStyle: { backgroundColor: '#FAF6EE' },
      headerTitleStyle: { color: '#0D251B', fontWeight: '700' },
      headerShadowVisible: false,
      headerTintColor: '#175E55',
      headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {session?.roles.includes('Cliente') && session.roles.includes('Profissional') ? <Pressable accessibilityRole="button" accessibilityLabel={`Experiência ${role}. Trocar experiência`} onPress={changeRole} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="swap-horizontal" size={24} color="#005B44" /><Text style={{ color: '#005B44', fontSize: 11, fontWeight: '700' }}>{role}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Minha conta" onPress={() => router.push('/(tabs)/conta')} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="account-circle-outline" size={24} color="#005B44" /></Pressable>
      </View>,
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Ir para início',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home-outline" color={color} size={size} focused={focused} />,
          href: isClient ? undefined : null,
        }}
      />
      <Tabs.Screen name="servicos" options={{ title: isClient ? 'Serviços' : 'Ofertas', tabBarAccessibilityLabel: isClient ? 'Ir para serviços' : 'Ir para ofertas', tabBarIcon: ({ color, size, focused }) => <TabIcon name={isClient ? 'clipboard-list-outline' : 'inbox-outline'} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="imoveis" options={{ title: 'Imóveis', tabBarAccessibilityLabel: 'Ir para imóveis', tabBarIcon: ({ color, size, focused }) => <TabIcon name="home-city-outline" color={color} size={size} focused={focused} />, href: isClient ? undefined : null }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarAccessibilityLabel: 'Ir para agenda', tabBarIcon: ({ color, size, focused }) => <TabIcon name="calendar-outline" color={color} size={size} focused={focused} />, href: isClient ? null : undefined }} />
      <Tabs.Screen name="pagamentos" options={{
        title: isClient ? 'Pagamentos' : 'Recebimentos',
        tabBarAccessibilityLabel: isClient ? 'Ir para pagamentos' : 'Ir para recebimentos',
        tabBarIcon: ({ color, size, focused }) => <TabIcon name={isClient ? 'credit-card-outline' : 'wallet-outline'} color={color} size={size} focused={focused} />,
        ...(fontScale <= 1.3 ? { tabBarLabel: ({ color }: { color: string }) => <Text style={{ color, fontSize: 11, textAlign: 'center', lineHeight: 13 }}>{isClient ? 'Pagamentos' : 'Recebimentos'}</Text> } : {}),
      }} />
      <Tabs.Screen name="profissional-perfil" options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Ir para perfil profissional', tabBarIcon: ({ color, size, focused }) => <TabIcon name="account-cog-outline" color={color} size={size} focused={focused} />, href: isClient ? null : undefined }} />
      <Tabs.Screen name="conta" options={{ title: 'Minha conta', href: null, headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { if (router.canGoBack()) router.back(); else router.replace(isClient ? '/(tabs)/home' : '/(tabs)/servicos'); }} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="arrow-left" size={24} color="#005B44" /></Pressable> }} />
    </Tabs>
  );
}
