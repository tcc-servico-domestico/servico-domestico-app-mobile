import type { IdentityApi } from '@/src/features/identity/contracts';
import type { Imovel, ImoveisApi, Page, SaveImovelInput } from '@/src/features/operations/contracts/imoveis';
import type { Oferta, OfertasApi } from '@/src/features/operations/contracts/ofertas';
import type { Pagamento, PagamentosApi } from '@/src/features/operations/contracts/pagamentos';
import type { Checklist, ChecklistStatus, CreateServicoInput, CriacaoServico, ProfissionalCompativel, Servico, ServicosApi } from '@/src/features/operations/contracts/servicos';
import type { OperationsSession, SessionStore } from '@/src/shared/contracts/session';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const now = '2030-01-20T12:00:00.000Z';
const clientSession: OperationsSession = {
  status: 'authenticated', userId: 'demo-cliente-profissional', roles: ['Cliente', 'Profissional'],
  accessToken: 'offline-demo-session', expiresAt: '2030-12-31T23:59:59.000Z',
};
const syntheticProperty: Imovel = {
  id: 'demo-imovel-01', descricao: 'Imóvel sintético para demonstração', metragemQuadrada: 80,
  latitude: -15.7800, longitude: -47.9200, status: 'Ativo', aggregateVersion: 1,
  endereco: { logradouro: 'Rua Sintética', numero: 1, complemento: null, bairro: 'Demonstração', cidade: 'Brasília', uf: 'DF', cep: '70000-000' },
};
const compatibleProfessional: ProfissionalCompativel = {
  profissionalId: 'demo-profissional-a', nomeExibicao: 'Profissional sintético A', distanciaKm: 2.4,
  avaliacaoMedia: 4.8, quantidadeAvaliacoes: 12, posicaoRanking: 1,
};

function page<T>(items: readonly T[], pageNumber = 1, pageSize = 20): Page<T> {
  return { items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, pageSize, total: items.length };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireItem<T extends { readonly id?: string; readonly servicoId?: string }>(items: readonly T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id || candidate.servicoId === id);
  if (!item) throw new Error('Registro sintético não encontrado. Reinicie a demonstração.');
  return item;
}

export interface OfflineDemoRuntime {
  readonly identityApi: IdentityApi;
  readonly sessionStore: SessionStore;
  readonly imoveisApi: ImoveisApi;
  readonly servicosApi: ServicosApi;
  readonly ofertasApi: OfertasApi;
  readonly pagamentosApi: PagamentosApi;
}

export function createOfflineDemoHttpGuard(): OperationsHttpClient {
  const blocked = async () => { throw new Error('Modo demo offline: chamadas de rede são bloqueadas.'); };
  return { get: blocked, post: blocked, put: blocked, patch: blocked, delete: blocked };
}

/** Implements existing app contracts in memory; it never uses an HTTP client or fetch. */
export function createOfflineDemoRuntime(): OfflineDemoRuntime {
  let session: OperationsSession | null = clientSession;
  const listeners = new Set<(value: OperationsSession | null) => void>();
  let properties: Imovel[] = [syntheticProperty];
  let services: Servico[] = [{
    id: 'demo-servico-aguardando-selecao', imovelId: syntheticProperty.id, profissionalId: null, raioBuscaKm: 5,
    inicioPrevisto: '2030-01-21T14:00:00.000Z', fimPrevisto: '2030-01-21T16:00:00.000Z', ofertaExpiraEmUtc: null,
    versaoOferta: null, valor: 80, moeda: 'BRL', status: 'AguardandoSelecao', aggregateVersion: 3,
    checklists: [{ id: 'demo-checklist-01', descricao: 'Separar materiais sintéticos', ordem: 1, status: 'Pendente' }, { id: 'demo-checklist-02', descricao: 'Conferir resultado', ordem: 2, status: 'Pendente' }],
  }, {
    id: 'demo-servico-expirado', imovelId: syntheticProperty.id, profissionalId: null, raioBuscaKm: 10,
    inicioPrevisto: '2030-01-19T14:00:00.000Z', fimPrevisto: '2030-01-19T16:00:00.000Z', ofertaExpiraEmUtc: null,
    versaoOferta: null, valor: 55, moeda: 'BRL', status: 'Expirado', aggregateVersion: 4, checklists: [],
  }];
  let offers: Oferta[] = [];
  let payments: Pagamento[] = [{
    id: 'demo-pagamento-confirmado', servicoId: 'demo-servico-aguardando-selecao', valor: 80, moeda: 'BRL', descricao: 'Custódia sintética',
    status: 'Confirmado', custodiaStatus: 'Retida', requestedAt: now, paidAt: now, createdAt: now, updatedAt: now, aggregateVersion: 2,
    transacoes: [{ id: 'demo-transacao-confirmacao', operacao: 'ConfirmacaoPagamento', status: 'Confirmado', occurredAt: now }],
  }, {
    id: 'demo-pagamento-estornado', servicoId: 'demo-servico-expirado', valor: 55, moeda: 'BRL', descricao: 'Cenário sintético de estorno',
    status: 'Estornado', custodiaStatus: 'Estornada', requestedAt: now, paidAt: now, createdAt: now, updatedAt: now, aggregateVersion: 3,
    transacoes: [{ id: 'demo-transacao-estorno', operacao: 'Estorno', status: 'Estornado', occurredAt: now, motivo: 'Expiração demonstrativa' }],
  }];

  const replaceService = (updated: Servico) => { services = services.map((item) => item.id === updated.id ? updated : item); return clone(updated); };
  const serviceFor = (id: string) => clone(requireItem(services, id));
  const paymentForService = (serviceId: string) => payments.find((item) => item.servicoId === serviceId);

  const sessionStore: SessionStore = {
    load: async () => session,
    save: async (value) => { session = value; listeners.forEach((listener) => listener(value)); },
    clear: async () => { session = null; listeners.forEach((listener) => listener(null)); },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };

  const identityApi: IdentityApi = {
    login: async () => clientSession,
    register: async () => undefined,
    confirmEmail: async () => undefined,
  };

  const imoveisApi: ImoveisApi = {
    list: async (input = {}) => clone(page(properties, input.page, input.pageSize)),
    get: async (id) => clone(requireItem(properties, id)),
    create: async (input: SaveImovelInput) => {
      const created: Imovel = { ...input, id: `demo-imovel-${properties.length + 1}`, status: 'Ativo', aggregateVersion: 1 };
      properties = [created, ...properties]; return clone(created);
    },
    update: async (id, input, version) => {
      const current = requireItem(properties, id);
      if (current.aggregateVersion !== version) throw new Error('Versão sintética desatualizada. Atualize a tela.');
      const updated: Imovel = { ...current, ...input, aggregateVersion: version + 1 };
      properties = properties.map((item) => item.id === id ? updated : item); return clone(updated);
    },
    deactivate: async (id, version) => {
      const current = requireItem(properties, id);
      if (current.aggregateVersion !== version) throw new Error('Versão sintética desatualizada. Atualize a tela.');
      properties = properties.map((item) => item.id === id ? { ...item, status: 'Inativo', aggregateVersion: version + 1 } : item);
    },
  };

  const servicosApi: ServicosApi = {
    list: async (input = {}) => clone(page(services.filter((item) => !input.status || item.status === input.status), input.page, input.pageSize)),
    get: async (id) => serviceFor(id),
    create: async (input: CreateServicoInput): Promise<CriacaoServico> => {
      const id = `demo-servico-${services.length + 1}`;
      const created: Servico = { id, imovelId: input.imovelId, profissionalId: null, raioBuscaKm: input.raioBuscaKm, inicioPrevisto: input.inicioPrevisto, fimPrevisto: input.fimPrevisto, ofertaExpiraEmUtc: null, versaoOferta: null, valor: input.valor, moeda: 'BRL', status: 'AguardandoPagamento', aggregateVersion: 1, checklists: input.checklists.map((item, index) => ({ ...item, id: `demo-checklist-${id}-${index + 1}`, ordem: index + 1, status: 'Pendente' })) };
      const pagamentoId = `demo-pagamento-${payments.length + 1}`;
      payments = [{ id: pagamentoId, servicoId: id, valor: input.valor, moeda: 'BRL', descricao: 'Cobrança Pix fictícia', status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: now, paidAt: null, createdAt: now, updatedAt: null, aggregateVersion: 1, transacoes: [{ id: `demo-transacao-${pagamentoId}`, operacao: 'CriacaoCobranca', status: 'Pendente', occurredAt: now }] }, ...payments];
      services = [created, ...services];
      return clone({ servico: created, cobrancaPix: { pagamentoId, pixCopiaECola: 'PIX-DEMONSTRACAO-SEM-VALOR-REAL', expiraEm: '2030-01-21T12:00:00.000Z' } });
    },
    listCompatibleProfessionals: async (_id, input = {}) => clone(page([compatibleProfessional], input.page, input.pageSize)),
    selectProfessional: async (id, professionalId, version) => {
      const current = requireItem(services, id);
      if (current.status !== 'AguardandoSelecao' || current.aggregateVersion !== version || professionalId !== compatibleProfessional.profissionalId) throw new Error('Seleção sintética não permitida neste estado.');
      const expiresAt = '2030-01-21T13:00:00.000Z';
      const updated: Servico = { ...current, profissionalId: professionalId, status: 'AguardandoAceite', aggregateVersion: version + 1, versaoOferta: 1, ofertaExpiraEmUtc: expiresAt };
      offers = [{ servicoId: id, versaoOferta: 1, aggregateVersion: updated.aggregateVersion, inicioPrevisto: updated.inicioPrevisto, fimPrevisto: updated.fimPrevisto, valor: updated.valor, pagamentoConfirmado: true, expiraEmUtc: expiresAt, status: 'Pendente', checklists: updated.checklists.map(({ descricao, ordem }) => ({ descricao, ordem })) }];
      return replaceService(updated);
    },
    cancel: async (id, _reason, version) => {
      const current = requireItem(services, id);
      if (current.aggregateVersion !== version) throw new Error('Versão sintética desatualizada.');
      return replaceService({ ...current, status: 'Cancelado', aggregateVersion: version + 1 });
    },
    start: async (id, version) => {
      const current = requireItem(services, id);
      if (current.status !== 'Aceito' || current.aggregateVersion !== version) throw new Error('Início sintético não permitido neste estado.');
      return replaceService({ ...current, status: 'EmExecucao', aggregateVersion: version + 1 });
    },
    complete: async (id, version) => {
      const current = requireItem(services, id);
      if (current.status !== 'EmExecucao' || current.aggregateVersion !== version || current.checklists.some((item) => item.status !== 'Concluida')) throw new Error('Conclua os checklists sintéticos antes de finalizar.');
      const updated = { ...current, status: 'Concluido' as const, aggregateVersion: version + 1 };
      const payment = paymentForService(id);
      if (payment) payments = payments.map((item) => item.id === payment.id ? { ...item, custodiaStatus: 'Liberada', updatedAt: now, aggregateVersion: item.aggregateVersion + 1, transacoes: [...item.transacoes, { id: `demo-liberacao-${item.id}`, operacao: 'LiberacaoCustodia', status: 'Liberado', occurredAt: now }] } : item);
      return replaceService(updated);
    },
    updateChecklist: async (id, checklistId, status: ChecklistStatus, version) => {
      const current = requireItem(services, id);
      if (current.status !== 'EmExecucao' || current.aggregateVersion !== version) throw new Error('Checklist sintético não permitido neste estado.');
      const checklist = requireItem(current.checklists, checklistId) as Checklist;
      const updatedChecklist = { ...checklist, status };
      replaceService({ ...current, aggregateVersion: version + 1, checklists: current.checklists.map((item) => item.id === checklistId ? updatedChecklist : item) });
      return clone(updatedChecklist);
    },
  };

  const ofertasApi: OfertasApi = {
    list: async (input = {}) => clone(page(offers.filter((item) => !input.status || item.status === input.status), input.page, input.pageSize)),
    accept: async (serviceId, offerVersion, version) => {
      const offer = requireItem(offers, serviceId);
      const service = requireItem(services, serviceId);
      if (offer.status !== 'Pendente' || offer.versaoOferta !== offerVersion || offer.aggregateVersion !== version || service.aggregateVersion !== version) throw new Error('Oferta sintética não pode ser aceita.');
      const accepted = { ...offer, status: 'Aceita' as const, aggregateVersion: version + 1 };
      offers = offers.map((item) => item.servicoId === serviceId ? accepted : item);
      replaceService({ ...service, status: 'Aceito', aggregateVersion: version + 1 });
      return clone(accepted);
    },
    reject: async (serviceId, offerVersion, version) => {
      const offer = requireItem(offers, serviceId);
      if (offer.status !== 'Pendente' || offer.versaoOferta !== offerVersion || offer.aggregateVersion !== version) throw new Error('Oferta sintética não pode ser recusada.');
      const rejected = { ...offer, status: 'Recusada' as const, aggregateVersion: version + 1 };
      offers = offers.map((item) => item.servicoId === serviceId ? rejected : item); return clone(rejected);
    },
  };

  const pagamentosApi: PagamentosApi = {
    list: async (input = {}) => clone(page(payments.filter((item) => !input.status || item.status === input.status), input.page, input.pageSize)),
    get: async (id) => clone(requireItem(payments, id)),
  };

  return { identityApi, sessionStore, imoveisApi, servicosApi, ofertasApi, pagamentosApi };
}
