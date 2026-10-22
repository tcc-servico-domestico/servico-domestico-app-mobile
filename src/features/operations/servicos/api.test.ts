import { describe, expect, it, vi } from 'vitest';

import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import { createServicosApi } from './api';
import { createOfertasApi } from '@/src/features/operations/ofertas/api';

function client() {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as OperationsHttpClient;
}

describe('adaptadores de operações', () => {
  it('mapeia lista, cancelamento, início e conclusão para as rotas v1 protegidas por versão', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    vi.mocked(http.post).mockResolvedValue({ id: 'service' });
    const api = createServicosApi(http);
    await api.list({ page: 2, pageSize: 10, status: 'Aceito' });
    await api.get('service');
    await api.cancel('service', 'Mudança de planos', 3, 'cancel-key');
    await api.start('service', 4, 'start-key');
    await api.complete('service', 5, 'complete-key');
    expect(http.get).toHaveBeenNthCalledWith(1, '/api/v1/servicos', { query: { page: 2, pageSize: 10, status: 'Aceito' } });
    expect(http.get).toHaveBeenNthCalledWith(2, '/api/v1/servicos/service');
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/v1/servicos/service/cancelamento', { motivo: 'Mudança de planos' }, { headers: { 'If-Match': '"3"', 'Idempotency-Key': 'cancel-key' } });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/v1/servicos/service/inicio', undefined, { headers: { 'If-Match': '"4"', 'Idempotency-Key': 'start-key' } });
    expect(http.post).toHaveBeenNthCalledWith(3, '/api/v1/servicos/service/conclusao', undefined, { headers: { 'If-Match': '"5"', 'Idempotency-Key': 'complete-key' } });
  });

  it('mapeia aceite e recusa somente com versão da oferta e versão do agregado', async () => {
    const http = client();
    vi.mocked(http.post).mockResolvedValue({ servicoId: 'service' });
    const api = createOfertasApi(http);
    await api.accept('service', 2, 7, 'accept-key');
    await api.reject('service', 3, 8, 'reject-key');
    expect(http.post).toHaveBeenNthCalledWith(1, '/api/v1/servicos/service/oferta/aceite', { versaoOferta: 2 }, { headers: { 'If-Match': '"7"', 'Idempotency-Key': 'accept-key' } });
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/v1/servicos/service/oferta/recusa', { versaoOferta: 3 }, { headers: { 'If-Match': '"8"', 'Idempotency-Key': 'reject-key' } });
  });
});
