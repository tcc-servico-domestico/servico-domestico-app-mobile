import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type ImovelStatus = 'Ativo' | 'Inativo';

export interface Endereco {
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly cidade: string;
  readonly uf: string;
  readonly cep: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface Imovel {
  readonly id: string;
  readonly descricao: string;
  readonly metragemQuadrada: number;
  readonly endereco: Endereco;
  readonly status: ImovelStatus;
  readonly aggregateVersion: number;
}

export interface SaveImovelInput {
  readonly descricao: string;
  readonly metragemQuadrada: number;
  readonly endereco: Endereco;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface ImoveisApi {
  list(input?: { readonly page?: number; readonly pageSize?: number }): Promise<Page<Imovel>>;
  get(imovelId: string): Promise<Imovel>;
  create(input: SaveImovelInput, idempotencyKey: string): Promise<Imovel>;
  update(imovelId: string, input: SaveImovelInput): Promise<Imovel>;
  deactivate(imovelId: string): Promise<void>;
}

export type ImoveisApiFactory = (http: OperationsHttpClient) => ImoveisApi;
