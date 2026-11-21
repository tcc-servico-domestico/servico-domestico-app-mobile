import { describe, expect, it, vi } from 'vitest';
import { loadClientDashboard } from './clientDashboard';

describe('painel do cliente', () => {
  it('busca todas as páginas e exclui serviços de imóveis de terceiros em conta com dois papéis', async () => {
    const imoveis = { list: vi.fn().mockResolvedValue({ items: [{ id: 'meu', status: 'Ativo' }], page: 1, total: 1, pageSize: 100 }) } as any;
    const servicos = { list: vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ page, pageSize: 1, total: 2, items: page === 1 ? [{ id: '1', imovelId: 'outro', status: 'Aceito', inicioPrevisto: '2026-12-01' }] : [{ id: '2', imovelId: 'meu', status: 'AguardandoPagamento', inicioPrevisto: '2026-12-02' }] })) } as any;
    const result = await loadClientDashboard(imoveis, servicos);
    expect(result.pending.map((item) => item.id)).toEqual(['2']);
    expect(result.upcoming).toEqual([]);
    expect(servicos.list).toHaveBeenCalledTimes(2);
  });
  it('informa erro em página incompleta em vez de apresentar vazio', async () => {
    const imoveis = { list: async () => ({ items: [], page: 1, total: 1, pageSize: 100 }) } as any;
    const servicos = { list: async () => ({ items: [], page: 1, total: 0, pageSize: 100 }) } as any;
    await expect(loadClientDashboard(imoveis, servicos)).rejects.toThrow('incompleta');
  });
  it('rejeita páginas repetidas em vez de duplicar atendimentos', async () => {
    const imoveis = { list: async () => ({ items: [{ id: 'meu', status: 'Ativo' }], page: 1, total: 1, pageSize: 100 }) } as any;
    const servicos = { list: async ({ page }: { page: number }) => ({ page, pageSize: 1, total: 2, items: [{ id: 'repetido', imovelId: 'meu', status: 'Aceito', inicioPrevisto: '2099-01-01' }] }) } as any;
    await expect(loadClientDashboard(imoveis, servicos)).rejects.toThrow('repetidos');
  });
  it('rejeita paginação ou contagem alterada durante a consulta', async () => {
    const imoveis = { list: async () => ({ items: [{ id: 'meu', status: 'Ativo' }], page: 1, total: 1, pageSize: 100 }) } as any;
    const servicos = { list: async ({ page }: { page: number }) => ({ page: 1, pageSize: 1, total: 2, items: [{ id: String(page), imovelId: 'meu', status: 'Aceito', inicioPrevisto: '2099-01-01' }] }) } as any;
    await expect(loadClientDashboard(imoveis, servicos)).rejects.toThrow('incompleta');
  });

});
