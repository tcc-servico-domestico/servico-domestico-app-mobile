import type { Page } from './imoveis';

export interface Avaliacao {
  readonly nota: number;
  readonly comentario: string;
}

export interface ResumoAvaliacoes {
  readonly avaliacaoMedia: number;
  readonly quantidadeAvaliacoes: number;
}

export interface AvaliacoesApi {
  obterDoServico(servicoId: string, signal?: AbortSignal): Promise<Avaliacao | null>;
  registrar(servicoId: string, avaliacao: Avaliacao): Promise<Avaliacao>;
  listar(profissionalId: string, page: number, signal?: AbortSignal): Promise<Page<Avaliacao>>;
  resumir(signal?: AbortSignal): Promise<ResumoAvaliacoes>;
}
