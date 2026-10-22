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
});
