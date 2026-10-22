import { createIdentityApi } from '@/src/features/identity/identityApi';
import { readEnvironment } from '@/src/shared/config/environment';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';
import { secureSessionStore } from '@/src/shared/session/secureSessionStore';

const environment = readEnvironment();

export const sessionStore = secureSessionStore;

export const httpClient = createFetchHttpClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: () => sessionStore.clear(),
});

export const identityApi = createIdentityApi(httpClient);
export { environment };
