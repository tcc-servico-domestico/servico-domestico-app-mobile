import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { Pagamento, PagamentosApi } from '@/src/features/operations/contracts/pagamentos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { operationErrorMessage } from '@/src/features/operations/errorPresentation';
import { PixChargeCard } from './PixChargeCard';
import { listAllPayments } from './listAllPayments';
import { paymentTrackingStore, type TrackedPixCharge } from './paymentTrackingStore';
import { isPixExpired, isPagamentoTerminal, paymentStatusLabel, shouldPollPagamento, transactionLabel } from './paymentPresentation';
import { paymentSelectionReducer } from './paymentSelection';

interface Props {
  readonly api: PagamentosApi;
  readonly session: OperationsSession;
  readonly initialPagamentoId?: string;
  readonly showTrackedPix?: boolean;
  readonly onRouteSelectionChange?: (id: string | undefined) => void;
}

function friendlyError(error: unknown): string {
  return operationErrorMessage(error, 'Não foi possível consultar os pagamentos.');
}

function updateCollection(items: readonly Pagamento[], updated: Pagamento): readonly Pagamento[] {
  const index = items.findIndex((item) => item.id === updated.id);
  return index < 0 ? [updated, ...items] : items.map((item) => item.id === updated.id ? updated : item);
}

export function PagamentosScreen({ api, session, initialPagamentoId, onRouteSelectionChange, showTrackedPix = true }: Props) {
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
        listAllPayments(api),
        showTrackedPix ? paymentTrackingStore.load(session.userId) : Promise.resolve([]),
      ]);
      setPayments(response);
      setTracked(stored);
      dispatchSelection({ type: 'loaded', trackedId: stored[0]?.pagamentoId });
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [api, session.userId, showTrackedPix]);

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
        if (currentTracked?.pixCopiaECola && (isPixExpired(currentTracked.expiraEm) || isPagamentoTerminal(next))) {
          await paymentTrackingStore.removePixCode(session.userId, selectedId);
          if (!disposed) setTracked((items) => items.map((item) => item.pagamentoId === selectedId ? { ...item, pixCopiaECola: null } : item));
        }
        if (shouldPollPagamento(next)) timer = setTimeout(() => void poll(), 5000);
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
    <PaymentButton variant="back" title="Voltar aos pagamentos" onPress={() => { dispatchSelection({ type: 'back' }); setSelected(null); onRouteSelectionChange?.(undefined); }} />
    <Text accessibilityRole="header" style={styles.title}>Acompanhar pagamento</Text>
    {message ? <ErrorPanel message={selected ? `${message} Os dados abaixo são os últimos recebidos e podem estar desatualizados.` : message} onRetry={refresh} /> : null}
    {!selected && !message ? <Text accessibilityRole="progressbar">Carregando pagamento…</Text> : null}
    {selected ? <PixChargeCard pagamento={selected} tracked={selectedTracked} showPixInstructions={showTrackedPix} /> : null}
    {selected ? <TransactionHistory pagamento={selected} /> : null}
    <PaymentButton title={refreshing ? 'Atualizando…' : 'Atualizar pagamento'} disabled={refreshing} busy={refreshing} onPress={refresh} />
  </ScrollView>;

  return <FlatList style={styles.list} contentContainerStyle={[styles.container, fontScale > 1.3 && { paddingBottom: 96 }]}
      data={payments}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && payments.length > 0} onRefresh={() => void load()} />}
      ListHeaderComponent={<View style={styles.listHeader}>
        <Text accessibilityRole="header" style={styles.title}>{showTrackedPix ? 'Pagamentos' : 'Recebimentos'}</Text>
        <Text>Consulte um pagamento para ver o valor, a situação e o histórico disponível.</Text>
        {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
        {loading && payments.length === 0 ? <Text accessibilityRole="progressbar">Carregando pagamentos…</Text> : null}
        {!loading && !message && payments.length === 0 ? <View style={styles.empty}><MaterialCommunityIcons name="credit-card-outline" size={28} color="#005B44" /><Text style={styles.cardTitle}>Nenhum pagamento disponível</Text><Text>Os pagamentos acessíveis aparecerão aqui.</Text></View> : null}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver pagamento: ${paymentStatusLabel(item)}, ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}`} style={[styles.card, focusedId === item.id && styles.focused]} onFocus={() => setFocusedId(item.id)} onBlur={() => setFocusedId(null)} onPress={() => { dispatchSelection({ type: 'open', id: item.id }); onRouteSelectionChange?.(item.id); }}>
        <View style={styles.cardHeading}><Text style={styles.amount}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</Text><View style={[styles.statusBadge, item.status === 'Confirmado' && styles.statusBadgeConfirmed]}><Text style={styles.statusText}>{paymentStatusLabel(item)}</Text></View></View>
        {item.descricao ? <Text style={styles.description}>{item.descricao}</Text> : null}
        <Text style={styles.link}>Ver detalhes ›</Text>
      </Pressable>}
    />;
}

function TransactionHistory({ pagamento }: { readonly pagamento: Pagamento }) {
  return <View style={styles.history}><Text accessibilityRole="header" style={styles.subtitle}>Histórico de operações</Text>{pagamento.transacoes.length === 0 ? <Text>Nenhuma movimentação disponível.</Text> : [...pagamento.transacoes].sort((a, b) => (a.observadoEm ?? a.occurredAt ?? '').localeCompare(b.observadoEm ?? b.occurredAt ?? '')).map((item) => <View key={item.id} style={styles.historyItem}><View style={styles.historyDot} /><View style={styles.historyContent}><Text style={styles.historyLabel}>{transactionLabel(item)}</Text>{item.motivo ? <Text>{item.motivo}</Text> : null}</View></View>)}</View>;
}

function PaymentButton({ title, onPress, disabled = false, busy = false, variant = 'outline' }: {
  readonly title: string; readonly onPress: () => void; readonly disabled?: boolean; readonly busy?: boolean;
  readonly variant?: 'outline' | 'back';
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled, busy }}
    onPress={onPress} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.action, variant === 'back' && styles.backAction,
      focused && styles.focused, (disabled || pressed) && { opacity: 0.6 }]}>
    <Text style={styles.actionText}>{variant === 'back' ? `‹  ${title}` : title}</Text>
  </Pressable>;
}

function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><PaymentButton title="Tentar novamente" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, listHeader: { gap: 12 },
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#F8F4EB' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' }, subtitle: { fontSize: 18, fontWeight: '700', color: '#1B2421' },
  card: { borderWidth: 1, borderColor: '#DDDAD1', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, gap: 8, marginVertical: 6, minHeight: 48 }, cardTitle: { fontWeight: '700', color: '#10251D' },
  cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusBadge: { flexShrink: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E6EBE8' },
  statusBadgeConfirmed: { backgroundColor: '#E3F2EC' },
  statusText: { color: '#005B44', fontWeight: '700', fontSize: 13 },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#005B44', marginTop: 6 },
  historyContent: { flex: 1, gap: 4 }, historyLabel: { color: '#10251D', fontWeight: '700' },
  amount: { color: '#10251D', fontSize: 18, fontWeight: '700' }, description: { color: '#53655C' }, link: { color: '#005B44', fontWeight: '700' },
  focused: { borderWidth: 3, borderColor: '#175E55' },
  action: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#005B44', borderRadius: 14, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  backAction: { alignSelf: 'flex-start', paddingHorizontal: 0, borderColor: 'transparent', backgroundColor: 'transparent' },
  actionText: { color: '#005B44', fontWeight: '700', textAlign: 'center' },
  error: { borderColor: '#A3262E', borderWidth: 1, padding: 8, gap: 8 }, empty: { padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D1C9', borderRadius: 16, backgroundColor: '#FFFDFA' }, history: { gap: 8 },
});
