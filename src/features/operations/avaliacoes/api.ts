import type { Avaliacao, AvaliacoesApi } from '../contracts/avaliacoes';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const servico = (id: string) => `/api/v1/servicos/${encodeURIComponent(id)}/avaliacao`;

export function createAvaliacoesApi(http: OperationsHttpClient): AvaliacoesApi {
  return {
    async obterDoServico(id, signal) {
      const resposta = await http.get<{ avaliacao: Avaliacao | null }>(servico(id), { signal });
      return resposta.avaliacao;
    },
    registrar: (id, avaliacao) => http.post(servico(id), avaliacao),
    listar: (id, page, signal) => http.get(`/api/v1/profissionais/${encodeURIComponent(id)}/avaliacoes`, {
      query: { page, pageSize: 20 }, signal,
    }),
    resumir: (signal) => http.get('/api/v1/profissionais/me/avaliacoes', { signal }),
  };
}
