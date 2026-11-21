import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/context/AuthContext';
import { confirmationDestination } from '@/src/features/identity/confirmationNavigation';
import { confirmationFailure } from '@/src/features/identity/confirmationFailure';
import { environment, identityApi } from '@/src/shared/runtime';

export default function ConfirmarAlteracaoEmail() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { status } = useAuth();
  const router = useRouter();
  const destination = confirmationDestination(status);
  const request = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'error' | 'uncertain'>('loading');
  const [message, setMessage] = useState('Confirmando novo e-mail…');

  useEffect(() => {
    if (typeof token !== 'string' || !token) {
      setState('error');
      setMessage('O link está incompleto. Abra o link enviado ao novo e-mail.');
      return;
    }
    let active = true;
    setState('loading');
    setMessage('Confirmando novo e-mail…');
    if (request.current?.token !== token) request.current = { token, promise: identityApi.confirmEmailChange(token) };
    request.current.promise.then(() => {
      if (!active) return;
      setState('success');
      setMessage('A alteração do e-mail foi confirmada.');
    }).catch((cause) => {
      if (!active) return;
      const failure = confirmationFailure(cause, 'email-change');
      setState(failure.state);
      setMessage(failure.message);
    });
    return () => { active = false; };
  }, [token]);

  return <SafeAreaView edges={environment.demoMode ? [] : ['top']} style={styles.safeArea}><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.brand} accessibilityLabel="Serviço Doméstico"><View style={styles.brandIcon}><MaterialCommunityIcons name="home-outline" size={25} color="#FFFFFF" /></View><Text style={styles.brandText}>Serviço{'\n'}Doméstico</Text></View>
    <Text accessibilityRole="header" style={styles.title}>Confirmar novo e-mail</Text>
    <View style={styles.status} accessibilityLiveRegion="polite">
      {state === 'loading' ? <ActivityIndicator accessibilityLabel="Confirmando novo e-mail" /> : <View style={[styles.icon, state === 'error' ? styles.errorIcon : state === 'uncertain' ? styles.uncertainIcon : null]}><MaterialCommunityIcons name={state === 'success' ? 'check-circle-outline' : 'alert-circle-outline'} size={32} color={state === 'success' ? '#005B44' : state === 'uncertain' ? '#614900' : '#A3262E'} /></View>}
      {state !== 'loading' ? <Text accessibilityRole="header" style={styles.statusTitle}>{state === 'success' ? 'Novo e-mail confirmado' : state === 'uncertain' ? 'Resultado não confirmado' : !token ? 'Link incompleto' : 'Não foi possível confirmar'}</Text> : null}
      <Text accessibilityRole={state === 'error' || state === 'uncertain' ? 'alert' : undefined} style={styles.body}>{message}</Text>
    </View>
    {state !== 'loading' ? <Pressable accessibilityRole="button" style={[styles.button, state !== 'success' && styles.secondaryButton]} onPress={() => router.replace(destination.route)}><Text style={[styles.buttonText, state !== 'success' && styles.secondaryButtonText]}>{destination.label}</Text></Pressable> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 32, gap: 20, backgroundColor: '#F8F4EB' },
  safeArea: { flex: 1, backgroundColor: '#F8F4EB' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 16, lineHeight: 19, color: '#10251D', fontWeight: 'bold' },
  status: { alignItems: 'center', gap: 16, padding: 24, borderWidth: 1, borderColor: '#DDDAD1', borderRadius: 16, backgroundColor: '#FFFDFA' },
  icon: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#DCF1E8', justifyContent: 'center', alignItems: 'center' },
  errorIcon: { backgroundColor: '#FFF0EE' },
  uncertainIcon: { backgroundColor: '#FFF1CF' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' },
  body: { fontSize: 16, color: '#1B2421', textAlign: 'center' },
  statusTitle: { color: '#0D251B', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  button: { minHeight: 48, borderRadius: 16, backgroundColor: '#175E55', alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { backgroundColor: 'transparent' },
  secondaryButtonText: { color: '#005B44' },
});
