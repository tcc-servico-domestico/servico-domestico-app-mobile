import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type AgendamentoStatus =
  | 'AguardandoPagamento'
  | 'Disponivel'
  | 'Aceito'
  | 'EmExecucao'
  | 'Concluido'
  | 'Cancelado'
  | 'Expirado';

export type TarefaStatus = 'Pendente' | 'EmAndamento' | 'Concluida';

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
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
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
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly valor: number;
  readonly tarefas: readonly TarefaInput[];
}

export interface UpdateAgendamentoInput {
  readonly inicioPrevisto?: string;
  readonly fimPrevisto?: string;
  readonly tarefas?: readonly TarefaInput[];
}

export interface AgendamentosApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: AgendamentoStatus }): Promise<Page<Agendamento>>;
  get(agendamentoId: string): Promise<Agendamento>;
  create(input: CreateAgendamentoInput, idempotencyKey: string): Promise<Agendamento>;
  update(agendamentoId: string, input: UpdateAgendamentoInput): Promise<Agendamento>;
  cancel(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  start(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  complete(agendamentoId: string, idempotencyKey: string): Promise<Agendamento>;
  updateTask(agendamentoId: string, tarefaId: string, status: TarefaStatus): Promise<Tarefa>;
}

export type AgendamentosApiFactory = (http: OperationsHttpClient) => AgendamentosApi;
