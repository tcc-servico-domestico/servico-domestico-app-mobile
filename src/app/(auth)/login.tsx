import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Checkbox, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityFieldErrors, loginErrorMessage, validateIdentityForm, type IdentityFieldErrors } from '@/src/features/identity/formValidation';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [manterConectado, setManterConectado] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<IdentityFieldErrors>({});
  const [emailTouched, setEmailTouched] = useState(false);
  const [senhaTouched, setSenhaTouched] = useState(false);
  const validation = validateIdentityForm(email, senha, 'login', { email: emailTouched, password: senhaTouched });
  const emailError = validation.emailError ?? fieldErrors.email;
  const senhaError = validation.passwordError ?? fieldErrors.password;

  const handleLogin = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await login({ usuario: email.trim(), senha }, manterConectado);
      router.replace('/(tabs)/home');
    } catch (cause) {
      if (cause instanceof HttpProblemError) setFieldErrors(identityFieldErrors(cause.problem.errors));
      setError(cause instanceof HttpProblemError ? loginErrorMessage(cause.problem.status, cause.message) : loginErrorMessage());
    } finally {
      setSubmitting(false);
    }
  };

  const handleEsqueciSenha = () => {
    Alert.alert('Recuperação de senha indisponível', 'Esta opção ainda não está disponível no aplicativo.');
  };

  const handleCadastro = () => {
    router.push('/(auth)/cadastro');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Faça seu login</Text>
      <Text>Informe seu e-mail e senha para acessar sua conta. Todos os campos são obrigatórios.</Text>

      <TextInput
        label="E-mail *"
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(null); }}
        onBlur={() => setEmailTouched(true)}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        placeholder="Email"
        placeholderTextColor="#ccc"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel="E-mail"
        accessibilityHint={emailError ?? 'Campo obrigatório.'}
        error={Boolean(emailError)}
      />
      {emailError ? <HelperText type="error" accessibilityLiveRegion="polite">{emailError}</HelperText> : null}

      <TextInput
        label="Senha *"
        value={senha}
        onChangeText={(value) => { setSenha(value); setFieldErrors((current) => ({ ...current, password: undefined })); setError(null); }}
        onBlur={() => setSenhaTouched(true)}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor="#ccc"
        autoComplete="current-password"
        accessibilityLabel="Senha"
        accessibilityHint={senhaError ?? 'Campo obrigatório.'}
        error={Boolean(senhaError)}
      />
      {senhaError ? <HelperText type="error" accessibilityLiveRegion="polite">{senhaError}</HelperText> : null}

      <View style={styles.row}> 
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setManterConectado(!manterConectado)}
            accessibilityRole="checkbox"
            accessibilityLabel="Continuar conectado"
            accessibilityState={{ checked: manterConectado }}
          >
          <View style={styles.checkbox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Checkbox
                status={manterConectado ? 'checked' : 'unchecked'}
                onPress={() => setManterConectado(!manterConectado)}
            />
          </View>
          <Text>Continuar conectado</Text>
          </TouchableOpacity>

        <TouchableOpacity style={styles.linkTarget} onPress={handleEsqueciSenha} accessibilityRole="button" accessibilityLabel="Esqueci a senha">
          <Text style={styles.linkText}>Esqueci a senha</Text>
        </TouchableOpacity>
      </View>

      {error ? <HelperText type="error" accessibilityLiveRegion="polite">{error}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleLogin}
        style={styles.loginButton}
        contentStyle={{ minHeight: 50 }}
        loading={submitting}
        disabled={submitting || !validation.canSubmit}
        accessibilityLabel="Entrar"
        accessibilityState={{ disabled: submitting || !validation.canSubmit, busy: submitting }}
      >
        Entrar
      </Button>

      <TouchableOpacity style={styles.linkTarget} onPress={handleCadastro} accessibilityRole="button" accessibilityLabel="Criar uma conta">
        <Text style={styles.cadastroText}>Não tenho conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 32,
    gap: 8,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f9f8f6',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    alignItems: 'center',
    borderStyle: 'solid',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minHeight: 44,
  },
  linkText: {
    color: '#175E55',
    fontSize: 14,
  },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  loginButton: {
    borderRadius: 25,
    marginBottom: 20,
  },
  cadastroText: {
    color: '#175E55',
    textAlign: 'center',
    fontSize: 14,
  },
});
