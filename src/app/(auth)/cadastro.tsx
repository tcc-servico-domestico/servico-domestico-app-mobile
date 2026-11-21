import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePrototypeFonts } from '@/src/context/TypographyContext';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityFieldErrors, registrationOutcomeUncertain, validateIdentityForm, type IdentityFieldErrors } from '@/src/features/identity/formValidation';

export default function CadastroScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { register } = useAuth();
  const customFonts = usePrototypeFonts();
  const [mostrarSenha, setMostrarSenha] = useState(false);

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

  usePreventRemove(!message && (email.length > 0 || senha.length > 0), ({ data }) => {
    Alert.alert('Descartar cadastro?', 'Os dados ainda não foram enviados ou podem não ter sido confirmados. Ao sair, os campos serão apagados.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const handleCadastro = async () => {
    if (submitting) return;
    setEmailTouched(true);
    setSenhaTouched(true);
    if (!validateIdentityForm(email, senha, 'registration', { email: true, password: true }).canSubmit) return;
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

  if (message) return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.brand} accessibilityLabel="Serviço Doméstico">
      <View style={styles.brandIcon}><MaterialCommunityIcons name="home-outline" size={25} color="#FFFFFF" /></View>
      <Text style={[styles.brandText, customFonts && { fontFamily: 'BricolageBold' }]}>Serviço{'\n'}Doméstico</Text>
    </View>
    <Text accessibilityRole="header" style={[styles.title, customFonts && { fontFamily: 'BricolageExtraBold' }]}>Confirme seu e-mail</Text>
    <View style={styles.successCard} accessibilityLiveRegion="polite">
      <View style={styles.successIcon}><MaterialCommunityIcons name="email-check-outline" size={32} color="#005B44" /></View>
      <Text style={styles.successText}>Cadastro recebido. Verifique seu e-mail para confirmar a conta.</Text>
      <Text style={styles.successEmail}>{email.trim()}</Text>
      <View style={styles.successSteps}>
        <Text style={styles.successStep}>1. Abra a mensagem de confirmação na sua caixa de entrada.</Text>
        <Text style={styles.successStep}>2. Abra o link recebido para confirmar seu e-mail.</Text>
        <Text style={styles.successStep}>3. Volte ao aplicativo e entre com seus dados.</Text>
      </View>
    </View>
    <Button mode="contained" buttonColor="#005B44" contentStyle={{ minHeight: 56 }} style={styles.cadastroButton} onPress={handleVoltarLogin}>Ir para entrar</Button>
  </ScrollView>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar para entrar" onPress={handleVoltarLogin} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#005B44" />
        </TouchableOpacity>
        <View style={styles.brandMark} accessibilityLabel="Serviço Doméstico">
          <View style={styles.brandIcon}><MaterialCommunityIcons name="home-outline" size={25} color="#FFFFFF" /></View>
          <Text style={[styles.brandText, customFonts && { fontFamily: 'BricolageBold' }]}>Serviço{'\n'}Doméstico</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.title, customFonts && { fontFamily: 'BricolageExtraBold' }]}>Seus dados de acesso</Text>
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, submissionUncertain ? styles.uncertainNotice : styles.errorNotice]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color={submissionUncertain ? '#614900' : '#A3262E'} />
        <View style={styles.noticeBody}>
          <Text style={[styles.noticeTitle, submissionUncertain ? styles.uncertainText : styles.errorText]}>{submissionUncertain ? 'Resultado não confirmado' : 'Não foi possível criar a conta'}</Text>
          <Text style={[styles.noticeText, submissionUncertain ? styles.uncertainText : styles.errorText]}>{error}</Text>
        </View>
      </View> : null}
      <Text style={styles.description}>Todos os campos são obrigatórios.</Text>
      <Text style={styles.fieldLabel}>E-mail *</Text>

      <TextInput
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); if (!submissionUncertain) setError(null); }}
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
      {!emailError ? <Text style={styles.fieldHint}>Você vai receber um link para confirmar seu e-mail.</Text> : null}

      <Text style={styles.fieldLabel}>Senha *</Text>
      <TextInput
        value={senha}
        onChangeText={(value) => { setSenha(value); setFieldErrors((current) => ({ ...current, password: undefined })); if (!submissionUncertain) setError(null); }}
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
        autoComplete="new-password"
        accessibilityLabel="Senha"
        accessibilityHint={senhaError ?? 'Mínimo de 8 caracteres.'}
        error={Boolean(senhaError)}
      />
      {senhaError ? <HelperText type="error" accessibilityLiveRegion="polite">{senhaError}</HelperText> : null}
      {!senhaError ? <Text style={styles.fieldHint}>Use pelo menos 8 caracteres.</Text> : null}

      <Button
        mode="contained"
        onPress={handleCadastro}
        style={styles.cadastroButton}
        contentStyle={{ minHeight: 56 }}
        buttonColor="#005B44"
        theme={{ colors: { surfaceDisabled: '#B8D9CA', onSurfaceDisabled: '#163C2E' } }}
        loading={submitting}
        disabled={submitting}
        accessibilityLabel={submitting ? 'Criando conta' : 'Criar conta'}
        accessibilityState={{ disabled: submitting, busy: submitting }}
      >
        {submitting ? 'Criando conta…' : 'Criar conta'}
      </Button>

      <TouchableOpacity style={styles.linkTarget} onPress={handleVoltarLogin} accessibilityRole="button" accessibilityLabel="Já tenho conta; ir para login">
        <Text style={styles.loginText}>Já tem conta? <Text style={styles.loginLink}>Entrar</Text></Text>
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
  brandMark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
  brandIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 16, lineHeight: 19, color: '#10251D', fontWeight: 'bold' },
  description: { color: '#40534B', marginBottom: 12 },
  fieldLabel: { color: '#10251D', fontSize: 15, fontWeight: 'bold', marginTop: 8 },
  fieldHint: { color: '#40534B', fontSize: 14 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: 1, borderRadius: 16 },
  noticeBody: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeText: { fontSize: 15, lineHeight: 22 },
  uncertainNotice: { backgroundColor: '#FFF1CF', borderColor: '#E8D69A' },
  errorNotice: { backgroundColor: '#FFF0EE', borderColor: '#E9B8B4' },
  uncertainText: { color: '#614900' },
  errorText: { color: '#8D2025' },
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
  successCard: { borderWidth: 1, borderColor: '#DDDAD1', borderRadius: 16, backgroundColor: '#FFFDFA', padding: 24, gap: 12, alignItems: 'center', marginVertical: 16 },
  successIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#DCF1E8', alignItems: 'center', justifyContent: 'center' },
  successText: { color: '#40534B', fontSize: 16, textAlign: 'center' },
  successEmail: { color: '#10251D', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  successSteps: { alignSelf: 'stretch', gap: 8 },
  successStep: { color: '#10251D', fontSize: 16, lineHeight: 23 },
  cadastroButton: {
    borderRadius: 16,
    marginBottom: 20,
  },
  loginLink: { color: '#005B44', fontWeight: 'bold', textDecorationLine: 'underline' },
  loginText: {
    color: '#10251D',
    textAlign: 'center',
    fontSize: 14,
  },
  linkTarget: { minHeight: 48, justifyContent: 'center' },
});
