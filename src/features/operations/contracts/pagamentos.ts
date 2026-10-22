import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type PagamentoStatus = 'Pendente' | 'Confirmado' | 'Falhou' | 'Estornado';
export type TransacaoPagamentoStatus = PagamentoStatus | 'Liberado';
export type CustodiaStatus = 'NaoIniciada' | 'Retida' | 'Liberada' | 'Estornada' | 'Falhou';

export interface TransacaoPagamento {
  readonly id: string;
  readonly operacao: 'CriacaoCobranca' | 'ConfirmacaoPagamento' | 'LiberacaoCustodia' | 'Estorno';
  readonly status: TransacaoPagamentoStatus;
  readonly occurredAt: string;
  readonly gatewayId?: string;
  readonly motivo?: string | null;
}

export interface Pagamento {
  readonly id: string;
  readonly servicoId: string;
  readonly valor: number;
  readonly moeda: 'BRL';
  readonly descricao?: string;
  readonly status: PagamentoStatus;
  readonly custodiaStatus: CustodiaStatus;
  readonly requestedAt: string;
  readonly paidAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly aggregateVersion: number;
  readonly transacoes: readonly TransacaoPagamento[];
}

export interface CobrancaPix {
  readonly pagamento: Pagamento;
  readonly pixCopiaECola: string;
  readonly expiraEm: string;
}

export interface PagamentosApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: PagamentoStatus }): Promise<Page<Pagamento>>;
  get(pagamentoId: string): Promise<Pagamento>;
}

export type PagamentosApiFactory = (http: OperationsHttpClient) => PagamentosApi;
