import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createPagamentosApi } from './api';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';

const server = setupServer();
const baseUrl = 'https://payment.example.test';
const payment = { id: '11111111-1111-4111-8111-111111111111', servicoId: '22222222-2222-4222-8222-222222222222', valor: 120, moeda: 'BRL', status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: '2099-01-01T12:00:00Z', paidAt: null, createdAt: '2099-01-01T12:00:00Z', updatedAt: null, aggregateVersion: 1, transacoes: [] };

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('adaptador HTTP de pagamentos', () => {
  it('envia Bearer à API de Pagamento e consulta lista e detalhe', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/pagamentos`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer user-token');
        return HttpResponse.json({ items: [payment], page: 1, pageSize: 100, total: 1 });
      }),
      http.get(`${baseUrl}/api/v1/pagamentos/${payment.id}`, () => HttpResponse.json(payment)),
    );
    const api = createPagamentosApi(createFetchHttpClient({ baseUrl, getAccessToken: async () => 'user-token' }));
    await expect(api.list({ page: 1, pageSize: 100 })).resolves.toMatchObject({ total: 1 });
    await expect(api.get(payment.id)).resolves.toMatchObject({ id: payment.id });
  });

  it('preserva Problem Details para recurso invisível e rede indisponível', async () => {
    server.use(http.get(`${baseUrl}/api/v1/pagamentos/:id`, () => HttpResponse.json({ title: 'Pagamento não encontrado', status: 404, code: 'not_found' }, { status: 404 })));
    const api = createPagamentosApi(createFetchHttpClient({ baseUrl }));
    await expect(api.get(payment.id)).rejects.toMatchObject({ problem: { title: 'Pagamento não encontrado', status: 404, code: 'not_found' } });

    server.use(http.get(`${baseUrl}/api/v1/pagamentos`, () => HttpResponse.error()));
    await expect(api.list()).rejects.toMatchObject({ problem: { status: 0, code: 'network_error' } });
  });
});
