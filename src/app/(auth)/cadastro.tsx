import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';

export default function CadastroScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCadastro = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await register({ email: email.trim(), senha });
      setMessage('Cadastro recebido. Verifique seu e-mail para confirmar a conta.');
    } catch (cause) {
      setError(cause instanceof HttpProblemError ? cause.message : 'Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoltarLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crie sua conta</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        placeholder="Email"
        placeholderTextColor="#ccc"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel="E-mail"
      />

      <TextInput
        label="Senha"
        value={senha}
        onChangeText={setSenha}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor="#ccc"
        autoComplete="new-password"
        accessibilityLabel="Senha"
      />

      <HelperText type="error" visible={Boolean(error)} accessibilityLiveRegion="polite">{error}</HelperText>
      <HelperText type="info" visible={Boolean(message)} accessibilityLiveRegion="polite">{message}</HelperText>

      <Button
        mode="contained"
        onPress={handleCadastro}
        style={styles.cadastroButton}
        contentStyle={{ height: 50 }}
        loading={submitting}
        disabled={submitting || !email.trim() || senha.length < 8}
        accessibilityLabel="Cadastrar"
      >
        Cadastrar
      </Button>

      <TouchableOpacity onPress={handleVoltarLogin}>
        <Text style={styles.loginText}>Já tenho conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f9f8f6',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  cadastroButton: {
    borderRadius: 25,
    backgroundColor: '#f68c1f',
    marginBottom: 20,
  },
  loginText: {
    color: '#f68c1f',
    textAlign: 'center',
    fontSize: 14,
  },
});
