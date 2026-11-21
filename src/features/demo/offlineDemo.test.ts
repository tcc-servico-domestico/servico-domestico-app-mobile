import { describe, expect, it, vi } from 'vitest';

import { createOfflineDemoHttpGuard, createOfflineDemoRuntime } from './offlineDemo';

describe('offline demo runtime', () => {
  it('executa o fluxo sintético sem usar fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const runtime = createOfflineDemoRuntime();

    const initial = await runtime.servicosApi.list({ page: 1, pageSize: 20 });
    const awaitingSelection = initial.items.find((item) => item.status === 'AguardandoSelecao');
    expect(awaitingSelection).toBeDefined();
    const candidates = await runtime.servicosApi.listCompatibleProfessionals(awaitingSelection!.id);
    const directed = await runtime.servicosApi.selectProfessional(awaitingSelection!.id, candidates.items[0].profissionalId, awaitingSelection!.aggregateVersion, 'demo-select');
    const offer = (await runtime.ofertasApi.list()).items[0];
    await runtime.ofertasApi.accept(offer.servicoId, offer.versaoOferta, offer.aggregateVersion, 'demo-accept');

    let running = await runtime.servicosApi.start(directed.id, directed.aggregateVersion + 1, 'demo-start');
    for (const checklist of running.checklists) {
      await runtime.servicosApi.updateChecklist(running.id, checklist.id, 'EmAndamento', running.aggregateVersion, 'demo-checklist');
      running = await runtime.servicosApi.get(running.id);
      await runtime.servicosApi.updateChecklist(running.id, checklist.id, 'Concluida', running.aggregateVersion, 'demo-checklist');
      running = await runtime.servicosApi.get(running.id);
    }
    const completed = await runtime.servicosApi.complete(running.id, running.aggregateVersion, 'demo-complete');
    const payment = (await runtime.pagamentosApi.list()).items.find((item) => item.servicoId === completed.id);

    expect(completed.status).toBe('Concluido');
    expect(payment?.custodiaStatus).toBe('Liberada');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('mantém Pix sintético sem valor real', async () => {
    const runtime = createOfflineDemoRuntime();
    const created = await runtime.servicosApi.create({
      imovelId: 'demo-imovel-01', raioBuscaKm: 5, inicioPrevisto: '2030-01-22T14:00:00.000Z',
      fimPrevisto: '2030-01-22T16:00:00.000Z', valor: 10, checklists: [{ descricao: 'Checklist de teste', ordem: 1 }],
    }, 'demo-create');

    expect(created.cobrancaPix.pixCopiaECola).toBe('PIX-DEMONSTRACAO-SEM-VALOR-REAL');
    expect(created.servico.status).toBe('AguardandoPagamento');
  });

  it('bloqueia explicitamente qualquer cliente HTTP no modo demo', async () => {
    await expect(createOfflineDemoHttpGuard().get('/api/v1/servicos')).rejects.toThrow('chamadas de rede são bloqueadas');
  });
  it('não inativa imóvel com serviço ativo e não lista imóvel inativado', async () => {
    const runtime = createOfflineDemoRuntime();
    const initial = (await runtime.imoveisApi.list()).items[0];
    await expect(runtime.imoveisApi.deactivate(initial.id, initial.aggregateVersion)).rejects.toMatchObject({ problem: { status: 409 } });
    const { id: _id, status: _status, aggregateVersion: _version, ...data } = initial;
    const extra = await runtime.imoveisApi.create(data, 'demo-property');
    await runtime.imoveisApi.deactivate(extra.id, extra.aggregateVersion);
    expect((await runtime.imoveisApi.list()).items.map((item) => item.id)).toEqual([initial.id]);
    await expect(runtime.servicosApi.create({ imovelId: extra.id, raioBuscaKm: 5, inicioPrevisto: '2030-01-22T14:00:00.000Z', fimPrevisto: '2030-01-22T16:00:00.000Z', valor: 10, checklists: [{ descricao: 'Teste', ordem: 1 }] }, 'demo-create')).rejects.toMatchObject({ problem: { status: 404 } });
    await expect(runtime.imoveisApi.deactivate(extra.id, extra.aggregateVersion + 1)).rejects.toMatchObject({ problem: { status: 404 } });
  });

  it('repete a criação de serviço pela mesma chave sem duplicar serviço ou cobrança', async () => {
    const runtime = createOfflineDemoRuntime();
    const input = { imovelId: 'demo-imovel-01', raioBuscaKm: 5 as const, inicioPrevisto: '2030-01-22T14:00:00.000Z', fimPrevisto: '2030-01-22T16:00:00.000Z', valor: 10, checklists: [{ descricao: 'Limpar', ordem: 1 }] };
    const first = await runtime.servicosApi.create(input, 'retry');
    const repeated = await runtime.servicosApi.create(input, 'retry');
    expect(repeated).toEqual(first);
    expect((await runtime.servicosApi.list()).items.filter((item) => item.id === first.servico.id)).toHaveLength(1);
    expect((await runtime.pagamentosApi.list()).items.filter((item) => item.id === first.cobrancaPix.pagamentoId)).toHaveLength(1);
    await expect(runtime.servicosApi.create({ ...input, valor: 11 }, 'retry')).rejects.toMatchObject({ problem: { status: 409 } });
  });

  it('repete a criação de imóvel pela mesma chave e rejeita alteração de dados', async () => {
    const runtime = createOfflineDemoRuntime();
    const initial = (await runtime.imoveisApi.list()).items[0];
    const { id: _id, status: _status, aggregateVersion: _version, ...input } = initial;
    const first = await runtime.imoveisApi.create(input, 'retry');
    const repeated = await runtime.imoveisApi.create(input, 'retry');
    expect(repeated).toEqual(first);
    expect((await runtime.imoveisApi.list()).items.filter((item) => item.id === first.id)).toHaveLength(1);
    await expect(runtime.imoveisApi.create({ ...input, descricao: 'Outra' }, 'retry')).rejects.toMatchObject({ problem: { status: 409 } });
  });

});
