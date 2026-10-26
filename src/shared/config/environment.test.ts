import { describe, expect, it } from 'vitest';

import { readEnvironment } from '@/src/shared/config/environment';

describe('readEnvironment', () => {
  it('accepts independent API and confirmation URLs', () => {
    expect(readEnvironment({
      EXPO_PUBLIC_APP_ENV: 'homologacao',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/',
      EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test/',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toEqual({
      deployment: 'homologacao',
      apiBaseUrl: 'https://api.example.test',
      paymentApiBaseUrl: 'https://payment.example.test',
      mobileConfirmationBaseUrl: 'servicodomestico://confirmar-email',
    });
  });

  it('rejects missing or unsafe API configuration', () => {
    expect(() => readEnvironment({
      EXPO_PUBLIC_API_BASE_URL: 'file:///tmp/api',
      EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toThrow('protocolo não permitido');
  });

  it('rejects HTTP and localhost for homologacao', () => {
    expect(() => readEnvironment({
      EXPO_PUBLIC_APP_ENV: 'homologacao',
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:5000',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toThrow('HTTPS público');
  });
});
