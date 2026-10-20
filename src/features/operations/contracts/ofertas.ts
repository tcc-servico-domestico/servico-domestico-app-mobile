import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type OfertaStatus = 'Pendente' | 'Aceita' | 'Recusada' | 'Expirada' | 'Cancelada';

export interface Oferta {
  readonly servicoId: string;
  readonly versaoOferta: number;
  readonly aggregateVersion: number;
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly valor: number;
  readonly pagamentoConfirmado: true;
  readonly expiraEmUtc: string;
  readonly status: OfertaStatus;
  readonly checklists: readonly { readonly descricao: string; readonly ordem: number }[];
}

export interface OfertasApi {
  /** Retorna apenas ofertas dirigidas ao profissional autenticado. */
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: OfertaStatus }): Promise<Page<Oferta>>;
  accept(servicoId: string, versaoOferta: number, expectedVersion: number, idempotencyKey: string): Promise<Oferta>;
  reject(servicoId: string, versaoOferta: number, expectedVersion: number, idempotencyKey: string): Promise<Oferta>;
}

export type OfertasApiFactory = (http: OperationsHttpClient) => OfertasApi;
