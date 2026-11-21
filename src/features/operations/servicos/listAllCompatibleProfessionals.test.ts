import { describe, expect, it, vi } from 'vitest';
import { listAllCompatibleProfessionals } from './listAllCompatibleProfessionals';

describe('paginação de profissionais compatíveis', () => {
  it('preserva a ordenação de todas as páginas', async () => {
    const listCompatibleProfessionals = vi.fn().mockImplementation((_id: string, { page }: { page: number }) => Promise.resolve({ items: [{ profissionalId: String(page) }], total: 2, page, pageSize: 1 }));
    const result = await listAllCompatibleProfessionals({ listCompatibleProfessionals }, 'servico');
    expect(result.map((item) => item.profissionalId)).toEqual(['1', '2']);
    expect(listCompatibleProfessionals).toHaveBeenCalledTimes(2);
  });
  it('sinaliza quando a consulta não entrega todos os resultados', async () => {
    const listCompatibleProfessionals = vi.fn().mockResolvedValue({ items: [], total: 1, page: 1, pageSize: 20 });
    await expect(listAllCompatibleProfessionals({ listCompatibleProfessionals }, 'servico')).rejects.toThrow('incompleta');
  });
});
