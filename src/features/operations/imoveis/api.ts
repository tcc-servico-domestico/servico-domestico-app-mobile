import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import type { ImoveisApi, Page, Imovel } from '@/src/features/operations/contracts/imoveis';

const resourcePath = '/api/v1/imoveis';

function quotedVersion(version: number): string {
  return `\"${version}\"`;
}

export function createImoveisApi(http: OperationsHttpClient): ImoveisApi {
  return {
    list: (input = {}) => http.get<Page<Imovel>>(resourcePath, { query: input }),
    get: (imovelId) => http.get<Imovel>(`${resourcePath}/${imovelId}`),
    create: (input, idempotencyKey) => http.post<Imovel>(resourcePath, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
    update: (imovelId, input, expectedVersion) => http.put<Imovel>(`${resourcePath}/${imovelId}`, input, {
      headers: { 'If-Match': quotedVersion(expectedVersion) },
    }),
    deactivate: (imovelId, expectedVersion) => http.delete<void>(`${resourcePath}/${imovelId}`, {
      headers: { 'If-Match': quotedVersion(expectedVersion) },
    }),
  };
}
