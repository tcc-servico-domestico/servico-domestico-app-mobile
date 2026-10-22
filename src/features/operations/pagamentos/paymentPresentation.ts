import type { Pagamento } from '@/src/features/operations/contracts/pagamentos';

export function isPixExpired(expiraEm: string, now = Date.now()): boolean {
  return new Date(expiraEm).getTime() <= now;
}

export function isPagamentoTerminal(pagamento: Pagamento): boolean {
  return pagamento.status === 'Falhou' || pagamento.status === 'Estornado' ||
    (pagamento.status === 'Confirmado' && pagamento.custodiaStatus === 'Liberada');
}

export function shouldPollPagamento(pagamento: Pagamento, expiraEm: string | undefined, now = Date.now()): boolean {
  return !isPagamentoTerminal(pagamento) && !(expiraEm && isPixExpired(expiraEm, now));
}

export function paymentStatusLabel(pagamento: Pagamento): string {
  if (pagamento.status === 'Pendente') return 'Aguardando pagamento';
  if (pagamento.status === 'Falhou') return 'Pagamento recusado';
  if (pagamento.status === 'Estornado') return 'Pagamento estornado';
  if (pagamento.custodiaStatus === 'Liberada') return 'Valor liberado ao profissional';
  return 'Pagamento confirmado; valor em custódia';
}
