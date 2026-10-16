import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

export type OfertaStatus = 'Disponivel' | 'Aceita' | 'Recusada' | 'Expirada';

export interface Oferta {
  readonly id: string;
  readonly agendamentoId: string;
  readonly inicioPrevisto: string;
  readonly fimPrevisto: string;
  readonly valor: number;
  readonly status: OfertaStatus;
}

export interface OfertasApi {
  list(input?: { readonly page?: number; readonly pageSize?: number; readonly status?: OfertaStatus }): Promise<Page<Oferta>>;
  accept(ofertaId: string, idempotencyKey: string): Promise<Oferta>;
  reject(ofertaId: string, idempotencyKey: string): Promise<Oferta>;
}

export type OfertasApiFactory = (http: OperationsHttpClient) => OfertasApi;
