export interface AppEnvironment {
  readonly apiBaseUrl: string;
  readonly mobileConfirmationBaseUrl: string;
}

function requiredUrl(value: string | undefined, name: string, allowedProtocols: readonly string[]): string {
  if (!value) {
    throw new Error(`${name} não foi configurada.`);
  }

  const url = new URL(value);
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`${name} usa um protocolo não permitido.`);
  }

  return value.replace(/\/$/, '');
}

export function readEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AppEnvironment {
  return {
    apiBaseUrl: requiredUrl(source.EXPO_PUBLIC_API_BASE_URL, 'EXPO_PUBLIC_API_BASE_URL', ['http:', 'https:']),
    mobileConfirmationBaseUrl: requiredUrl(
      source.EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL,
      'EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL',
      ['http:', 'https:', 'servicodomestico:'],
    ),
  };
}
