import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Button, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import type { Imovel, ImoveisApi, SaveImovelInput } from '@/src/features/operations/contracts/imoveis';
import type { OperationsSession } from '@/src/shared/contracts/session';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createIdempotencyKey } from './idempotency';
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
  if (error instanceof HttpProblemError) return error.problem.detail ?? error.problem.title;
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
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

function summary(imovel: Imovel): string {
  const { endereco } = imovel;
  return `${endereco.logradouro}, ${endereco.numero ?? 's/n'} — ${endereco.cidade}/${endereco.uf}`;
}

export function ImoveisScreen({ api, session }: Props) {
  const canManageImoveis = session.roles.includes('Cliente');
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [items, setItems] = useState<readonly Imovel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState<Imovel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    } catch (error) {
      setMessage(friendlyError(error));
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
      return saved;
    } finally {
      setMutating(false);
    }
  }, [api]);

  const deactivate = useCallback(async (imovel: Imovel) => {
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
      } else setActionError(friendlyError(error));
    } finally {
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
      onBack={() => setScreen(screen.imovel ? { name: 'detail', imovel: screen.imovel } : { name: 'list' })}
      onSave={(input, key) => save(input, key, screen.imovel)}
    />;
  }

  if (screen.name === 'detail') {
    return <>
      <ImovelDetail
        imovel={screen.imovel}
        pending={mutating}
        error={actionError}
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
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Meus imóveis</Text>
        <Button title="Adicionar" accessibilityLabel="Cadastrar imóvel" onPress={() => setScreen({ name: 'form' })} />
      </View>
      {message ? <ErrorPanel message={message} onRetry={refresh} /> : null}
      {loading && items.length === 0 ? <View style={styles.center}><ActivityIndicator accessibilityLabel="Carregando imóveis" /></View> : null}
      {!loading && !message && items.length === 0 ? <View style={styles.center}><Text>Nenhum imóvel cadastrado.</Text></View> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver imóvel ${item.descricao ?? item.endereco.logradouro}`} style={styles.card} onPress={() => void openDetail(item.id)}>
            <Text style={styles.cardTitle}>{item.descricao ?? 'Imóvel sem descrição'}</Text>
            <Text>{summary(item)}</Text>
            <Text>{item.status}</Text>
          </Pressable>
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator accessibilityLabel="Carregando mais imóveis" /> : null}
      />
    </View>
  );
}

function DeactivationConfirmation({ visible, pending, onCancel, onConfirm }: {
  readonly visible: boolean; readonly pending: boolean; readonly onCancel: () => void; readonly onConfirm: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View accessibilityRole="alert" style={styles.modalCard}>
        <Text style={styles.modalTitle}>Inativar imóvel?</Text>
        <Text>Imóveis com serviço ativo não podem ser inativados.</Text>
        <View style={styles.actions}>
          <Button title="Cancelar" onPress={onCancel} disabled={pending} />
          <Button title={pending ? 'Inativando…' : 'Confirmar inativação'} color="#a00" onPress={onConfirm} disabled={pending} />
        </View>
      </View>
    </View>
  </Modal>;
}

function ErrorPanel({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return <View style={styles.error}><Text accessibilityRole="alert">{message}</Text><Button title="Tentar novamente" onPress={onRetry} /></View>;
}

function ImovelDetail({ imovel, pending, error, onBack, onEdit, onDeactivate }: {
  readonly imovel: Imovel; readonly pending: boolean; readonly onBack: () => void; readonly onEdit: () => void; readonly onDeactivate: () => void;
  readonly error: string | null;
}) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Voltar" onPress={onBack} />
      <Text style={styles.title}>{imovel.descricao ?? 'Imóvel sem descrição'}</Text>
      <Text>{summary(imovel)}</Text>
      <Text>CEP: {imovel.endereco.cep}</Text><Text>Coordenadas: {imovel.latitude}, {imovel.longitude}</Text>
      <Text>Metragem: {imovel.metragemQuadrada ?? 'não informada'} m²</Text><Text>Situação: {imovel.status}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      <View style={styles.actions}><Button title="Editar" onPress={onEdit} disabled={pending} /><Button title="Inativar" color="#a00" onPress={onDeactivate} disabled={pending} /></View>
    </ScrollView>
  );
}

function ImovelForm({ imovel, pending, onBack, onSave }: {
  readonly imovel?: Imovel; readonly pending: boolean; readonly onBack: () => void;
  readonly onSave: (input: SaveImovelInput, idempotencyKey: string) => Promise<Imovel>;
}) {
  const initialValues = useMemo(() => imovel ? toImovelFormValues(imovel) : emptyImovelForm, [imovel]);
  const [values, setValues] = useState<ImovelFormValues>(initialValues);
  const [errors, setErrors] = useState<ImovelFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ readonly fingerprint: string; readonly key: string } | null>(null);

  const setValue = (field: keyof ImovelFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async () => {
    const validation = validateImovel(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    const input = toSaveImovelInput(values);
    const fingerprint = JSON.stringify(input);
    const idempotencyKey = attempt?.fingerprint === fingerprint ? attempt.key : createIdempotencyKey();
    setAttempt({ fingerprint, key: idempotencyKey });
    try {
      await onSave(input, idempotencyKey);
    } catch (error) {
      setErrors((current) => ({ ...current, ...serverErrors(error) }));
      setSubmitError(error instanceof HttpProblemError && error.problem.status === 412
        ? 'O imóvel foi alterado em outro acesso. Volte, atualize os dados e confirme novamente.'
        : friendlyError(error));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Button title="Cancelar" onPress={onBack} disabled={pending} />
      <Text style={styles.title}>{imovel ? 'Editar imóvel' : 'Cadastrar imóvel'}</Text>
      {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
      <Field label="Descrição" value={values.descricao} onChangeText={(value) => setValue('descricao', value)} error={errors.descricao} />
      <Field label="Metragem quadrada" value={values.metragemQuadrada} keyboardType="decimal-pad" onChangeText={(value) => setValue('metragemQuadrada', value)} error={errors.metragemQuadrada} />
      <Field label="Latitude" value={values.latitude} keyboardType="decimal-pad" onChangeText={(value) => setValue('latitude', value)} error={errors.latitude} required />
      <Field label="Longitude" value={values.longitude} keyboardType="decimal-pad" onChangeText={(value) => setValue('longitude', value)} error={errors.longitude} required />
      <Field label="Logradouro" value={values.logradouro} onChangeText={(value) => setValue('logradouro', value)} error={errors.logradouro} required />
      <Field label="Número" value={values.numero} keyboardType="number-pad" onChangeText={(value) => setValue('numero', value)} error={errors.numero} />
      <Field label="Complemento" value={values.complemento} onChangeText={(value) => setValue('complemento', value)} error={errors.complemento} />
      <Field label="Bairro" value={values.bairro} onChangeText={(value) => setValue('bairro', value)} error={errors.bairro} required />
      <Field label="Cidade" value={values.cidade} onChangeText={(value) => setValue('cidade', value)} error={errors.cidade} required />
      <Field label="UF" value={values.uf} autoCapitalize="characters" maxLength={2} onChangeText={(value) => setValue('uf', value)} error={errors.uf} required />
      <Field label="CEP" value={values.cep} keyboardType="number-pad" onChangeText={(value) => setValue('cep', value)} error={errors.cep} required />
      <Button title={pending ? 'Salvando…' : 'Salvar'} disabled={pending} onPress={() => void submit()} accessibilityState={{ disabled: pending, busy: pending }} />
    </ScrollView>
  );
}

function Field({ label, error, required = false, ...props }: {
  readonly label: string; readonly error?: string; readonly required?: boolean;
  readonly value: string; readonly onChangeText: (value: string) => void;
  readonly keyboardType?: 'default' | 'decimal-pad' | 'number-pad'; readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; readonly maxLength?: number;
}) {
  return <View style={styles.field}><Text>{label}{required ? ' *' : ''}</Text><TextInput accessibilityLabel={label} accessibilityHint={error} style={styles.input} {...props} />{error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginVertical: 6, gap: 4 }, cardTitle: { fontWeight: '700' },
  error: { borderColor: '#a00', borderWidth: 1, padding: 8, gap: 8 }, errorText: { color: '#a00' },
  field: { gap: 4 }, input: { borderWidth: 1, borderColor: '#777', borderRadius: 4, padding: 10, minHeight: 44 }, actions: { gap: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalCard: { gap: 16, padding: 20, borderRadius: 8, backgroundColor: '#fff' }, modalTitle: { fontSize: 20, fontWeight: '700' },
});
