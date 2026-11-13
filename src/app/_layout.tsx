import { SplashScreen, Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { environment } from '@/src/shared/runtime';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#175E55', onPrimary: '#FFFFFF', background: '#FAFAF7',
    surface: '#FFFFFF', onSurface: '#1B2421', error: '#A3262E', outline: '#6B7A74',
  },
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </PaperProvider>
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
