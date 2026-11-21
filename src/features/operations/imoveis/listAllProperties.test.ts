import { describe, expect, it, vi } from 'vitest';
import { listAllProperties } from './listAllProperties';

describe('seleção de imóveis paginada', () => {
  it('consulta todas as páginas antes de permitir a seleção', async () => {
    const list = vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ id: String(page) }], total: 2, page, pageSize: 1 }));
    expect((await listAllProperties({ list })).map((item) => item.id)).toEqual(['1', '2']);
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('não apresenta seleção incompleta como lista completa', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 1, page: 1, pageSize: 100 });
    await expect(listAllProperties({ list })).rejects.toThrow('incompleta');
  });
  it('rejeita imóveis repetidos entre páginas', async () => {
    const list = vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ id: 'repetido' }], total: 2, page, pageSize: 1 }));
    await expect(listAllProperties({ list })).rejects.toThrow('repetidos');
  });
  it('rejeita mudança de total durante a consulta', async () => {
    const list = vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ id: String(page) }], total: page === 1 ? 2 : 3, page, pageSize: 1 }));
    await expect(listAllProperties({ list })).rejects.toThrow('mudou');
  });

});
