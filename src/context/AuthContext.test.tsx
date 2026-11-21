import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { IdentityApi } from '@/src/features/identity/contracts';
import type { OperationsSession, SessionStore } from '@/src/shared/contracts/session';

vi.mock('@/src/shared/runtime', () => ({ identityApi: {}, sessionStore: {} }));
vi.mock('@/src/features/operations/pagamentos/paymentTrackingStore', () => ({ paymentTrackingStore: { clear: vi.fn() } }));

function Status() {
  const { status, session, sessionNotice, logout } = useAuth();
  return React.createElement('status', { status, roles: session?.roles.join(','), sessionNotice, logout });
}

describe('estado de acesso', () => {
  it('apresenta estado anônimo quando a sessão restaurada expirou', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const store = { load: vi.fn().mockResolvedValue(null), clear: vi.fn(), save: vi.fn() } as SessionStore;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<AuthProvider store={store} api={{} as IdentityApi}><Status /></AuthProvider>); });
    expect(view.root.findByType('status' as React.ElementType).props.status).toBe('anonymous');
    await act(async () => view.unmount());
  });

  it('mantém os dois papéis e remove o acesso ao receber limpeza de sessão', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const session = { status: 'authenticated', userId: 'test', roles: ['Cliente', 'Profissional'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' } as OperationsSession;
    let publish!: (value: OperationsSession | null) => void;
    const store = { load: vi.fn().mockResolvedValue(session), clear: vi.fn(), save: vi.fn(), subscribe: (fn: typeof publish) => { publish = fn; return () => {}; } } as SessionStore;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<AuthProvider store={store} api={{} as IdentityApi}><Status /></AuthProvider>); });
    expect(view.root.findByType('status' as React.ElementType).props.roles).toBe('Cliente,Profissional');
    await act(async () => publish(null));
    expect(view.root.findByType('status' as React.ElementType).props.status).toBe('anonymous');
    expect(view.root.findByType('status' as React.ElementType).props.roles).toBeUndefined();
    expect(view.root.findByType('status' as React.ElementType).props.sessionNotice).toContain('Entre novamente');
    await act(async () => view.unmount());
  });

  it('não apresenta aviso de sessão terminada na saída voluntária', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const session = { status: 'authenticated', userId: 'test', roles: ['Cliente'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' } as OperationsSession;
    let publish!: (value: OperationsSession | null) => void;
    const store = { load: vi.fn().mockResolvedValue(session), clear: vi.fn(async () => publish(null)), save: vi.fn(), subscribe: (fn: typeof publish) => { publish = fn; return () => {}; } } as SessionStore;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<AuthProvider store={store} api={{} as IdentityApi}><Status /></AuthProvider>); });
    await act(async () => { await view.root.findByType('status' as React.ElementType).props.logout(); });
    expect(view.root.findByType('status' as React.ElementType).props.status).toBe('anonymous');
    expect(view.root.findByType('status' as React.ElementType).props.sessionNotice).toBeNull();
    await act(async () => view.unmount());
  });

  it('não restaura uma sessão antiga após receber uma atualização mais recente', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const oldSession = { status: 'authenticated', userId: 'old', roles: ['Cliente'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' } as OperationsSession;
    let finishLoad!: (value: OperationsSession | null) => void;
    let publish!: (value: OperationsSession | null) => void;
    const store = { load: vi.fn().mockReturnValue(new Promise((resolve) => { finishLoad = resolve; })), clear: vi.fn(), save: vi.fn(), subscribe: (fn: typeof publish) => { publish = fn; return () => {}; } } as SessionStore;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<AuthProvider store={store} api={{} as IdentityApi}><Status /></AuthProvider>); });
    await act(async () => publish(null));
    await act(async () => finishLoad(oldSession));
    expect(view.root.findByType('status' as React.ElementType).props.status).toBe('anonymous');
    expect(view.root.findByType('status' as React.ElementType).props.roles).toBeUndefined();
    await act(async () => view.unmount());
  });

  it('não limpa uma sessão nova quando a leitura anterior falha', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const newSession = { status: 'authenticated', userId: 'new', roles: ['Profissional'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' } as OperationsSession;
    let failLoad!: (reason: Error) => void;
    let publish!: (value: OperationsSession | null) => void;
    const store = { load: vi.fn().mockReturnValue(new Promise((_, reject) => { failLoad = reject; })), clear: vi.fn(), save: vi.fn(), subscribe: (fn: typeof publish) => { publish = fn; return () => {}; } } as SessionStore;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<AuthProvider store={store} api={{} as IdentityApi}><Status /></AuthProvider>); });
    await act(async () => publish(newSession));
    await act(async () => failLoad(new Error('falha de leitura')));
    expect(store.clear).not.toHaveBeenCalled();
    expect(view.root.findByType('status' as React.ElementType).props.roles).toBe('Profissional');
    await act(async () => view.unmount());
  });
});
