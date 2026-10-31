import { SplashScreen, Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { environment } from '@/src/shared/runtime';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

function RootNavigation() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <View style={styles.root}>
      {environment.demoMode ? <View accessibilityRole="alert" style={styles.demoBanner}><Text style={styles.demoText}>MOCK — NÃO CONECTADO À HOMOLOGAÇÃO</Text></View> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'anonymous'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="confirmar-email" options={{ headerShown: true, title: 'Confirmar e-mail' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  demoBanner: { backgroundColor: '#7a2e00', padding: 8 },
  demoText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
