import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { Imovel, ImoveisApi, SaveImovelInput } from '@/src/features/operations/contracts/imoveis';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createIdempotencyKey } from './idempotency';
import { creationAttemptFor, type CreationAttempt } from '@/src/features/operations/creationAttempt';
import { operationErrorMessage } from '@/src/features/operations/errorPresentation';
import {
  emptyImovelForm, toImovelFormValues, toSaveImovelInput, validateImovel,
  type ImovelFormErrors, type ImovelFormValues,
} from './validation';

type Screen =
  | { readonly name: 'list' }
  | { readonly name: 'detail'; readonly imovel: Imovel }
  | { readonly name: 'form'; readonly imovel?: Imovel };

interface Props {
  readonly api: ImoveisApi;
  readonly session: OperationsSession;
}

function friendlyError(error: unknown): string {
  return operationErrorMessage(error, 'Não foi possível concluir a operação.');
}

function serverErrors(error: unknown): ImovelFormErrors {
  if (!(error instanceof HttpProblemError)) return {};
  const errors: ImovelFormErrors = {};
  const aliases: Record<string, keyof ImovelFormValues> = {
    descricao: 'descricao', metragemquadrada: 'metragemQuadrada', latitude: 'latitude', longitude: 'longitude',
    logradouro: 'logradouro', numero: 'numero', complemento: 'complemento', bairro: 'bairro', cidade: 'cidade', uf: 'uf', cep: 'cep',
  };
  Object.entries(error.problem.errors ?? {}).forEach(([key, messages]) => {
    const name = key.split('.').at(-1)?.toLowerCase();
    if (name && aliases[name]) errors[aliases[name]] = messages[0] ?? 'Valor inválido.';
  });
  return errors;
}

export function ImoveisScreen({ api, session }: Props) {
  const canManageImoveis = session.roles.includes('Cliente');
  const { fontScale } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [items, setItems] = useState<readonly Imovel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(canManageImoveis);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const deactivationInFlight = useRef(false);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState<Imovel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionUncertain, setActionUncertain] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [creationAttempt, setCreationAttempt] = useState<CreationAttempt | null>(null);
  const [creationDraft, setCreationDraft] = useState<ImovelFormValues>(emptyImovelForm);
  const [editDraft, setEditDraft] = useState<{ id: string; values: ImovelFormValues } | null>(null);

  const load = useCallback(async (requestedPage: number, append: boolean) => {
    if (!canManageImoveis) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMessage(null);
    try {
      const response = await api.list({ page: requestedPage, pageSize: 20 });
      setItems((current) => append ? [...current, ...response.items] : response.items);
      setPage(response.page);
      setTotal(response.total);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [api, canManageImoveis]);

  useEffect(() => { void load(1, false); }, [load]);

  const refresh = useCallback(() => { void load(1, false); }, [load]);
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && items.length < total) void load(page + 1, true);
  }, [items.length, load, loading, loadingMore, page, total]);

  const openDetail = useCallback(async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      setScreen({ name: 'detail', imovel: await api.get(id) });
      setActionError(null);
      setActionUncertain(false);
    } catch (error) {
      setMessage(friendlyError(error));
      setActionError(`${friendlyError(error)} Não foi possível atualizar o imóvel.`);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const save = useCallback(async (input: SaveImovelInput, idempotencyKey: string, editing?: Imovel): Promise<Imovel> => {
    setMutating(true);
    try {
      const saved = editing
        ? await api.update(editing.id, input, editing.aggregateVersion)
        : await api.create(input, idempotencyKey);
      setItems((current) => {
        const index = current.findIndex((item) => item.id === saved.id);
        return index < 0 ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item);
      });
      setScreen({ name: 'detail', imovel: saved });
      if (editing) setEditDraft(null);
      return saved;
    } finally {
      setMutating(false);
    }
  }, [api]);

  const deactivate = useCallback(async (imovel: Imovel) => {
    if (deactivationInFlight.current) return;
    deactivationInFlight.current = true;
    setMutating(true);
    setActionError(null);
    try {
      await api.deactivate(imovel.id, imovel.aggregateVersion);
      setItems((current) => current.filter((item) => item.id !== imovel.id));
      setTotal((current) => Math.max(0, current - 1));
      setScreen({ name: 'list' });
    } catch (error) {
      if (error instanceof HttpProblemError && error.problem.status === 404) setScreen({ name: 'list' });
      else if (error instanceof HttpProblemError && error.problem.status === 409) {
        setActionError('Este imóvel está vinculado a um serviço ativo. Finalize, cancele ou aguarde a expiração do serviço antes de inativá-lo.');
      } else {
        setActionUncertain(true);
        setActionError(`${friendlyError(error)} O resultado da inativação não foi confirmado. Atualize o imóvel antes de tentar novamente.`);
      }
    } finally {
      deactivationInFlight.current = false;
      setMutating(false);
      setConfirmingDeactivation(null);
    }
  }, [api]);

  if (!canManageImoveis) {
    return <View style={styles.center}><Text accessibilityRole="alert">O perfil Cliente é necessário para gerenciar imóveis.</Text></View>;
  }

  if (screen.name === 'form') {
    return <ImovelForm
      imovel={screen.imovel}
      pending={mutating}
      attempt={creationAttempt}
      setAttempt={setCreationAttempt}
      creationDraft={creationDraft}
      setCreationDraft={setCreationDraft}
      editDraft={editDraft && screen.imovel && editDraft.id === screen.imovel.id ? editDraft.values : null}
      setEditDraft={(values) => { if (screen.imovel) setEditDraft({ id: screen.imovel.id, values }); }}
      onUncertainEdit={() => { setActionUncertain(true); setActionError('O resultado da edição não foi confirmado. Atualize o imóvel antes de tentar novamente; seu rascunho foi preservado nesta tela.'); }}
      onBack={() => setScreen(screen.imovel ? { name: 'detail', imovel: screen.imovel } : { name: 'list' })}
      onSave={(input, key) => save(input, key, screen.imovel)}
    />;
  }

  if (screen.name === 'detail') {
    return <>
      <ImovelDetail
        imovel={screen.imovel}
        pending={mutating || loading}
        error={actionError}
        actionUncertain={actionUncertain}
        onReload={() => void openDetail(screen.imovel.id)}
        onBack={() => setScreen({ name: 'list' })}
        onEdit={() => setScreen({ name: 'form', imovel: screen.imovel })}
        onDeactivate={() => setConfirmingDeactivation(screen.imovel)}
      />
      <DeactivationConfirmation
        visible={confirmingDeactivation !== null}
        pending={mutating}
        onCancel={() => setConfirmingDeactivation(null)}
        onConfirm={() => confirmingDeactivation ? void deactivate(confirmingDeactivation) : undefined}
      />
    </>;
  }

  return (
    <FlatList style={styles.list} contentContainerStyle={[styles.container, fontScale > 1.3 && { paddingBottom: 96 }]}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={<View style={styles.listHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar imóvel" onPress={() => setScreen({ name: 'form' })} style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.75 }]}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" /><Text style={styles.addButtonText}>Cadastrar imóvel</Text>
          </Pressable>
          {message ? <ErrorPanel message={message} onRetry={refresh} /> : null}
          {loading && items.length === 0 ? <View style={styles.center}><ActivityIndicator accessibilityLabel="Carregando imóveis" /></View> : null}
          {!loading && !message && items.length > 0 ? <Text accessibilityRole="header" style={styles.sectionTitle}>{items.every((item) => item.status === 'Ativo') ? 'Ativos' : 'Imóveis'}</Text> : null}
          {!loading && !message && items.length === 0 && total > 0 ? <ErrorPanel message="A lista de imóveis veio incompleta. Tente novamente." onRetry={refresh} /> : null}
          {!loading && !message && items.length === 0 && total === 0 ? <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><MaterialCommunityIcons name="home-outline" size={28} color="#005B44" /></View>
            <Text accessibilityRole="header" style={styles.emptyTitle}>Nenhum imóvel ainda</Text>
            <Text style={styles.emptyText}>Cadastre o endereço onde o serviço vai acontecer.</Text>
          </View> : null}
        </View>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver imóvel ${item.descricao ?? item.endereco.logradouro}`} style={[styles.card, focusedId === item.id && styles.focused]} onFocus={() => setFocusedId(item.id)} onBlur={() => setFocusedId(null)} onPress={() => void openDetail(item.id)}>
            <View style={styles.cardIcon}><MaterialCommunityIcons name="home-outline" size={24} color="#005B44" /></View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.descricao || `${item.endereco.logradouro}, ${item.endereco.numero ?? 's/n'}`}</Text>
              <Text style={styles.muted}>{item.endereco.bairro}, {item.endereco.cidade}/{item.endereco.uf}</Text>
              <View style={item.status === 'Ativo' ? styles.listStatusBadge : styles.listStatusInactive}><Text style={item.status === 'Ativo' ? styles.status : styles.inactiveStatus}>{item.status}</Text></View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#53655C" />
          </Pressable>
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator accessibilityLabel="Carregando mais imóveis" /> : null}
    />
  );
}

function PropertyButton({ title, onPress, disabled = false, busy = false, variant = 'primary' }: {
  readonly title: string; readonly onPress: () => void; readonly disabled?: boolean; readonly busy?: boolean;
  readonly variant?: 'primary' | 'outline' | 'danger' | 'back';
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.propertyButton, variant === 'outline' && styles.propertyButtonOutline,
      variant === 'danger' && styles.propertyButtonDanger, variant === 'back' && styles.propertyButtonBack,
      focused && styles.propertyButtonFocused, (pressed || disabled) && { opacity: 0.65 }]}>
    <Text style={[styles.propertyButtonText, variant === 'outline' && styles.propertyButtonOutlineText,
      variant === 'danger' && styles.propertyButtonDangerText, variant === 'back' && styles.propertyButtonBackText]}>{title}</Text>
  </Pressable>;
}

function PropertyDetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return <View style={styles.detailRow}><Text style={styles.muted}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function DeactivationConfirmation({ visible, pending, onCancel, onConfirm }: {
  readonly visible: boolean; readonly pending: boolean; readonly onCancel: () => void; readonly onConfirm: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>
        <Text accessibilityRole="header" style={styles.modalTitle}>Inativar imóvel?</Text>
        <Text>Imóveis com serviço ativo não podem ser inativados.</Text>
        <View style={styles.actions}>
          <PropertyButton variant="outline" title="Cancelar" onPress={onCancel} disabled={pending} />
          <PropertyButton variant="danger" title={pending ? 'Inativando…' : 'Confirmar inativação'} onPress={onConfirm} disabled={pending} busy={pending} />
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><PropertyButton variant="outline" title="Tentar novamente" onPress={onRetry} /></View>;
}

function ImovelDetail({ imovel, pending, error, actionUncertain, onBack, onEdit, onDeactivate, onReload }: {
  readonly imovel: Imovel; readonly pending: boolean; readonly onBack: () => void; readonly onEdit: () => void; readonly onDeactivate: () => void;
  readonly error: string | null; readonly actionUncertain: boolean; readonly onReload: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PropertyButton variant="back" title="‹  Voltar aos imóveis" onPress={onBack} />
      <Text accessibilityRole="header" style={styles.title}>{imovel.descricao || `${imovel.endereco.logradouro}, ${imovel.endereco.numero ?? 's/n'}`}</Text>
      <View style={styles.statusBadge}><Text style={styles.status}>{imovel.status}</Text></View>
      <View style={styles.detailCard}>
        <PropertyDetailRow label="Endereço" value={`${imovel.endereco.logradouro}, ${imovel.endereco.numero ?? 's/n'}${imovel.endereco.complemento ? ` — ${imovel.endereco.complemento}` : ''}`} />
        <PropertyDetailRow label="Bairro" value={imovel.endereco.bairro} />
        <PropertyDetailRow label="Cidade" value={`${imovel.endereco.cidade}/${imovel.endereco.uf}`} />
        <PropertyDetailRow label="CEP" value={imovel.endereco.cep} />
        <PropertyDetailRow label="Metragem" value={imovel.metragemQuadrada == null ? 'Não informada' : `${imovel.metragemQuadrada} m²`} />
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Localização</Text>
      <View style={styles.detailCard}><Text>Coordenadas: {imovel.latitude}, {imovel.longitude}</Text></View>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {actionUncertain ? <PropertyButton variant="outline" title="Atualizar imóvel" onPress={onReload} disabled={pending} /> : null}
      <View style={styles.actions}><PropertyButton variant="outline" title="Editar imóvel" onPress={onEdit} disabled={pending || actionUncertain} /><PropertyButton variant="danger" title="Inativar imóvel" onPress={onDeactivate} disabled={pending || actionUncertain} /></View>
    </ScrollView>
  );
}

function ImovelForm({ imovel, pending, attempt, setAttempt, creationDraft, setCreationDraft, editDraft, setEditDraft, onUncertainEdit, onBack, onSave }: {
  readonly imovel?: Imovel; readonly pending: boolean; readonly onBack: () => void;
  readonly attempt: CreationAttempt | null; readonly setAttempt: (attempt: CreationAttempt | null) => void;
  readonly creationDraft: ImovelFormValues; readonly setCreationDraft: (draft: ImovelFormValues) => void;
  readonly editDraft: ImovelFormValues | null; readonly setEditDraft: (draft: ImovelFormValues) => void; readonly onUncertainEdit: () => void;
  readonly onSave: (input: SaveImovelInput, idempotencyKey: string) => Promise<Imovel>;
}) {
  const initialValues = useMemo(() => imovel ? editDraft ?? toImovelFormValues(imovel) : creationDraft, [imovel, creationDraft, editDraft]);
  const [values, setValues] = useState<ImovelFormValues>(initialValues);
  const [errors, setErrors] = useState<ImovelFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editUncertain, setEditUncertain] = useState(false);
  const submitting = useRef(false);

  const setValue = (field: keyof ImovelFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (!editUncertain) setSubmitError(null);
  };

  const submit = async () => {
    if (editUncertain || submitting.current) return;
    const validation = validateImovel(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    const input = toSaveImovelInput(values);
    const fingerprint = JSON.stringify(input);
    const nextAttempt = imovel ? { fingerprint, key: createIdempotencyKey() } : creationAttemptFor(attempt, fingerprint, createIdempotencyKey);
    if (!nextAttempt) {
      setSubmitError('O resultado da tentativa anterior ainda não foi confirmado. Volte à lista e atualize os imóveis antes de cadastrar outro com dados diferentes.');
      return;
    }
    if (!imovel) setAttempt(nextAttempt);
    submitting.current = true;
    try {
      await onSave(input, nextAttempt.key);
      if (!imovel) { setAttempt(null); setCreationDraft(emptyImovelForm); }
    } catch (error) {
      setErrors((current) => ({ ...current, ...serverErrors(error) }));
      if (error instanceof HttpProblemError && (error.problem.status === 400 || error.problem.status === 422)) setAttempt(null);
      if (imovel && !(error instanceof HttpProblemError && (error.problem.status === 400 || error.problem.status === 422))) {
        setEditDraft(values);
        setEditUncertain(true);
        onUncertainEdit();
      }
      setSubmitError(error instanceof HttpProblemError && error.problem.status === 412
        ? 'O imóvel foi alterado em outro acesso. Volte, atualize os dados e confirme novamente.'
        : error instanceof HttpProblemError && (error.problem.status === 400 || error.problem.status === 422)
          ? friendlyError(error)
          : imovel ? `${friendlyError(error)} O resultado não foi confirmado. Volte e atualize o imóvel antes de editar novamente; os dados digitados serão preservados nesta tela.`
          : `${friendlyError(error)} O resultado não foi confirmado. Atualize a lista de imóveis antes de iniciar outra operação; para repetir esta tentativa, mantenha os mesmos dados.`);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <PropertyButton variant="back" title="‹  Voltar" onPress={() => { if (imovel) setEditDraft(values); else setCreationDraft(values); onBack(); }} disabled={pending} />
      <Text accessibilityRole="header" style={styles.title}>{imovel ? 'Editar imóvel' : 'Cadastrar imóvel'}</Text>
      <Text>Campos marcados com * são obrigatórios. Confira os dados antes de salvar.</Text>
      {imovel && editDraft ? <Text accessibilityRole="alert">Seu rascunho anterior foi recuperado. Compare os dados com o imóvel atualizado antes de salvar.</Text> : null}
      {!imovel && attempt ? <Text accessibilityRole="alert">Há uma criação anterior com resultado não confirmado. Os dados foram preservados para que você possa consultá-los antes de repetir.</Text> : null}
      {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
      <Text accessibilityRole="header" style={styles.sectionTitle}>Identificação</Text>
      <Field label="Descrição" value={values.descricao} onChangeText={(value) => setValue('descricao', value)} error={errors.descricao} />
      <Field label="Metragem quadrada" value={values.metragemQuadrada} keyboardType="decimal-pad" onChangeText={(value) => setValue('metragemQuadrada', value)} error={errors.metragemQuadrada} />
      <Text accessibilityRole="header" style={styles.sectionTitle}>Endereço</Text>
      <Field label="CEP" value={values.cep} keyboardType="number-pad" onChangeText={(value) => setValue('cep', value)} error={errors.cep} required />
      <Field label="Logradouro" value={values.logradouro} onChangeText={(value) => setValue('logradouro', value)} error={errors.logradouro} required />
      <Field label="Número" value={values.numero} keyboardType="number-pad" onChangeText={(value) => setValue('numero', value)} error={errors.numero} />
      <Field label="Complemento" value={values.complemento} onChangeText={(value) => setValue('complemento', value)} error={errors.complemento} />
      <Field label="Bairro" value={values.bairro} onChangeText={(value) => setValue('bairro', value)} error={errors.bairro} required />
      <Field label="Cidade" value={values.cidade} onChangeText={(value) => setValue('cidade', value)} error={errors.cidade} required />
      <Field label="UF" value={values.uf} autoCapitalize="characters" maxLength={2} onChangeText={(value) => setValue('uf', value)} error={errors.uf} required />
      <Text accessibilityRole="header" style={styles.sectionTitle}>Localização</Text>
      <Text style={styles.muted}>Informe as coordenadas do imóvel.</Text>
      <Field label="Latitude" value={values.latitude} keyboardType="decimal-pad" onChangeText={(value) => setValue('latitude', value)} error={errors.latitude} required />
      <Field label="Longitude" value={values.longitude} keyboardType="decimal-pad" onChangeText={(value) => setValue('longitude', value)} error={errors.longitude} required />
      <PropertyButton title={pending ? 'Salvando…' : 'Salvar'} disabled={pending || editUncertain} onPress={() => void submit()} busy={pending} />
    </ScrollView>
  );
}

function Field({ label, error, required = false, ...props }: {
  readonly label: string; readonly error?: string; readonly required?: boolean;
  readonly value: string; readonly onChangeText: (value: string) => void;
  readonly keyboardType?: 'default' | 'decimal-pad' | 'number-pad'; readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; readonly maxLength?: number;
}) {
  return <View style={styles.field}><Text>{label}{required ? ' *' : ''}</Text><TextInput accessibilityLabel={`${label}${required ? ', obrigatório' : ''}`} accessibilityHint={error} style={styles.input} {...props} />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, listHeader: { gap: 12 },
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#F8F4EB' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 24, fontWeight: '700', color: '#1B2421' },
  detailCard: { borderWidth: 1, borderColor: '#DDDAD1', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, gap: 8 },
  addButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#005B44', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  emptyCard: { minHeight: 212, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D1C9', borderRadius: 16, backgroundColor: '#FFFDFA' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCF1E8' },
  emptyTitle: { color: '#10251D', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#465550', fontSize: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#DDDAD1', backgroundColor: '#FFFDFA', borderRadius: 16, padding: 16, marginVertical: 6, gap: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCF1E8' },
  cardContent: { flex: 1, gap: 4 }, cardTitle: { fontWeight: '700', color: '#10251D', fontSize: 16 },
  sectionTitle: { color: '#10251D', fontSize: 18, fontWeight: '700', marginTop: 8 },
  muted: { color: '#53655C' }, status: { color: '#005B44', fontWeight: '700' },
  focused: { borderWidth: 3, borderColor: '#175E55' },
  error: { borderColor: '#A3262E', borderWidth: 1, padding: 8, gap: 8 }, errorText: { color: '#A3262E' },
  field: { gap: 4 }, input: { borderWidth: 1, borderColor: '#6B7A74', backgroundColor: '#FFFFFF', color: '#1B2421', borderRadius: 12, padding: 10, minHeight: 48 }, actions: { gap: 12 },
  listStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#DCF1E8' },
  listStatusInactive: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E6EBE8' },
  inactiveStatus: { color: '#465550', fontWeight: '700' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#DCF1E8' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDDAD1' },
  detailValue: { color: '#1B2421', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  propertyButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#005B44', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  propertyButtonOutline: { backgroundColor: '#FFFDFA', borderWidth: 1, borderColor: '#005B44' },
  propertyButtonDanger: { backgroundColor: '#FBE9E6', borderWidth: 1, borderColor: '#A3262E' },
  propertyButtonBack: { alignSelf: 'flex-start', paddingHorizontal: 0, backgroundColor: 'transparent' },
  propertyButtonFocused: { borderWidth: 3, borderColor: '#175E55' },
  propertyButtonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  propertyButtonOutlineText: { color: '#005B44' }, propertyButtonDangerText: { color: '#A3262E' }, propertyButtonBackText: { color: '#005B44' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalScroll: { flexGrow: 0, maxHeight: '90%' },
  modalCard: { gap: 16, padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' }, modalTitle: { fontSize: 20, fontWeight: '700' },
});
