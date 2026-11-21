import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { IdentityApi, LoginInput, RegisterInput } from '@/src/features/identity/contracts';
import { identityApi as defaultIdentityApi, sessionStore as defaultSessionStore } from '@/src/shared/runtime';
import type { OperationsSession, SessionStore } from '@/src/shared/contracts/session';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';

type AuthContextType = {
  readonly status: 'loading' | 'anonymous' | 'authenticated';
  readonly session: OperationsSession | null;
  readonly sessionNotice: string | null;
  login(input: LoginInput, persistent: boolean): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  confirmEmail(token: string): Promise<void>;
  logout(): Promise<void>;
};

interface AuthProviderProps {
  readonly children: ReactNode;
  readonly api?: IdentityApi;
  readonly store?: SessionStore;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, api = defaultIdentityApi, store = defaultSessionStore }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  const [session, setSession] = useState<OperationsSession | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const previousSession = useRef<OperationsSession | null>(null);
  const signingOut = useRef(false);

  useEffect(() => {
    let active = true;
    let observedUpdate = false;
    const unsubscribe = store.subscribe?.((updated) => {
      if (!active) return;
      observedUpdate = true;
      if (!updated && previousSession.current && !signingOut.current) setSessionNotice('Sua sessão terminou. Entre novamente para continuar.');
      if (updated) setSessionNotice(null);
      previousSession.current = updated;
      setSession(updated);
      setStatus(updated ? 'authenticated' : 'anonymous');
    });
    store.load().then((restored) => {
      if (!active || observedUpdate) return;
      previousSession.current = restored;
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'anonymous');
    }).catch(async () => {
      if (!active || observedUpdate) return;
      await store.clear();
      if (active && !observedUpdate) { setSession(null); setStatus('anonymous'); }
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [store]);

  const login = useCallback(async (input: LoginInput, persistent: boolean) => {
    const authenticated = await api.login(input);
    await store.save(authenticated, persistent);
    previousSession.current = authenticated;
    setSessionNotice(null);
    setSession(authenticated);
    setStatus('authenticated');
  }, [api, store]);

  const logout = useCallback(async () => {
    if (session) await paymentTrackingStore.clear(session.userId);
    signingOut.current = true;
    try {
      await store.clear();
      previousSession.current = null;
      setSessionNotice(null);
      setSession(null);
      setStatus('anonymous');
    } finally {
      signingOut.current = false;
    }
  }, [session, store]);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    sessionNotice,
    login,
    register: api.register,
    confirmEmail: api.confirmEmail,
    logout,
  }), [api, login, logout, session, sessionNotice, status]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
