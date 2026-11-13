import { describe, expect, it, vi } from 'vitest';

import { creationAttemptFor } from './creationAttempt';

describe('tentativa de criação', () => {
  it('reutiliza a chave após resultado incerto apenas para os mesmos dados', () => {
    const createKey = vi.fn(() => 'key-1');
    const first = creationAttemptFor(null, 'dados originais', createKey);
    expect(first).toEqual({ fingerprint: 'dados originais', key: 'key-1' });
    expect(creationAttemptFor(first, 'dados originais', createKey)).toEqual(first);
    expect(creationAttemptFor(first, 'dados alterados', createKey)).toBeNull();
    expect(createKey).toHaveBeenCalledTimes(1);
  });
});
