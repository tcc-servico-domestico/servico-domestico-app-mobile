import { createIdentityApi } from '@/src/features/identity/identityApi';
import { readEnvironment } from '@/src/shared/config/environment';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';
import { secureSessionStore } from '@/src/shared/session/secureSessionStore';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';

const environment = readEnvironment();

export const sessionStore = secureSessionStore;

export const httpClient = createFetchHttpClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: async () => {
    const session = await sessionStore.load();
    if (session) await paymentTrackingStore.clear(session.userId);
    await sessionStore.clear();
  },
});

export const paymentHttpClient = createFetchHttpClient({
  baseUrl: environment.paymentApiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: async () => {
    const session = await sessionStore.load();
    if (session) await paymentTrackingStore.clear(session.userId);
    await sessionStore.clear();
  },
});

export const identityApi = createIdentityApi(httpClient);
export { environment };
