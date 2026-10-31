export interface AppEnvironment {
  readonly deployment: 'development' | 'homologacao' | 'production';
  readonly demoMode: boolean;
  readonly apiBaseUrl: string;
  readonly authApiBaseUrl: string;
  readonly paymentApiBaseUrl: string;
  readonly mobileConfirmationBaseUrl: string;
}

function requiredUrl(value: string | undefined, name: string, allowedProtocols: readonly string[]): URL {
  if (!value) {
    throw new Error(`${name} não foi configurada.`);
  }

  const url = new URL(value);
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`${name} usa um protocolo não permitido.`);
  }

  return url;
}

function readDeployment(value: string | undefined): AppEnvironment['deployment'] {
  if (!value || value === 'development') return 'development';
  if (value === 'homologacao' || value === 'production') return value;
  throw new Error('EXPO_PUBLIC_APP_ENV deve ser development, homologacao ou production.');
}

function readDemoMode(value: string | undefined, deployment: AppEnvironment['deployment']): boolean {
  if (!value || value === 'false') return false;
  if (value !== 'true') throw new Error('EXPO_PUBLIC_DEMO_MODE deve ser true ou false.');
  if (deployment !== 'development') throw new Error('EXPO_PUBLIC_DEMO_MODE só pode ser usado em desenvolvimento.');
  return true;
}

function publicApiUrl(
  source: Readonly<Record<string, string | undefined>>,
  name: 'EXPO_PUBLIC_API_BASE_URL' | 'EXPO_PUBLIC_AUTH_API_BASE_URL' | 'EXPO_PUBLIC_PAYMENT_API_BASE_URL',
  deployment: AppEnvironment['deployment'],
): string {
  const url = requiredUrl(source[name], name, ['http:', 'https:']);
  const unusableHost = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    /^127\./.test(url.hostname) || url.hostname === '[::1]' || url.hostname === '0.0.0.0' ||
    url.hostname.endsWith('.invalid');
  if (deployment !== 'development' && (url.protocol !== 'https:' || unusableHost)) {
    throw new Error(`${name} deve usar HTTPS público fora do desenvolvimento.`);
  }
  return url.toString().replace(/\/$/, '');
}

export function readEnvironment(
  // Expo replaces only statically accessed EXPO_PUBLIC_* properties in bundles.
  source: Readonly<Record<string, string | undefined>> = {
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_AUTH_API_BASE_URL: process.env.EXPO_PUBLIC_AUTH_API_BASE_URL,
    EXPO_PUBLIC_PAYMENT_API_BASE_URL: process.env.EXPO_PUBLIC_PAYMENT_API_BASE_URL,
    EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: process.env.EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL,
    EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
  },
): AppEnvironment {
  const deployment = readDeployment(source.EXPO_PUBLIC_APP_ENV);
  return {
    deployment,
    demoMode: readDemoMode(source.EXPO_PUBLIC_DEMO_MODE, deployment),
    apiBaseUrl: publicApiUrl(source, 'EXPO_PUBLIC_API_BASE_URL', deployment),
    authApiBaseUrl: publicApiUrl(source, 'EXPO_PUBLIC_AUTH_API_BASE_URL', deployment),
    paymentApiBaseUrl: publicApiUrl(source, 'EXPO_PUBLIC_PAYMENT_API_BASE_URL', deployment),
    mobileConfirmationBaseUrl: requiredUrl(
      source.EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL,
      'EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL',
      ['http:', 'https:', 'servicodomestico:'],
    ).toString().replace(/\/$/, ''),
  };
}
