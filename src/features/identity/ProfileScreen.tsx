import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import type { UserProfile } from '@/src/features/identity/contracts';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { identityApi } from '@/src/shared/runtime';

function AccountButton({ title, onPress, disabled, color }: { title: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const destructive = color === '#A3262E';
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, destructive && styles.destructiveAction, disabled && styles.disabledAction, pressed && styles.pressedAction]}>
    <Text style={[styles.actionText, destructive && styles.destructiveText]}>{title}</Text>
  </Pressable>;
}

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
      {loading ? <ActivityIndicator accessibilityLabel="Carregando conta" /> : null}
      {error ? <>
        <Text accessibilityRole="alert" style={styles.body}>Não foi possível consultar sua conta.</Text>
        <AccountButton title="Tentar novamente" onPress={retry} />
      </> : null}
      {profile && profile.id === userId ? <>
        <View style={styles.card}>
          <Text style={styles.label}>E-mail de acesso</Text>
          <Text style={styles.value}>{profile.email}</Text>
          <View style={styles.divider} />
          <View style={styles.infoRow}><Text style={styles.label}>Verificação</Text><Text style={styles.value}>{profile.emailVerificado ? 'Confirmado' : 'Não confirmado'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.label}>Conta</Text><Text style={styles.value}>{profile.ativo ? 'Ativa' : 'Inativa'}</Text></View>
          {session?.roles?.length ? <View style={styles.infoRow}><Text style={styles.label}>Perfis</Text><Text style={styles.value}>{session.roles.join(' e ')}</Text></View> : null}
          {profile.emailPendente ? <Text style={styles.body}>Aguardando confirmação: {profile.emailPendente}</Text> : null}
        </View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>E-mail</Text>
        <Text style={styles.body}>Novo e-mail</Text>
        <TextInput accessibilityLabel="Novo e-mail" autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <AccountButton color="#005B44" title={submitting ? 'Enviando…' : 'Solicitar alteração de e-mail'} onPress={requestChange} disabled={submitting || deleteUncertain || changeUncertain} />
        {changeUncertain ? <AccountButton title="Atualizar conta" onPress={retry} disabled={submitting} /> : null}
        <Text accessibilityRole="header" style={styles.sectionTitle}>Sessão</Text>
        <AccountButton title="Sair da conta" color="#005B44" onPress={() => void logout()} disabled={submitting} />
        <View style={styles.divider} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>Encerrar conta</Text>
        {!confirmDelete && !deleteUncertain ? <AccountButton title="Excluir conta" color="#A3262E" onPress={() => setConfirmDelete(true)} disabled={submitting} /> : null}
        {confirmDelete ? <>
          <Text style={styles.body}>Deseja encerrar sua conta? Você perderá o acesso ao aplicativo.</Text>
          <AccountButton title="Confirmar exclusão" color="#A3262E" onPress={removeAccount} disabled={submitting} />
          <AccountButton title="Voltar" onPress={() => setConfirmDelete(false)} disabled={submitting} />
        </> : null}
        {deleteUncertain ? <AccountButton title="Sair e tentar entrar" onPress={() => void logout()} /> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
      </> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16, backgroundColor: '#F8F4EB' },
  card: { padding: 16, borderWidth: 1, borderColor: '#DDDAD1', borderRadius: 16, backgroundColor: '#FFFDFA', gap: 8 },
  label: { color: '#53655C', fontSize: 14, flexShrink: 1 },
  value: { color: '#10251D', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  divider: { height: 1, backgroundColor: '#E2E0D8' },
  sectionTitle: { fontSize: 17, color: '#10251D', fontWeight: '700', marginTop: 4 },
  action: { minHeight: 48, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCF1E8' },
  actionText: { color: '#005B44', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  destructiveAction: { borderWidth: 1, borderColor: '#A3262E', backgroundColor: '#FFF8F6' },
  destructiveText: { color: '#A3262E' },
  disabledAction: { opacity: 0.5 },
  pressedAction: { opacity: 0.75 },
  body: { fontSize: 16, color: '#1B2421' },
  input: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 12, padding: 12, minHeight: 48, backgroundColor: '#FFFFFF', color: '#1B2421' },
});
