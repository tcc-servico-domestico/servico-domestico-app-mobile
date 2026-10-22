import { describe, expect, it } from 'vitest';

import { emptyServicoForm, saoPauloToUtcIso, toCreateServicoInput, validateServico } from './validation';

const valid = {
  ...emptyServicoForm,
  imovelId: '11111111-1111-4111-8111-111111111111',
  dataInicio: '10/12/2099', horaInicio: '09:30', dataFim: '10/12/2099', horaFim: '12:00', valor: '123,45',
  checklists: [{ id: 'one', descricao: 'Limpar cozinha' }],
} as const;

describe('validação de serviço', () => {
  it('converte data de São Paulo e checklist para o contrato Core v1', () => {
    expect(saoPauloToUtcIso('10/12/2099', '09:30')).toBe('2099-12-10T12:30:00.000Z');
    expect(toCreateServicoInput(valid)).toEqual(expect.objectContaining({
      inicioPrevisto: '2099-12-10T12:30:00.000Z', fimPrevisto: '2099-12-10T15:00:00.000Z', valor: 123.45,
      checklists: [{ descricao: 'Limpar cozinha', ordem: 1 }],
    }));
  });

  it('rejeita imóvel, agenda, valor e checklists inválidos', () => {
    const errors = validateServico({
      ...valid, imovelId: '', dataInicio: '31/02/2099', horaInicio: '26:00', dataFim: '10/12/2099', horaFim: '08:00',
      valor: '1,234', checklists: [{ id: 'one', descricao: '' }],
    });
    expect(errors).toMatchObject({ imovelId: expect.any(String), dataInicio: expect.any(String), horaInicio: expect.any(String), valor: expect.any(String), checklistItems: { one: expect.any(String) } });
  });

  it('rejeita início no passado e fim anterior ao início', () => {
    const past = validateServico({ ...valid, dataInicio: '01/01/2020', dataFim: '01/01/2020' });
    const inverted = validateServico({ ...valid, horaFim: '08:00' });
    expect(past.dataInicio).toBeTruthy();
    expect(inverted.dataFim).toBeTruthy();
  });
});
