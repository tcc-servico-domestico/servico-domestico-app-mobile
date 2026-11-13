import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Button, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';

import type { Imovel, ImoveisApi, Page } from '@/src/features/operations/contracts/imoveis';
import type { Oferta, OfertasApi } from '@/src/features/operations/contracts/ofertas';
import type { Checklist, ProfissionalCompativel, Servico, ServicosApi } from '@/src/features/operations/contracts/servicos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createIdempotencyKey } from '@/src/features/operations/idempotency';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';
import { actionableChecklist, canCancel, canChooseProfessional, canComplete, canRespondToOffer, canStart, canUpdateChecklist, nextChecklistStatus } from './policy';
import { checklistStatusLabel, offerStatusLabel, propertyDescription, serviceStatusLabel } from './servicePresentation';
import { allowedRadii, emptyServicoForm, toCreateServicoInput, validateServico, type ServicoFormErrors, type ServicoFormValues } from './validation';
import { creationAttemptFor, type CreationAttempt } from '@/src/features/operations/creationAttempt';
import { operationErrorMessage } from '@/src/features/operations/errorPresentation';

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
  return operationErrorMessage(error, 'Não foi possível concluir a operação.');
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
  const { fontScale } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [servicos, setServicos] = useState<readonly Servico[]>([]);
  const [ofertas, setOfertas] = useState<readonly Oferta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const actionInFlight = useRef(false);
  const [serviceUncertain, setServiceUncertain] = useState(false);
  const [offerUncertain, setOfferUncertain] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [creationAttempt, setCreationAttempt] = useState<CreationAttempt | null>(null);
  const [creationDraft, setCreationDraft] = useState<ServicoFormValues>(emptyServicoForm);

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
      setOfferUncertain(false);
    } catch (error) {
      setMessage(`${friendlyError(error)} Atualize a lista para consultar a situação antes de tentar novamente.`);
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
      setServiceUncertain(false);
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
      setServiceUncertain(false);
      setMessage(null);
    } catch (error) {
      if (error instanceof HttpProblemError && error.problem.status === 404) setScreen({ name: 'list' });
      else setServiceUncertain(true);
      setMessage(`${friendlyError(error)} Não foi possível atualizar o estado do serviço; consulte novamente antes de executar outra ação.`);
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
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setMutating(true);
    setMessage(null);
    try {
      const updated = await operation(servico, createIdempotencyKey());
      setServicos((items) => updateCollection(items, updated));
      setScreen({ name: 'detail', servico: updated });
    } catch (error) {
      setScreen({ name: 'detail', servico });
      setServiceUncertain(true);
      setMessage(`${friendlyError(error)} O resultado da ação não pôde ser confirmado. Atualize o serviço antes de tentar novamente.`);
      if (error instanceof HttpProblemError && (error.problem.status === 409 || error.problem.status === 412)) await refreshDetail(servico.id);
    } finally {
      actionInFlight.current = false;
      setMutating(false);
    }
  }, [refreshDetail]);

  const selectProfessional = useCallback(async (servico: Servico, profissionalId: string) => {
    await operate((current, key) => servicosApi.selectProfessional(current.id, profissionalId, current.aggregateVersion, key), servico);
  }, [operate, servicosApi]);

  const respondOffer = useCallback(async (oferta: Oferta, accepted: boolean) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setMutating(true);
    setMessage(null);
    try {
      const updated = accepted
        ? await ofertasApi.accept(oferta.servicoId, oferta.versaoOferta, oferta.aggregateVersion, createIdempotencyKey())
        : await ofertasApi.reject(oferta.servicoId, oferta.versaoOferta, oferta.aggregateVersion, createIdempotencyKey());
      setOfertas((items) => items.map((item) => item.servicoId === updated.servicoId && item.versaoOferta === updated.versaoOferta ? updated : item));
      await load();
    } catch (error) {
      setOfferUncertain(true);
      setMessage(`${friendlyError(error)} O resultado da resposta não pôde ser confirmado. Atualize a lista antes de tentar novamente.`);
    } finally {
      actionInFlight.current = false;
      setMutating(false);
    }
  }, [load, ofertasApi]);

  if (screen.name === 'create') return <ServicoForm api={imoveisApi} pending={mutating} attempt={creationAttempt} setAttempt={setCreationAttempt} creationDraft={creationDraft} setCreationDraft={setCreationDraft} onBack={() => setScreen({ name: 'list' })} onSave={saveServico} />;
  if (screen.name === 'matching') return <MatchingScreen servico={screen.servico} api={servicosApi} pending={mutating} onBack={() => setScreen({ name: 'detail', servico: screen.servico })} onSelect={selectProfessional} />;
  if (screen.name === 'detail') return <ServicoDetail
    servico={screen.servico} imoveisApi={imoveisApi} roles={session.roles} pending={mutating} actionsDisabled={serviceUncertain} message={message}
    onBack={() => { setScreen({ name: 'list' }); }}
    onReload={() => void refreshDetail(screen.servico.id)}
    onChoose={() => setScreen({ name: 'matching', servico: screen.servico })}
    onCancel={(motivo) => operate((current, key) => servicosApi.cancel(current.id, motivo, current.aggregateVersion, key), screen.servico)}
    onStart={() => operate((current, key) => servicosApi.start(current.id, current.aggregateVersion, key), screen.servico)}
    onChecklist={async (checklist, status) => {
      if (actionInFlight.current) return;
      actionInFlight.current = true;
      setMutating(true);
      setMessage(null);
      try {
        await servicosApi.updateChecklist(screen.servico.id, checklist.id, status, screen.servico.aggregateVersion, createIdempotencyKey());
        await refreshDetail(screen.servico.id);
      } catch (error) {
        setServiceUncertain(true);
        setMessage(`${friendlyError(error)} Atualize o serviço antes de tentar outra ação.`);
      } finally { actionInFlight.current = false; setMutating(false); }
    }}
    onComplete={() => operate((current, key) => servicosApi.complete(current.id, current.aggregateVersion, key), screen.servico)}
  />;

  return <FlatList style={styles.matchingList} contentContainerStyle={[styles.container, fontScale > 1.3 && { paddingBottom: 96 }]}
      data={servicos} keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && servicos.length > 0} onRefresh={() => void load()} />}
      onEndReached={() => { if (!loading && !loadingMore && servicos.length < total) void load(page + 1, true); }}
      onEndReachedThreshold={0.3}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver serviço: ${serviceStatusLabel(item.status)}, ${formatDate(item.inicioPrevisto)}, ${money(item.valor)}`} style={[styles.card, focusedId === item.id && styles.focused]} onFocus={() => setFocusedId(item.id)} onBlur={() => setFocusedId(null)} onPress={() => void openDetail(item.id)}>
        <Text style={styles.cardTitle}>{serviceStatusLabel(item.status)}</Text><Text>{formatDate(item.inicioPrevisto)} · {money(item.valor)}</Text>
      </Pressable>}
      ListFooterComponent={loadingMore ? <ActivityIndicator accessibilityLabel="Carregando mais serviços" /> : null}
      ListHeaderComponent={<View style={styles.matchingHeader}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Serviços</Text>{isClient ? <Button color="#175E55" title="Novo serviço" onPress={() => setScreen({ name: 'create' })} /> : null}</View>
        <Text>Selecione um serviço para consultar sua situação e as ações disponíveis para seu perfil.</Text>
        {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
        {loading && servicos.length === 0 ? <Center label="Carregando serviços" /> : null}
        {!loading && !message && servicos.length === 0 ? <Text style={styles.empty}>Nenhum serviço visível para este perfil.</Text> : null}
        {isProfessional && (!loading || ofertas.length > 0) && (!message || ofertas.length > 0) ? <OffersSection offers={ofertas} pending={mutating || offerUncertain} onRespond={respondOffer} /> : null}
      </View>}
    />;
}

function ServicoForm({ api, pending, attempt, setAttempt, creationDraft, setCreationDraft, onBack, onSave }: { readonly api: ImoveisApi; readonly pending: boolean; readonly attempt: CreationAttempt | null; readonly setAttempt: (attempt: CreationAttempt | null) => void; readonly creationDraft: ServicoFormValues; readonly setCreationDraft: (draft: ServicoFormValues) => void; readonly onBack: () => void; readonly onSave: (input: ReturnType<typeof toCreateServicoInput>, key: string) => Promise<void> }) {
  const [values, setValues] = useState<ServicoFormValues>(creationDraft);
  const [imoveis, setImoveis] = useState<readonly Imovel[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(true);
  const [imoveisError, setImoveisError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ServicoFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focusedChoice, setFocusedChoice] = useState<string | null>(null);
  const submitting = useRef(false);

  const loadImoveis = useCallback(async () => {
    setLoadingImoveis(true);
    setImoveisError(null);
    try {
      const page: Page<Imovel> = await api.list({ page: 1, pageSize: 100 });
      setImoveis(page.items);
    } catch (error) {
      setImoveisError(friendlyError(error));
    } finally {
      setLoadingImoveis(false);
    }
  }, [api]);
  useEffect(() => { void loadImoveis(); }, [loadImoveis]);
  const setValue = <K extends Exclude<keyof ServicoFormValues, 'checklists'>>(field: K, value: ServicoFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); setSubmitError(null);
  };
  const changeChecklist = (id: string, descricao: string) => setValues((current) => ({ ...current, checklists: current.checklists.map((item) => item.id === id ? { ...item, descricao } : item) }));
  const addChecklist = () => setValues((current) => ({ ...current, checklists: [...current.checklists, { id: createIdempotencyKey(), descricao: '' }] }));
  const removeChecklist = (id: string) => setValues((current) => ({ ...current, checklists: current.checklists.filter((item) => item.id !== id) }));
  const submit = async () => {
    if (submitting.current) return;
    const validation = validateServico(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const input = toCreateServicoInput(values);
    const fingerprint = JSON.stringify(input);
    const nextAttempt = creationAttemptFor(attempt, fingerprint, createIdempotencyKey);
    if (!nextAttempt) {
      setSubmitError('O resultado da tentativa anterior ainda não foi confirmado. Volte à lista e atualize os serviços antes de criar outro com dados diferentes.');
      return;
    }
    setAttempt(nextAttempt);
    submitting.current = true;
    try {
      await onSave(input, nextAttempt.key);
      setAttempt(null);
      setCreationDraft(emptyServicoForm);
    } catch (error) {
      if (error instanceof HttpProblemError && (error.problem.status === 400 || error.problem.status === 422)) {
        setAttempt(null);
        setSubmitError(friendlyError(error));
      } else {
        setSubmitError(`${friendlyError(error)} O resultado não foi confirmado. Atualize a lista de serviços antes de iniciar outra criação; para repetir esta tentativa, mantenha os mesmos dados.`);
      }
    } finally {
      submitting.current = false;
    }
  };
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Button color="#175E55" title="Voltar" onPress={() => { setCreationDraft(values); onBack(); }} disabled={pending} /><Text accessibilityRole="header" style={styles.title}>Novo serviço</Text>
    <Text>Preencha os campos obrigatórios (*) e confira os dados antes de criar o serviço.</Text>
    {attempt ? <Text accessibilityRole="alert">Há uma criação anterior com resultado não confirmado. Os dados foram preservados para que você possa consultá-los antes de repetir.</Text> : null}
    {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
    <Text style={styles.label}>Imóvel *</Text>
    {errors.imovelId ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.imovelId}</Text> : null}
    {loadingImoveis ? <ActivityIndicator accessibilityLabel="Carregando imóveis" /> : imoveisError ? <ErrorPanel message={`Não foi possível carregar os imóveis. ${imoveisError}`} onRetry={() => void loadImoveis()} /> : imoveis.length === 0 ? <Text accessibilityRole="alert">Nenhum imóvel encontrado. Cadastre um imóvel ativo antes de criar um serviço.</Text> : imoveis.map((imovel) => <Pressable key={imovel.id} accessibilityRole="radio" accessibilityState={{ selected: values.imovelId === imovel.id }} style={[styles.choice, values.imovelId === imovel.id && styles.choiceSelected, focusedChoice === `imovel-${imovel.id}` && styles.focused]} onFocus={() => setFocusedChoice(`imovel-${imovel.id}`)} onBlur={() => setFocusedChoice(null)} onPress={() => setValue('imovelId', imovel.id)}><Text>{imovel.descricao ?? imovel.endereco.logradouro}{values.imovelId === imovel.id ? ' — selecionado' : ''}</Text><Text>{imovel.endereco.cidade}/{imovel.endereco.uf}</Text></Pressable>)}
    <Field label="Data inicial" value={values.dataInicio} placeholder="DD/MM/AAAA" error={errors.dataInicio} onChangeText={(value) => setValue('dataInicio', value)} required />
    <Field label="Hora inicial" value={values.horaInicio} placeholder="HH:mm" error={errors.horaInicio} onChangeText={(value) => setValue('horaInicio', value)} required />
    <Field label="Data final" value={values.dataFim} placeholder="DD/MM/AAAA" error={errors.dataFim} onChangeText={(value) => setValue('dataFim', value)} required />
    <Field label="Hora final" value={values.horaFim} placeholder="HH:mm" error={errors.horaFim} onChangeText={(value) => setValue('horaFim', value)} required />
    <Field label="Valor (R$)" value={values.valor} placeholder="0,00" error={errors.valor} keyboardType="decimal-pad" onChangeText={(value) => setValue('valor', value)} required />
    <Text style={styles.label}>Raio de busca *</Text><View style={styles.inline}>{allowedRadii.map((radius) => <Pressable key={radius} accessibilityRole="radio" accessibilityState={{ selected: values.raioBuscaKm === radius }} style={[styles.radius, values.raioBuscaKm === radius && styles.choiceSelected, focusedChoice === `raio-${radius}` && styles.focused]} onFocus={() => setFocusedChoice(`raio-${radius}`)} onBlur={() => setFocusedChoice(null)} onPress={() => setValue('raioBuscaKm', radius)}><Text>{radius} km{values.raioBuscaKm === radius ? ' — selecionado' : ''}</Text></Pressable>)}</View>
    {errors.raioBuscaKm ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.raioBuscaKm}</Text> : null}
    <Text style={styles.label}>Checklists *</Text>{errors.checklists ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.checklists}</Text> : null}
    {values.checklists.map((item, index) => <View key={item.id} style={styles.checklistRow}><Field label={`Checklist ${index + 1}`} value={item.descricao} error={errors.checklistItems?.[item.id]} onChangeText={(value) => changeChecklist(item.id, value)} required /><Button title="Remover" color="#A3262E" onPress={() => removeChecklist(item.id)} disabled={pending || values.checklists.length === 1} /></View>)}
    <Button color="#175E55" title="Adicionar checklist" onPress={addChecklist} disabled={pending} />
    <Button color="#175E55" title={pending ? 'Criando…' : 'Criar serviço'} onPress={() => void submit()} disabled={pending || loadingImoveis || Boolean(imoveisError) || imoveis.length === 0} />
  </ScrollView>;
}

function MatchingScreen({ servico, api, pending, onBack, onSelect }: { readonly servico: Servico; readonly api: ServicosApi; readonly pending: boolean; readonly onBack: () => void; readonly onSelect: (servico: Servico, profissionalId: string) => Promise<void> }) {
  const { fontScale } = useWindowDimensions();
  const [items, setItems] = useState<readonly ProfissionalCompativel[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProfissionalCompativel | null>(null);
  const load = useCallback(() => { setLoading(true); setError(null); return api.listCompatibleProfessionals(servico.id, { page: 1, pageSize: 20 }).then((response) => setItems(response.items)).catch((cause: unknown) => setError(friendlyError(cause))).finally(() => setLoading(false)); }, [api, servico.id]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.matchingContainer}><FlatList style={styles.matchingList} contentContainerStyle={[styles.matchingContent, fontScale > 1.3 && { paddingBottom: 96 }]} data={items} keyExtractor={(item) => item.profissionalId} ListHeaderComponent={<View style={styles.matchingHeader}><Button color="#175E55" title="Voltar" onPress={onBack} disabled={pending} /><Text accessibilityRole="header" style={styles.title}>Profissionais compatíveis</Text>{loading ? <Center label="Carregando profissionais" /> : null}{error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}{!loading && !error && items.length === 0 ? <Text style={styles.empty}>Não há profissional compatível para o raio e horário escolhidos.</Text> : null}</View>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.nomeExibicao ?? 'Profissional compatível'}</Text><Text>#{item.posicaoRanking} · {item.avaliacaoMedia.toFixed(1)} ({item.quantidadeAvaliacoes} avaliações) · {item.distanciaKm.toFixed(1)} km</Text><Button color="#175E55" title="Selecionar" disabled={pending} onPress={() => setSelected(item)} /></View>} />
    <Modal transparent visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
      <Text accessibilityRole="header" style={styles.modalTitle}>Selecionar profissional?</Text>
      <Text>Ao confirmar, será enviada uma oferta para {selected?.nomeExibicao ?? 'o profissional escolhido'}. Você pode voltar sem enviar.</Text>
      <View style={styles.inline}><Button color="#175E55" title="Voltar" disabled={pending} onPress={() => setSelected(null)} /><Button color="#175E55" title="Confirmar seleção" disabled={pending} onPress={() => { if (!selected) return; const id = selected.profissionalId; setSelected(null); void onSelect(servico, id); }} /></View>
    </ScrollView></View></Modal>
  </View>;
}

function ServicoDetail({ servico, imoveisApi, roles, pending, actionsDisabled, message, onBack, onReload, onChoose, onCancel, onStart, onChecklist, onComplete }: { readonly servico: Servico; readonly imoveisApi: ImoveisApi; readonly roles: OperationsSession['roles']; readonly pending: boolean; readonly actionsDisabled: boolean; readonly message: string | null; readonly onBack: () => void; readonly onReload: () => void; readonly onChoose: () => void; readonly onCancel: (motivo: string) => void; readonly onStart: () => void; readonly onChecklist: (checklist: Checklist, status: NonNullable<ReturnType<typeof nextChecklistStatus>>) => Promise<void>; readonly onComplete: () => void }) {
  const [showCancel, setShowCancel] = useState(false); const [motivo, setMotivo] = useState('');
  const [confirmation, setConfirmation] = useState<'start' | 'complete' | null>(null);
  const [propertyLabel, setPropertyLabel] = useState('Descrição indisponível');
  const canViewProperty = roles.includes('Cliente');
  useEffect(() => {
    let active = true;
    setPropertyLabel(canViewProperty ? 'Carregando descrição…' : 'Descrição indisponível para este perfil');
    void propertyDescription(imoveisApi, servico.imovelId, canViewProperty).then((label) => {
      if (active) setPropertyLabel(label);
    });
    return () => { active = false; };
  }, [canViewProperty, imoveisApi, servico.imovelId]);
  const next = actionableChecklist(servico); const nextStatus = next ? nextChecklistStatus(next) : null;
  return <ScrollView contentContainerStyle={styles.container}><Button color="#175E55" title="Voltar" onPress={onBack} disabled={pending} /><Text accessibilityRole="header" style={styles.title}>Detalhe do serviço</Text>{message ? <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text> : null}<Text>Situação: {serviceStatusLabel(servico.status)}</Text><Text>Imóvel vinculado: {propertyLabel}</Text><Text>Início: {formatDate(servico.inicioPrevisto)}</Text><Text>Fim: {formatDate(servico.fimPrevisto)}</Text><Text>Valor: {money(servico.valor)}</Text><Text>Raio: {servico.raioBuscaKm} km</Text>{servico.profissionalId ? <Text>Profissional selecionado.</Text> : null}
    <Text style={styles.label}>Checklists</Text>{[...servico.checklists].sort((a, b) => a.ordem - b.ordem).map((item) => <View key={item.id} style={styles.checklist}><Text>{item.ordem}. {item.descricao} — {checklistStatusLabel(item.status)}</Text>{canUpdateChecklist(roles, servico, item) && nextStatus ? <Button color="#175E55" title={`Marcar como ${checklistStatusLabel(nextStatus)}`} disabled={pending || actionsDisabled} onPress={() => void onChecklist(item, nextStatus)} /> : null}</View>)}
    {canChooseProfessional(roles, servico.status) ? <Button color="#175E55" title="Escolher profissional" disabled={pending || actionsDisabled} onPress={onChoose} /> : null}{canCancel(roles, servico.status) ? <Button title="Cancelar serviço" color="#A3262E" disabled={pending || actionsDisabled} onPress={() => setShowCancel(true)} /> : null}{canStart(roles, servico.status) ? <Button color="#175E55" title="Iniciar serviço" disabled={pending || actionsDisabled} onPress={() => setConfirmation('start')} /> : null}{canComplete(roles, servico) ? <Button color="#175E55" title="Concluir serviço" disabled={pending || actionsDisabled} onPress={() => setConfirmation('complete')} /> : null}<Button color="#175E55" title="Atualizar serviço" disabled={pending} onPress={onReload} />
    <Modal transparent visible={confirmation !== null} animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
      <Text accessibilityRole="header" style={styles.modalTitle}>{confirmation === 'start' ? 'Iniciar serviço?' : 'Concluir serviço?'}</Text>
      <Text>{confirmation === 'start' ? 'Ao confirmar, o serviço passará para execução. Você pode voltar sem iniciar.' : 'Ao confirmar, o serviço será concluído e poderá iniciar a liberação do valor. Você pode voltar sem concluir.'}</Text>
      <View style={styles.inline}><Button color="#175E55" title="Voltar" disabled={pending} onPress={() => setConfirmation(null)} /><Button color="#175E55" title={confirmation === 'start' ? 'Confirmar início' : 'Confirmar conclusão'} disabled={pending || actionsDisabled} onPress={() => { const action = confirmation; setConfirmation(null); if (action === 'start') onStart(); else if (action === 'complete') onComplete(); }} /></View>
    </ScrollView></View></Modal>
    <Modal transparent visible={showCancel} animationType="fade" onRequestClose={() => setShowCancel(false)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled"><Text accessibilityRole="header" style={styles.modalTitle}>Cancelar serviço?</Text><Text>Ao confirmar, será solicitada a alteração da situação do serviço para cancelado. Você pode voltar sem enviar o cancelamento.</Text><Field label="Motivo" value={motivo} onChangeText={setMotivo} required /><Text>Informe de 1 a 300 caracteres.</Text><View style={styles.inline}><Button color="#175E55" title="Voltar" onPress={() => setShowCancel(false)} disabled={pending} /><Button title="Confirmar cancelamento" color="#A3262E" disabled={pending || motivo.trim().length < 1 || motivo.trim().length > 300} onPress={() => { setShowCancel(false); onCancel(motivo.trim()); }} /></View></ScrollView></View></Modal>
  </ScrollView>;
}

function OffersSection({ offers, pending, onRespond }: { readonly offers: readonly Oferta[]; readonly pending: boolean; readonly onRespond: (oferta: Oferta, accepted: boolean) => Promise<void> }) {
  const [confirmation, setConfirmation] = useState<{ offer: Oferta; accepted: boolean } | null>(null);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.subtitle}>Minhas ofertas</Text>
    {offers.length === 0 ? <Text>Nenhuma oferta disponível para este perfil.</Text> : offers.map((offer) => <View style={styles.card} key={`${offer.servicoId}-${offer.versaoOferta}`}>
      <Text style={styles.cardTitle}>Situação: {offerStatusLabel(offer.status)}</Text>
      <Text>{formatDate(offer.inicioPrevisto)} · {money(offer.valor)}</Text>
      <Text>Pagamento: {offer.pagamentoConfirmado ? 'confirmado' : 'aguardando confirmação'}</Text>
      <Text>Expira em {formatDate(offer.expiraEmUtc)}</Text>
      <Text style={styles.label}>Checklists</Text>
      {[...offer.checklists].sort((a, b) => a.ordem - b.ordem).map((item) => <Text key={item.ordem}>{item.ordem}. {item.descricao}</Text>)}
      {canRespondToOffer(['Profissional'], offer) ? <View style={styles.inline}>
        <Button title="Recusar" color="#A3262E" disabled={pending} onPress={() => setConfirmation({ offer, accepted: false })} />
        <Button color="#175E55" title="Aceitar" disabled={pending} onPress={() => setConfirmation({ offer, accepted: true })} />
      </View> : null}
    </View>)}
    <Modal transparent visible={confirmation !== null} animationType="fade" onRequestClose={() => setConfirmation(null)}>
      <View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
        <Text accessibilityRole="header" style={styles.modalTitle}>{confirmation?.accepted ? 'Aceitar oferta?' : 'Recusar oferta?'}</Text>
        <Text>Sua resposta será enviada e poderá alterar a situação da oferta. Confira os dados antes de confirmar.</Text>
        <View style={styles.inline}>
          <Button color="#175E55" title="Voltar" disabled={pending} onPress={() => setConfirmation(null)} />
          <Button color="#175E55" title={confirmation?.accepted ? 'Confirmar aceite' : 'Confirmar recusa'} disabled={pending} onPress={() => {
            if (!confirmation) return;
            const { offer, accepted } = confirmation;
            setConfirmation(null);
            void onRespond(offer, accepted);
          }} />
        </View>
      </ScrollView></View>
    </Modal>
  </View>;
}

function Field({ label, error, required = false, ...props }: { readonly label: string; readonly error?: string; readonly required?: boolean; readonly value: string; readonly onChangeText: (value: string) => void; readonly placeholder?: string; readonly keyboardType?: 'default' | 'decimal-pad' }) { return <View style={styles.field}><Text style={styles.label}>{label}{required ? ' *' : ''}</Text><TextInput accessibilityLabel={`${label}${required ? ', obrigatório' : ''}`} accessibilityHint={error} style={styles.input} {...props} />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}</View>; }
function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) { return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button color="#175E55" title="Tentar novamente" onPress={onRetry} /></View>; }
function Center({ label }: { readonly label: string }) { return <View style={styles.center}><ActivityIndicator accessibilityLabel={label} /></View>; }

const styles = StyleSheet.create({
  modalScroll: { flexGrow: 0, maxHeight: '90%' },
  matchingContainer: { flex: 1 }, matchingList: { flex: 1 }, matchingContent: { padding: 16 }, matchingHeader: { gap: 12 },
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#FAFAF7' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }, heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 24, fontWeight: '700', color: '#1B2421' }, subtitle: { fontSize: 18, fontWeight: '700' }, label: { fontWeight: '600' }, card: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 8, padding: 12, gap: 6, marginVertical: 6 }, cardTitle: { fontWeight: '700' }, focused: { borderWidth: 3, borderColor: '#175E55' }, choice: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 6, padding: 10, gap: 3 }, choiceSelected: { borderColor: '#175E55', borderWidth: 2, backgroundColor: '#E3F2EC' }, radius: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 6, padding: 8 }, inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, field: { gap: 4 }, input: { borderWidth: 1, borderColor: '#6B7A74', borderRadius: 4, padding: 10, minHeight: 44 }, error: { borderColor: '#A3262E', borderWidth: 1, padding: 8, gap: 8 }, errorText: { color: '#A3262E' }, empty: { padding: 16, textAlign: 'center' }, checklistRow: { borderTopWidth: 1, borderColor: '#ddd', paddingTop: 8, gap: 8 }, checklist: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, gap: 6 }, section: { marginBottom: 12 }, modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }, modalCard: { backgroundColor: '#fff', padding: 20, borderRadius: 8, gap: 12 }, modalTitle: { fontSize: 20, fontWeight: '700' },
});
