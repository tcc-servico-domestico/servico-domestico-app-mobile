import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import type { UserProfile } from '@/src/features/identity/contracts';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityApi } from '@/src/shared/runtime';

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const userId = session?.userId;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteUncertain, setDeleteUncertain] = useState(false);
  const [changeUncertain, setChangeUncertain] = useState(false);
  const submittingRef = useRef(false);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(false);
    if (!userId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    identityApi.getProfile(userId).then((result) => {
      if (active && result.id === userId) { setProfile(result); setChangeUncertain(false); }
      else if (active) setError(true);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId, attempt]);

  useEffect(() => { setEmail(''); setMessage(''); setConfirmDelete(false); setDeleteUncertain(false); setChangeUncertain(false); }, [userId]);

  async function requestChange() {
    const value = email.trim();
    if (!userId || submittingRef.current || deleteUncertain || changeUncertain) return;
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setMessage('Informe um e-mail válido com até 254 caracteres.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await identityApi.requestEmailChange(userId, value);
      setMessage('Solicitação registrada. Confirme o link enviado ao novo e-mail.');
      retry();
    } catch (cause) {
      if (!(cause instanceof HttpProblemError) || cause.problem.status >= 500 || cause.problem.status === 0 || cause.problem.status === 408)
        setChangeUncertain(true);
      setMessage(cause instanceof HttpProblemError && cause.problem.status === 409
        ? 'Este e-mail já está cadastrado.'
        : 'Não foi possível confirmar a solicitação. Atualize a conta antes de tentar novamente.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function removeAccount() {
    if (!userId || submittingRef.current || deleteUncertain) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await identityApi.deleteAccount(userId);
      await logout();
    } catch {
      setConfirmDelete(false);
      setDeleteUncertain(true);
      setMessage('Não foi possível confirmar a exclusão. Saia e tente entrar novamente; uma falha no login não comprova que a conta foi excluída.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Minha conta</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando conta" /> : null}
      {error ? <>
        <Text accessibilityRole="alert" style={styles.body}>Não foi possível consultar sua conta.</Text>
        <Button title="Tentar novamente" onPress={retry} />
      </> : null}
      {profile && profile.id === userId ? <>
        <Text style={styles.body}>E-mail: {profile.email}</Text>
        <Text style={styles.body}>Conta: {profile.ativo ? 'Ativa' : 'Inativa'}</Text>
        <Text style={styles.body}>E-mail: {profile.emailVerificado ? 'Confirmado' : 'Não confirmado'}</Text>
        {profile.emailPendente ? <Text style={styles.body}>Aguardando confirmação: {profile.emailPendente}</Text> : null}
        <Text style={styles.body}>Novo e-mail</Text>
        <TextInput accessibilityLabel="Novo e-mail" autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <Button title={submitting ? 'Enviando…' : 'Solicitar alteração de e-mail'} onPress={requestChange} disabled={submitting || deleteUncertain || changeUncertain} />
        {changeUncertain ? <Button title="Atualizar conta" onPress={retry} disabled={submitting} /> : null}
        {!confirmDelete && !deleteUncertain ? <Button title="Excluir conta" color="#A3262E" onPress={() => setConfirmDelete(true)} disabled={submitting} /> : null}
        {confirmDelete ? <>
          <Text style={styles.body}>Deseja encerrar sua conta? Você perderá o acesso ao aplicativo.</Text>
          <Button title="Confirmar exclusão" color="#A3262E" onPress={removeAccount} disabled={submitting} />
          <Button title="Voltar" onPress={() => setConfirmDelete(false)} disabled={submitting} />
        </> : null}
        {deleteUncertain ? <Button title="Sair e tentar entrar" onPress={() => void logout()} /> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
      </> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16, backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' },
  body: { fontSize: 16, color: '#1B2421' },
  input: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 4, padding: 12, color: '#1B2421' },
});
