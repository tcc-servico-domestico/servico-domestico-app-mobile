import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type PagamentoStatus = 'Pendente' | 'Confirmado' | 'Falhou' | 'Estornado';
export type CustodiaStatus = 'NaoIniciada' | 'Retida' | 'Liberada' | 'Estornada' | 'Falhou';

export interface TransacaoPagamento {
  readonly id: string;
  readonly operacao: 'CriacaoCobranca' | 'ConfirmacaoPagamento' | 'LiberacaoCustodia' | 'Estorno';
  readonly status: PagamentoStatus;
  readonly occurredAt: string;
  readonly gatewayId?: string;
}

export interface Pagamento {
  readonly id: string;
  readonly agendamentoId: string;
  readonly valor: number;
  readonly moeda: 'BRL';
  readonly descricao?: string;
  readonly status: PagamentoStatus;
  readonly custodiaStatus: CustodiaStatus;
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

export interface CreateCobrancaPixInput {
  readonly agendamentoId: string;
  readonly valor: number;
  readonly descricao: string;
}

export interface PagamentosApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: PagamentoStatus }): Promise<Page<Pagamento>>;
  get(pagamentoId: string): Promise<Pagamento>;
  createPixCharge(input: CreateCobrancaPixInput, idempotencyKey: string): Promise<CobrancaPix>;
}

export type PagamentosApiFactory = (http: OperationsHttpClient) => PagamentosApi;
