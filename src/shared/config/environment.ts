export interface AppEnvironment {
  readonly deployment: 'development' | 'homologacao' | 'production';
  readonly apiBaseUrl: string;
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

function publicApiUrl(
  source: Readonly<Record<string, string | undefined>>,
  name: 'EXPO_PUBLIC_API_BASE_URL' | 'EXPO_PUBLIC_PAYMENT_API_BASE_URL',
  deployment: AppEnvironment['deployment'],
): string {
  const url = requiredUrl(source[name], name, ['http:', 'https:']);
  if (deployment !== 'development' && (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    throw new Error(`${name} deve usar HTTPS público fora do desenvolvimento.`);
  }
  return url.toString().replace(/\/$/, '');
}

export function readEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AppEnvironment {
  const deployment = readDeployment(source.EXPO_PUBLIC_APP_ENV);
  return {
    deployment,
    apiBaseUrl: publicApiUrl(source, 'EXPO_PUBLIC_API_BASE_URL', deployment),
    paymentApiBaseUrl: publicApiUrl(source, 'EXPO_PUBLIC_PAYMENT_API_BASE_URL', deployment),
    mobileConfirmationBaseUrl: requiredUrl(
      source.EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL,
      'EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL',
      ['http:', 'https:', 'servicodomestico:'],
    ).toString().replace(/\/$/, ''),
  };
}
