import type { Pagamento, TransacaoPagamento } from '@/src/features/operations/contracts/pagamentos';

export function transactionLabel(transaction: TransacaoPagamento): string {
  const operations: Record<string, string> = {
    CriacaoCobranca: 'Criação da cobrança', ConfirmacaoPagamento: 'Confirmação do pagamento',
    LiberacaoCustodia: 'Liberação da custódia', Estorno: 'Estorno',
  };
  const statuses: Record<string, string> = {
    Pendente: 'pendente', Confirmado: 'confirmado', Falhou: 'falhou', Estornado: 'estornado', Liberado: 'liberado',
  };
  return `${operations[transaction.operacao] ?? 'Operação desconhecida'}: ${statuses[transaction.status] ?? 'situação desconhecida'}`;
}

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
  if (pagamento.status !== 'Confirmado') return 'Situação do pagamento desconhecida';
  if (pagamento.custodiaStatus === 'Liberada') return 'Valor liberado ao profissional';
  if (pagamento.custodiaStatus === 'Retida') return 'Pagamento confirmado; valor em custódia';
  if (pagamento.custodiaStatus === 'NaoIniciada') return 'Pagamento confirmado; situação da custódia: não iniciada';
  if (pagamento.custodiaStatus === 'Falhou') return 'Pagamento confirmado; falha na custódia';
  if (pagamento.custodiaStatus === 'Estornada') return 'Pagamento confirmado; custódia estornada';
  return 'Pagamento confirmado; situação da custódia desconhecida';
}
