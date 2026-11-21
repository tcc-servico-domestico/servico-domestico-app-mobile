import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/context/AuthContext';
import { confirmationDestination } from '@/src/features/identity/confirmationNavigation';
import { confirmationFailure } from '@/src/features/identity/confirmationFailure';
import { environment } from '@/src/shared/runtime';

export default function ConfirmEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { confirmEmail, status } = useAuth();
  const router = useRouter();
  const request = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const value = Array.isArray(token) ? token[0] : token;
  const [state, setState] = useState<'loading' | 'success' | 'error' | 'uncertain'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail…');
  const destination = confirmationDestination(status);

  useEffect(() => {
    if (!value) {
      setState('error');
      setMessage('O link de confirmação está incompleto. Abra o link recebido por e-mail novamente.');
      return;
    }
    let active = true;
    setState('loading');
    setMessage('Confirmando seu e-mail…');
    if (request.current?.token !== value) request.current = { token: value, promise: confirmEmail(value) };
    request.current.promise.then(() => {
      if (!active) return;
      setState('success');
      setMessage('A confirmação foi concluída.');
    }).catch((cause) => {
      if (!active) return;
      const failure = confirmationFailure(cause, 'email');
      setState(failure.state);
      setMessage(failure.message);
    });
    return () => { active = false; };
  }, [confirmEmail, value]);

  return (
    <SafeAreaView edges={environment.demoMode ? [] : ['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.container}>
      <View style={styles.brand} accessibilityLabel="Serviço Doméstico"><View style={styles.brandIcon}><MaterialCommunityIcons name="home-outline" size={25} color="#FFFFFF" /></View><Text style={styles.brandText}>Serviço{'\n'}Doméstico</Text></View>
      <Text variant="headlineSmall" accessibilityRole="header" style={styles.title}>Confirmação de e-mail</Text>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        {state === 'loading' ? <ActivityIndicator size="large" accessibilityLabel="Confirmando e-mail" /> : <View style={[styles.icon, state === 'error' ? styles.errorIcon : state === 'uncertain' ? styles.uncertainIcon : null]}><MaterialCommunityIcons name={state === 'success' ? 'check-circle-outline' : 'alert-circle-outline'} size={32} color={state === 'success' ? '#005B44' : state === 'uncertain' ? '#614900' : '#A3262E'} /></View>}
        {state !== 'loading' ? <Text accessibilityRole="header" style={styles.statusTitle}>{state === 'success' ? 'E-mail confirmado' : state === 'uncertain' ? 'Resultado não confirmado' : !value ? 'Link incompleto' : 'Não foi possível confirmar'}</Text> : null}
        <Text variant="bodyLarge" style={styles.message} accessibilityRole={state === 'error' || state === 'uncertain' ? 'alert' : undefined}>{message}{state === 'success' && status === 'anonymous' ? ' Você já pode entrar.' : ''}</Text>
      </View>
      {state !== 'loading' && (
        <Button mode={state === 'success' ? 'contained' : 'text'} buttonColor={state === 'success' ? '#005B44' : undefined} textColor={state === 'success' ? '#FFFFFF' : '#005B44'} style={styles.action} contentStyle={styles.button} accessibilityLabel={destination.label} onPress={() => router.replace(destination.route)}>
          {destination.label}
        </Button>
      )}
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'stretch', gap: 20, padding: 20, paddingTop: 32, backgroundColor: '#F8F4EB' },
  safeArea: { flex: 1, backgroundColor: '#F8F4EB' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 16, lineHeight: 19, color: '#10251D', fontWeight: 'bold' },
  status: { alignItems: 'center', gap: 16, padding: 24, borderWidth: 1, borderColor: '#DDDAD1', borderRadius: 16, backgroundColor: '#FFFDFA' },
  icon: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#DCF1E8', justifyContent: 'center', alignItems: 'center' },
  errorIcon: { backgroundColor: '#FFF0EE' },
  uncertainIcon: { backgroundColor: '#FFF1CF' },
  action: { borderRadius: 16 },
  button: { minHeight: 56 },
  message: { textAlign: 'center', color: '#1B2421' },
  title: { color: '#0D251B', fontSize: 26, fontWeight: '700' },
  statusTitle: { color: '#0D251B', fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
