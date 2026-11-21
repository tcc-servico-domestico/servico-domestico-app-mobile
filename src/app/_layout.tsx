import { SplashScreen, Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { environment } from '@/src/shared/runtime';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { TypographyContext } from '@/src/context/TypographyContext';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#005B44', onPrimary: '#FFFDFA', background: '#FAF6EE',
    surface: '#FFFDFA', onSurface: '#0D251B', error: '#A3262E', outline: '#6B7A74',
    secondary: '#005B44', secondaryContainer: '#D3F0E2', onSecondaryContainer: '#0D251B',
    tertiary: '#F8C562', onTertiary: '#0D251B',
  },
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonRegular: require('../assets/fonts/AtkinsonHyperlegible_400Regular.ttf'),
    AtkinsonBold: require('../assets/fonts/AtkinsonHyperlegible_700Bold.ttf'),
    BricolageBold: require('../assets/fonts/BricolageGrotesque_700Bold.ttf'),
    BricolageExtraBold: require('../assets/fonts/BricolageGrotesque_800ExtraBold.ttf'),
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <TypographyContext.Provider value={fontsLoaded}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </PaperProvider>
    </TypographyContext.Provider>
  );
}

export function RootNavigation() {
  const { status, session } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <View style={styles.root}>
      <StatusBar style={environment.demoMode ? 'light' : 'dark'} />
      {environment.demoMode ? <SafeAreaView edges={['top']} style={styles.demoBanner}><Text accessibilityRole="alert" style={styles.demoText}>MOCK — NÃO CONECTADO À HOMOLOGAÇÃO</Text></SafeAreaView> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="acesso-negado" />
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="perfil" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated' && session?.roles.includes('Profissional') === true}>
          <Stack.Screen name="perfil-profissional" options={{ headerShown: true, title: 'Perfil profissional' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'anonymous'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="confirmar-email" />
        <Stack.Screen name="confirmar-alteracao-email" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  demoBanner: { backgroundColor: '#7a2e00', padding: 8 },
  demoText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
