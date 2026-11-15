import type { Page } from '@/src/features/operations/contracts/imoveis';
import type { Pagamento, PagamentosApi, PagamentoStatus, TransacaoPagamento } from '@/src/features/operations/contracts/pagamentos';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';

const path = '/api/v2/pagamentos';
const statusPagamento = ['EmConciliacao', 'Pendente', 'Confirmado', 'Falhou', 'Estornado', 'Desconhecido'];
const statusRecebimento = ['Pendente', 'Recebido', 'Desconhecido'];
const statusDisponibilidade = ['Disponivel', 'Indisponivel', 'Desconhecida'];
const statusGarantia = ['NaoConstituida', 'Ativa', 'Encerrada', 'Desconhecida'];
const origens = ['Fake', 'AsaasSandbox'];
const operacoes = ['CriacaoCobranca', 'ConfirmacaoPagamento', 'Recebimento', 'Repasse', 'Estorno'];
const statusTransacao = ['Pendente', 'Confirmado', 'Falhou', 'Incerto'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dataUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function invalido(): never { throw new Error('Resposta de pagamento inválida.'); }
function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalido();
  return value as Record<string, unknown>;
}
function idValido(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value) && value !== '00000000-0000-0000-0000-000000000000';
}
function utcValido(value: unknown): value is string {
  if (typeof value !== 'string' || !dataUtc.test(value)) return false;
  const instante = Date.parse(value);
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 19) === value.slice(0, 19);
}
function pertence(value: unknown, opcoes: readonly string[]): value is string {
  return typeof value === 'string' && opcoes.includes(value);
}
function camposPermitidos(item: Record<string, unknown>, campos: readonly string[]): boolean {
  return Object.keys(item).every((campo) => campos.includes(campo));
}
function transacaoV2(value: unknown): TransacaoPagamento {
  const item = objeto(value);
  if (!camposPermitidos(item, ['id', 'operacao', 'status', 'observadoEm']) || !idValido(item.id) ||
      !pertence(item.operacao, operacoes) || !pertence(item.status, statusTransacao) || !utcValido(item.observadoEm)) return invalido();
  return { id: item.id, operacao: item.operacao as TransacaoPagamento['operacao'],
    status: item.status as TransacaoPagamento['status'], observadoEm: item.observadoEm };
}
function pagamentoV2(value: unknown): Pagamento {
  const item = objeto(value);
  if (!camposPermitidos(item, ['id', 'servicoId', 'valor', 'moeda', 'status', 'recebimentoStatus', 'disponibilidadeStatus',
      'garantiaStatus', 'origem', 'requestedAt', 'aggregateVersion', 'transacoes']) ||
      !idValido(item.id) || !idValido(item.servicoId) || typeof item.valor !== 'number' || !Number.isFinite(item.valor) || item.valor <= 0 ||
      !Number.isSafeInteger(Math.round(item.valor * 100)) || Math.abs(item.valor * 100 - Math.round(item.valor * 100)) > 1e-7 ||
      item.moeda !== 'BRL' || !pertence(item.status, statusPagamento) || !pertence(item.recebimentoStatus, statusRecebimento) ||
      !pertence(item.disponibilidadeStatus, statusDisponibilidade) || !pertence(item.garantiaStatus, statusGarantia) ||
      !pertence(item.origem, origens) || !utcValido(item.requestedAt) || !Number.isSafeInteger(item.aggregateVersion) ||
      (item.aggregateVersion as number) < 1 || !Array.isArray(item.transacoes)) return invalido();
  const transacoes = item.transacoes.map(transacaoV2);
  if (new Set(transacoes.map((transacao) => transacao.id)).size !== transacoes.length) return invalido();
  return {
    id: item.id, servicoId: item.servicoId, valor: item.valor, moeda: 'BRL', status: item.status as PagamentoStatus,
    custodiaStatus: 'Desconhecida', recebimentoStatus: item.recebimentoStatus as Pagamento['recebimentoStatus'],
    disponibilidadeStatus: item.disponibilidadeStatus as Pagamento['disponibilidadeStatus'],
    garantiaStatus: item.garantiaStatus as Pagamento['garantiaStatus'], origem: item.origem as Pagamento['origem'],
    requestedAt: item.requestedAt, aggregateVersion: item.aggregateVersion as number, transacoes,
  };
}

export function createPagamentosV2Api(http: OperationsHttpClient): PagamentosApi {
  return {
    async list(input = {}): Promise<Page<Pagamento>> {
      const item = objeto(await http.get<unknown>(path, { query: input }));
      if (!camposPermitidos(item, ['items', 'page', 'pageSize', 'total']) || !Array.isArray(item.items) ||
          !Number.isSafeInteger(item.page) || (item.page as number) < 1 ||
          !Number.isSafeInteger(item.pageSize) || (item.pageSize as number) < 1 || (item.pageSize as number) > 100 ||
          !Number.isSafeInteger(item.total) || (item.total as number) < 0) return invalido();
      const items = item.items.map(pagamentoV2);
      if (items.length > (item.pageSize as number) || new Set(items.map((pagamento) => pagamento.id.toLowerCase())).size !== items.length) return invalido();
      return { items, page: item.page as number, pageSize: item.pageSize as number, total: item.total as number };
    },
    async get(pagamentoId): Promise<Pagamento> {
      if (!idValido(pagamentoId)) return invalido();
      const pagamento = pagamentoV2(await http.get<unknown>(`${path}/${encodeURIComponent(pagamentoId)}`));
      if (pagamento.id.toLowerCase() !== pagamentoId.toLowerCase()) return invalido();
      return pagamento;
    },
    async getPix(pagamentoId) {
      if (!idValido(pagamentoId)) return invalido();
      const item = objeto(await http.get<unknown>(`${path}/cobrancas-pix/${encodeURIComponent(pagamentoId)}`));
      if (!camposPermitidos(item, ['pagamentoId', 'pixCopiaECola', 'expiraEm', 'status']) ||
          !idValido(item.pagamentoId) || item.pagamentoId.toLowerCase() !== pagamentoId.toLowerCase() ||
          !utcValido(item.expiraEm) || !pertence(item.status, [...statusPagamento, 'Expirado']) ||
          (item.pixCopiaECola !== null && typeof item.pixCopiaECola !== 'string')) return invalido();
      return { pixCopiaECola: item.status === 'Pendente' ? item.pixCopiaECola : null, expiraEm: item.expiraEm };
    },
  };
}
