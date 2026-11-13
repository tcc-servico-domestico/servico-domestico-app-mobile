import { describe, expect, it } from 'vitest';

import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';
import { canCopyPix, formatPixExpiration, isPagamentoTerminal, isPixExpired, paymentStatusLabel, shouldPollPagamento, transactionLabel } from './paymentPresentation';

const base: Pagamento = {
  id: '11111111-1111-4111-8111-111111111111', servicoId: '22222222-2222-4222-8222-222222222222', valor: 120,
  moeda: 'BRL', status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: '2099-01-01T12:00:00Z', paidAt: null,
  createdAt: '2099-01-01T12:00:00Z', updatedAt: null, aggregateVersion: 1, transacoes: [],
};

describe('apresentação e monitoramento de pagamento', () => {
  it('apresenta histórico legível sem inventar estados desconhecidos', () => {
    const transaction = { id: '1', operacao: 'ConfirmacaoPagamento' as const, status: 'Confirmado' as const, occurredAt: '2099-01-01' };
    expect(transactionLabel(transaction)).toBe('Confirmação do pagamento: confirmado');
    expect(transactionLabel({ ...transaction, operacao: 'NovaOperacao' as typeof transaction.operacao, status: 'NovoStatus' as typeof transaction.status })).toBe('Operação desconhecida: situação desconhecida');
  });
  it('permite copiar somente código pendente e válido no instante do toque', () => {
    const expiration = '2099-01-01T13:00:00Z';
    expect(canCopyPix(base, 'codigo-de-teste', expiration, Date.parse('2099-01-01T12:59:59Z'))).toBe(true);
    expect(canCopyPix(base, 'codigo-de-teste', expiration, Date.parse(expiration))).toBe(false);
    expect(canCopyPix(base, null, expiration, Date.parse('2099-01-01T12:59:59Z'))).toBe(false);
    expect(canCopyPix({ ...base, status: 'Confirmado' }, 'codigo-de-teste', expiration, Date.parse('2099-01-01T12:59:59Z'))).toBe(false);
    expect(canCopyPix(base, 'codigo-de-teste', 'inválida', Date.parse('2099-01-01T12:59:59Z'))).toBe(false);
  });
  it('não apresenta uma validade inválida como data utilizável', () => {
    expect(formatPixExpiration('data-inválida')).toBe('Validade indisponível');
    expect(formatPixExpiration('2099-01-01T13:00:00Z')).toContain('01/01/2099');
  });
  it('mantém confirmação retida em acompanhamento e para nos estados terminais', () => {
    const confirmed = { ...base, status: 'Confirmado' as const, custodiaStatus: 'Retida' as const };
    expect(isPagamentoTerminal(confirmed)).toBe(false);
    expect(shouldPollPagamento(confirmed)).toBe(true);
    expect(isPagamentoTerminal({ ...confirmed, custodiaStatus: 'Liberada' })).toBe(true);
    expect(isPagamentoTerminal({ ...base, status: 'Falhou', custodiaStatus: 'Falhou' })).toBe(true);
    expect(isPagamentoTerminal({ ...base, status: 'Estornado', custodiaStatus: 'Estornada' })).toBe(true);
  });

  it('mantém acompanhamento após expirar o código e apresenta os estados financeiros', () => {
    const now = Date.parse('2099-01-01T13:00:00Z');
    expect(isPixExpired('2099-01-01T13:00:00Z', now)).toBe(true);
    expect(shouldPollPagamento(base)).toBe(true);
    expect(paymentStatusLabel(base)).toBe('Aguardando pagamento');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Retida' })).toContain('custódia');
    expect(paymentStatusLabel({ ...base, status: 'Estornado', custodiaStatus: 'Estornada' })).toBe('Pagamento estornado');
  });

  it('distingue confirmação de recebimento sem presumir custódia', () => {
    const confirmed = { ...base, status: 'Confirmado' as const, custodiaStatus: 'NaoIniciada' as const };
    expect(paymentStatusLabel({ ...confirmed, recebimentoStatus: 'Pendente' })).toBe('Pagamento confirmado; recebimento pendente');
    expect(paymentStatusLabel({ ...confirmed, recebimentoStatus: 'Recebido' })).toBe('Pagamento confirmado; valor recebido');
    expect(paymentStatusLabel({ ...confirmed, recebimentoStatus: 'Desconhecido' })).toBe('Pagamento confirmado; recebimento não informado');
  });
  it('não apresenta confirmação ou custódia que não foi informada', () => {
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'NaoIniciada' })).toBe('Pagamento confirmado; situação da custódia: não iniciada');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Falhou' })).toBe('Pagamento confirmado; falha na custódia');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Estornada' })).toBe('Pagamento confirmado; custódia estornada');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Desconhecida' as Pagamento['custodiaStatus'] })).toBe('Pagamento confirmado; situação da custódia desconhecida');
    expect(paymentStatusLabel({ ...base, status: 'Confirmado', custodiaStatus: 'Liberada' })).toBe('Valor liberado ao profissional');
    expect(paymentStatusLabel({ ...base, status: 'Falhou', custodiaStatus: 'Falhou' })).toBe('Pagamento recusado');
    expect(paymentStatusLabel({ ...base, status: 'Desconhecido' as Pagamento['status'] })).toBe('Situação do pagamento desconhecida');
  });
});
