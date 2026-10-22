import type { OfertasApi } from '@/src/features/operations/contracts/ofertas';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const quotedVersion = (version: number) => `\"${version}\"`;
const commandHeaders = (expectedVersion: number, idempotencyKey: string) => ({
  'If-Match': quotedVersion(expectedVersion),
  'Idempotency-Key': idempotencyKey,
});

export function createOfertasApi(http: OperationsHttpClient): OfertasApi {
  return {
    list: (input = {}) => http.get('/api/v1/ofertas', { query: input }),
    accept: (servicoId, versaoOferta, expectedVersion, idempotencyKey) => http.post(
      `/api/v1/servicos/${servicoId}/oferta/aceite`, { versaoOferta }, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
    reject: (servicoId, versaoOferta, expectedVersion, idempotencyKey) => http.post(
      `/api/v1/servicos/${servicoId}/oferta/recusa`, { versaoOferta }, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
  };
}
