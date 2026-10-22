import * as SecureStore from 'expo-secure-store';

import type { OperationsSession, SessionStore } from '@/src/shared/contracts/session';

const SESSION_KEY = 'servico-domestico.session.v1';
const supportsSecureStore = typeof window === 'undefined';

let volatileSession: OperationsSession | null = null;
const listeners = new Set<(session: OperationsSession | null) => void>();

function publish(session: OperationsSession | null) {
  listeners.forEach((listener) => listener(session));
}

export function isSessionExpired(session: OperationsSession, now = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() <= now;
}

export const secureSessionStore: SessionStore = {
  async load() {
    const persisted = supportsSecureStore ? await SecureStore.getItemAsync(SESSION_KEY) : null;
    const serialized = persisted ??
      (volatileSession ? JSON.stringify(volatileSession) : null);
    if (!serialized) return null;

    const session = JSON.parse(serialized) as OperationsSession;
    if (isSessionExpired(session)) {
      await this.clear();
      return null;
    }
    return session;
  },
  async save(session, persistent) {
    volatileSession = session;
    if (supportsSecureStore && persistent) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    else if (supportsSecureStore) await SecureStore.deleteItemAsync(SESSION_KEY);
    publish(session);
  },
  async clear() {
    volatileSession = null;
    if (supportsSecureStore) await SecureStore.deleteItemAsync(SESSION_KEY);
    publish(null);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
