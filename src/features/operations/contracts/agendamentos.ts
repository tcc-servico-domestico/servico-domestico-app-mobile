import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type AgendamentoStatus =
  | 'AguardandoPagamento'
  | 'AguardandoSelecao'
  | 'AguardandoAceite'
  | 'Aceito'
  | 'EmExecucao'
  | 'Concluido'
  | 'Cancelado'
  | 'Expirado';

export type TarefaStatus = 'Pendente' | 'EmAndamento' | 'Concluida';
export type RaioBuscaKm = 5 | 10 | 20 | 30 | 50;

export interface Tarefa {
  readonly id: string;
  readonly descricao: string;
  readonly ordem: number;
  readonly status: TarefaStatus;
}

export interface Agendamento {
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
  readonly status: AgendamentoStatus;
  readonly tarefas: readonly Tarefa[];
  readonly aggregateVersion: number;
}

export interface TarefaInput {
  readonly descricao: string;
  readonly ordem: number;
}

export interface CreateAgendamentoInput {
  readonly imovelId: string;
  readonly raioBuscaKm: RaioBuscaKm;
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly valor: number;
  readonly tarefas: readonly TarefaInput[];
}

export interface UpdateAgendamentoInput {
  readonly inicioPrevisto?: string;
  readonly fimPrevisto?: string;
  readonly raioBuscaKm?: RaioBuscaKm;
  readonly tarefas?: readonly TarefaInput[];
}

export interface ProfissionalCompativel {
  readonly profissionalId: string;
  readonly nomeExibicao?: string;
  readonly distanciaKm: number;
  readonly avaliacaoMedia: number;
  readonly quantidadeAvaliacoes: number;
  readonly posicaoRanking: number;
}

export interface AgendamentosApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: AgendamentoStatus }): Promise<Page<Agendamento>>;
  get(agendamentoId: string): Promise<Agendamento>;
  create(input: CreateAgendamentoInput, idempotencyKey: string): Promise<Agendamento>;
  update(agendamentoId: string, input: UpdateAgendamentoInput): Promise<Agendamento>;
  listCompatibleProfessionals(
    agendamentoId: string,
    input?: { readonly page?: number; readonly pageSize?: number },
  ): Promise<Page<ProfissionalCompativel>>;
  selectProfessional(
    agendamentoId: string,
    profissionalId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Agendamento>;
  cancel(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  start(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  complete(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  updateTask(agendamentoId: string, tarefaId: string, status: TarefaStatus): Promise<Tarefa>;
}

export type AgendamentosApiFactory = (http: OperationsHttpClient) => AgendamentosApi;
