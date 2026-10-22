import { describe, expect, it } from 'vitest';

import { emptyImovelForm, toSaveImovelInput, validateImovel } from './validation';

const valid = {
  ...emptyImovelForm,
  descricao: 'Casa', metragemQuadrada: '120,5', latitude: '-15.79', longitude: '-47.88',
  logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Brasília', uf: 'df', cep: '70000-000',
};

describe('validação de imóvel', () => {
  it('converte endereço e coordenadas para o formato Core v1', () => {
    expect(toSaveImovelInput(valid)).toEqual(expect.objectContaining({
      descricao: 'Casa', metragemQuadrada: 120.5, latitude: -15.79, longitude: -47.88,
      endereco: expect.objectContaining({ numero: 10, uf: 'DF' }),
    }));
  });

  it('rejeita campos obrigatórios, coordenadas e números inválidos', () => {
    const errors = validateImovel({ ...valid, latitude: '91', numero: '-1', uf: 'D', cep: '70000' });
    expect(errors).toMatchObject({ latitude: expect.any(String), numero: expect.any(String), uf: expect.any(String), cep: expect.any(String) });
  });
});
