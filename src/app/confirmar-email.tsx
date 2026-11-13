import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { useAuth } from '@/src/context/AuthContext';
import { confirmationDestination } from '@/src/features/identity/confirmationNavigation';
import { HttpProblemError } from '@/src/shared/contracts/http';

export default function ConfirmEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { confirmEmail, status } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail…');
  const destination = confirmationDestination(status);

  useEffect(() => {
    const value = Array.isArray(token) ? token[0] : token;
    if (!value) {
      setState('error');
      setMessage('O link de confirmação está incompleto. Abra o link recebido por e-mail novamente.');
      return;
    }

    let active = true;
    confirmEmail(value).then(() => {
      if (!active) return;
      setState('success');
      setMessage('E-mail confirmado.');
    }).catch((cause) => {
      if (!active) return;
      setState('error');
      setMessage(cause instanceof HttpProblemError ? cause.message : 'Não foi possível confirmar o e-mail. Verifique o link recebido e tente novamente.');
    });
    return () => { active = false; };
  }, [confirmEmail, token]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall" accessibilityRole="header" style={styles.message}>Confirmação de e-mail</Text>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        {state === 'loading' && <ActivityIndicator size="large" accessibilityLabel="Confirmando e-mail" />}
        <Text variant="titleMedium" style={styles.message} accessibilityRole={state === 'error' ? 'alert' : undefined}>{message}{state === 'success' && status === 'anonymous' ? ' Você já pode entrar.' : ''}</Text>
      </View>
      {state !== 'loading' && (
        <Button mode="contained" contentStyle={styles.button} accessibilityLabel={destination.label} onPress={() => router.replace(destination.route)}>
          {destination.label}
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  status: { alignItems: 'center', gap: 16 },
  button: { minHeight: 48 },
  message: { textAlign: 'center' },
});
