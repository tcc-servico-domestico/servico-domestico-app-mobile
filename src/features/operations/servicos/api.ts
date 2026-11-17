import type { ServicosApi, ChecklistStatus, CreateServicoInput, CriacaoServico } from '@/src/features/operations/contracts/servicos';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const resourcePath = '/api/v1/servicos';
const quotedVersion = (version: number) => `\"${version}\"`;
const commandHeaders = (expectedVersion: number, idempotencyKey: string) => ({
  'If-Match': quotedVersion(expectedVersion),
  'Idempotency-Key': idempotencyKey,
});

export function createServicosApi(http: OperationsHttpClient): ServicosApi {
  return {
    list: (input = {}) => http.get(resourcePath, { query: input }),
    get: (servicoId) => http.get(`${resourcePath}/${servicoId}`),
    create: (input: CreateServicoInput, idempotencyKey: string) => http.post<CriacaoServico>(resourcePath, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
    listCompatibleProfessionals: (servicoId, input = {}) => http.get(`${resourcePath}/${servicoId}/profissionais`, { query: input }),
    selectProfessional: (servicoId, profissionalId, expectedVersion, idempotencyKey) => http.post(
      `${resourcePath}/${servicoId}/selecao`, { profissionalId }, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
    cancel: (servicoId, motivo, expectedVersion, idempotencyKey) => http.post(
      `${resourcePath}/${servicoId}/cancelamento`, { motivo }, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
    start: (servicoId, expectedVersion, idempotencyKey) => http.post(
      `${resourcePath}/${servicoId}/inicio`, undefined, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
    complete: (servicoId, expectedVersion, idempotencyKey) => http.post(
      `${resourcePath}/${servicoId}/conclusao`, undefined, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
    updateChecklist: (servicoId, checklistId, status: ChecklistStatus, expectedVersion, idempotencyKey) => http.patch(
      `${resourcePath}/${servicoId}/checklists/${checklistId}`, { status }, { headers: commandHeaders(expectedVersion, idempotencyKey) },
    ),
  };
}
