import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { IdentityApi, LoginInput, RegisterInput } from '@/src/features/identity/contracts';
import { identityApi as defaultIdentityApi, sessionStore as defaultSessionStore } from '@/src/shared/runtime';
import type { OperationsSession, SessionStore } from '@/src/shared/contracts/session';

type AuthContextType = {
  readonly status: 'loading' | 'anonymous' | 'authenticated';
  readonly session: OperationsSession | null;
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

  useEffect(() => {
    let active = true;
    const unsubscribe = store.subscribe?.((updated) => {
      if (!active) return;
      setSession(updated);
      setStatus(updated ? 'authenticated' : 'anonymous');
    });
    store.load().then((restored) => {
      if (!active) return;
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'anonymous');
    }).catch(async () => {
      await store.clear();
      if (active) setStatus('anonymous');
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [store]);

  const login = useCallback(async (input: LoginInput, persistent: boolean) => {
    const authenticated = await api.login(input);
    await store.save(authenticated, persistent);
    setSession(authenticated);
    setStatus('authenticated');
  }, [api, store]);

  const logout = useCallback(async () => {
    await store.clear();
    setSession(null);
    setStatus('anonymous');
  }, [store]);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    login,
    register: api.register,
    confirmEmail: api.confirmEmail,
    logout,
  }), [api, login, logout, session, status]);

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
