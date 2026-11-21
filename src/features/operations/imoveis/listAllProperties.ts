import type { Imovel, ImoveisApi } from '@/src/features/operations/contracts/imoveis';

/** Evita omitir imóveis disponíveis nas páginas seguintes da seleção. */
export async function listAllProperties(api: Pick<ImoveisApi, 'list'>): Promise<Imovel[]> {
  const items: Imovel[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 100; page++) {
    const result = await api.list({ page, pageSize: 100 });
    if (result.page !== page || !Number.isSafeInteger(result.total) || result.total < 0 ||
      (expectedTotal !== undefined && expectedTotal !== result.total)) throw new Error('A lista de imóveis está incompleta ou mudou durante a consulta.');
    expectedTotal = result.total;
    for (const item of result.items) {
      if (!item.id || seen.has(item.id)) throw new Error('A lista de imóveis está incompleta ou contém itens repetidos.');
      seen.add(item.id);
      items.push(item);
    }
    if (items.length > result.total) throw new Error('A lista de imóveis está incompleta ou inconsistente.');
    if (items.length === result.total) return items;
    if (!result.items.length) throw new Error('A lista de imóveis está incompleta.');
  }
  throw new Error('A lista de imóveis ultrapassou o limite de páginas.');
}
