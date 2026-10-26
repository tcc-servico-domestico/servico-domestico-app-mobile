import { describe, expect, it, vi } from 'vitest';

import { createIdentityApi } from '@/src/features/identity/identityApi';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

function token(payload: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`;
}

describe('identityApi', () => {
  it('maps JWT claims into the shared authenticated session', async () => {
    const post = vi.fn().mockResolvedValue({
      accessToken: token({ sub: 'user-1', role: ['Cliente'], exp: 1_800_000_000 }),
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const http = { post } as unknown as OperationsHttpClient;

    const session = await createIdentityApi(http).login({ usuario: 'user@example.com', senha: 'secret' });

    expect(post).toHaveBeenCalledWith('/Autenticacao/login', { usuario: 'user@example.com', senha: 'secret' });
    expect(session).toMatchObject({ userId: 'user-1', roles: ['Cliente'], status: 'authenticated' });
    expect(session.expiresAt).toBe('2027-01-15T08:00:00.000Z');
  });

  it('encodes an opaque token in the confirmation path', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const http = { get } as unknown as OperationsHttpClient;

    await createIdentityApi(http).confirmEmail('a/b+c=');

    expect(get).toHaveBeenCalledWith('/Usuario/confirmar-email/a%2Fb%2Bc%3D');
  });

  it('rejects a token already expired before persisting the session', async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        accessToken: token({ sub: 'user-1', role: 'Cliente', exp: 1_000 }),
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    } as unknown as OperationsHttpClient;

    await expect(createIdentityApi(http, () => 1_000_001).login({ usuario: 'user@example.com', senha: 'secret' }))
      .rejects.toThrow('já está expirada');
  });

  it('executes the identity journey against a mock without putting the confirmation token in the request body', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        accessToken: token({ sub: 'user-1', role: 'Cliente', exp: 1_800_000_000 }),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    const get = vi.fn().mockResolvedValue(undefined);
    const api = createIdentityApi({ post, get } as unknown as OperationsHttpClient);

    await api.register({ email: 'pessoa@example.invalid', senha: 'senha-de-teste' });
    await api.confirmEmail('token-opaco');
    await api.login({ usuario: 'pessoa@example.invalid', senha: 'senha-de-teste' });

    expect(post).toHaveBeenNthCalledWith(1, '/Usuario', { email: 'pessoa@example.invalid', senha: 'senha-de-teste' });
    expect(get).toHaveBeenCalledWith('/Usuario/confirmar-email/token-opaco');
    expect(post).toHaveBeenNthCalledWith(2, '/Autenticacao/login', { usuario: 'pessoa@example.invalid', senha: 'senha-de-teste' });
  });
});
