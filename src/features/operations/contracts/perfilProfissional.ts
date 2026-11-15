export interface PontoPerfilProfissional {
  readonly latitude: number;
  readonly longitude: number;
}

export interface FaixaPerfilProfissional {
  readonly dia: string;
  readonly horaInicio: string;
  readonly horaFim: string;
}

export interface DadosPerfilProfissional {
  readonly habilidades: readonly string[];
  readonly areas: readonly PontoPerfilProfissional[];
  readonly disponibilidades: readonly FaixaPerfilProfissional[];
}

export interface PerfilProfissional extends DadosPerfilProfissional {
  readonly aggregateVersion: number;
}

export type ResultadoSalvamentoPerfil =
  | { estado: 'salvo' | 'divergente'; perfil: PerfilProfissional }
  | { estado: 'ausente' | 'incerto' };

export interface PerfilProfissionalApi {
  obter(signal?: AbortSignal): Promise<PerfilProfissional | null>;
  salvar(dados: DadosPerfilProfissional, versao: number | null, signal?: AbortSignal): Promise<ResultadoSalvamentoPerfil>;
  verificar(dados: DadosPerfilProfissional, signal?: AbortSignal): Promise<ResultadoSalvamentoPerfil>;
}
