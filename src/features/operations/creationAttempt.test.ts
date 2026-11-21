import { describe, expect, it, vi } from 'vitest';

import { creationAttemptFor, inputDaTentativa } from './creationAttempt';

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

it('mantém os dados enviados para recuperar uma tentativa mesmo após o horário passar', () => {
  const input = { imovelId: 'imovel', inicioPrevisto: '2026-01-01T12:00:00Z', fimPrevisto: '2026-01-01T13:00:00Z', raioBuscaKm: 10, valor: 120, checklists: [{ descricao: 'Limpar', ordem: 1 }] };
  const attempt = creationAttemptFor(null, JSON.stringify(input), () => 'key-1')!;
  expect(inputDaTentativa(attempt)).toEqual(input);
});
