import { describe, expect, it } from 'vitest';

import { readEnvironment } from '@/src/shared/config/environment';

describe('readEnvironment', () => {
  it('accepts independent Auth, Core, Pagamento and confirmation URLs', () => {
    expect(readEnvironment({
      EXPO_PUBLIC_APP_ENV: 'homologacao',
      EXPO_PUBLIC_AUTH_API_BASE_URL: 'https://auth.example.test/',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/',
      EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test/',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toEqual({
      deployment: 'homologacao',
      authApiBaseUrl: 'https://auth.example.test',
      apiBaseUrl: 'https://api.example.test',
      paymentApiBaseUrl: 'https://payment.example.test',
      mobileConfirmationBaseUrl: 'servicodomestico://confirmar-email',
    });
  });

  it('rejects missing or unsafe API configuration', () => {
    expect(() => readEnvironment({
      EXPO_PUBLIC_AUTH_API_BASE_URL: 'https://auth.example.test',
      EXPO_PUBLIC_API_BASE_URL: 'file:///tmp/api',
      EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toThrow('protocolo não permitido');
  });

  it('rejects HTTP and localhost for homologacao', () => {
    expect(() => readEnvironment({
      EXPO_PUBLIC_APP_ENV: 'homologacao',
      EXPO_PUBLIC_AUTH_API_BASE_URL: 'https://auth.example.test',
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:5000',
      EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test',
      EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
    })).toThrow('HTTPS público');
  });

  it.each(['EXPO_PUBLIC_AUTH_API_BASE_URL', 'EXPO_PUBLIC_PAYMENT_API_BASE_URL'])(
    'requires an independent secure endpoint for %s', (name) => {
      const source = {
        EXPO_PUBLIC_APP_ENV: 'homologacao',
        EXPO_PUBLIC_API_BASE_URL: 'https://core.example.test',
        EXPO_PUBLIC_AUTH_API_BASE_URL: 'https://auth.example.test',
        EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test',
        EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
      };
      expect(() => readEnvironment({ ...source, [name]: undefined })).toThrow(`${name} não foi configurada`);
      expect(() => readEnvironment({ ...source, [name]: 'http://localhost:8080' })).toThrow('HTTPS público');
    },
  );

  it.each(['https://[::1]', 'https://127.0.0.2', 'https://payment.hml.example.invalid'])(
    'rejects unusable homologacao hosts: %s', (apiUrl) => {
      expect(() => readEnvironment({
        EXPO_PUBLIC_APP_ENV: 'homologacao',
        EXPO_PUBLIC_API_BASE_URL: apiUrl,
        EXPO_PUBLIC_AUTH_API_BASE_URL: 'https://auth.example.test',
        EXPO_PUBLIC_PAYMENT_API_BASE_URL: 'https://payment.example.test',
        EXPO_PUBLIC_MOBILE_CONFIRMATION_BASE_URL: 'servicodomestico://confirmar-email',
      })).toThrow('HTTPS público');
    },
  );
});
