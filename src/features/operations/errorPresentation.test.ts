import { describe, expect, it } from 'vitest';
import { HttpProblemError } from '@/src/shared/contracts/http';
import { operationErrorMessage } from './errorPresentation';

describe('mensagens de falha operacional', () => {
  it('orienta sobre conexão sem exibir detalhes técnicos do transporte', () => {
    const error = new HttpProblemError({ status: 0, title: 'Serviço indisponível', detail: 'Network request failed' });
    expect(operationErrorMessage(error, 'Falha')).toBe('Não foi possível conectar. Verifique sua conexão.');
  });

  it('preserva a orientação de uma resposta conhecida e usa alternativa para erro desconhecido', () => {
    expect(operationErrorMessage(new HttpProblemError({ status: 409, title: 'Conflito', detail: 'Atualize os dados.' }), 'Falha')).toBe('Atualize os dados.');
    expect(operationErrorMessage(null, 'Falha')).toBe('Falha');
  });
});
