import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIdempotencyKey } from './idempotency.native';

const secureRandomUUID = vi.hoisted(() => vi.fn());
vi.mock('expo-crypto', () => ({ randomUUID: secureRandomUUID }));

afterEach(() => {
  vi.unstubAllGlobals();
  secureRandomUUID.mockReset();
});

describe('idempotência no runtime nativo', () => {
  it('gera chaves independentes mesmo sem Web Crypto global no Android', () => {
    vi.stubGlobal('crypto', undefined);
    secureRandomUUID
      .mockReturnValueOnce('84cb72cf-86b2-4f97-a72e-4a882f6a5265')
      .mockReturnValueOnce('50286821-6c4f-4575-b18d-6708243a6d71');

    const first = createIdempotencyKey();
    const second = createIdempotencyKey();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
    expect(secureRandomUUID).toHaveBeenCalledTimes(2);
  });

  it('interrompe a operação se a fonte segura nativa falhar', () => {
    vi.stubGlobal('crypto', undefined);
    secureRandomUUID.mockImplementation(() => { throw new Error('native entropy unavailable'); });

    expect(() => createIdempotencyKey()).toThrow('native entropy unavailable');
  });
});
