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

  it('recupera o acompanhamento vencido sem recuperar o código Pix', async () => {
    const expired = { ...first, expiraEm: '2000-01-01T00:00:00Z' };
    nativeStore.values.set('servico-domestico.payment-tracking.v1.user-1', JSON.stringify([expired, first]));

    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([{ ...expired, pixCopiaECola: null }, first]);
    expect(JSON.parse(nativeStore.values.get('servico-domestico.payment-tracking.v1.user-1')!))
      .toEqual([{ ...expired, pixCopiaECola: null }, first]);
  });

  it('não mantém código com validade inválida ou já expirada ao salvar', async () => {
    const invalid = { ...first, expiraEm: 'inválida' };
    await paymentTrackingStore.save('user-1', invalid);
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([{ ...invalid, pixCopiaECola: null }]);
  });

  it('preserva cobranças quando salvamentos do mesmo usuário ocorrem em paralelo', async () => {
    await Promise.all([
      paymentTrackingStore.save('user-1', first),
      paymentTrackingStore.save('user-1', { ...first, pagamentoId: 'payment-2' }),
    ]);
    const payments = await paymentTrackingStore.load('user-1');
    expect(payments.map((item) => item.pagamentoId).sort()).toEqual(['payment-1', 'payment-2']);
  });

  it('apaga armazenamento após uma gravação pendente no logout', async () => {
    await Promise.all([
      paymentTrackingStore.save('user-1', first),
      paymentTrackingStore.clear('user-1'),
    ]);
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([]);
    expect(nativeStore.values.has('servico-domestico.payment-tracking.v1.user-1')).toBe(false);
  });

  it('permite nova operação após falha de armazenamento', async () => {
    nativeStore.setItemAsync.mockRejectedValueOnce(new Error('indisponível'));
    await expect(paymentTrackingStore.save('user-1', first)).rejects.toThrow('indisponível');
    await paymentTrackingStore.save('user-1', first);
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([first]);
  });

  it('ignora conteúdo persistido inválido sem interromper o aplicativo', async () => {
    nativeStore.values.set('servico-domestico.payment-tracking.v1.user-1', '{inválido');
    await expect(paymentTrackingStore.load('user-1')).resolves.toEqual([]);
  });
});
