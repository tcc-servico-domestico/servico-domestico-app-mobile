import { describe, expect, it } from 'vitest';

import { createIdempotencyKey } from './idempotency';

describe('chave de idempotência', () => {
  it('gera UUID v4 não vazio para uma criação', () => {
    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
