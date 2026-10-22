import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';
import { createServicosApi } from './api';
import { createOfertasApi } from '@/src/features/operations/ofertas/api';

const server = setupServer();
const baseUrl = 'https://core.example.test';
const service = { id: '11111111-1111-4111-8111-111111111111', imovelId: '22222222-2222-4222-8222-222222222222', profissionalId: null, raioBuscaKm: 10, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', ofertaExpiraEmUtc: null, versaoOferta: null, valor: 100, moeda: 'BRL', status: 'AguardandoPagamento', checklists: [{ id: '33333333-3333-4333-8333-333333333333', descricao: 'Limpar', ordem: 1, status: 'Pendente' }], aggregateVersion: 1 };

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('adaptadores v1 de serviços e ofertas', () => {
  it('envia criação sem IDs internos, expõe o Pix e usa ETag nos comandos', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/servicos`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        expect(request.headers.get('idempotency-key')).toBe('create-key');
        expect(body).not.toHaveProperty('PessoaId'); expect(body).not.toHaveProperty('EnderecoId');
        return HttpResponse.json({ servico: service, cobrancaPix: { pagamentoId: '44444444-4444-4444-8444-444444444444', pixCopiaECola: 'pix-code', expiraEm: '2099-01-01T13:00:00Z' } }, { status: 201 });
      }),
      http.post(`${baseUrl}/api/v1/servicos/${service.id}/selecao`, async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"1"'); expect(request.headers.get('idempotency-key')).toBe('select-key');
        expect(await request.json()).toEqual({ profissionalId: '55555555-5555-4555-8555-555555555555' });
        return HttpResponse.json({ ...service, status: 'AguardandoAceite', aggregateVersion: 2 });
      }),
      http.patch(`${baseUrl}/api/v1/servicos/${service.id}/checklists/${service.checklists[0].id}`, async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"2"'); expect(await request.json()).toEqual({ status: 'EmAndamento' });
        return HttpResponse.json({ ...service.checklists[0], status: 'EmAndamento' });
      }),
      http.get(`${baseUrl}/api/v1/ofertas`, () => HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 })),
    );
    const client = createFetchHttpClient({ baseUrl }); const api = createServicosApi(client); const offers = createOfertasApi(client);
    const creation = await api.create({ imovelId: service.imovelId, raioBuscaKm: 10, inicioPrevisto: service.inicioPrevisto, fimPrevisto: service.fimPrevisto, valor: 100, checklists: [{ descricao: 'Limpar', ordem: 1 }] }, 'create-key');
    expect(creation.cobrancaPix.pixCopiaECola).toBe('pix-code');
    await api.selectProfessional(service.id, '55555555-5555-4555-8555-555555555555', 1, 'select-key');
    await api.updateChecklist(service.id, service.checklists[0].id, 'EmAndamento', 2, 'check-key');
    await expect(offers.list()).resolves.toMatchObject({ total: 0 });
  });
});
