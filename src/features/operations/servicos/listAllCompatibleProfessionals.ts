import type { ProfissionalCompativel, ServicosApi } from '@/src/features/operations/contracts/servicos';

/** Evita oferecer uma seleção que silenciosamente omita profissionais compatíveis. */
export async function listAllCompatibleProfessionals(api: Pick<ServicosApi, 'listCompatibleProfessionals'>, servicoId: string): Promise<ProfissionalCompativel[]> {
  const items: ProfissionalCompativel[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api.listCompatibleProfessionals(servicoId, { page, pageSize: 20 });
    items.push(...result.items);
    if (items.length >= result.total) return items;
    if (result.items.length === 0) throw new Error('A lista de profissionais está incompleta.');
  }
  throw new Error('A lista de profissionais ultrapassou o limite de páginas.');
}
