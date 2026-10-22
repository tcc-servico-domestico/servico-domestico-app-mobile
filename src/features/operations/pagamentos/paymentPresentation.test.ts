import { describe, expect, it } from 'vitest';

import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';
import { isPagamentoTerminal, isPixExpired, paymentStatusLabel, shouldPollPagamento } from './paymentPresentation';

const base: Pagamento = {
  id: '11111111-1111-4111-8111-111111111111', servicoId: '22222222-2222-4222-8222-222222222222', valor: 120,
  moeda: 'BRL', status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: '2099-01-01T12:00:00Z', paidAt: null,
  createdAt: '2099-01-01T12:00:00Z', updatedAt: null, aggregateVersion: 1, transacoes: [],
};

describe('apresentação e monitoramento de pagamento', () => {
  it('mantém confirmação retida em acompanhamento e para nos estados terminais', () => {
    const confirmed = { ...base, status: 'Confirmado' as const, custodiaStatus: 'Retida' as const };
    expect(isPagamentoTerminal(confirmed)).toBe(false);
    expect(shouldPollPagamento(confirmed, '2099-01-01T13:00:00Z', Date.parse('2099-01-01T12:01:00Z'))).toBe(true);
    expect(isPagamentoTerminal({ ...confirmed, custodiaStatus: 'Liberada' })).toBe(true);
    expect(isPagamentoTerminal({ ...base, status: 'Falhou', custodiaStatus: 'Falhou' })).toBe(true);
    expect(isPagamentoTerminal({ ...base, status: 'Estornado', custodiaStatus: 'Estornada' })).toBe(true);
  });

  it('trata expiração como limite local e apresenta os estados financeiros', () => {
    const now = Date.parse('2099-01-01T13:00:00Z');
    expect(isPixExpired('2099-01-01T13:00:00Z', now)).toBe(true);
    expect(shouldPollPagamento(base, '2099-01-01T13:00:00Z', now)).toBe(false);
    expect(paymentStatusLabel(base)).toBe('Aguardando pagamento');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Retida' })).toContain('custódia');
    expect(paymentStatusLabel({ ...base, status: 'Estornado', custodiaStatus: 'Estornada' })).toBe('Pagamento estornado');
  });
});
