import { describe, expect, it } from 'vitest';

import { actionableChecklist, canCancel, canChooseProfessional, canComplete, canRespondToOffer, canStart, nextChecklistStatus } from './policy';
import type { Oferta } from '@/src/features/operations/contracts/ofertas';
import type { Servico } from '@/src/features/operations/contracts/servicos';

const servico: Servico = {
  id: 'service', imovelId: 'house', profissionalId: null, raioBuscaKm: 10, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', ofertaExpiraEmUtc: null, versaoOferta: null, valor: 100, moeda: 'BRL', status: 'EmExecucao', aggregateVersion: 2,
  checklists: [{ id: 'later', descricao: 'Depois', ordem: 2, status: 'Pendente' }, { id: 'first', descricao: 'Primeiro', ordem: 1, status: 'EmAndamento' }],
};
const offer: Oferta = { servicoId: 'service', versaoOferta: 1, aggregateVersion: 2, inicioPrevisto: servico.inicioPrevisto, fimPrevisto: servico.fimPrevisto, valor: 100, pagamentoConfirmado: true, expiraEmUtc: '2099-01-01T10:00:00Z', status: 'Pendente', checklists: [] };

describe('política de ações do serviço', () => {
  it('separa as ações de Cliente e Profissional por estado', () => {
    expect(canCancel(['Cliente'], 'Aceito')).toBe(true);
    expect(canCancel(['Profissional'], 'Aceito')).toBe(false);
    expect(canChooseProfessional(['Cliente'], 'AguardandoSelecao')).toBe(true);
    expect(canChooseProfessional(['Cliente'], 'AguardandoAceite')).toBe(false);
    expect(canStart(['Profissional'], 'Aceito')).toBe(true);
    expect(canStart(['Cliente'], 'Aceito')).toBe(false);
    expect(canRespondToOffer(['Profissional'], offer)).toBe(true);
    expect(canRespondToOffer(['Cliente'], offer)).toBe(false);
  });

  it('libera apenas a primeira checklist pendente e conclusão após todas concluídas', () => {
    expect(actionableChecklist(servico)?.id).toBe('first');
    expect(nextChecklistStatus(actionableChecklist(servico)!)).toBe('Concluida');
    expect(canComplete(['Profissional'], servico)).toBe(false);
    const complete = { ...servico, checklists: servico.checklists.map((item) => ({ ...item, status: 'Concluida' as const })) };
    expect(canComplete(['Profissional'], complete)).toBe(true);
  });
});
