import * as SecureStore from 'expo-secure-store';
import { isPixExpired } from './paymentPresentation';

export interface TrackedPixCharge {
  readonly pagamentoId: string;
  readonly servicoId: string;
  readonly pixCopiaECola: string | null;
  readonly expiraEm: string;
}

const keyFor = (userId: string) => `servico-domestico.payment-tracking.v1.${userId}`;
const supportsSecureStore = typeof window === 'undefined';
const volatileCharges = new Map<string, readonly TrackedPixCharge[]>();
const pendingOperations = new Map<string, Promise<void>>();

function serialize<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const result = (pendingOperations.get(userId) ?? Promise.resolve()).then(operation);
  const completion = result.then(() => undefined, () => undefined);
  pendingOperations.set(userId, completion);
  void completion.then(() => {
    if (pendingOperations.get(userId) === completion) pendingOperations.delete(userId);
  });
  return result;
}

function withoutExpiredCode(charge: TrackedPixCharge): TrackedPixCharge {
  return charge.pixCopiaECola && isPixExpired(charge.expiraEm)
    ? { ...charge, pixCopiaECola: null }
    : charge;
}

function isTrackedCharge(value: unknown): value is TrackedPixCharge {
  if (!value || typeof value !== 'object') return false;
  const charge = value as Partial<TrackedPixCharge>;
  return typeof charge.pagamentoId === 'string' && typeof charge.servicoId === 'string' &&
    typeof charge.expiraEm === 'string' && (typeof charge.pixCopiaECola === 'string' || charge.pixCopiaECola === null);
}

async function read(userId: string): Promise<readonly TrackedPixCharge[]> {
  const serialized = supportsSecureStore ? await SecureStore.getItemAsync(keyFor(userId)) : null;
  let source: unknown = volatileCharges.get(userId) ?? [];
  if (serialized) {
    try { source = JSON.parse(serialized); } catch { source = []; }
  }
  const charges = Array.isArray(source) ? source.filter(isTrackedCharge) : [];
  const sanitized = charges.map(withoutExpiredCode);
  if (sanitized.some((charge, index) => charge !== charges[index])) await write(userId, sanitized);
  return sanitized;
}

async function write(userId: string, charges: readonly TrackedPixCharge[]) {
  if (supportsSecureStore) await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(charges));
  volatileCharges.set(userId, charges);
}

export const paymentTrackingStore = {
  load: (userId: string) => serialize(userId, () => read(userId)),
  save: (userId: string, charge: TrackedPixCharge) => serialize(userId, async () => {
    const current = await read(userId);
    await write(userId, [withoutExpiredCode(charge), ...current.filter((item) => item.pagamentoId !== charge.pagamentoId)]);
  }),
  removePixCode: (userId: string, pagamentoId: string) => serialize(userId, async () => {
    const current = await read(userId);
    await write(userId, current.map((item) => item.pagamentoId === pagamentoId ? { ...item, pixCopiaECola: null } : item));
  }),
  clear: (userId: string) => serialize(userId, async () => {
    volatileCharges.delete(userId);
    if (supportsSecureStore) await SecureStore.deleteItemAsync(keyFor(userId));
  }),
};
