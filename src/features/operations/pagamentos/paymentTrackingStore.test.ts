import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeStore = vi.hoisted(() => ({
  values: new Map<string, string>(),
  getItemAsync: vi.fn(async (key: string) => nativeStore.values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { nativeStore.values.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { nativeStore.values.delete(key); }),
}));

vi.mock('expo-secure-store', () => nativeStore);

// Must follow the mock so the store receives the native implementation above.
// eslint-disable-next-line import/first
import { paymentTrackingStore } from './paymentTrackingStore';

const first = { pagamentoId: 'payment-1', servicoId: 'service-1', pixCopiaECola: 'pix-1', expiraEm: '2099-01-01T13:00:00Z' };

describe('paymentTrackingStore', () => {
  beforeEach(async () => {
    nativeStore.values.clear(); vi.clearAllMocks(); await paymentTrackingStore.clear('user-1'); vi.clearAllMocks();
  });

  it('restaura por usuário e substitui uma cobrança repetida sem duplicá-la', async () => {
    await paymentTrackingStore.save('user-1', first);
    await paymentTrackingStore.save('user-1', { ...first, expiraEm: '2099-01-01T14:00:00Z' });
    await paymentTrackingStore.save('user-2', { ...first, pagamentoId: 'payment-2' });

    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([{ ...first, expiraEm: '2099-01-01T14:00:00Z' }]);
    await expect(paymentTrackingStore.load('user-2')).resolves.toEqual([{ ...first, pagamentoId: 'payment-2' }]);
  });

  it('remove o código ao encerrar o ciclo e limpa os dados no logout', async () => {
    await paymentTrackingStore.save('user-1', first);
    await paymentTrackingStore.removePixCode('user-1', first.pagamentoId);
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([{ ...first, pixCopiaECola: null }]);
    await paymentTrackingStore.clear('user-1');
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([]);
  });

  it('ignora conteúdo persistido inválido sem interromper o aplicativo', async () => {
    nativeStore.values.set('servico-domestico.payment-tracking.v1.user-1', '{inválido');
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([]);
  });
});
