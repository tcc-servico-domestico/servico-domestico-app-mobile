import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OperationsSession } from '@/src/shared/contracts/session';
import { secureSessionStore } from '@/src/shared/session/secureSessionStore';

const nativeStore = vi.hoisted(() => ({
  value: null as string | null,
  getItemAsync: vi.fn(async () => nativeStore.value),
  setItemAsync: vi.fn(async (_key: string, value: string) => { nativeStore.value = value; }),
  deleteItemAsync: vi.fn(async () => { nativeStore.value = null; }),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: nativeStore.getItemAsync,
  setItemAsync: nativeStore.setItemAsync,
  deleteItemAsync: nativeStore.deleteItemAsync,
}));

const session: OperationsSession = {
  status: 'authenticated',
  userId: 'user-1',
  roles: ['Cliente'],
  accessToken: 'token',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

describe('secureSessionStore', () => {
  beforeEach(async () => {
    nativeStore.value = null;
    vi.clearAllMocks();
    await secureSessionStore.clear();
    vi.clearAllMocks();
  });

  it('removes an expired persisted session while restoring the app', async () => {
    nativeStore.value = JSON.stringify({ ...session, expiresAt: '2020-01-01T00:00:00.000Z' });

    await expect(secureSessionStore.load()).resolves.toBeNull();
    expect(nativeStore.deleteItemAsync).toHaveBeenCalledOnce();
  });

  it('keeps a non-persistent session only in memory and publishes changes', async () => {
    const listener = vi.fn();
    const unsubscribe = secureSessionStore.subscribe!(listener);

    await secureSessionStore.save(session, false);

    await expect(secureSessionStore.load()).resolves.toEqual(session);
    expect(nativeStore.setItemAsync).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(session);
    unsubscribe();
  });
});
