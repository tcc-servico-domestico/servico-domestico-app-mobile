import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createImoveisApi } from './api';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ImoveisApi com servidor mockado', () => {
  it('envia a criação v1 sem IDs internos e retorna a resposta do Core', async () => {
    server.use(http.post('https://core.example.test/api/v1/imoveis', async ({ request }) => {
      expect(request.headers.get('idempotency-key')).toBe('create-1');
      const body = await request.json() as Record<string, unknown>;
      expect(body).not.toHaveProperty('PessoaId');
      expect(body).not.toHaveProperty('EnderecoId');
      expect(body).toMatchObject({ latitude: -15.79, longitude: -47.88, endereco: { bairro: 'Centro' } });
      return HttpResponse.json({ ...body, id: 'imovel-1', status: 'Ativo', aggregateVersion: 1 }, { status: 201 });
    }));

    const api = createImoveisApi(createFetchHttpClient({ baseUrl: 'https://core.example.test' }));
    const result = await api.create({
      descricao: 'Casa', metragemQuadrada: 80, latitude: -15.79, longitude: -47.88,
      endereco: { logradouro: 'Rua A', numero: 10, complemento: null, bairro: 'Centro', cidade: 'Brasília', uf: 'DF', cep: '70000-000' },
    }, 'create-1');

    expect(result).toMatchObject({ id: 'imovel-1', aggregateVersion: 1 });
  });

  it('aceita inativação sem corpo 204', async () => {
    server.use(http.delete('https://core.example.test/api/v1/imoveis/imovel-1', ({ request }) => {
      expect(request.headers.get('if-match')).toBe('"3"');
      return new HttpResponse(null, { status: 204 });
    }));

    const api = createImoveisApi(createFetchHttpClient({ baseUrl: 'https://core.example.test' }));
    await expect(api.deactivate('imovel-1', 3)).resolves.toBeUndefined();
  });
});
