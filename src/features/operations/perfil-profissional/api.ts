import { HttpProblemError, type OperationsHttpClient } from '@/src/shared/contracts/http';
import type {
  DadosPerfilProfissional, PerfilProfissional, PerfilProfissionalApi, ResultadoSalvamentoPerfil,
} from '../contracts/perfilProfissional';
import { normalizarPerfil } from './validation';

const path = '/api/v1/profissionais/me';

function perfilValido(perfil: PerfilProfissional | null | undefined): perfil is PerfilProfissional {
  return !!perfil && Number.isInteger(perfil.aggregateVersion) && perfil.aggregateVersion > 0 &&
    Array.isArray(perfil.habilidades) && Array.isArray(perfil.areas) && Array.isArray(perfil.disponibilidades);
}

export function createPerfilProfissionalApi(http: OperationsHttpClient): PerfilProfissionalApi {
  async function obter(signal?: AbortSignal): Promise<PerfilProfissional | null> {
    try {
      const perfil = await http.get<PerfilProfissional>(path, { signal });
      if (!perfilValido(perfil)) throw new Error('O Core devolveu uma resposta de perfil inválida.');
      return perfil;
    } catch (erro) {
      if (erro instanceof HttpProblemError && erro.problem.status === 404 &&
          erro.problem.code === 'perfil_profissional_nao_encontrado') return null;
      throw erro;
    }
  }

  async function verificar(dados: DadosPerfilProfissional, signal?: AbortSignal): Promise<ResultadoSalvamentoPerfil> {
    try {
      const perfil = await obter(signal);
      if (perfil === null) return { estado: 'ausente' };
      const coincide = JSON.stringify(normalizarPerfil(perfil)) === JSON.stringify(normalizarPerfil(dados));
      return { estado: coincide ? 'salvo' : 'divergente', perfil };
    } catch (erro) {
      if (signal?.aborted || (erro instanceof HttpProblemError && [401, 403].includes(erro.problem.status))) throw erro;
      return { estado: 'incerto' };
    }
  }

  return {
    obter,
    verificar,
    async salvar(dados, versao, signal) {
      const headers: Record<string, string> = versao === null
        ? { 'If-None-Match': '*' }
        : { 'If-Match': `"${versao}"` };
      try {
        const perfil = await http.put<PerfilProfissional>(path, dados, { headers, signal });
        if (!perfilValido(perfil)) return verificar(dados, signal);
        return { estado: 'salvo', perfil };
      } catch (erro) {
        if (signal?.aborted) throw erro;
        if (erro instanceof HttpProblemError) {
          const { status } = erro.problem;
          if (status !== 0 && status !== 412 && status < 500) throw erro;
        } else if (!(erro instanceof SyntaxError)) throw erro;
        return verificar(dados, signal);
      }
    },
  };
}
