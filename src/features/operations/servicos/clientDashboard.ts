import type { Imovel, ImoveisApi, Page } from '@/src/features/operations/contracts/imoveis';
import type { Servico, ServicosApi } from '@/src/features/operations/contracts/servicos';

async function allPages<T extends { readonly id: string }>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 100; page++) {
    const response = await fetchPage(page);
    if (response.page !== page || !Number.isSafeInteger(response.total) || response.total < 0 ||
      (expectedTotal !== undefined && expectedTotal !== response.total)) {
      throw new Error('A listagem de dados está incompleta ou mudou durante a consulta.');
    }
    expectedTotal = response.total;
    for (const item of response.items) {
      if (!item.id || seen.has(item.id)) throw new Error('A listagem de dados está incompleta ou contém itens repetidos.');
      seen.add(item.id);
      all.push(item);
    }
    if (all.length > response.total) throw new Error('A listagem de dados está inconsistente.');
    if (all.length === response.total) return all;
    if (!response.items.length) throw new Error('A listagem de dados está incompleta.');
  }
  throw new Error('A listagem ultrapassou o limite de páginas.');
}

export async function loadClientDashboard(imoveis: Pick<ImoveisApi, 'list'>, servicos: Pick<ServicosApi, 'list'>) {
  const [properties, services] = await Promise.all([
    allPages<Imovel>((page) => imoveis.list({ page, pageSize: 100 })),
    allPages<Servico>((page) => servicos.list({ page, pageSize: 100 })),
  ]);
  const propertyIds = new Set(properties.filter((item) => item.status === 'Ativo').map((item) => item.id));
  const own = services.filter((item) => propertyIds.has(item.imovelId));
  const byDate = (a: Servico, b: Servico) => a.inicioPrevisto.localeCompare(b.inicioPrevisto);
  return {
    pending: own.filter((item) => ['AguardandoPagamento', 'AguardandoSelecao'].includes(item.status)).sort(byDate),
    upcoming: own.filter((item) => ['AguardandoAceite', 'Aceito', 'EmExecucao'].includes(item.status)).sort(byDate),
  };
}
