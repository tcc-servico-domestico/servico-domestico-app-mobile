import { describe, expect, it, vi } from 'vitest';
import { listAllOffers } from './listAllOffers';

describe('paginação de ofertas', () => {
  it('consulta todas as páginas antes de retornar a lista', async () => {
    const list = vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ servicoId: String(page) }], total: 2, page, pageSize: 1 }));
    const result = await listAllOffers({ list } as any);
    expect(result.map((item) => item.servicoId)).toEqual(['1', '2']);
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('não apresenta lista parcial como completa', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 1, page: 1, pageSize: 100 });
    await expect(listAllOffers({ list })).rejects.toThrow('incompleta');
  });
});
