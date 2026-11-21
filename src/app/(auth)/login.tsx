import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Alert, type TextInput as NativeTextInput } from 'react-native';
import { TextInput, Button, Checkbox, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePrototypeFonts } from '@/src/context/TypographyContext';
import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityFieldErrors, loginErrorMessage, validateIdentityForm, type IdentityFieldErrors } from '@/src/features/identity/formValidation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, sessionNotice } = useAuth();
  const customFonts = usePrototypeFonts();
  const emailInput = useRef<NativeTextInput>(null);
  const senhaInput = useRef<NativeTextInput>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

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
    setEmailTouched(true);
    setSenhaTouched(true);
    const result = validateIdentityForm(email, senha, 'login', { email: true, password: true });
    if (!result.canSubmit) {
      if (result.emailError) emailInput.current?.focus();
      else if (result.passwordError) senhaInput.current?.focus();
      return;
    }
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
      <View style={styles.brand} accessibilityLabel="Serviço Doméstico">
        <View style={styles.brandIcon}><MaterialCommunityIcons name="home-outline" size={25} color="#FFFFFF" /><MaterialCommunityIcons name="star-four-points" size={10} color="#F8C562" style={styles.brandSparkle} /></View>
        <Text style={[styles.brandText, customFonts && { fontFamily: 'BricolageBold' }]}>Serviço{'\n'}Doméstico</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.title, customFonts && { fontFamily: 'BricolageExtraBold' }]}>Entrar</Text>
      {sessionNotice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.sessionNotice}>{sessionNotice}</Text> : null}
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorNotice}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#A3262E" />
        <Text style={styles.errorText}>{error}</Text>
      </View> : null}
      <Text style={styles.description}>Informe seu e-mail e senha para acessar sua conta. Todos os campos são obrigatórios.</Text>
      <Text style={styles.fieldLabel}>E-mail *</Text>

      <TextInput
        ref={emailInput}
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(null); }}
        onBlur={() => setEmailTouched(true)}
        style={styles.input}
        mode="outlined"
        outlineStyle={styles.inputOutline}
        outlineColor="#AEB7AA"
        activeOutlineColor="#005B44"
        placeholder="Email"
        placeholderTextColor="#465550"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel="E-mail"
        accessibilityHint={emailError ?? 'Campo obrigatório.'}
        error={Boolean(emailError)}
      />
      {emailError ? <HelperText type="error" accessibilityLiveRegion="polite">{emailError}</HelperText> : null}

      <Text style={styles.fieldLabel}>Senha *</Text>
      <TextInput
        ref={senhaInput}
        value={senha}
        onChangeText={(value) => { setSenha(value); setFieldErrors((current) => ({ ...current, password: undefined })); setError(null); }}
        onBlur={() => setSenhaTouched(true)}
        style={styles.input}
        mode="outlined"
        outlineStyle={styles.inputOutline}
        outlineColor="#AEB7AA"
        activeOutlineColor="#005B44"
        secureTextEntry={!mostrarSenha}
        right={<TextInput.Icon icon={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} onPress={() => setMostrarSenha((visible) => !visible)} accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} forceTextInputFocus={false} />}
        placeholder="Senha"
        placeholderTextColor="#465550"
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
            aria-checked={manterConectado}
          >
          <View style={styles.checkbox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
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

      <Button
        mode="contained"
        onPress={handleLogin}
        style={styles.loginButton}
        contentStyle={{ minHeight: 56 }}
        buttonColor="#005B44"
        theme={{ colors: { surfaceDisabled: '#B8D9CA', onSurfaceDisabled: '#163C2E' } }}
        icon="login"
        loading={submitting}
        disabled={submitting}
        accessibilityLabel={submitting ? 'Entrando' : 'Entrar'}
        accessibilityState={{ disabled: submitting, busy: submitting }}
      >
        {submitting ? 'Entrando…' : 'Entrar'}
      </Button>

      <TouchableOpacity style={styles.linkTarget} onPress={handleCadastro} accessibilityRole="button" accessibilityLabel="Criar uma conta">
        <Text style={styles.cadastroText}>Ainda não tem conta? <Text style={styles.cadastroLink}>Criar conta</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingBottom: 32,
    gap: 6,
    backgroundColor: '#F8F4EB',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  brandIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center' },
  brandSparkle: { position: 'absolute', top: 2, right: 2 },
  brandText: { fontSize: 16, lineHeight: 19, color: '#10251D', fontWeight: 'bold' },
  description: { color: '#40534B', marginBottom: 12 },
  sessionNotice: { color: '#614900', backgroundColor: '#FFF1CF', borderRadius: 12, padding: 12 },
  errorNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: 1, borderColor: '#E9B8B4', borderRadius: 16, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: '#8D2025', fontSize: 15, lineHeight: 22 },
  fieldLabel: { color: '#10251D', fontSize: 15, fontWeight: 'bold', marginTop: 8 },
  inputOutline: { borderRadius: 18, borderWidth: 1.5 },
  title: {
    fontSize: 28,
    color: '#1B2421',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFEFB',
    marginBottom: 6,
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
    minHeight: 48,
  },
  linkText: {
    color: '#175E55',
    fontSize: 14,
  },
  linkTarget: { minHeight: 48, justifyContent: 'center' },
  loginButton: {
    borderRadius: 16,
    marginBottom: 20,
  },
  cadastroLink: { color: '#005B44', fontWeight: 'bold', textDecorationLine: 'underline' },
  cadastroText: {
    color: '#10251D',
    textAlign: 'center',
    fontSize: 14,
  },
});
