import { describe, expect, it, vi } from 'vitest';

import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import { createPagamentosApi } from './api';

function client() {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as OperationsHttpClient;
}

describe('createPagamentosApi', () => {
  it('consulta somente os endpoints públicos v1 de pagamentos', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    const api = createPagamentosApi(http);

    await api.list({ page: 2, pageSize: 10, status: 'Pendente' });
    await api.get('11111111-1111-4111-8111-111111111111');

    expect(http.get).toHaveBeenNthCalledWith(1, '/api/v1/pagamentos', { query: { page: 2, pageSize: 10, status: 'Pendente' } });
    expect(http.get).toHaveBeenNthCalledWith(2, '/api/v1/pagamentos/11111111-1111-4111-8111-111111111111');
    expect(http.post).not.toHaveBeenCalled();
  });
});
