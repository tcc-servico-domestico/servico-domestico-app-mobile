import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityFieldErrors, registrationOutcomeUncertain, validateIdentityForm, type IdentityFieldErrors } from '@/src/features/identity/formValidation';

export default function CadastroScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<IdentityFieldErrors>({});
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [senhaTouched, setSenhaTouched] = useState(false);
  const validation = validateIdentityForm(email, senha, 'registration', { email: emailTouched, password: senhaTouched });
  const emailError = validation.emailError ?? fieldErrors.email;
  const senhaError = validation.passwordError ?? fieldErrors.password;

  const handleCadastro = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    setFieldErrors({});
    try {
      await register({ email: email.trim(), senha });
      setSubmissionUncertain(false);
      setMessage('Cadastro recebido. Verifique seu e-mail para confirmar a conta.');
    } catch (cause) {
      if (cause instanceof HttpProblemError) setFieldErrors(identityFieldErrors(cause.problem.errors));
      const uncertain = registrationOutcomeUncertain(cause instanceof HttpProblemError ? cause.problem.status : undefined);
      setSubmissionUncertain(uncertain);
      setError(uncertain
        ? 'Não foi possível confirmar se o cadastro foi recebido. Verifique seu e-mail antes de tentar novamente.'
        : cause instanceof HttpProblemError ? cause.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoltarLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Crie sua conta</Text>
      <Text>Informe seu e-mail e uma senha com pelo menos 8 caracteres. Todos os campos são obrigatórios.</Text>

      <TextInput
        label="E-mail *"
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); if (!submissionUncertain) setError(null); }}
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
        onChangeText={(value) => { setSenha(value); setFieldErrors((current) => ({ ...current, password: undefined })); if (!submissionUncertain) setError(null); }}
        onBlur={() => setSenhaTouched(true)}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor="#ccc"
        autoComplete="new-password"
        accessibilityLabel="Senha"
        accessibilityHint={senhaError ?? 'Mínimo de 8 caracteres.'}
        error={Boolean(senhaError)}
      />
      {senhaError ? <HelperText type="error" accessibilityLiveRegion="polite">{senhaError}</HelperText> : null}

      {error ? <HelperText type="error" accessibilityLiveRegion="polite">{error}</HelperText> : null}
      {message ? <HelperText type="info" accessibilityLiveRegion="polite">{message}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleCadastro}
        style={styles.cadastroButton}
        contentStyle={{ minHeight: 50 }}
        loading={submitting}
        disabled={submitting || !validation.canSubmit}
        accessibilityLabel="Cadastrar"
        accessibilityState={{ disabled: submitting || !validation.canSubmit, busy: submitting }}
      >
        Cadastrar
      </Button>

      <TouchableOpacity style={styles.linkTarget} onPress={handleVoltarLogin} accessibilityRole="button" accessibilityLabel="Já tenho conta; ir para login">
        <Text style={styles.loginText}>Já tenho conta</Text>
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
  cadastroButton: {
    borderRadius: 25,
    marginBottom: 20,
  },
  loginText: {
    color: '#175E55',
    textAlign: 'center',
    fontSize: 14,
  },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
});
