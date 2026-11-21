import type { Oferta, OfertasApi } from '@/src/features/operations/contracts/ofertas';

/** Consulta todas as páginas antes de apresentar a lista como completa. */
export async function listAllOffers(api: Pick<OfertasApi, 'list'>): Promise<Oferta[]> {
  const offers: Oferta[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api.list({ page, pageSize: 100 });
    offers.push(...result.items);
    if (offers.length >= result.total) return offers;
    if (!result.items.length) throw new Error('A lista de ofertas está incompleta.');
  }
  throw new Error('A lista de ofertas ultrapassou o limite de páginas.');
}
