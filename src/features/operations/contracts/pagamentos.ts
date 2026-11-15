import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type PagamentoStatus = 'EmConciliacao' | 'Pendente' | 'Confirmado' | 'Falhou' | 'Estornado' | 'Desconhecido';
export type TransacaoPagamentoStatus = PagamentoStatus | 'Liberado' | 'Incerto';
export type RecebimentoStatus = 'Pendente' | 'Recebido' | 'Desconhecido';
export type CustodiaStatus = 'NaoIniciada' | 'Retida' | 'Liberada' | 'Estornada' | 'Falhou' | 'Desconhecida';
export type GarantiaStatus = 'NaoConstituida' | 'Ativa' | 'Encerrada' | 'Desconhecida';
export type DisponibilidadeStatus = 'Disponivel' | 'Indisponivel' | 'Desconhecida';

export interface TransacaoPagamento {
  readonly id: string;
  readonly operacao: 'CriacaoCobranca' | 'ConfirmacaoPagamento' | 'LiberacaoCustodia' | 'Recebimento' | 'Repasse' | 'Estorno';
  readonly status: TransacaoPagamentoStatus;
  readonly occurredAt?: string;
  readonly observadoEm?: string;
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
  readonly recebimentoStatus?: RecebimentoStatus;
  readonly disponibilidadeStatus?: DisponibilidadeStatus;
  readonly garantiaStatus?: GarantiaStatus;
  readonly origem?: 'Fake' | 'AsaasSandbox';
  readonly requestedAt: string;
  readonly paidAt?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string | null;
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
  getPix?(pagamentoId: string): Promise<{ readonly pixCopiaECola: string | null; readonly expiraEm: string }>;
}

export type PagamentosApiFactory = (http: OperationsHttpClient) => PagamentosApi;
