import { describe, expect, it, vi } from 'vitest';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import { createPagamentosV2Api } from './api.v2';
import { canCopyPix, paymentStatusLabel, transactionLabel } from './paymentPresentation';

const pagamento = {
  id: '11111111-1111-4111-8111-111111111111', servicoId: '22222222-2222-4222-8222-222222222222',
  valor: 120, moeda: 'BRL', status: 'Confirmado', recebimentoStatus: 'Desconhecido',
  disponibilidadeStatus: 'Desconhecida', garantiaStatus: 'NaoConstituida', origem: 'AsaasSandbox',
  requestedAt: '2026-11-13T12:00:00Z', aggregateVersion: 2,
  transacoes: [{ id: '33333333-3333-4333-8333-333333333333', operacao: 'ConfirmacaoPagamento', status: 'Confirmado', observadoEm: '2026-11-13T13:00:00Z' }],
};
function client() {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as OperationsHttpClient;
}

describe('pagamentos v2 candidatos', () => {
  it('mantém fatos separados e não inventa custódia ou horário de pagamento', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue(pagamento);
    const resultado = await createPagamentosV2Api(http).get(pagamento.id);
    expect(resultado.origem).toBe('AsaasSandbox');
    expect(resultado.garantiaStatus).toBe('NaoConstituida');
    expect(resultado.custodiaStatus).toBe('Desconhecida');
    expect(resultado.paidAt).toBeUndefined();
    expect(paymentStatusLabel(resultado)).toBe('Pagamento confirmado; recebimento não informado');
    expect(transactionLabel(resultado.transacoes[0])).toBe('Confirmação do pagamento: confirmado');
    expect(resultado.transacoes[0].observadoEm).toBe('2026-11-13T13:00:00Z');
    expect(resultado.transacoes[0].occurredAt).toBeUndefined();
    expect(http.get).toHaveBeenCalledWith(`/api/v2/pagamentos/${pagamento.id}`);
  });

  it('apresenta conciliação sem liberar cópia e rejeita estados ou valores inválidos', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ ...pagamento, status: 'EmConciliacao', transacoes: [] });
    const resultado = await createPagamentosV2Api(http).get(pagamento.id);
    expect(paymentStatusLabel(resultado)).toBe('Pagamento em conciliação');
    expect(canCopyPix(resultado, 'codigo-teste', '2099-01-01T00:00:00Z')).toBe(false);
    for (const invalido of [{ ...pagamento, valor: -1 }, { ...pagamento, status: 'Surpresa' }, { ...pagamento, requestedAt: 'sem-fuso' }, { ...pagamento, requestedAt: '2026-02-30T12:00:00Z' }]) {
      vi.mocked(http.get).mockResolvedValue(invalido);
      await expect(createPagamentosV2Api(http).get(pagamento.id)).rejects.toThrow('Resposta de pagamento inválida.');
    }
  });

  it('não aceita resposta de outro pagamento nem campos fora do contrato fechado', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ ...pagamento, id: '44444444-4444-4444-8444-444444444444' });
    await expect(createPagamentosV2Api(http).get(pagamento.id)).rejects.toThrow('Resposta de pagamento inválida.');
    vi.mocked(http.get).mockResolvedValue({ ...pagamento, gatewayIdExterno: 'pay_1' });
    await expect(createPagamentosV2Api(http).get(pagamento.id)).rejects.toThrow('Resposta de pagamento inválida.');
    await expect(createPagamentosV2Api(http).get('../outro')).rejects.toThrow('Resposta de pagamento inválida.');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('lista somente pela rota v2 e preserva paginação', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ items: [pagamento], page: 1, pageSize: 20, total: 1 });
    const pagina = await createPagamentosV2Api(http).list({ page: 1, pageSize: 20 });
    expect(pagina.items).toHaveLength(1);
    expect(pagina.total).toBe(1);
    expect(http.get).toHaveBeenCalledWith('/api/v2/pagamentos', { query: { page: 1, pageSize: 20 } });
  });

  it('recupera o código pendente e só o utiliza para o pagamento solicitado', async () => {
    const http = client();
    const api = createPagamentosV2Api(http);
    const pix = { pagamentoId: pagamento.id, pixCopiaECola: 'codigo-teste', expiraEm: '2099-01-01T00:00:00Z', status: 'Pendente' };
    vi.mocked(http.get).mockResolvedValueOnce(pix).mockResolvedValueOnce({ ...pix, status: 'Confirmado' })
      .mockResolvedValueOnce({ ...pix, pagamentoId: pagamento.servicoId });
    await expect(api.getPix!(pagamento.id)).resolves.toMatchObject({ pixCopiaECola: 'codigo-teste' });
    await expect(api.getPix!(pagamento.id)).resolves.toMatchObject({ pixCopiaECola: null });
    await expect(api.getPix!(pagamento.id)).rejects.toThrow('Resposta de pagamento inválida.');
  });
});
