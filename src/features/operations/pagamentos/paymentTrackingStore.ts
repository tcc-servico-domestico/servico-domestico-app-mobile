import * as SecureStore from 'expo-secure-store';

export interface TrackedPixCharge {
  readonly pagamentoId: string;
  readonly servicoId: string;
  readonly pixCopiaECola: string | null;
  readonly expiraEm: string;
}

const keyFor = (userId: string) => `servico-domestico.payment-tracking.v1.${userId}`;
const supportsSecureStore = typeof window === 'undefined';
const volatileCharges = new Map<string, readonly TrackedPixCharge[]>();

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
  return Array.isArray(source) ? source.filter(isTrackedCharge) : [];
}

async function write(userId: string, charges: readonly TrackedPixCharge[]) {
  if (supportsSecureStore) await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(charges));
  volatileCharges.set(userId, charges);
}

export const paymentTrackingStore = {
  load: read,
  async save(userId: string, charge: TrackedPixCharge) {
    const current = await read(userId);
    await write(userId, [charge, ...current.filter((item) => item.pagamentoId !== charge.pagamentoId)]);
  },
  async removePixCode(userId: string, pagamentoId: string) {
    const current = await read(userId);
    await write(userId, current.map((item) => item.pagamentoId === pagamentoId ? { ...item, pixCopiaECola: null } : item));
  },
  async clear(userId: string) {
    volatileCharges.delete(userId);
    if (supportsSecureStore) await SecureStore.deleteItemAsync(keyFor(userId));
  },
};
