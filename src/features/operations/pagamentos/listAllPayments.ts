import type { Pagamento, PagamentosApi } from '@/src/features/operations/contracts/pagamentos';

/** Evita apresentar uma primeira página como histórico completo. */
export async function listAllPayments(api: Pick<PagamentosApi, 'list'>): Promise<Pagamento[]> {
  const payments: Pagamento[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api.list({ page, pageSize: 100 });
    payments.push(...result.items);
    if (payments.length >= result.total) return payments;
    if (result.items.length === 0) throw new Error('A lista de pagamentos está incompleta.');
  }
  throw new Error('A lista de pagamentos ultrapassou o limite de páginas.');
}
