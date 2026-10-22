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
});
