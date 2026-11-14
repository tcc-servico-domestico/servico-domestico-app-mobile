import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import { confirmationDestination } from '@/src/features/identity/confirmationNavigation';
import { identityApi } from '@/src/shared/runtime';

export default function ConfirmarAlteracaoEmail() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { status } = useAuth();
  const router = useRouter();
  const destination = confirmationDestination(status);
  const requested = useRef<string | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando novo e-mail…');

  useEffect(() => {
    if (typeof token !== 'string' || !token) {
      setState('error');
      setMessage('O link está incompleto. Abra o link enviado ao novo e-mail.');
      return;
    }
    if (requested.current === token) return;
    requested.current = token;
    identityApi.confirmEmailChange(token).then(() => {
      setState('success');
      setMessage('Novo e-mail confirmado.');
    }).catch(() => {
      setState('error');
      setMessage('Não foi possível confirmar o novo e-mail. Consulte sua conta antes de solicitar outro link.');
    });
  }, [token]);

  return <ScrollView contentContainerStyle={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>Confirmar novo e-mail</Text>
    {state === 'loading' ? <ActivityIndicator accessibilityLabel="Confirmando novo e-mail" /> : null}
    <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>
    {state !== 'loading' ? <Button title={destination.label} onPress={() => router.replace(destination.route)} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16, backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' },
  body: { fontSize: 16, color: '#1B2421' },
});
