import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Button, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Pagamento, PagamentosApi } from '@/src/features/operations/contracts/pagamentos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { PixChargeCard } from './PixChargeCard';
import { paymentTrackingStore, type TrackedPixCharge } from './paymentTrackingStore';
import { isPixExpired, isPagamentoTerminal, paymentStatusLabel, shouldPollPagamento } from './paymentPresentation';

interface Props {
  readonly api: PagamentosApi;
  readonly session: OperationsSession;
  readonly initialPagamentoId?: string;
}

function friendlyError(error: unknown): string {
  if (error instanceof HttpProblemError) return error.problem.detail ?? error.problem.title;
  return error instanceof Error ? error.message : 'Não foi possível consultar os pagamentos.';
}

function updateCollection(items: readonly Pagamento[], updated: Pagamento): readonly Pagamento[] {
  const index = items.findIndex((item) => item.id === updated.id);
  return index < 0 ? [updated, ...items] : items.map((item) => item.id === updated.id ? updated : item);
}

export function PagamentosScreen({ api, session, initialPagamentoId }: Props) {
  const [payments, setPayments] = useState<readonly Pagamento[]>([]);
  const [tracked, setTracked] = useState<readonly TrackedPixCharge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialPagamentoId ?? null);
  const [selected, setSelected] = useState<Pagamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [retryToken, setRetryToken] = useState(0);

  const trackedById = useMemo(() => new Map(tracked.map((item) => [item.pagamentoId, item])), [tracked]);
  const selectedTracked = selectedId ? trackedById.get(selectedId) : undefined;

  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const [response, stored] = await Promise.all([
        api.list({ page: 1, pageSize: 100 }),
        paymentTrackingStore.load(session.userId),
      ]);
      setPayments(response.items);
      setTracked(stored);
      if (!selectedId && stored[0]) setSelectedId(stored[0].pagamentoId);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [api, selectedId, session.userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!selectedId || !foreground) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (disposed) return;
      setRefreshing(true);
      try {
        const next = await api.get(selectedId);
        if (disposed) return;
        setSelected(next);
        setPayments((items) => updateCollection(items, next));
        setMessage(null);
        const currentTracked = trackedById.get(selectedId);
        if (currentTracked && (isPixExpired(currentTracked.expiraEm) || isPagamentoTerminal(next))) {
          await paymentTrackingStore.removePixCode(session.userId, selectedId);
          if (!disposed) setTracked((items) => items.map((item) => item.pagamentoId === selectedId ? { ...item, pixCopiaECola: null } : item));
        }
        if (shouldPollPagamento(next, currentTracked?.expiraEm)) timer = setTimeout(() => void poll(), 5000);
      } catch (error) {
        if (!disposed) setMessage(friendlyError(error));
      } finally {
        if (!disposed) setRefreshing(false);
      }
    };

    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [api, foreground, retryToken, selectedId, session.userId, trackedById]);

  const refresh = () => setRetryToken((value) => value + 1);
  if (selectedId) return <ScrollView contentContainerStyle={styles.container}>
    <Button title="Voltar aos pagamentos" onPress={() => { setSelectedId(null); setSelected(null); }} />
    <Text style={styles.title}>Acompanhar pagamento</Text>
    {message ? <ErrorPanel message={message} onRetry={refresh} /> : null}
    {!selected && !message ? <Text accessibilityRole="progressbar">Carregando pagamento…</Text> : null}
    {selected ? <PixChargeCard pagamento={selected} tracked={selectedTracked} /> : null}
    {selected ? <TransactionHistory pagamento={selected} /> : null}
    <Button title={refreshing ? 'Atualizando…' : 'Atualizar pagamento'} disabled={refreshing} onPress={refresh} />
  </ScrollView>;

  return <View style={styles.container}>
    <Text style={styles.title}>Pagamentos</Text>
    {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
    {loading && payments.length === 0 ? <Text accessibilityRole="progressbar">Carregando pagamentos…</Text> : null}
    {!loading && !message && payments.length === 0 ? <Text style={styles.empty}>Nenhum pagamento visível para este perfil.</Text> : null}
    <FlatList
      data={payments}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && payments.length > 0} onRefresh={() => void load()} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => setSelectedId(item.id)}>
        <Text style={styles.cardTitle}>{paymentStatusLabel(item)}</Text>
        <Text>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</Text>
      </Pressable>}
    />
  </View>;
}

function TransactionHistory({ pagamento }: { readonly pagamento: Pagamento }) {
  return <View style={styles.history}><Text style={styles.subtitle}>Histórico</Text>{[...pagamento.transacoes].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map((item) => <View key={item.id}><Text>{item.operacao}: {item.status}</Text>{item.motivo ? <Text>{item.motivo}</Text> : null}</View>)}</View>;
}

function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button title="Tentar novamente" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' }, subtitle: { fontSize: 18, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, gap: 6, marginVertical: 6 }, cardTitle: { fontWeight: '700' },
  error: { borderColor: '#a00', borderWidth: 1, padding: 8, gap: 8 }, empty: { padding: 16, textAlign: 'center' }, history: { gap: 8 },
});
