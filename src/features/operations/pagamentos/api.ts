import type { PagamentosApi } from '@/src/features/operations/contracts/pagamentos';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const resourcePath = '/api/v1/pagamentos';

export function createPagamentosApi(http: OperationsHttpClient): PagamentosApi {
  return {
    list: (input = {}) => http.get(resourcePath, { query: input }),
    get: (pagamentoId) => http.get(`${resourcePath}/${pagamentoId}`),
  };
}
