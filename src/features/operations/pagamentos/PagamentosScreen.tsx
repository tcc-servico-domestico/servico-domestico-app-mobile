import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, Button, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { Pagamento, PagamentosApi } from '@/src/features/operations/contracts/pagamentos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { operationErrorMessage } from '@/src/features/operations/errorPresentation';
import { PixChargeCard } from './PixChargeCard';
import { paymentTrackingStore, type TrackedPixCharge } from './paymentTrackingStore';
import { isPixExpired, isPagamentoTerminal, paymentStatusLabel, shouldPollPagamento, transactionLabel } from './paymentPresentation';
import { paymentSelectionReducer } from './paymentSelection';

interface Props {
  readonly api: PagamentosApi;
  readonly session: OperationsSession;
  readonly initialPagamentoId?: string;
  readonly onRouteSelectionChange?: (id: string | undefined) => void;
}

function friendlyError(error: unknown): string {
  return operationErrorMessage(error, 'Não foi possível consultar os pagamentos.');
}

function updateCollection(items: readonly Pagamento[], updated: Pagamento): readonly Pagamento[] {
  const index = items.findIndex((item) => item.id === updated.id);
  return index < 0 ? [updated, ...items] : items.map((item) => item.id === updated.id ? updated : item);
}

export function PagamentosScreen({ api, session, initialPagamentoId, onRouteSelectionChange }: Props) {
  const { fontScale } = useWindowDimensions();
  const [payments, setPayments] = useState<readonly Pagamento[]>([]);
  const [tracked, setTracked] = useState<readonly TrackedPixCharge[]>([]);
  const [selection, dispatchSelection] = useReducer(paymentSelectionReducer, { selectedId: initialPagamentoId ?? null, initialized: false });
  const { selectedId } = selection;
  const previousRouteId = useRef(initialPagamentoId);
  const [selected, setSelected] = useState<Pagamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [retryToken, setRetryToken] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);

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
      dispatchSelection({ type: 'loaded', trackedId: stored[0]?.pagamentoId });
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [api, session.userId]);

  useEffect(() => {
    if (previousRouteId.current === initialPagamentoId) return;
    previousRouteId.current = initialPagamentoId;
    if (initialPagamentoId) {
      setSelected(null);
      setMessage(null);
      dispatchSelection({ type: 'open', id: initialPagamentoId });
      void load();
    }
  }, [initialPagamentoId, load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
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
    <Button title="Voltar aos pagamentos" color="#175E55" onPress={() => { dispatchSelection({ type: 'back' }); setSelected(null); onRouteSelectionChange?.(undefined); }} />
    <Text accessibilityRole="header" style={styles.title}>Acompanhar pagamento</Text>
    {message ? <ErrorPanel message={selected ? `${message} Os dados abaixo são os últimos recebidos e podem estar desatualizados.` : message} onRetry={refresh} /> : null}
    {!selected && !message ? <Text accessibilityRole="progressbar">Carregando pagamento…</Text> : null}
    {selected ? <PixChargeCard pagamento={selected} tracked={selectedTracked} /> : null}
    {selected ? <TransactionHistory pagamento={selected} /> : null}
    <Button title={refreshing ? 'Atualizando…' : 'Atualizar pagamento'} color="#175E55" disabled={refreshing} accessibilityState={{ disabled: refreshing, busy: refreshing }} onPress={refresh} />
  </ScrollView>;

  return <FlatList style={styles.list} contentContainerStyle={[styles.container, fontScale > 1.3 && { paddingBottom: 96 }]}
      data={payments}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && payments.length > 0} onRefresh={() => void load()} />}
      ListHeaderComponent={<View style={styles.listHeader}>
        <Text accessibilityRole="header" style={styles.title}>Pagamentos</Text>
        <Text>Consulte um pagamento para ver o valor, a situação e o histórico disponível.</Text>
        {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
        {loading && payments.length === 0 ? <Text accessibilityRole="progressbar">Carregando pagamentos…</Text> : null}
        {!loading && !message && payments.length === 0 ? <Text style={styles.empty}>Nenhum pagamento visível para este perfil.</Text> : null}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver pagamento: ${paymentStatusLabel(item)}, ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}`} style={[styles.card, focusedId === item.id && styles.focused]} onFocus={() => setFocusedId(item.id)} onBlur={() => setFocusedId(null)} onPress={() => { dispatchSelection({ type: 'open', id: item.id }); onRouteSelectionChange?.(item.id); }}>
        <Text style={styles.cardTitle}>{paymentStatusLabel(item)}</Text>
        <Text>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</Text>
      </Pressable>}
    />;
}

function TransactionHistory({ pagamento }: { readonly pagamento: Pagamento }) {
  return <View style={styles.history}><Text accessibilityRole="header" style={styles.subtitle}>Histórico</Text>{pagamento.transacoes.length === 0 ? <Text>Nenhuma movimentação disponível.</Text> : [...pagamento.transacoes].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map((item) => <View key={item.id}><Text>{transactionLabel(item)}</Text>{item.motivo ? <Text>{item.motivo}</Text> : null}</View>)}</View>;
}

function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button title="Tentar novamente" color="#175E55" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, listHeader: { gap: 12 },
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' }, subtitle: { fontSize: 18, fontWeight: '700', color: '#1B2421' },
  card: { borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, gap: 6, marginVertical: 6, minHeight: 44 }, cardTitle: { fontWeight: '700', color: '#1B2421' },
  focused: { borderWidth: 3, borderColor: '#175E55' },
  error: { borderColor: '#A3262E', borderWidth: 1, padding: 8, gap: 8 }, empty: { padding: 16, textAlign: 'center' }, history: { gap: 8 },
});
