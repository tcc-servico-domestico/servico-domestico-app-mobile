import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIdentityApi } from '@/src/features/identity/identityApi';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';

afterEach(() => vi.unstubAllGlobals());

function token(payload: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`;
}

describe('identityApi', () => {
  it('conclui solicitações com respostas HTTP reais sem corpo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createIdentityApi(createFetchHttpClient({ baseUrl: 'https://api.example.test' }));
    await expect(api.requestEmailChange('user-1', 'novo@example.invalid')).resolves.toBeUndefined();
    await expect(api.confirmEmailChange('token-sintetico')).resolves.toBeUndefined();
    await expect(api.deleteAccount('user-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('loads the authenticated user profile and propagates failures', async () => {
    const profile = { id: 'user-1', email: 'pessoa@example.invalid', ativo: true, emailVerificado: true, emailPendente: 'novo@example.invalid' };
    const get = vi.fn().mockResolvedValueOnce(profile).mockRejectedValueOnce(new Error('indisponível'));
    const api = createIdentityApi({ get } as unknown as OperationsHttpClient);

    await expect(api.getProfile('user-1')).resolves.toEqual(profile);
    expect(get).toHaveBeenCalledWith('/Usuario/user-1');
    await expect(api.getProfile('user-1')).rejects.toThrow('indisponível');
  });

  it('propagates an unauthorized profile response for the session handler', async () => {
    const unauthorized = new HttpProblemError({ title: 'Sessão inválida', status: 401 });
    const get = vi.fn().mockRejectedValue(unauthorized);
    await expect(createIdentityApi({ get } as unknown as OperationsHttpClient).getProfile('user-1'))
      .rejects.toBe(unauthorized);
  });

  it('requests an email change without declaring the new address confirmed', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const api = createIdentityApi({ post } as unknown as OperationsHttpClient);
    await api.requestEmailChange('user-1', 'novo@example.invalid');
    expect(post).toHaveBeenCalledWith('/Usuario/user-1/alterar-email', { email: 'novo@example.invalid' });
  });

  it('sends the opaque change token to its own confirmation endpoint', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const api = createIdentityApi({ get } as unknown as OperationsHttpClient);
    await api.confirmEmailChange('a/b+c=');
    expect(get).toHaveBeenCalledWith('/Usuario/confirmar-alteracao-email/a%2Fb%2Bc%3D');
  });

  it('sends one account deletion request and propagates an uncertain failure', async () => {
    const failure = new Error('resposta desconhecida');
    const remove = vi.fn().mockRejectedValue(failure);
    const api = createIdentityApi({ delete: remove } as unknown as OperationsHttpClient);
    await expect(api.deleteAccount('user-1')).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('/Usuario/user-1');
  });
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

  it.each([
    ['sem assunto', { role: 'Cliente', exp: 1_800_000_000 }],
    ['sem papel permitido', { sub: 'user-1', role: 'Administrador', exp: 1_800_000_000 }],
    ['sem expiração', { sub: 'user-1', role: 'Cliente' }],
  ])('rejects a token %s before creating the session', async (_scenario, payload) => {
    const http = {
      post: vi.fn().mockResolvedValue({
        accessToken: token(payload),
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    } as unknown as OperationsHttpClient;

    await expect(createIdentityApi(http).login({ usuario: 'user@example.com', senha: 'secret' }))
      .rejects.toThrow('Token de acesso inválido');
  });

  it('rejects a response that is not a Bearer token', async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        accessToken: token({ sub: 'user-1', role: 'Cliente', exp: 1_800_000_000 }),
        tokenType: 'Basic',
        expiresIn: 900,
      }),
    } as unknown as OperationsHttpClient;

    await expect(createIdentityApi(http).login({ usuario: 'user@example.com', senha: 'secret' }))
      .rejects.toThrow('resposta de autenticação é inválida');
  });

  it('rejects a malformed access token', async () => {
    const http = {
      post: vi.fn().mockResolvedValue({ accessToken: 'not-a-jwt', tokenType: 'Bearer', expiresIn: 900 }),
    } as unknown as OperationsHttpClient;

    await expect(createIdentityApi(http).login({ usuario: 'user@example.com', senha: 'secret' }))
      .rejects.toThrow('Token de acesso inválido');
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
