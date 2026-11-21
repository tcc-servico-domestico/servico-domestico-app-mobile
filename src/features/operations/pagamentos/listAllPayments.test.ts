import { describe, expect, it, vi } from 'vitest';
import { listAllPayments } from './listAllPayments';

describe('paginação de pagamentos', () => {
  it('consulta todas as páginas', async () => {
    const list = vi.fn().mockImplementation(({ page }: { page: number }) => Promise.resolve({ items: [{ id: String(page) }], total: 2, page, pageSize: 1 }));
    const result = await listAllPayments({ list });
    expect(result.map((item) => item.id)).toEqual(['1', '2']);
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('rejeita uma lista incompleta', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 1, page: 1, pageSize: 100 });
    await expect(listAllPayments({ list })).rejects.toThrow('incompleta');
  });
});
