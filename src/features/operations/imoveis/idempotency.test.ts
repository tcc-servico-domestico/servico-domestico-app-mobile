import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' }));

import { createIdempotencyKey } from './idempotency';

describe('chave de idempotência', () => {
  it('gera UUID v4 não vazio para uma criação', () => {
    expect(createIdempotencyKey()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
