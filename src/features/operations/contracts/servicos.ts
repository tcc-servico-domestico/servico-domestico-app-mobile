import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type ServicoStatus =
  | 'AguardandoPagamento'
  | 'AguardandoSelecao'
  | 'AguardandoAceite'
  | 'Aceito'
  | 'EmExecucao'
  | 'Concluido'
  | 'Cancelado'
  | 'Expirado';

export type ChecklistStatus = 'Pendente' | 'EmAndamento' | 'Concluida';
export type RaioBuscaKm = 5 | 10 | 20 | 30 | 50;

export interface Checklist {
  readonly id: string;
  readonly descricao: string;
  readonly ordem: number;
  readonly status: ChecklistStatus;
}

export interface Servico {
  readonly id: string;
  readonly imovelId: string;
  readonly profissionalId: string | null;
  readonly raioBuscaKm: RaioBuscaKm;
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly ofertaExpiraEmUtc: string | null;
  readonly versaoOferta: number | null;
  readonly valor: number;
  readonly moeda: 'BRL';
  readonly status: ServicoStatus;
  readonly checklists: readonly Checklist[];
  readonly aggregateVersion: number;
}

export interface ChecklistInput {
  readonly descricao: string;
  readonly ordem: number;
}

export interface CreateServicoInput {
  readonly imovelId: string;
  readonly raioBuscaKm: RaioBuscaKm;
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly valor: number;
  readonly checklists: readonly ChecklistInput[];
}

export interface CobrancaPixCriada {
  readonly pagamentoId: string;
  readonly pixCopiaECola: string;
  readonly expiraEm: string;
}

export interface CriacaoServico {
  readonly servico: Servico;
  readonly cobrancaPix: CobrancaPixCriada;
}

export interface ProfissionalCompativel {
  readonly profissionalId: string;
  readonly nomeExibicao?: string;
  readonly distanciaKm: number;
  readonly avaliacaoMedia: number;
  readonly quantidadeAvaliacoes: number;
  readonly posicaoRanking: number;
}

export interface ServicosApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: ServicoStatus }): Promise<Page<Servico>>;
  get(servicoId: string): Promise<Servico>;
  create(input: CreateServicoInput, idempotencyKey: string): Promise<CriacaoServico>;
  listCompatibleProfessionals(
    servicoId: string,
    input?: { readonly page?: number; readonly pageSize?: number },
  ): Promise<Page<ProfissionalCompativel>>;
  selectProfessional(
    servicoId: string,
    profissionalId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Servico>;
  cancel(servicoId: string, motivo: string, expectedVersion: number, idempotencyKey: string): Promise<Servico>;
  start(servicoId: string, expectedVersion: number, idempotencyKey: string): Promise<Servico>;
  complete(servicoId: string, expectedVersion: number, idempotencyKey: string): Promise<Servico>;
  updateChecklist(servicoId: string, checklistId: string, status: ChecklistStatus, expectedVersion: number, idempotencyKey: string): Promise<Checklist>;
}

export type ServicosApiFactory = (http: OperationsHttpClient) => ServicosApi;
