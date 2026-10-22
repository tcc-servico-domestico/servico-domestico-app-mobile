import { describe, expect, it } from 'vitest';

import { readEnvironment } from '@/src/shared/config/environment';

describe('readEnvironment', () => {
  it('accepts independent API and confirmation URLs', () => {
    expect(readEnvironment({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toEqual({
      apiBaseUrl: 'https://api.example.test',
      mobileConfirmationBaseUrl: 'servicodomestico://confirmar-email',
    });
  });

  it('rejects missing or unsafe API configuration', () => {
    expect(() => readEnvironment({
      EXPO_PUBLIC_API_BASE_URL: 'file:///tmp/api',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toThrow('protocolo não permitido');
  });
});
