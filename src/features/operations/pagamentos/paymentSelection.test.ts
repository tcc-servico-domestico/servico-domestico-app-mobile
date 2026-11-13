import { describe, expect, it } from 'vitest';
import { paymentSelectionReducer, type PaymentSelection } from './paymentSelection';

describe('navegação de pagamentos acompanhados', () => {
  it('abre a cobrança acompanhada apenas na primeira carga e respeita a volta à lista', () => {
    const initial: PaymentSelection = { initialized: false, selectedId: null };
    const opened = paymentSelectionReducer(initial, { type: 'loaded', trackedId: 'pix-1' });
    expect(opened.selectedId).toBe('pix-1');
    const back = paymentSelectionReducer(opened, { type: 'back' });
    expect(paymentSelectionReducer(back, { type: 'loaded', trackedId: 'pix-1' }).selectedId).toBeNull();
    expect(paymentSelectionReducer(back, { type: 'open', id: 'pix-2' }).selectedId).toBe('pix-2');
  });

  it('preserva uma seleção explícita ou volta mesmo se a carga inicial terminar depois', () => {
    const initial: PaymentSelection = { initialized: false, selectedId: 'explicit' };
    expect(paymentSelectionReducer(initial, { type: 'loaded', trackedId: 'pix-1' }).selectedId).toBe('explicit');
    const back = paymentSelectionReducer(initial, { type: 'back' });
    expect(paymentSelectionReducer(back, { type: 'loaded', trackedId: 'pix-1' }).selectedId).toBeNull();
    expect(paymentSelectionReducer(back, { type: 'open', id: 'nova-cobranca' }).selectedId).toBe('nova-cobranca');
  });
});
