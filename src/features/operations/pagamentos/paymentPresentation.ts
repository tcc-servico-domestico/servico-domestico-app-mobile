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
  const expiration = new Date(expiraEm).getTime();
  return !Number.isFinite(expiration) || expiration <= now;
}

export function formatPixExpiration(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Validade indisponível';
  return `Expira em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)}`;
}
export function canCopyPix(pagamento: Pagamento, pixCode: string | null | undefined, expiraEm: string | undefined, now = Date.now()): boolean {
  return pagamento.status === 'Pendente' && Boolean(pixCode) && Boolean(expiraEm) && !isPixExpired(expiraEm!, now);
}

export function isPagamentoTerminal(pagamento: Pagamento): boolean {
  return pagamento.status === 'Falhou' || pagamento.status === 'Estornado' ||
    (pagamento.status === 'Confirmado' && pagamento.custodiaStatus === 'Liberada');
}

export function shouldPollPagamento(pagamento: Pagamento): boolean {
  return !isPagamentoTerminal(pagamento);
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
