import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator, Alert, Button, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';

import { AvaliacaoDoServico } from '@/src/features/operations/avaliacoes/AvaliacaoDoServico';
import { AvaliacoesScreen } from '@/src/features/operations/avaliacoes/AvaliacoesScreen';
import type { AvaliacoesApi } from '@/src/features/operations/contracts/avaliacoes';
import type { Imovel, ImoveisApi } from '@/src/features/operations/contracts/imoveis';
import type { Oferta, OfertasApi } from '@/src/features/operations/contracts/ofertas';
import { listAllOffers } from '@/src/features/operations/ofertas/listAllOffers';
import { listAllProperties } from '@/src/features/operations/imoveis/listAllProperties';
import { listAllCompatibleProfessionals } from './listAllCompatibleProfessionals';
import type { Checklist, ProfissionalCompativel, Servico, ServicosApi } from '@/src/features/operations/contracts/servicos';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createIdempotencyKey } from '@/src/features/operations/idempotency';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';
import { actionableChecklist, canCancel, canChooseProfessional, canComplete, canRespondToOffer, canStart, canUpdateChecklist, nextChecklistStatus } from './policy';
import { checklistStatusLabel, offerStatusLabel, propertyDescription, serviceStatusLabel } from './servicePresentation';
import { allowedRadii, emptyServicoForm, toCreateServicoInput, validateServico, type ServicoFormErrors, type ServicoFormValues } from './validation';
import { creationAttemptFor, inputDaTentativa, type CreationAttempt } from '@/src/features/operations/creationAttempt';
import { operationErrorMessage } from '@/src/features/operations/errorPresentation';

type Screen =
  | { readonly name: 'list' }
  | { readonly name: 'detail'; readonly servico: Servico }
  | { readonly name: 'create' }
  | { readonly name: 'matching'; readonly servico: Servico }
  | { readonly name: 'avaliacoes'; readonly retorno: { readonly name: 'detail'; readonly servico: Servico } | { readonly name: 'matching'; readonly servico: Servico }; readonly profissionalId: string; readonly nomeExibicao?: string }
  | { readonly name: 'resumoAvaliacoes' };

interface Props {
  readonly mixedRoleList?: boolean;
  readonly servicosApi: ServicosApi;
  readonly ofertasApi: OfertasApi;
  readonly imoveisApi: ImoveisApi;
  readonly avaliacoesApi?: AvaliacoesApi;
  readonly openCreateToken?: string;
  readonly onCreateOpened?: () => void;
  readonly openServiceId?: string;
  readonly onServiceOpened?: () => void;
  readonly openProfessionalServiceId?: string;
  readonly onProfessionalServiceOpened?: () => void;
  readonly session: OperationsSession;
}

function PrimaryServiceButton({ title, onPress, disabled, busy }: { readonly title: string; readonly onPress: () => void; readonly disabled?: boolean; readonly busy?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.primaryAction, focused && styles.actionFocus, disabled && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}>
    <Text style={styles.primaryActionText}>{title}</Text>
  </Pressable>;
}

function SecondaryServiceButton({ title, onPress, disabled, destructive, accessibilityLabel }: { readonly title: string; readonly onPress: () => void; readonly disabled?: boolean; readonly destructive?: boolean; readonly accessibilityLabel?: string }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.secondaryAction, destructive && styles.secondaryDestructive, focused && styles.secondaryFocus, disabled && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}>
    <Text style={[styles.secondaryActionText, destructive && styles.secondaryDestructiveText]}>{title}</Text>
  </Pressable>;
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

export function ServicosScreen({ servicosApi, ofertasApi, imoveisApi, avaliacoesApi, mixedRoleList, openCreateToken, onCreateOpened, openServiceId, onServiceOpened, openProfessionalServiceId, onProfessionalServiceOpened, session }: Props) {
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
  const [serviceFilter, setServiceFilter] = useState<'abertos' | 'concluidos' | 'encerrados'>('abertos');
  const [creationAttempt, setCreationAttempt] = useState<CreationAttempt | null>(null);
  const [creationDraft, setCreationDraft] = useState<ServicoFormValues>(emptyServicoForm);

  const isClient = session.roles.includes('Cliente');
  const isProfessional = session.roles.includes('Profissional');
  const lastCreateToken = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isClient && openCreateToken && lastCreateToken.current !== openCreateToken) {
      lastCreateToken.current = openCreateToken;
      setScreen({ name: 'create' });
      onCreateOpened?.();
    }
  }, [isClient, openCreateToken, onCreateOpened]);

  const load = useCallback(async (requestedPage = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setMessage(null);
    try {
      const [servicesResponse, offersResponse] = await Promise.all([
        servicosApi.list({ page: requestedPage, pageSize: 20 }),
        isProfessional && !append ? listAllOffers(ofertasApi) : Promise.resolve(null),
      ]);
      const visibleItems = isProfessional && !isClient ? servicesResponse.items.filter((item) => item.profissionalId === session.userId) : servicesResponse.items;
      setServicos((current) => append ? [...current, ...visibleItems] : visibleItems);
      setPage(servicesResponse.page);
      setTotal(servicesResponse.total);
      if (offersResponse) { setOfertas(offersResponse); setOfferUncertain(false); }
    } catch (error) {
      setMessage(`${friendlyError(error)} Atualize a lista para consultar a situação antes de tentar novamente.`);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [isClient, isProfessional, ofertasApi, servicosApi, session.userId]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = useCallback(async (id: string, expectedProfessionalId?: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const servico = await servicosApi.get(id);
      if (expectedProfessionalId && servico.profissionalId !== expectedProfessionalId) {
        throw new Error('Atendimento indisponível para este profissional.');
      }
      setScreen({ name: 'detail', servico });
      setServiceUncertain(false);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [servicosApi]);

  const lastServiceId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!openServiceId) { lastServiceId.current = undefined; return; }
    if (!isClient || lastServiceId.current === openServiceId) return;
    lastServiceId.current = openServiceId;
    const open = () => { onServiceOpened?.(); void openDetail(openServiceId); };
    if (screen.name === 'create') {
      Alert.alert('Abrir outro atendimento?', 'O rascunho não enviado pode ser descartado. Você pode permanecer na solicitação.', [
        { text: 'Permanecer', style: 'cancel', onPress: () => onServiceOpened?.() },
        { text: 'Abrir atendimento', onPress: open },
      ]);
    } else open();
  }, [isClient, openServiceId, onServiceOpened, openDetail, screen.name]);

  const lastProfessionalServiceId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!openProfessionalServiceId) { lastProfessionalServiceId.current = undefined; return; }
    if (!isProfessional || isClient || lastProfessionalServiceId.current === openProfessionalServiceId) return;
    lastProfessionalServiceId.current = openProfessionalServiceId;
    onProfessionalServiceOpened?.();
    void openDetail(openProfessionalServiceId, session.userId);
  }, [isProfessional, isClient, openProfessionalServiceId, onProfessionalServiceOpened, openDetail, session.userId]);

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
  if (screen.name === 'avaliacoes' && avaliacoesApi) return <AvaliacoesScreen api={avaliacoesApi} profissionalId={screen.profissionalId} nomeExibicao={screen.nomeExibicao} onBack={() => setScreen(screen.retorno)} />;
  if (screen.name === 'resumoAvaliacoes' && avaliacoesApi) return <AvaliacoesScreen api={avaliacoesApi} onBack={() => setScreen({ name: 'list' })} />;
  if (screen.name === 'matching') return <MatchingScreen servico={screen.servico} api={servicosApi} pending={mutating} onBack={() => setScreen({ name: 'detail', servico: screen.servico })} onSelect={selectProfessional} userId={session.userId} onReviews={avaliacoesApi ? (item) => setScreen({ name: 'avaliacoes', retorno: screen, profissionalId: item.profissionalId, nomeExibicao: item.nomeExibicao }) : undefined} />;
  if (screen.name === 'detail') return <ServicoDetail
    servico={screen.servico} imoveisApi={imoveisApi} roles={session.roles} pending={mutating} actionsDisabled={serviceUncertain} message={message}
    onBack={() => { setScreen({ name: 'list' }); void load(); }}
    onReload={() => void refreshDetail(screen.servico.id)}
    reviews={avaliacoesApi && isClient && screen.servico.status === 'Concluido' && screen.servico.profissionalId && screen.servico.profissionalId !== session.userId ? <>
      <AvaliacaoDoServico key={screen.servico.id} api={avaliacoesApi} servicoId={screen.servico.id} />
      <Button title="Consultar avaliações do profissional" onPress={() => { if (screen.servico.profissionalId) setScreen({ name: 'avaliacoes', retorno: screen, profissionalId: screen.servico.profissionalId }); }} />
    </> : null}
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

  const visibleServices = isClient ? servicos.filter((item) => serviceFilter === 'abertos' ? ['AguardandoPagamento', 'AguardandoSelecao', 'AguardandoAceite', 'Aceito', 'EmExecucao'].includes(item.status) : serviceFilter === 'concluidos' ? item.status === 'Concluido' : ['Cancelado', 'Expirado'].includes(item.status)) : servicos;
  const hasMoreServices = page * 20 < total;
  return <FlatList style={styles.matchingList} contentContainerStyle={[styles.container, fontScale > 1.3 && { paddingBottom: 96 }]}
      data={visibleServices} keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading && servicos.length > 0} onRefresh={() => void load()} />}
      onEndReached={() => { if (!loading && !loadingMore && page * 20 < total) void load(page + 1, true); }}
      onEndReachedThreshold={0.3}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver serviço: ${serviceStatusLabel(item.status)}, ${formatDate(item.inicioPrevisto)}, ${money(item.valor)}`} style={[styles.card, focusedId === item.id && styles.focused]} onFocus={() => setFocusedId(item.id)} onBlur={() => setFocusedId(null)} onPress={() => void openDetail(item.id)}>
        <View style={styles.serviceCardHeading}><Text style={styles.serviceBadge}>{serviceStatusLabel(item.status)}</Text><Text style={styles.serviceValue}>{money(item.valor)}</Text></View>
        <Text style={styles.serviceDate}>{formatDate(item.inicioPrevisto)}</Text><Text style={styles.serviceLink}>Ver atendimento ›</Text>
      </Pressable>}
      ListFooterComponent={loadingMore ? <ActivityIndicator accessibilityLabel="Carregando mais serviços" /> : hasMoreServices ? <Button color="#175E55" title="Carregar mais serviços" onPress={() => void load(page + 1, true)} /> : null}
      ListHeaderComponent={<View style={styles.matchingHeader}>
        {mixedRoleList ? <Text accessibilityRole="alert" style={{ padding: 12, color: '#0D251B', backgroundColor: '#FFF1CF' }}>Esta lista pode incluir serviços acessíveis pelos dois papéis. Confira o atendimento antes de agir.</Text> : null}
        {isClient ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Novo serviço" onPress={() => setScreen({ name: 'create' })} style={({ pressed }) => [styles.primaryAction, pressed && { opacity: 0.75 }]}><Text style={styles.primaryActionText}>＋ Solicitar serviço</Text></Pressable>
          <View accessibilityRole="tablist" accessibilityLabel="Filtrar serviços" style={styles.filterRow}>
            {([['abertos', 'Em aberto'], ['concluidos', 'Concluídos'], ['encerrados', 'Cancelados']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: serviceFilter === key }} onPress={() => setServiceFilter(key)} style={[styles.filter, serviceFilter === key && styles.filterSelected]}><Text style={[styles.filterText, serviceFilter === key && styles.filterTextSelected]}>{label}</Text></Pressable>)}
          </View>
        </> : null}
        {message ? <ErrorPanel message={message} onRetry={() => void load()} /> : null}
        {loading && servicos.length === 0 ? <Center label="Carregando serviços" /> : null}
        {isProfessional && (!loading || ofertas.length > 0) && (!message || ofertas.length > 0) ? <OffersSection offers={ofertas} pending={mutating || offerUncertain} onRespond={respondOffer} /> : null}
        {isProfessional && avaliacoesApi ? <Button color="#175E55" title="Minhas avaliações" onPress={() => setScreen({ name: 'resumoAvaliacoes' })} /> : null}
        {isProfessional && servicos.length > 0 ? <Text accessibilityRole="header" style={styles.subtitle}>Meus atendimentos</Text> : null}
        {!loading && !message && visibleServices.length === 0 && isClient ? <View style={styles.serviceEmpty}><Text style={styles.cardTitle}>{hasMoreServices ? 'Nenhum serviço encontrado nesta parte da lista' : serviceFilter === 'abertos' ? 'Nenhum serviço em aberto' : 'Nada por aqui'}</Text><Text>{hasMoreServices ? 'Carregue mais serviços para continuar a consulta.' : serviceFilter === 'abertos' ? 'Solicite um serviço para começar.' : 'Não há serviços nesta situação.'}</Text></View> : null}
      </View>}
    />;
}

function ServicoForm({ api, pending, attempt, setAttempt, creationDraft, setCreationDraft, onBack, onSave }: { readonly api: ImoveisApi; readonly pending: boolean; readonly attempt: CreationAttempt | null; readonly setAttempt: (attempt: CreationAttempt | null) => void; readonly creationDraft: ServicoFormValues; readonly setCreationDraft: (draft: ServicoFormValues) => void; readonly onBack: () => void; readonly onSave: (input: ReturnType<typeof toCreateServicoInput>, key: string) => Promise<void> }) {
  const { fontScale } = useWindowDimensions();
  const [values, setValues] = useState<ServicoFormValues>(creationDraft);
  const [imoveis, setImoveis] = useState<readonly Imovel[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(true);
  const [imoveisError, setImoveisError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ServicoFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(Boolean(attempt));
  const [focusedChoice, setFocusedChoice] = useState<string | null>(null);
  const submitting = useRef(false);

  const loadImoveis = useCallback(async () => {
    setLoadingImoveis(true);
    setImoveisError(null);
    try {
      const properties = await listAllProperties(api);
      setImoveis(properties);
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
    if (!attempt) {
      const validation = validateServico(values);
      setErrors(validation);
      if (Object.keys(validation).length) { setReviewing(false); return; }
    }
    const input = attempt ? inputDaTentativa(attempt) : toCreateServicoInput(values);
    const fingerprint = JSON.stringify(input);
    const nextAttempt = creationAttemptFor(attempt, fingerprint, createIdempotencyKey);
    if (!nextAttempt) {
      setSubmitError('O resultado da tentativa anterior ainda não foi confirmado. Volte à lista e atualize os serviços antes de criar outro com dados diferentes.');
      return;
    }
    setCreationDraft(values);
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
  if (reviewing) {
    const imovel = imoveis.find((item) => item.id === values.imovelId);
    return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Revise seu pedido</Text>
      <Text>Confira os dados antes de {attempt ? 'recuperar a solicitação' : 'criar o serviço'}.</Text>
      {attempt ? <Text accessibilityRole="alert">A resposta anterior não foi confirmada. A tentativa mantém os mesmos dados e chave.</Text> : null}
      {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Imóvel</Text><Text>{imovel?.descricao ?? imovel?.endereco.logradouro ?? 'Imóvel selecionado'}</Text>
        <Text style={styles.cardTitle}>Quando</Text><Text>{values.dataInicio} às {values.horaInicio} até {values.dataFim} às {values.horaFim}</Text>
        <Text style={styles.cardTitle}>Valor e distância</Text><Text>R$ {values.valor} · {values.raioBuscaKm} km</Text>
        <Text style={styles.cardTitle}>Checklist</Text>{values.checklists.map((item, index) => <Text key={item.id}>{index + 1}. {item.descricao}</Text>)}
      </View>
      {!attempt ? <SecondaryServiceButton title="Voltar e editar" onPress={() => setReviewing(false)} disabled={pending} /> : <SecondaryServiceButton title="Voltar aos serviços" onPress={() => { setCreationDraft(values); onBack(); }} disabled={pending} />}
      <PrimaryServiceButton title={pending ? 'Enviando…' : attempt ? 'Repetir mesma tentativa' : 'Confirmar solicitação'} onPress={() => void submit()} disabled={pending} busy={pending} />
    </ScrollView>;
  }
  const reviewButton = <PrimaryServiceButton title="Revisar pedido" onPress={() => { const validation = validateServico(values); setErrors(validation); if (!Object.keys(validation).length) { setCreationDraft(values); setReviewing(true); } }} disabled={pending || loadingImoveis || Boolean(imoveisError) || imoveis.length === 0} />;
  return <View style={styles.formLayout}>
  <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" accessibilityState={{ disabled: pending }} onPress={() => { setCreationDraft(values); onBack(); }} disabled={pending} style={styles.backAction}><Text style={styles.backText}>‹  Voltar</Text></Pressable><Text accessibilityRole="header" style={styles.title}>Solicitar serviço</Text>
    <Text>Preencha os campos obrigatórios (*) e confira os dados antes de criar o serviço.</Text>
    {attempt ? <Text accessibilityRole="alert">Há uma criação anterior com resultado não confirmado. Os dados foram preservados para que você possa consultá-los antes de repetir.</Text> : null}
    {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
    <Text accessibilityRole="header" style={styles.formSection}>1. Onde</Text>
    <Text style={styles.label}>Imóvel *</Text>
    {errors.imovelId ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.imovelId}</Text> : null}
    {loadingImoveis ? <ActivityIndicator accessibilityLabel="Carregando imóveis" /> : imoveisError ? <ErrorPanel message={`Não foi possível carregar os imóveis. ${imoveisError}`} onRetry={() => void loadImoveis()} /> : imoveis.length === 0 ? <Text accessibilityRole="alert">Nenhum imóvel encontrado. Cadastre um imóvel ativo antes de criar um serviço.</Text> : imoveis.map((imovel) => <Pressable key={imovel.id} accessibilityRole="radio" accessibilityLabel={`${imovel.descricao || imovel.endereco.logradouro}, ${imovel.endereco.cidade}/${imovel.endereco.uf}`} accessibilityState={{ checked: values.imovelId === imovel.id }} aria-checked={values.imovelId === imovel.id} style={[styles.choice, values.imovelId === imovel.id && styles.choiceSelected, focusedChoice === `imovel-${imovel.id}` && styles.focused]} onFocus={() => setFocusedChoice(`imovel-${imovel.id}`)} onBlur={() => setFocusedChoice(null)} onPress={() => setValue('imovelId', imovel.id)}><View style={styles.propertyChoiceRow}><MaterialCommunityIcons name={values.imovelId === imovel.id ? 'radiobox-marked' : 'radiobox-blank'} size={24} color="#005B44" /><View style={styles.propertyChoiceText}><Text style={styles.propertyChoiceTitle}>{imovel.descricao || imovel.endereco.logradouro}</Text><Text style={styles.propertyChoiceCaption}>{imovel.endereco.cidade}/{imovel.endereco.uf}</Text></View></View></Pressable>)}
    <Text accessibilityRole="header" style={styles.formSection}>2. Quando</Text>
    <Field label="Data inicial" value={values.dataInicio} placeholder="DD/MM/AAAA" error={errors.dataInicio} onChangeText={(value) => setValue('dataInicio', value)} required />
    <Field label="Hora inicial" value={values.horaInicio} placeholder="HH:mm" error={errors.horaInicio} onChangeText={(value) => setValue('horaInicio', value)} required />
    <Field label="Data final" value={values.dataFim} placeholder="DD/MM/AAAA" error={errors.dataFim} onChangeText={(value) => setValue('dataFim', value)} required />
    <Field label="Hora final" value={values.horaFim} placeholder="HH:mm" error={errors.horaFim} onChangeText={(value) => setValue('horaFim', value)} required />
    <Text accessibilityRole="header" style={styles.formSection}>3. Valor e alcance</Text>
    <Field label="Valor (R$)" value={values.valor} placeholder="0,00" error={errors.valor} keyboardType="decimal-pad" onChangeText={(value) => setValue('valor', value)} required />
    <Text style={styles.label}>Raio de busca *</Text><View style={styles.inline}>{allowedRadii.map((radius) => <Pressable key={radius} accessibilityRole="radio" accessibilityState={{ checked: values.raioBuscaKm === radius }} aria-checked={values.raioBuscaKm === radius} style={[styles.radius, values.raioBuscaKm === radius && styles.choiceSelected, focusedChoice === `raio-${radius}` && styles.focused]} onFocus={() => setFocusedChoice(`raio-${radius}`)} onBlur={() => setFocusedChoice(null)} onPress={() => setValue('raioBuscaKm', radius)}><Text>{radius} km{values.raioBuscaKm === radius ? ' — selecionado' : ''}</Text></Pressable>)}</View>
    {errors.raioBuscaKm ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.raioBuscaKm}</Text> : null}
    <Text accessibilityRole="header" style={styles.formSection}>4. Tarefas</Text>
    <Text style={styles.label}>Checklists *</Text>{errors.checklists ? <Text accessibilityRole="alert" style={styles.errorText}>{errors.checklists}</Text> : null}
    {values.checklists.map((item, index) => <View key={item.id} style={styles.checklistRow}><Field label={`Checklist ${index + 1}`} value={item.descricao} error={errors.checklistItems?.[item.id]} onChangeText={(value) => changeChecklist(item.id, value)} required /><SecondaryServiceButton title="Remover" accessibilityLabel={`Remover checklist ${index + 1}`} destructive onPress={() => removeChecklist(item.id)} disabled={pending || values.checklists.length === 1} /></View>)}
    <SecondaryServiceButton title="Adicionar checklist" onPress={addChecklist} disabled={pending} />
    {fontScale > 1.3 ? reviewButton : null}
  </ScrollView>
  {fontScale <= 1.3 ? <View style={styles.formFooter}>{reviewButton}</View> : null}
  </View>;
}

function MatchingScreen({ servico, api, pending, onBack, onSelect, userId, onReviews }: { readonly servico: Servico; readonly api: ServicosApi; readonly pending: boolean; readonly onBack: () => void; readonly onSelect: (servico: Servico, profissionalId: string) => Promise<void>; readonly userId: string; readonly onReviews?: (item: ProfissionalCompativel) => void }) {
  const { fontScale } = useWindowDimensions();
  const [items, setItems] = useState<readonly ProfissionalCompativel[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProfissionalCompativel | null>(null);
  const load = useCallback(() => { setLoading(true); setError(null); return listAllCompatibleProfessionals(api, servico.id).then((response) => setItems(response)).catch((cause: unknown) => { setItems([]); setError(friendlyError(cause)); }).finally(() => setLoading(false)); }, [api, servico.id]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.matchingContainer}><FlatList style={styles.matchingList} contentContainerStyle={[styles.matchingContent, fontScale > 1.3 && { paddingBottom: 96 }]} data={items} keyExtractor={(item) => item.profissionalId} ListHeaderComponent={<View style={styles.matchingHeader}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao atendimento" disabled={pending} onPress={onBack} style={styles.backAction}><Text style={styles.backText}>‹  Voltar ao atendimento</Text></Pressable><Text accessibilityRole="header" style={styles.title}>Profissionais compatíveis</Text>{loading ? <Center label="Carregando profissionais" /> : null}{error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}{!loading && !error && items.length === 0 ? <Text style={styles.empty}>Não há profissional compatível para o raio e horário escolhidos.</Text> : null}</View>} renderItem={({ item }) => <View style={styles.professionalCard}>
      <View style={styles.professionalHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{item.nomeExibicao?.trim().charAt(0).toUpperCase() || 'P'}</Text></View><View style={styles.professionalInfo}><Text style={styles.professionalName}>{item.nomeExibicao ?? 'Profissional compatível'}</Text><Text style={styles.mutedText}>Posição {item.posicaoRanking} · {item.distanciaKm.toFixed(1)} km</Text><Text style={styles.professionalRating}>★ {item.avaliacaoMedia.toFixed(1)} ({item.quantidadeAvaliacoes} avaliações)</Text></View></View>
      {onReviews && item.profissionalId !== userId ? <SecondaryServiceButton title="Ver avaliações" disabled={pending} onPress={() => onReviews(item)} /> : null}<PrimaryServiceButton title="Selecionar" disabled={pending} onPress={() => setSelected(item)} />
    </View>} />
    <Modal transparent visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
      <Text accessibilityRole="header" style={styles.modalTitle}>Selecionar profissional?</Text>
      <Text>Ao confirmar, será enviada uma oferta para {selected?.nomeExibicao ?? 'o profissional escolhido'}. Você pode voltar sem enviar.</Text>
      <View style={styles.inline}><View style={styles.offerAction}><SecondaryServiceButton title="Voltar" disabled={pending} onPress={() => setSelected(null)} /></View><View style={styles.offerAction}><PrimaryServiceButton title="Confirmar seleção" disabled={pending} onPress={() => { if (!selected) return; const id = selected.profissionalId; setSelected(null); void onSelect(servico, id); }} /></View></View>
    </ScrollView></View></Modal>
  </View>;
}

function ServicoDetail({ servico, imoveisApi, roles, pending, actionsDisabled, message, reviews, onBack, onReload, onChoose, onCancel, onStart, onChecklist, onComplete }: { readonly servico: Servico; readonly imoveisApi: ImoveisApi; readonly roles: OperationsSession['roles']; readonly pending: boolean; readonly actionsDisabled: boolean; readonly message: string | null; readonly reviews: React.ReactNode; readonly onBack: () => void; readonly onReload: () => void; readonly onChoose: () => void; readonly onCancel: (motivo: string) => void; readonly onStart: () => void; readonly onChecklist: (checklist: Checklist, status: NonNullable<ReturnType<typeof nextChecklistStatus>>) => Promise<void>; readonly onComplete: () => void }) {
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
  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos serviços" disabled={pending} onPress={onBack} style={styles.backAction}><Text style={styles.backText}>‹  Voltar aos serviços</Text></Pressable>
    <Text accessibilityRole="header" style={styles.title}>Atendimento</Text>
    {message ? <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text> : null}
    <View style={styles.detailCard}>
      <View style={styles.serviceCardHeading}><Text style={styles.serviceBadge}>{serviceStatusLabel(servico.status)}</Text><Text style={styles.serviceValue}>{money(servico.valor)}</Text></View>
      <Text style={styles.serviceDate}>{formatDate(servico.inicioPrevisto)} até {formatDate(servico.fimPrevisto)}</Text>
      <Text>Imóvel vinculado: {propertyLabel}</Text>
      <Text>Raio: {servico.raioBuscaKm} km</Text>
      {servico.profissionalId ? <Text>Profissional selecionado.</Text> : null}
    </View>
    {canChooseProfessional(roles, servico.status) || canStart(roles, servico.status) || canComplete(roles, servico) ? <View style={styles.nextStep}>
      <Text accessibilityRole="header" style={styles.nextStepTitle}>Próximo passo</Text>
      {canChooseProfessional(roles, servico.status) ? <PrimaryServiceButton title="Escolher profissional" disabled={pending || actionsDisabled} onPress={onChoose} /> : null}
      {canStart(roles, servico.status) ? <PrimaryServiceButton title="Iniciar serviço" disabled={pending || actionsDisabled} onPress={() => setConfirmation('start')} /> : null}
      {canComplete(roles, servico) ? <PrimaryServiceButton title="Concluir serviço" disabled={pending || actionsDisabled} onPress={() => setConfirmation('complete')} /> : null}
    </View> : null}
    <Text accessibilityRole="header" style={styles.formSection}>Tarefas</Text>
    {servico.checklists.length === 0 ? <Text>Nenhuma tarefa informada.</Text> : null}
    {[...servico.checklists].sort((a, b) => a.ordem - b.ordem).map((item) => <View key={item.id} style={styles.checklist}><Text>{item.ordem}. {item.descricao} — {checklistStatusLabel(item.status)}</Text>{canUpdateChecklist(roles, servico, item) && nextStatus ? <SecondaryServiceButton title={`Marcar como ${checklistStatusLabel(nextStatus)}`} disabled={pending || actionsDisabled} onPress={() => void onChecklist(item, nextStatus)} /> : null}</View>)}
    {canCancel(roles, servico.status) ? <SecondaryServiceButton title="Cancelar serviço" destructive disabled={pending || actionsDisabled} onPress={() => setShowCancel(true)} /> : null}
    <SecondaryServiceButton title="Atualizar serviço" disabled={pending} onPress={onReload} />
    {reviews}
    <Modal transparent visible={confirmation !== null} animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
      <Text accessibilityRole="header" style={styles.modalTitle}>{confirmation === 'start' ? 'Iniciar serviço?' : 'Concluir serviço?'}</Text>
      <Text>{confirmation === 'start' ? 'Ao confirmar, o serviço passará para execução. Você pode voltar sem iniciar.' : 'Ao confirmar, o serviço será concluído e poderá iniciar a liberação do valor. Você pode voltar sem concluir.'}</Text>
      <View style={styles.inline}><View style={styles.offerAction}><SecondaryServiceButton title="Voltar" disabled={pending} onPress={() => setConfirmation(null)} /></View><View style={styles.offerAction}><PrimaryServiceButton title={confirmation === 'start' ? 'Confirmar início' : 'Confirmar conclusão'} disabled={pending || actionsDisabled} onPress={() => { const action = confirmation; setConfirmation(null); if (action === 'start') onStart(); else if (action === 'complete') onComplete(); }} /></View></View>
    </ScrollView></View></Modal>
    <Modal transparent visible={showCancel} animationType="fade" onRequestClose={() => setShowCancel(false)}><View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled"><Text accessibilityRole="header" style={styles.modalTitle}>Cancelar serviço?</Text><Text>Ao confirmar, será solicitada a alteração da situação do serviço para cancelado. Você pode voltar sem enviar o cancelamento.</Text><Field label="Motivo" value={motivo} onChangeText={setMotivo} required /><Text>Informe de 1 a 300 caracteres.</Text><View style={styles.inline}><View style={styles.offerAction}><SecondaryServiceButton title="Voltar" onPress={() => setShowCancel(false)} disabled={pending} /></View><View style={styles.offerAction}><SecondaryServiceButton title="Confirmar cancelamento" destructive disabled={pending || motivo.trim().length < 1 || motivo.trim().length > 300} onPress={() => { setShowCancel(false); onCancel(motivo.trim()); }} /></View></View></ScrollView></View></Modal>
  </ScrollView>;
}

function OffersSection({ offers, pending, onRespond }: { readonly offers: readonly Oferta[]; readonly pending: boolean; readonly onRespond: (oferta: Oferta, accepted: boolean) => Promise<void> }) {
  const [confirmation, setConfirmation] = useState<{ offer: Oferta; accepted: boolean } | null>(null);
  const pendingOffers = offers.filter((offer) => canRespondToOffer(['Profissional'], offer));
  const otherOffers = offers.filter((offer) => !canRespondToOffer(['Profissional'], offer));
  const renderOffer = (offer: Oferta) => <View style={styles.offerCard} key={`${offer.servicoId}-${offer.versaoOferta}`}>
      <View style={styles.offerHeading}><Text style={styles.offerValue}>{money(offer.valor)}</Text><Text style={styles.offerBadge}>{offerStatusLabel(offer.status)}</Text></View>
      <Text style={styles.cardTitle}>{formatDate(offer.inicioPrevisto)} até {formatDate(offer.fimPrevisto)}</Text>
      <Text>Pagamento: {offer.pagamentoConfirmado ? 'confirmado' : 'aguardando confirmação'}</Text>
      <Text>Expira em {formatDate(offer.expiraEmUtc)}</Text>
      <Text style={styles.label}>Checklists</Text>
      {[...offer.checklists].sort((a, b) => a.ordem - b.ordem).map((item) => <Text key={item.ordem}>{item.ordem}. {item.descricao}</Text>)}
      {canRespondToOffer(['Profissional'], offer) ? <View style={styles.inline}>
        <View style={styles.offerAction}><SecondaryServiceButton title="Recusar" destructive disabled={pending} onPress={() => setConfirmation({ offer, accepted: false })} /></View>
        <View style={styles.offerAction}><PrimaryServiceButton title="Aceitar" disabled={pending} onPress={() => setConfirmation({ offer, accepted: true })} /></View>
      </View> : null}
    </View>;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.subtitle}>Para responder ({pendingOffers.length})</Text>
    {pendingOffers.length ? pendingOffers.map(renderOffer) : <View style={styles.offerEmpty}><Text style={styles.cardTitle}>Nenhuma oferta agora</Text><Text>Quando houver uma oferta disponível para resposta, ela aparece aqui.</Text></View>}
    {otherOffers.length ? <><Text accessibilityRole="header" style={styles.subtitle}>Outras ofertas</Text>{otherOffers.map(renderOffer)}</> : null}
    <Modal transparent visible={confirmation !== null} animationType="fade" onRequestClose={() => setConfirmation(null)}>
      <View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
        <Text accessibilityRole="header" style={styles.modalTitle}>{confirmation?.accepted ? 'Aceitar oferta?' : 'Recusar oferta?'}</Text>
        <Text>Sua resposta será enviada e poderá alterar a situação da oferta. Confira os dados antes de confirmar.</Text>
        <View style={styles.inline}>
          <View style={styles.offerAction}><SecondaryServiceButton title="Voltar" disabled={pending} onPress={() => setConfirmation(null)} /></View>
          <View style={styles.offerAction}><PrimaryServiceButton title={confirmation?.accepted ? 'Confirmar aceite' : 'Confirmar recusa'} disabled={pending} onPress={() => {
            if (!confirmation) return;
            const { offer, accepted } = confirmation;
            setConfirmation(null);
            void onRespond(offer, accepted);
          }} /></View>
        </View>
      </ScrollView></View>
    </Modal>
  </View>;
}

function Field({ label, error, required = false, ...props }: { readonly label: string; readonly error?: string; readonly required?: boolean; readonly value: string; readonly onChangeText: (value: string) => void; readonly placeholder?: string; readonly keyboardType?: 'default' | 'decimal-pad' }) { return <View style={styles.field}><Text style={styles.label}>{label}{required ? ' *' : ''}</Text><TextInput accessibilityLabel={`${label}${required ? ', obrigatório' : ''}`} accessibilityHint={error} style={styles.input} {...props} />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}</View>; }
function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) { return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button color="#175E55" title="Tentar novamente" onPress={onRetry} /></View>; }
function Center({ label }: { readonly label: string }) { return <View style={styles.center}><ActivityIndicator accessibilityLabel={label} /></View>; }

const styles = StyleSheet.create({
  actionFocus: { borderWidth: 3, borderColor: '#F8C562' },
  secondaryFocus: { borderWidth: 3, borderColor: '#005B44' },
  secondaryAction: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: '#005B44', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#FFFDFA' },
  secondaryDestructive: { borderColor: '#A3262E', backgroundColor: '#FFF8F6' },
  secondaryDestructiveText: { color: '#A3262E' },
  offerAction: { flexGrow: 1, flexBasis: 120 },
  secondaryActionText: { color: '#005B44', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  backAction: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12 },
  backText: { color: '#005B44', fontSize: 16, fontWeight: '700' },
  primaryAction: { minHeight: 56, borderRadius: 16, backgroundColor: '#005B44', alignItems: 'center', justifyContent: 'center', padding: 12 },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#C9D1C9', backgroundColor: '#FFFDFA', borderRadius: 24, justifyContent: 'center' },
  filterSelected: { backgroundColor: '#005B44', borderColor: '#005B44' },
  filterText: { color: '#10251D', fontWeight: '700' }, filterTextSelected: { color: '#FFFFFF' },
  professionalCard: { borderWidth: 1, borderColor: '#D4D1C9', borderRadius: 16, padding: 16, gap: 10, marginVertical: 6, backgroundColor: '#FFFDFA' },
  professionalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCF1E8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#005B44', fontSize: 20, fontWeight: '700' },
  professionalInfo: { flex: 1, gap: 4 }, professionalName: { color: '#10251D', fontSize: 17, fontWeight: '700' },
  mutedText: { color: '#53655C' }, professionalRating: { color: '#614900', fontWeight: '700' },
  nextStep: { borderWidth: 1, borderColor: '#D7B45D', borderRadius: 16, backgroundColor: '#FFF1CF', padding: 16, gap: 8 },
  nextStepTitle: { color: '#614900', fontSize: 16, fontWeight: '700' },
  detailCard: { borderWidth: 1, borderColor: '#D4D1C9', borderRadius: 16, padding: 16, gap: 10, backgroundColor: '#FFFDFA' },
  serviceCardHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  serviceBadge: { color: '#005B44', backgroundColor: '#DCF1E8', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontWeight: '700', flexShrink: 1 }, serviceValue: { color: '#10251D', fontWeight: '700', fontSize: 18 },
  serviceDate: { color: '#10251D', fontSize: 16, fontWeight: '700' }, serviceLink: { color: '#005B44', fontWeight: '700' },
  serviceEmpty: { padding: 20, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D1C9', backgroundColor: '#FFFDFA', alignItems: 'center', gap: 8 },
  propertyChoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  propertyChoiceText: { flex: 1, gap: 3 },
  propertyChoiceTitle: { color: '#10251D', fontSize: 16, fontWeight: '700' },
  propertyChoiceCaption: { color: '#53655C', fontSize: 14 },
  formLayout: { flex: 1, backgroundColor: '#F8F4EB' },
  formFooter: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: '#DDDAD1' },
  formSection: { marginTop: 12, color: '#0D251B', fontSize: 18, fontWeight: '700' },
  offerEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D1C9', borderRadius: 16, padding: 20, marginVertical: 10, alignItems: 'center', gap: 8, backgroundColor: '#FFFDFA' },
  offerCard: { borderWidth: 1, borderColor: '#D4D1C9', borderLeftWidth: 4, borderLeftColor: '#F8C562', borderRadius: 16, padding: 16, gap: 8, marginVertical: 6, backgroundColor: '#FFFDFA' },
  offerHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, offerValue: { color: '#0D251B', fontSize: 24, fontWeight: '800' }, offerBadge: { color: '#604000', backgroundColor: '#FFEBBE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, fontWeight: '700' },
  modalScroll: { flexGrow: 0, maxHeight: '90%' },
  matchingContainer: { flex: 1, backgroundColor: '#F8F4EB' }, matchingList: { flex: 1 }, matchingContent: { padding: 16, backgroundColor: '#F8F4EB' }, matchingHeader: { gap: 12 },
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#F8F4EB' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }, heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 24, fontWeight: '700', color: '#1B2421' }, subtitle: { fontSize: 18, fontWeight: '700' }, label: { fontWeight: '600' }, card: { borderWidth: 1, borderColor: '#D4D1C9', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, gap: 6, marginVertical: 6 }, cardTitle: { fontWeight: '700' }, focused: { borderWidth: 3, borderColor: '#175E55' }, choice: { borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, minHeight: 48, gap: 3 }, choiceSelected: { borderColor: '#175E55', borderWidth: 2, backgroundColor: '#E3F2EC' }, radius: { borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8, minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }, inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, field: { gap: 4 }, input: { borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', color: '#1B2421', borderRadius: 12, padding: 10, minHeight: 48 }, error: { borderColor: '#A3262E', backgroundColor: '#FFF5F4', borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 }, errorText: { color: '#A3262E' }, empty: { padding: 16, textAlign: 'center' }, checklistRow: { borderTopWidth: 1, borderColor: '#ddd', paddingTop: 8, gap: 8 }, checklist: { padding: 12, borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', borderRadius: 12, gap: 8 }, section: { marginBottom: 12 }, modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }, modalCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, gap: 12 }, modalTitle: { fontSize: 20, fontWeight: '700' },
});
