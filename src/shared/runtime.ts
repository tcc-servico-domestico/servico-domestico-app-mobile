import { createIdentityApi } from '@/src/features/identity/identityApi';
import { readEnvironment } from '@/src/shared/config/environment';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';
import { secureSessionStore } from '@/src/shared/session/secureSessionStore';
import { paymentTrackingStore } from '@/src/features/operations/pagamentos/paymentTrackingStore';
import { createImoveisApi } from '@/src/features/operations/imoveis/api';
import { createOfertasApi } from '@/src/features/operations/ofertas/api';
import { createPagamentosApi } from '@/src/features/operations/pagamentos/api';
import { createServicosApi } from '@/src/features/operations/servicos/api';
import { createOfflineDemoHttpGuard, createOfflineDemoRuntime } from '@/src/features/demo/offlineDemo';

const environment = readEnvironment();
const offlineDemo = environment.demoMode ? createOfflineDemoRuntime() : null;
const demoHttpGuard = offlineDemo ? createOfflineDemoHttpGuard() : null;

export const sessionStore = offlineDemo?.sessionStore ?? secureSessionStore;

export const httpClient = demoHttpGuard ?? createFetchHttpClient({
  baseUrl: environment.apiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: async () => {
    const session = await sessionStore.load();
    if (session) await paymentTrackingStore.clear(session.userId);
    await sessionStore.clear();
  },
});

const identityHttpClient = demoHttpGuard ?? createFetchHttpClient({
  baseUrl: environment.authApiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: async () => {
    const session = await sessionStore.load();
    if (session) await paymentTrackingStore.clear(session.userId);
    await sessionStore.clear();
  },
});

export const paymentHttpClient = demoHttpGuard ?? createFetchHttpClient({
  baseUrl: environment.paymentApiBaseUrl,
  getAccessToken: async () => (await sessionStore.load())?.accessToken ?? null,
  onUnauthorized: async () => {
    const session = await sessionStore.load();
    if (session) await paymentTrackingStore.clear(session.userId);
    await sessionStore.clear();
  },
});

export const identityApi = offlineDemo?.identityApi ?? createIdentityApi(identityHttpClient);
export const imoveisApi = offlineDemo?.imoveisApi ?? createImoveisApi(httpClient);
export const servicosApi = offlineDemo?.servicosApi ?? createServicosApi(httpClient);
export const ofertasApi = offlineDemo?.ofertasApi ?? createOfertasApi(httpClient);
export const pagamentosApi = offlineDemo?.pagamentosApi ?? createPagamentosApi(paymentHttpClient);
export { environment };
