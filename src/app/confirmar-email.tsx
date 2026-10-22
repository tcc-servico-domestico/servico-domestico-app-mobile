import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';

export default function ConfirmEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { confirmEmail } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail…');

  useEffect(() => {
    const value = Array.isArray(token) ? token[0] : token;
    if (!value) {
      setState('error');
      setMessage('O link de confirmação é inválido.');
      return;
    }

    let active = true;
    confirmEmail(value).then(() => {
      if (!active) return;
      setState('success');
      setMessage('E-mail confirmado. Você já pode entrar.');
    }).catch((cause) => {
      if (!active) return;
      setState('error');
      setMessage(cause instanceof HttpProblemError ? cause.message : 'Não foi possível confirmar o e-mail.');
    });
    return () => { active = false; };
  }, [confirmEmail, token]);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {state === 'loading' && <ActivityIndicator size="large" />}
      <Text variant="titleMedium" style={styles.message}>{message}</Text>
      {state !== 'loading' && (
        <Button mode="contained" onPress={() => router.replace('/(auth)/login')}>Ir para login</Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  message: { textAlign: 'center' },
});
