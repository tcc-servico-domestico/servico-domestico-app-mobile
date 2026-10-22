import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Button, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import type { Imovel, ImoveisApi, Page } from '@/src/features/operations/contracts/imoveis';
import type { Oferta, OfertasApi } from '@/src/features/operations/contracts/ofertas';
import type { Checklist, ProfissionalCompativel, Servico, ServicosApi } from '@/src/features/operations/contracts/servicos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createIdempotencyKey } from '@/src/features/operations/idempotency';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';
import { actionableChecklist, canCancel, canChooseProfessional, canComplete, canRespondToOffer, canStart, nextChecklistStatus } from './policy';
import { allowedRadii, emptyServicoForm, toCreateServicoInput, validateServico, type ServicoFormErrors, type ServicoFormValues } from './validation';

type Screen =
  | { readonly name: 'list' }
  | { readonly name: 'detail'; readonly servico: Servico }
  | { readonly name: 'create' }
  | { readonly name: 'matching'; readonly servico: Servico };

interface Props {
  readonly servicosApi: ServicosApi;
  readonly ofertasApi: OfertasApi;
  readonly imoveisApi: ImoveisApi;
  readonly session: OperationsSession;
}

function friendlyError(error: unknown): string {
  if (error instanceof HttpProblemError) return error.problem.detail ?? error.problem.title;
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function updateCollection(items: readonly Servico[], updated: Servico): readonly Servico[] {
  const index = items.findIndex((item) => item.id === updated.id);
  return index < 0 ? [updated, ...items] : items.map((item) => item.id === updated.id ? updated : item);
}

export function ServicosScreen({ servicosApi, ofertasApi, imoveisApi, session }: Props) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [servicos, setServicos] = useState<readonly Servico[]>([]);
  const [ofertas, setOfertas] = useState<readonly Oferta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const isClient = session.roles.includes('Cliente');
  const isProfessional = session.roles.includes('Profissional');

  const load = useCallback(async (requestedPage = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setMessage(null);
    try {
      const [servicesResponse, offersResponse] = await Promise.all([
        servicosApi.list({ page: requestedPage, pageSize: 20 }),
        isProfessional ? ofertasApi.list({ page: 1, pageSize: 20 }) : Promise.resolve(null),
      ]);
      setServicos((current) => append ? [...current, ...servicesResponse.items] : servicesResponse.items);
      setPage(servicesResponse.page);
      setTotal(servicesResponse.total);
      if (offersResponse) setOfertas(offersResponse.items);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [isProfessional, ofertasApi, servicosApi]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const servico = await servicosApi.get(id);
      setScreen({ name: 'detail', servico });
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [servicosApi]);

  const refreshDetail = useCallback(async (id: string) => {
    setMutating(true);
    try {
      const servico = await servicosApi.get(id);
      setServicos((items) => updateCollection(items, servico));
      setScreen({ name: 'detail', servico });
      setMessage(null);
    } catch (error) {
      if (error instanceof HttpProblemError && error.problem.status === 404) setScreen({ name: 'list' });
      setMessage(friendlyError(error));
    } finally {
      setMutating(false);
    }
  }, [servicosApi]);

  const saveServico = useCallback(async (input: ReturnType<typeof toCreateServicoInput>, key: string) => {
    setMutating(true);
    try {
      const created = await servicosApi.create(input, key);
      await paymentTrackingStore.save(session.userId, {
        pagamentoId: created.cobrancaPix.pagamentoId,
        servicoId: created.servico.id,
        pixCopiaECola: created.cobrancaPix.pixCopiaECola,
        expiraEm: created.cobrancaPix.expiraEm,
      });
      setServicos((items) => updateCollection(items, created.servico));
      setScreen({ name: 'detail', servico: created.servico });
      router.push({ pathname: './pagamentos', params: { pagamentoId: created.cobrancaPix.pagamentoId } });
    } finally {
      setMutating(false);
    }
  }, [router, servicosApi, session.userId]);

  const operate = useCallback(async (operation: (servico: Servico, key: string) => Promise<Servico>, servico: Servico) => {
    setMutating(true);
    setMessage(null);
    try {
      const updated = await operation(servico, createIdempotencyKey());
      setServicos((items) => updateCollection(items, updated));
      setScreen({ name: 'detail', servico: updated });
    } catch (error) {
      setMessage(friendlyError(error));
      if (error instanceof HttpProblemError && (error.problem.status === 409 || error.problem.status === 412)) void refreshDetail(servico.id);
    } finally {
      setMutating(false);
    }
  }, [refreshDetail]);

  const selectProfessional = useCallback(async (servico: Servico, profissionalId: string) => {
    await operate((current, key) => servicosApi.selectProfessional(current.id, profissionalId, current.aggregateVersion, key), servico);
  }, [operate, servicosApi]);

  const respondOffer = useCallback(async (oferta: Oferta, accepted: boolean) => {
    setMutating(true);
    setMessage(null);
    try {
      const updated = accepted
        ? await ofertasApi.accept(oferta.servicoId, oferta.versaoOferta, oferta.aggregateVersion, createIdempotencyKey())
        : await ofertasApi.reject(oferta.servicoId, oferta.versaoOferta, oferta.aggregateVersion, createIdempotencyKey());
      setOfertas((items) => items.map((item) => item.servicoId === updated.servicoId && item.versaoOferta === updated.versaoOferta ? updated : item));
      await load();
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setMutating(false);
    }
  }, [load, ofertasApi]);

  if (screen.name === 'create') return <ServicoForm api={imoveisApi} pending={mutating} onBack={() => setScreen({ name: 'list' })} onSave={saveServico} />;
  if (screen.name === 'matching') return <MatchingScreen servico={screen.servico} api={servicosApi} pending={mutating} onBack={() => setScreen({ name: 'detail', servico: screen.servico })} onSelect={selectProfessional} />;
  if (screen.name === 'detail') return <ServicoDetail
    servico={screen.servico} roles={session.roles} pending={mutating} message={message}
    onBack={() => { setScreen({ name: 'list' }); }}
    onReload={() => void refreshDetail(screen.servico.id)}
    onChoose={() => setScreen({ name: 'matching', servico: screen.servico })}
    onCancel={(motivo) => operate((current, key) => servicosApi.cancel(current.id, motivo, current.aggregateVersion, key), screen.servico)}
    onStart={() => operate((current, key) => servicosApi.start(current.id, current.aggregateVersion, key), screen.servico)}
    onChecklist={async (checklist, status) => {
      setMutating(true);
      setMessage(null);
      try {
        await servicosApi.updateChecklist(screen.servico.id, checklist.id, status, screen.servico.aggregateVersion, createIdempotencyKey());
        await refreshDetail(screen.servico.id);
      } catch (error) {
        setMessage(`${friendlyError(error)} Atualize o serviço antes de tentar outra ação.`);
      } finally { setMutating(false); }
    }}
    onComplete={() => operate((current, key) => servicosApi.complete(current.id, current.aggregateVersion, key), screen.servico)}
  />;

  return <View style={styles.container}>
    <View style={styles.heading}>
      <Text style={styles.title}>Serviços</Text>
      {isClient ? <Button title="Novo serviço" onPress={() => setScreen({ name: 'create' })} /> : null}
    </View>
    {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
    {loading && servicos.length === 0 ? <Center label="Carregando serviços" /> : null}
    {!loading && !message && servicos.length === 0 ? <Text style={styles.empty}>Nenhum serviço visível para este perfil.</Text> : null}
    <FlatList
      data={servicos} keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && servicos.length > 0} onRefresh={() => void load()} />}
      onEndReached={() => { if (!loading && !loadingMore && servicos.length < total) void load(page + 1, true); }}
      onEndReachedThreshold={0.3}
      renderItem={({ item }) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => void openDetail(item.id)}>
        <Text style={styles.cardTitle}>{item.status}</Text><Text>{formatDate(item.inicioPrevisto)} · {money(item.valor)}</Text>
      </Pressable>}
      ListFooterComponent={loadingMore ? <ActivityIndicator accessibilityLabel="Carregando mais serviços" /> : null}
      ListHeaderComponent={isProfessional ? <OffersSection offers={ofertas} pending={mutating} onRespond={respondOffer} /> : null}
    />
  </View>;
}

function ServicoForm({ api, pending, onBack, onSave }: { readonly api: ImoveisApi; readonly pending: boolean; readonly onBack: () => void; readonly onSave: (input: ReturnType<typeof toCreateServicoInput>, key: string) => Promise<void> }) {
  const [values, setValues] = useState<ServicoFormValues>(emptyServicoForm);
  const [imoveis, setImoveis] = useState<readonly Imovel[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(true);
  const [errors, setErrors] = useState<ServicoFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ readonly fingerprint: string; readonly key: string } | null>(null);

  useEffect(() => { void api.list({ page: 1, pageSize: 100 }).then((page: Page<Imovel>) => setImoveis(page.items)).catch((error: unknown) => setSubmitError(friendlyError(error))).finally(() => setLoadingImoveis(false)); }, [api]);
  const setValue = <K extends Exclude<keyof ServicoFormValues, 'checklists'>>(field: K, value: ServicoFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); setSubmitError(null);
  };
  const changeChecklist = (id: string, descricao: string) => setValues((current) => ({ ...current, checklists: current.checklists.map((item) => item.id === id ? { ...item, descricao } : item) }));
  const addChecklist = () => setValues((current) => ({ ...current, checklists: [...current.checklists, { id: createIdempotencyKey(), descricao: '' }] }));
  const removeChecklist = (id: string) => setValues((current) => ({ ...current, checklists: current.checklists.filter((item) => item.id !== id) }));
  const submit = async () => {
    const validation = validateServico(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const input = toCreateServicoInput(values);
    const fingerprint = JSON.stringify(input);
    const key = attempt?.fingerprint === fingerprint ? attempt.key : createIdempotencyKey();
    setAttempt({ fingerprint, key });
    try { await onSave(input, key); } catch (error) { setSubmitError(friendlyError(error)); }
  };
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Button title="Cancelar" onPress={onBack} disabled={pending} /><Text style={styles.title}>Novo serviço</Text>
    {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
    <Text style={styles.label}>Imóvel *</Text>
    {loadingImoveis ? <ActivityIndicator accessibilityLabel="Carregando imóveis" /> : imoveis.length === 0 ? <Text accessibilityRole="alert">Cadastre um imóvel ativo antes de criar um serviço.</Text> : imoveis.map((imovel) => <Pressable key={imovel.id} accessibilityRole="radio" accessibilityState={{ selected: values.imovelId === imovel.id }} style={[styles.choice, values.imovelId === imovel.id && styles.choiceSelected]} onPress={() => setValue('imovelId', imovel.id)}><Text>{imovel.descricao ?? imovel.endereco.logradouro}</Text><Text>{imovel.endereco.cidade}/{imovel.endereco.uf}</Text></Pressable>)}
    <Field label="Data inicial" value={values.dataInicio} placeholder="DD/MM/AAAA" error={errors.dataInicio} onChangeText={(value) => setValue('dataInicio', value)} required />
    <Field label="Hora inicial" value={values.horaInicio} placeholder="HH:mm" error={errors.horaInicio} onChangeText={(value) => setValue('horaInicio', value)} required />
    <Field label="Data final" value={values.dataFim} placeholder="DD/MM/AAAA" error={errors.dataFim} onChangeText={(value) => setValue('dataFim', value)} required />
    <Field label="Hora final" value={values.horaFim} placeholder="HH:mm" error={errors.horaFim} onChangeText={(value) => setValue('horaFim', value)} required />
    <Field label="Valor (R$)" value={values.valor} placeholder="0,00" error={errors.valor} keyboardType="decimal-pad" onChangeText={(value) => setValue('valor', value)} required />
    <Text style={styles.label}>Raio de busca *</Text><View style={styles.inline}>{allowedRadii.map((radius) => <Pressable key={radius} accessibilityRole="radio" accessibilityState={{ selected: values.raioBuscaKm === radius }} style={[styles.radius, values.raioBuscaKm === radius && styles.choiceSelected]} onPress={() => setValue('raioBuscaKm', radius)}><Text>{radius} km</Text></Pressable>)}</View>
    <Text style={styles.label}>Checklists *</Text>{errors.checklists ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.checklists}</Text> : null}
    {values.checklists.map((item, index) => <View key={item.id} style={styles.checklistRow}><Field label={`Checklist ${index + 1}`} value={item.descricao} error={errors.checklistItems?.[item.id]} onChangeText={(value) => changeChecklist(item.id, value)} required /><Button title="Remover" color="#a00" onPress={() => removeChecklist(item.id)} disabled={pending || values.checklists.length === 1} /></View>)}
    <Button title="Adicionar checklist" onPress={addChecklist} disabled={pending} />
    <Button title={pending ? 'Criando…' : 'Criar serviço'} onPress={() => void submit()} disabled={pending || loadingImoveis || imoveis.length === 0} />
  </ScrollView>;
}

function MatchingScreen({ servico, api, pending, onBack, onSelect }: { readonly servico: Servico; readonly api: ServicosApi; readonly pending: boolean; readonly onBack: () => void; readonly onSelect: (servico: Servico, profissionalId: string) => Promise<void> }) {
  const [items, setItems] = useState<readonly ProfissionalCompativel[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setLoading(true); setError(null); return api.listCompatibleProfessionals(servico.id, { page: 1, pageSize: 20 }).then((response) => setItems(response.items)).catch((cause: unknown) => setError(friendlyError(cause))).finally(() => setLoading(false)); }, [api, servico.id]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.container}><Button title="Voltar" onPress={onBack} disabled={pending} /><Text style={styles.title}>Profissionais compatíveis</Text>{loading ? <Center label="Carregando profissionais" /> : null}{error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}{!loading && !error && items.length === 0 ? <Text style={styles.empty}>Não há profissional compatível para o raio e horário escolhidos.</Text> : null}<FlatList data={items} keyExtractor={(item) => item.profissionalId} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.nomeExibicao ?? 'Profissional compatível'}</Text><Text>#{item.posicaoRanking} · {item.avaliacaoMedia.toFixed(1)} ({item.quantidadeAvaliacoes} avaliações) · {item.distanciaKm.toFixed(1)} km</Text><Button title="Selecionar" disabled={pending} onPress={() => void onSelect(servico, item.profissionalId)} /></View>} /></View>;
}

function ServicoDetail({ servico, roles, pending, message, onBack, onReload, onChoose, onCancel, onStart, onChecklist, onComplete }: { readonly servico: Servico; readonly roles: OperationsSession['roles']; readonly pending: boolean; readonly message: string | null; readonly onBack: () => void; readonly onReload: () => void; readonly onChoose: () => void; readonly onCancel: (motivo: string) => void; readonly onStart: () => void; readonly onChecklist: (checklist: Checklist, status: NonNullable<ReturnType<typeof nextChecklistStatus>>) => Promise<void>; readonly onComplete: () => void }) {
  const [showCancel, setShowCancel] = useState(false); const [motivo, setMotivo] = useState('');
  const next = actionableChecklist(servico); const nextStatus = next ? nextChecklistStatus(next) : null;
  return <ScrollView contentContainerStyle={styles.container}><Button title="Voltar" onPress={onBack} disabled={pending} /><Text style={styles.title}>Detalhe do serviço</Text>{message ? <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text> : null}<Text>Status: {servico.status}</Text><Text>Imóvel vinculado: {servico.imovelId}</Text><Text>Início: {formatDate(servico.inicioPrevisto)}</Text><Text>Fim: {formatDate(servico.fimPrevisto)}</Text><Text>Valor: {money(servico.valor)}</Text><Text>Raio: {servico.raioBuscaKm} km</Text>{servico.profissionalId ? <Text>Profissional selecionado.</Text> : null}
    <Text style={styles.label}>Checklists</Text>{[...servico.checklists].sort((a, b) => a.ordem - b.ordem).map((item) => <View key={item.id} style={styles.checklist}><Text>{item.ordem}. {item.descricao} — {item.status}</Text>{next?.id === item.id && nextStatus && servico.status === 'EmExecucao' ? <Button title={`Marcar como ${nextStatus}`} disabled={pending} onPress={() => void onChecklist(item, nextStatus)} /> : null}</View>)}
    {canChooseProfessional(roles, servico.status) ? <Button title="Escolher profissional" disabled={pending} onPress={onChoose} /> : null}{canCancel(roles, servico.status) ? <Button title="Cancelar serviço" color="#a00" disabled={pending} onPress={() => setShowCancel(true)} /> : null}{canStart(roles, servico.status) ? <Button title="Iniciar serviço" disabled={pending} onPress={onStart} /> : null}{canComplete(roles, servico) ? <Button title="Concluir serviço" disabled={pending} onPress={onComplete} /> : null}<Button title="Atualizar serviço" disabled={pending} onPress={onReload} />
    <Modal transparent visible={showCancel} animationType="fade" onRequestClose={() => setShowCancel(false)}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>Cancelar serviço?</Text><Field label="Motivo" value={motivo} onChangeText={setMotivo} required /><View style={styles.inline}><Button title="Voltar" onPress={() => setShowCancel(false)} disabled={pending} /><Button title="Confirmar cancelamento" color="#a00" disabled={pending || motivo.trim().length < 1 || motivo.trim().length > 300} onPress={() => { setShowCancel(false); onCancel(motivo.trim()); }} /></View></View></View></Modal>
  </ScrollView>;
}

function OffersSection({ offers, pending, onRespond }: { readonly offers: readonly Oferta[]; readonly pending: boolean; readonly onRespond: (oferta: Oferta, accepted: boolean) => Promise<void> }) {
  return <View style={styles.section}><Text style={styles.subtitle}>Minhas ofertas</Text>{offers.length === 0 ? <Text>Nenhuma oferta dirigida pendente.</Text> : offers.map((offer) => <View style={styles.card} key={`${offer.servicoId}-${offer.versaoOferta}`}><Text style={styles.cardTitle}>{offer.status}</Text><Text>{formatDate(offer.inicioPrevisto)} · {money(offer.valor)}</Text><Text>Expira em {formatDate(offer.expiraEmUtc)}</Text>{canRespondToOffer(['Profissional'], offer) ? <View style={styles.inline}><Button title="Recusar" color="#a00" disabled={pending} onPress={() => void onRespond(offer, false)} /><Button title="Aceitar" disabled={pending} onPress={() => void onRespond(offer, true)} /></View> : null}</View>)}</View>;
}

function Field({ label, error, required = false, ...props }: { readonly label: string; readonly error?: string; readonly required?: boolean; readonly value: string; readonly onChangeText: (value: string) => void; readonly placeholder?: string; readonly keyboardType?: 'default' | 'decimal-pad' }) { return <View style={styles.field}><Text style={styles.label}>{label}{required ? ' *' : ''}</Text><TextInput accessibilityLabel={label} accessibilityHint={error} style={styles.input} {...props} />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}</View>; }
function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) { return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button title="Tentar novamente" onPress={onRetry} /></View>; }
function Center({ label }: { readonly label: string }) { return <View style={styles.center}><ActivityIndicator accessibilityLabel={label} /></View>; }

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 22, fontWeight: '700' }, subtitle: { fontSize: 18, fontWeight: '700' }, label: { fontWeight: '600' }, card: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, gap: 6, marginVertical: 6 }, cardTitle: { fontWeight: '700' }, choice: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 10, gap: 3 }, choiceSelected: { borderColor: '#1769aa', borderWidth: 2, backgroundColor: '#eef7ff' }, radius: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 8 }, inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, field: { gap: 4 }, input: { borderWidth: 1, borderColor: '#777', borderRadius: 4, padding: 10, minHeight: 44 }, error: { borderColor: '#a00', borderWidth: 1, padding: 8, gap: 8 }, errorText: { color: '#a00' }, empty: { padding: 16, textAlign: 'center' }, checklistRow: { borderTopWidth: 1, borderColor: '#ddd', paddingTop: 8, gap: 8 }, checklist: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, gap: 6 }, section: { marginBottom: 12 }, modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }, modalCard: { backgroundColor: '#fff', padding: 20, borderRadius: 8, gap: 12 }, modalTitle: { fontSize: 20, fontWeight: '700' },
});
