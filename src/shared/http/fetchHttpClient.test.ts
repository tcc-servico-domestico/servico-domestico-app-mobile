import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpProblemError } from '@/src/shared/contracts/http';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';

afterEach(() => vi.unstubAllGlobals());

describe('fetchHttpClient', () => {
  it('adds query, token and JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createFetchHttpClient({ baseUrl: 'https://api.example.test', getAccessToken: async () => 'token' });

    await client.post('/items', { name: 'x' }, { query: { page: 2, ignored: undefined } });

    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.example.test/items?page=2'), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token', 'Content-Type': 'application/json' }),
    }));
  });

  it('clears the session and exposes Problem Details on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Sessão inválida', status: 401 }), {
      status: 401,
      headers: { 'content-type': 'application/problem+json' },
    })));
    const unauthorized = vi.fn();
    const client = createFetchHttpClient({ baseUrl: 'https://api.example.test', onUnauthorized: unauthorized });

    await expect(client.get('/protected')).rejects.toBeInstanceOf(HttpProblemError);
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('preserva a sessão quando o servidor recusa permissão com 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Forbidden', status: 403 }), {
      status: 403, headers: { 'content-type': 'application/problem+json' },
    })));
    const unauthorized = vi.fn();
    const client = createFetchHttpClient({ baseUrl: 'https://api.example.test', onUnauthorized: unauthorized });
    await expect(client.get('/protected')).rejects.toMatchObject({ problem: { status: 403 } });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('identifica falha de rede sem encerrar a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const unauthorized = vi.fn();
    const client = createFetchHttpClient({ baseUrl: 'https://api.example.test', onUnauthorized: unauthorized });
    await expect(client.get('/protected')).rejects.toMatchObject({ problem: { status: 0, code: 'network_error' } });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it.each(['{', 'null', '[]'])('preserva o status e a correlação quando a resposta de erro é inválida: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      status: 503, headers: { 'content-type': 'application/problem+json', 'x-correlation-id': 'test-correlation' },
    })));
    const client = createFetchHttpClient({ baseUrl: 'https://api.example.test' });
    await expect(client.get('/protected')).rejects.toMatchObject({
      problem: { status: 503, title: 'Não foi possível concluir a solicitação.', correlationId: 'test-correlation' },
    });
  });
});
