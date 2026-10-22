import http from 'node:http';

const port = 19007;
const now = new Date('2099-12-10T12:00:00Z');
const iso = (hours) => new Date(now.valueOf() + hours * 3_600_000).toISOString();
const imovel = {
  id: '11111111-1111-4111-8111-111111111111', descricao: 'Apartamento de teste', metragemQuadrada: 80,
  latitude: -15.79, longitude: -47.88,
  endereco: { logradouro: 'Rua de Teste', numero: 10, complemento: null, bairro: 'Centro', cidade: 'Brasília', uf: 'DF', cep: '70000-000' },
  status: 'Ativo', aggregateVersion: 1,
};
const checklist = (status = 'Pendente') => ({ id: '55555555-5555-4555-8555-555555555555', descricao: 'Limpar cozinha', ordem: 1, status });
const newService = (id, status) => ({
  id, imovelId: imovel.id, profissionalId: status === 'Aceito' || status === 'EmExecucao' ? '44444444-4444-4444-8444-444444444444' : null,
  raioBuscaKm: 10, inicioPrevisto: iso(48), fimPrevisto: iso(52), ofertaExpiraEmUtc: status === 'AguardandoAceite' ? iso(2) : null,
  versaoOferta: status === 'AguardandoAceite' ? 1 : null, valor: 120, moeda: 'BRL', status, checklists: [checklist()], aggregateVersion: 1,
});
let services = [newService('service-ready', 'AguardandoSelecao'), newService('service-accepted', 'Aceito')];
let offer = {
  servicoId: 'service-accepted', versaoOferta: 1, aggregateVersion: 1, inicioPrevisto: iso(48), fimPrevisto: iso(52), valor: 120,
  pagamentoConfirmado: true, expiraEmUtc: iso(2), status: 'Pendente', checklists: [{ descricao: 'Limpar cozinha', ordem: 1 }],
};
let payments = [];

function newPayment(service, id) {
  return {
    id, servicoId: service.id, valor: service.valor, moeda: 'BRL', descricao: 'Serviço doméstico simulado',
    status: 'Pendente', custodiaStatus: 'NaoIniciada', requestedAt: now.toISOString(), paidAt: null,
    createdAt: now.toISOString(), updatedAt: null, aggregateVersion: 1,
    transacoes: [{ id: `transaction-${id}`, operacao: 'CriacaoCobranca', status: 'Pendente', occurredAt: now.toISOString(), gatewayId: `gateway-${id}` }],
  };
}

function token() {
  const payload = Buffer.from(JSON.stringify({ sub: 'cliente-profissional-teste', role: ['Cliente', 'Profissional'], exp: 4_102_444_800 })).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.signature`;
}
function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
}
function findService(id) { return services.find((item) => item.id === id); }
async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, idempotency-key, if-match', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' });
    return response.end();
  }
  const url = new URL(request.url, `http://127.0.0.1:${port}`); const { pathname } = url;
  if (request.method === 'POST' && pathname === '/Autenticacao/login') return json(response, 200, { accessToken: token(), tokenType: 'Bearer', expiresIn: 3600 });
  if (request.method === 'GET' && pathname === '/api/v1/imoveis') return json(response, 200, { items: [imovel], page: 1, pageSize: 100, total: 1 });
  if (request.method === 'GET' && pathname === '/api/v1/servicos') return json(response, 200, { items: services, page: 1, pageSize: 20, total: services.length });
  if (request.method === 'GET' && pathname === '/api/v1/ofertas') return json(response, 200, { items: [offer], page: 1, pageSize: 20, total: 1 });
  if (request.method === 'GET' && pathname === '/api/v1/pagamentos') return json(response, 200, { items: payments, page: 1, pageSize: 100, total: payments.length });
  const paymentMatch = /^\/api\/v1\/pagamentos\/([^/]+)$/.exec(pathname);
  if (request.method === 'GET' && paymentMatch) {
    const payment = payments.find((item) => item.id === paymentMatch[1]);
    return payment ? json(response, 200, payment) : json(response, 404, { title: 'Pagamento não encontrado', status: 404 });
  }
  const transitionMatch = /^\/__mock\/pagamentos\/([^/]+)\/(Confirmado|Falhou|Liberado|Estornado)$/.exec(pathname);
  if (request.method === 'POST' && transitionMatch) {
    const payment = payments.find((item) => item.id === transitionMatch[1]);
    if (!payment) return json(response, 404, { title: 'Pagamento não encontrado', status: 404 });
    const status = transitionMatch[2]; const occurredAt = new Date().toISOString();
    if (status === 'Confirmado') { payment.status = 'Confirmado'; payment.custodiaStatus = 'Retida'; payment.paidAt = occurredAt; }
    if (status === 'Falhou') { payment.status = 'Falhou'; payment.custodiaStatus = 'Falhou'; }
    if (status === 'Liberado') { payment.status = 'Confirmado'; payment.custodiaStatus = 'Liberada'; }
    if (status === 'Estornado') { payment.status = 'Estornado'; payment.custodiaStatus = 'Estornada'; }
    payment.aggregateVersion += 1; payment.updatedAt = occurredAt;
    payment.transacoes.push({ id: `transaction-${payment.aggregateVersion}`, operacao: status === 'Liberado' ? 'LiberacaoCustodia' : status === 'Estornado' ? 'Estorno' : 'ConfirmacaoPagamento', status: status === 'Liberado' ? 'Liberado' : payment.status, occurredAt, motivo: status === 'Falhou' ? 'Falha simulada' : status === 'Estornado' ? 'Estorno simulado' : null });
    return json(response, 200, payment);
  }
  if (request.method === 'POST' && pathname === '/api/v1/servicos') {
    const input = await body(request); const created = { ...newService(`service-${services.length + 1}`, 'AguardandoPagamento'), ...input, aggregateVersion: 1, checklists: input.checklists.map((item) => ({ ...item, id: `${item.ordem}`.padStart(8, '0'), status: 'Pendente' })) };
    services = [created, ...services];
    const paymentId = `99999999-9999-4999-8999-${String(payments.length + 1).padStart(12, '0')}`;
    payments = [newPayment(created, paymentId), ...payments];
    return json(response, 201, { servico: created, cobrancaPix: { pagamentoId: paymentId, pixCopiaECola: 'PIX-COPIA-E-COLA-LOCAL', expiraEm: iso(24) } });
  }
  const match = /^\/api\/v1\/servicos\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (!match) return json(response, 404, { title: 'Não encontrado', status: 404 });
  const [, id, action = ''] = match; const service = findService(id);
  if (!service) return json(response, 404, { title: 'Serviço não encontrado', status: 404 });
  if (request.method === 'GET' && !action) return json(response, 200, service);
  if (request.method === 'GET' && action === 'profissionais') return json(response, 200, { items: [{ profissionalId: '44444444-4444-4444-8444-444444444444', nomeExibicao: 'Profissional de teste', distanciaKm: 2.4, avaliacaoMedia: 4.8, quantidadeAvaliacoes: 12, posicaoRanking: 1 }], page: 1, pageSize: 20, total: 1 });
  if (request.method === 'POST' && action === 'selecao') { service.status = 'AguardandoAceite'; service.profissionalId = '44444444-4444-4444-8444-444444444444'; service.aggregateVersion += 1; return json(response, 200, service); }
  if (request.method === 'POST' && action === 'cancelamento') { service.status = 'Cancelado'; service.aggregateVersion += 1; return json(response, 200, service); }
  if (request.method === 'POST' && action === 'inicio') { service.status = 'EmExecucao'; service.aggregateVersion += 1; return json(response, 200, service); }
  if (request.method === 'POST' && action === 'conclusao') { service.status = 'Concluido'; service.aggregateVersion += 1; return json(response, 200, service); }
  if (request.method === 'POST' && action === 'oferta/aceite') { offer = { ...offer, status: 'Aceita', aggregateVersion: offer.aggregateVersion + 1 }; service.status = 'Aceito'; service.aggregateVersion += 1; return json(response, 200, offer); }
  if (request.method === 'POST' && action === 'oferta/recusa') { offer = { ...offer, status: 'Recusada', aggregateVersion: offer.aggregateVersion + 1 }; return json(response, 200, offer); }
  const checklistMatch = /^checklists\/([^/]+)$/.exec(action);
  if (request.method === 'PATCH' && checklistMatch) { const input = await body(request); const item = service.checklists.find((entry) => entry.id === checklistMatch[1]); item.status = input.status; service.aggregateVersion += 1; return json(response, 200, item); }
  return json(response, 404, { title: 'Não encontrado', status: 404 });
}).listen(port, '127.0.0.1', () => console.log(`Manual smoke API listening on ${port}`));
