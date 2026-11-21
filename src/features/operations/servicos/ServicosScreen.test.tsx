import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ServicosScreen } from './ServicosScreen';
import { emptyServicoForm } from './validation';
import { createOfflineDemoRuntime } from '@/src/features/demo/offlineDemo';

const alertMock = vi.hoisted(() => vi.fn());
const testWindow = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/src/features/operations/pagamentos/paymentTrackingStore', () => ({ paymentTrackingStore: { save: vi.fn() } }));
vi.mock('react-native', async () => {
  const R = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => R.createElement(name, props, children);
  return { Alert: { alert: alertMock }, ActivityIndicator: element('activity'), Button: element('button'), FlatList: ({ ListHeaderComponent, data = [], renderItem }: { ListHeaderComponent: React.ReactNode; data?: any[]; renderItem?: (item: { item: any }) => React.ReactNode }) => R.createElement('list', null, ListHeaderComponent, data.map((item, index) => R.createElement(R.Fragment, { key: index }, renderItem?.({ item })))), Modal: element('modal'), Pressable: element('pressable'), RefreshControl: element('refresh'), ScrollView: element('scroll'), StyleSheet: { create: (x: unknown) => x }, Text: element('text'), TextInput: element('input'), View: element('view'), useWindowDimensions: () => testWindow };
});

describe('revisão da solicitação', () => {
  it('mostra o aviso de conta dupla na lista e não no formulário', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const list = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ServicosScreen mixedRoleList session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={{ list } as any} ofertasApi={{} as any} imoveisApi={{ list } as any} />); });
    expect(JSON.stringify(view.toJSON())).toContain('Esta lista pode incluir serviços acessíveis pelos dois papéis');
    await act(async () => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Novo serviço')!.props.onPress());
    expect(JSON.stringify(view.toJSON())).not.toContain('Esta lista pode incluir serviços acessíveis pelos dois papéis');
    await act(async () => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Voltar')!.props.onPress());
    expect(JSON.stringify(view.toJSON())).toContain('Esta lista pode incluir serviços acessíveis pelos dois papéis');
    await act(async () => view.unmount());
  });
  it('abre o formulário sem criar serviço', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const createService = vi.fn();
    const list = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
    const session = { userId: 'u', roles: ['Cliente'] } as any;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ServicosScreen session={session} servicosApi={{ list, create: createService } as any} ofertasApi={{} as any} imoveisApi={{ list } as any} />); });
    const open = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Novo serviço');
    expect(open).toBeDefined();
    await act(async () => { open!.props.onPress(); });
    expect(createService).not.toHaveBeenCalled();
    expect(emptyServicoForm.imovelId).toBe('');
    await act(async () => view.unmount());
  });
});


it('revisa sem enviar, preserva rascunho ao voltar e envia somente ao confirmar', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const createService = vi.fn().mockImplementation(() => new Promise(() => {}));
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }), create: createService };
  const properties = { list: vi.fn().mockResolvedValue({ items: [{ id: 'i', descricao: 'Casa', endereco: { logradouro: 'Rua', cidade: 'Cidade', uf: 'SP' } }], page: 1, total: 1 }) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={services as any} ofertasApi={{} as any} imoveisApi={properties as any} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => { button('Novo serviço').props.onPress(); });
  const property = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityRole === 'radio')!;
  expect(property.props.accessibilityLabel).toBe('Casa, Cidade/SP');
  await act(async () => property.props.onPress());
  expect(property.props.accessibilityState.checked).toBe(true);
  const fill = async (label: string, value: string) => { const input = view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith(label))!; await act(async () => input.props.onChangeText(value)); };
  await fill('Data inicial', '10/12/2099'); await fill('Hora inicial', '09:00');
  await fill('Data final', '10/12/2099'); await fill('Hora final', '12:00');
  await fill('Valor', '120,00'); await fill('Checklist 1', 'Limpar');
  await act(async () => button('Revisar pedido').props.onPress());
  expect(createService).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('Revise seu pedido');
  await act(async () => button('Voltar e editar').props.onPress());
  expect(view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith('Valor'))!.props.value).toBe('120,00');
  await act(async () => button('Revisar pedido').props.onPress());
  await act(async () => { await button('Confirmar solicitação').props.onPress(); });
  expect(createService).toHaveBeenCalledOnce();
  await act(async () => { button('Enviando…').props.onPress(); });
  expect(createService).toHaveBeenCalledOnce();
  await act(async () => view.unmount());
});



it('mantém dados e chave na repetição após resultado incerto', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const createService = vi.fn().mockRejectedValue(new Error('conexão perdida'));
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }), create: createService };
  const properties = { list: vi.fn().mockResolvedValue({ items: [{ id: 'i', descricao: 'Casa', endereco: { logradouro: 'Rua', cidade: 'Cidade', uf: 'SP' } }], page: 1, total: 1 }) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={services as any} ofertasApi={{} as any} imoveisApi={properties as any} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => { button('Novo serviço').props.onPress(); });
  await act(async () => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityRole === 'radio')!.props.onPress());
  const fill = async (label: string, value: string) => { const input = view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith(label))!; await act(async () => input.props.onChangeText(value)); };
  await fill('Data inicial', '10/12/2099'); await fill('Hora inicial', '09:00'); await fill('Data final', '10/12/2099'); await fill('Hora final', '12:00'); await fill('Valor', '120,00'); await fill('Checklist 1', 'Limpar');
  await act(async () => button('Revisar pedido').props.onPress());
  await act(async () => { button('Confirmar solicitação').props.onPress(); });
  expect(createService).toHaveBeenCalledOnce();
  expect(button('Voltar e editar')).toBeUndefined();
  const now = vi.spyOn(Date, 'now').mockReturnValue(new Date('2100-01-01T00:00:00Z').valueOf());
  await act(async () => { button('Repetir mesma tentativa').props.onPress(); });
  now.mockRestore();
  expect(createService).toHaveBeenCalledTimes(2);
  expect(createService.mock.calls[1]).toEqual(createService.mock.calls[0]);
  await act(async () => view.unmount());
});

it('revalida o início antes da primeira submissão', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const createService = vi.fn().mockImplementation(() => new Promise(() => {}));
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }), create: createService };
  const properties = { list: vi.fn().mockResolvedValue({ items: [{ id: 'i', descricao: 'Casa', endereco: { logradouro: 'Rua', cidade: 'Cidade', uf: 'SP' } }], page: 1, total: 1 }) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={services as any} ofertasApi={{} as any} imoveisApi={properties as any} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => { button('Novo serviço').props.onPress(); });
  const property = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityRole === 'radio')!;
  await act(async () => property.props.onPress());
  const fill = async (label: string, value: string) => { const input = view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith(label))!; await act(async () => input.props.onChangeText(value)); };
  await fill('Data inicial', '10/12/2099'); await fill('Hora inicial', '09:00');
  await fill('Data final', '10/12/2099'); await fill('Hora final', '12:00');
  await fill('Valor', '120,00'); await fill('Checklist 1', 'Limpar');
  await act(async () => button('Revisar pedido').props.onPress());
  expect(createService).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('Revise seu pedido');
  const now = vi.spyOn(Date, 'now').mockReturnValue(new Date('2100-01-01T00:00:00Z').valueOf());
  await act(async () => { button('Confirmar solicitação').props.onPress(); });
  now.mockRestore();
  expect(createService).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('O início previsto deve estar no futuro');
  await act(async () => view.unmount());
});

it('apresenta ofertas para profissional e criação apenas para cliente', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const page = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const api = { list: page } as any;
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'prof', roles: ['Profissional'] } as any} servicosApi={api} ofertasApi={api} imoveisApi={api} />); });
  expect(JSON.stringify(view.toJSON())).toContain('Nenhuma oferta agora');
  expect(view.root.findAllByType('pressable' as React.ElementType).some((node) => node.props.accessibilityLabel === 'Novo serviço')).toBe(false);
  await act(async () => view.unmount());
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'ambos', roles: ['Cliente', 'Profissional'] } as any} servicosApi={api} ofertasApi={api} imoveisApi={api} />); });
  expect(JSON.stringify(view.toJSON())).toContain('Nenhuma oferta agora');
  expect(view.root.findAllByType('pressable' as React.ElementType).some((node) => node.props.accessibilityLabel === 'Novo serviço')).toBe(true);
  await act(async () => view.unmount());
});

it('pede confirmação antes de aceitar oferta e não envia ao desistir', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const offer = { servicoId: 's', versaoOferta: 1, aggregateVersion: 2, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', valor: 100, pagamentoConfirmado: true, expiraEmUtc: '2099-01-01T10:00:00Z', status: 'Pendente', checklists: [] };
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }) };
  const offers = { list: vi.fn().mockResolvedValue({ items: [offer], page: 1, total: 1 }), accept: vi.fn() };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={services as any} ofertasApi={offers as any} imoveisApi={{} as any} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => button('Aceitar').props.onPress());
  expect(offers.accept).not.toHaveBeenCalled();
  await act(async () => button('Voltar').props.onPress());
  expect(offers.accept).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});


it('atualiza serviços e ofertas ao voltar do detalhe', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const service = { id: 's', imovelId: 'i', profissionalId: null, raioBuscaKm: 5, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', status: 'AguardandoSelecao', valor: 80, checklists: [], aggregateVersion: 1 };
  const list = vi.fn().mockResolvedValue({ items: [service], page: 1, total: 1 });
  const offers = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const api = { list, get: vi.fn().mockResolvedValue(service) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente', 'Profissional'] } as any} servicosApi={api as any} ofertasApi={{ list: offers } as any} imoveisApi={{ get: vi.fn().mockResolvedValue({ descricao: 'Casa' }) } as any} />); });
  const card = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel?.startsWith('Ver serviço:'))!;
  await act(async () => { card.props.onPress(); });
  const back = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Voltar aos serviços')!;
  await act(async () => { back.props.onPress(); });
  expect(list).toHaveBeenCalledTimes(2);
  expect(offers).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});

it('após falha na resposta da oferta exige atualizar antes de outra resposta', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const offer = { servicoId: 's', versaoOferta: 1, aggregateVersion: 2, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', valor: 100, pagamentoConfirmado: true, expiraEmUtc: '2099-01-01T10:00:00Z', status: 'Pendente', checklists: [] };
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }) };
  const offers = { list: vi.fn().mockResolvedValue({ items: [offer], page: 1, total: 1 }), accept: vi.fn().mockRejectedValue(new Error('indisponível')) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={services as any} ofertasApi={offers as any} imoveisApi={{} as any} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => button('Aceitar').props.onPress());
  await act(async () => { button('Confirmar aceite').props.onPress(); });
  expect(offers.accept).toHaveBeenCalledOnce();
  expect(JSON.stringify(view.toJSON())).toContain('Atualize a lista antes de tentar novamente');
  expect(button('Aceitar').props.disabled).toBe(true);
  await act(async () => view.unmount());
});

it('abre a solicitação pelo atalho do início sem enviar o serviço', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const createService = vi.fn();
  const opened = vi.fn();
  const list = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen onCreateOpened={opened} openCreateToken="abrir-1" session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={{ list, create: createService } as any} ofertasApi={{} as any} imoveisApi={{ list } as any} />); });
  expect(JSON.stringify(view.toJSON())).toContain('Revisar pedido');
  expect(opened).toHaveBeenCalledOnce();
  expect(createService).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});

it('filtra serviços por situação e informa quando existem páginas não consultadas', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const service = { id: 's', inicioPrevisto: '2099-01-01T12:00:00Z', status: 'Concluido', valor: 80 };
  const list = vi.fn().mockResolvedValue({ items: [service], page: 1, total: 21 });
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={{ list } as any} ofertasApi={{} as any} imoveisApi={{} as any} />); });
  expect(JSON.stringify(view.toJSON())).toContain('Carregue mais serviços para continuar a consulta');
  const tab = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Concluídos')!;
  await act(async () => { tab.props.onPress(); });
  expect(view.root.findAllByType('pressable' as React.ElementType).some((node) => String(node.props.accessibilityLabel ?? '').startsWith('Ver serviço:'))).toBe(true);
  await act(async () => view.unmount());
});


it('abre do painel o atendimento solicitado com consulta autorizada e consome o destino', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const service = { id: 's', imovelId: 'i', profissionalId: null, raioBuscaKm: 5, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', status: 'AguardandoSelecao', valor: 80, checklists: [], aggregateVersion: 1 };
  const api = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }), get: vi.fn().mockResolvedValue(service) };
  const consumed = vi.fn();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={api as any} ofertasApi={{} as any} imoveisApi={{ get: vi.fn().mockResolvedValue({ descricao: 'Casa' }) } as any} openServiceId="s" onServiceOpened={consumed} />); });
  expect(api.get).toHaveBeenCalledWith('s');
  expect(consumed).toHaveBeenCalledOnce();
  expect(JSON.stringify(view.toJSON())).toContain('Atendimento');
  await act(async () => view.unmount());
});

it('avisa antes de abandonar solicitação ao abrir atendimento do painel', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  alertMock.mockClear();
  const api = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }), get: vi.fn() };
  const properties = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }) };
  const session = { userId: 'u', roles: ['Cliente'] } as any;
  const consumed = vi.fn();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={session} servicosApi={api as any} ofertasApi={{} as any} imoveisApi={properties as any} />); });
  const createButton = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Novo serviço')!;
  await act(async () => createButton.props.onPress());
  await act(async () => view.update(<ServicosScreen session={session} servicosApi={api as any} ofertasApi={{} as any} imoveisApi={properties as any} openServiceId="s" onServiceOpened={consumed} />));
  expect(alertMock).toHaveBeenCalledOnce();
  const actions = alertMock.mock.calls[0][2];
  expect(alertMock.mock.calls[0][1]).toContain('rascunho');
  await act(async () => actions.find((action: any) => action.text === 'Permanecer').onPress());
  expect(api.get).not.toHaveBeenCalled();
  expect(consumed).toHaveBeenCalledOnce();
  expect(JSON.stringify(view.toJSON())).toContain('Solicitar serviço');
  await act(async () => view.unmount());
});


it('não abre atalho de cliente na experiência profissional', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const page = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const api = { list: page, get: vi.fn() };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={api as any} ofertasApi={{ list: page } as any} imoveisApi={{} as any} openServiceId="s" />); });
  expect(api.get).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});


it('identifica os controles de remoção por tarefa', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const list = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'u', roles: ['Cliente'] } as any} servicosApi={{ list } as any} ofertasApi={{} as any} imoveisApi={{ list } as any} />); });
  const button = (label: string) => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === label);
  await act(async () => button('Novo serviço')!.props.onPress());
  await act(async () => button('Adicionar checklist')!.props.onPress());
  expect(button('Remover checklist 1')).toBeDefined();
  expect(button('Remover checklist 2')).toBeDefined();
  await act(async () => view.unmount());
});


it('mantém a revisão fixa e a coloca na rolagem com fonte ampliada', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const list = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const session = { userId: 'u', roles: ['Cliente'] } as any;
  const props = { session, servicosApi: { list } as any, ofertasApi: {} as any, imoveisApi: { list } as any };
  let view!: ReactTestRenderer;
  try {
    testWindow.fontScale = 1;
    await act(async () => { view = create(<ServicosScreen {...props} />); });
    await act(async () => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Novo serviço')!.props.onPress());
    const inScroll = () => view.root.findByType('scroll' as React.ElementType).findAllByType('pressable' as React.ElementType).some((node) => node.props.accessibilityLabel === 'Revisar pedido');
    expect(inScroll()).toBe(false);
    testWindow.fontScale = 2;
    await act(async () => view.update(<ServicosScreen {...props} />));
    expect(inScroll()).toBe(true);
  } finally { testWindow.fontScale = 1; if (view) await act(async () => view.unmount()); }
});


it('abre pela agenda apenas atendimento atribuído ao profissional autenticado', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const service = { id: 's', imovelId: 'i', profissionalId: 'p', raioBuscaKm: 5, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', status: 'Aceito', valor: 80, checklists: [], aggregateVersion: 1 };
  const page = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const get = vi.fn().mockResolvedValue(service);
  const consumed = vi.fn();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={{ list: page, get } as any} ofertasApi={{ list: page } as any} imoveisApi={{ get: vi.fn().mockResolvedValue({ descricao: 'Casa' }) } as any} openProfessionalServiceId="s" onProfessionalServiceOpened={consumed} />); });
  expect(get).toHaveBeenCalledWith('s');
  expect(consumed).toHaveBeenCalledOnce();
  expect(JSON.stringify(view.toJSON())).toContain('80,00');
  await act(async () => view.unmount());
});

it('não mostra pela agenda um atendimento de outro profissional', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const service = { id: 's', imovelId: 'i', profissionalId: 'outro', raioBuscaKm: 5, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', status: 'Aceito', valor: 999, checklists: [], aggregateVersion: 1 };
  const page = vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 });
  const get = vi.fn().mockResolvedValue(service);
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={{ list: page, get } as any} ofertasApi={{ list: page } as any} imoveisApi={{} as any} openProfessionalServiceId="s" />); });
  expect(get).toHaveBeenCalledWith('s');
  expect(JSON.stringify(view.toJSON())).not.toContain('999,00');
  expect(JSON.stringify(view.toJSON())).toContain('Atendimento indisponível para este profissional.');
  await act(async () => view.unmount());
});


it('percorre revisão e cria serviço e cobrança no ambiente offline isolado', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const runtime = createOfflineDemoRuntime();
  const beforeServices = (await runtime.servicosApi.list()).total;
  const beforePayments = (await runtime.pagamentosApi.list()).total;
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'demo-cliente-profissional', roles: ['Cliente'] } as any} servicosApi={runtime.servicosApi} ofertasApi={runtime.ofertasApi} imoveisApi={runtime.imoveisApi} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => button('Novo serviço').props.onPress());
  const property = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityRole === 'radio')!;
  await act(async () => property.props.onPress());
  const fill = async (label: string, value: string) => { const input = view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith(label))!; await act(async () => input.props.onChangeText(value)); };
  await fill('Data inicial', '10/12/2099'); await fill('Hora inicial', '09:00');
  await fill('Data final', '10/12/2099'); await fill('Hora final', '12:00');
  await fill('Valor', '120,00'); await fill('Checklist 1', 'Limpar');
  await act(async () => button('Revisar pedido').props.onPress());
  expect((await runtime.servicosApi.list()).total).toBe(beforeServices);
  await act(async () => { button('Confirmar solicitação').props.onPress(); });
  const services = await runtime.servicosApi.list();
  const payments = await runtime.pagamentosApi.list();
  expect(services.total).toBe(beforeServices + 1);
  expect(payments.total).toBe(beforePayments + 1);
  const created = services.items.find((item) => item.status === 'AguardandoPagamento')!;
  expect(created.checklists[0].descricao).toBe('Limpar');
  expect(payments.items.some((item) => item.servicoId === created.id && item.status === 'Pendente')).toBe(true);
  await act(async () => view.unmount());
});


it('recupera resposta perdida da criação offline sem duplicar serviço ou cobrança', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const runtime = createOfflineDemoRuntime();
  const beforeServices = (await runtime.servicosApi.list()).total;
  const beforePayments = (await runtime.pagamentosApi.list()).total;
  let calls = 0;
  const api = { ...runtime.servicosApi, create: vi.fn(async (input, key) => {
    const result = await runtime.servicosApi.create(input, key);
    if (++calls === 1) throw new Error('Resposta de teste perdida');
    return result;
  }) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'demo-cliente-profissional', roles: ['Cliente'] } as any} servicosApi={api} ofertasApi={runtime.ofertasApi} imoveisApi={runtime.imoveisApi} />); });
  const button = (title: string) => (view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title) ?? view.root.findAllByType('button').find((node) => node.props.title === title))!;
  await act(async () => button('Novo serviço').props.onPress());
  await act(async () => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityRole === 'radio')!.props.onPress());
  const fill = async (label: string, value: string) => { const input = view.root.findAllByType('input').find((node) => node.props.accessibilityLabel?.startsWith(label))!; await act(async () => input.props.onChangeText(value)); };
  await fill('Data inicial', '10/12/2099'); await fill('Hora inicial', '09:00');
  await fill('Data final', '10/12/2099'); await fill('Hora final', '12:00');
  await fill('Valor', '120,00'); await fill('Checklist 1', 'Limpar');
  await act(async () => button('Revisar pedido').props.onPress());
  await act(async () => { button('Confirmar solicitação').props.onPress(); });
  expect(button('Repetir mesma tentativa')).toBeDefined();
  await act(async () => { button('Repetir mesma tentativa').props.onPress(); });
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[1]).toEqual(api.create.mock.calls[0]);
  expect((await runtime.servicosApi.list()).total).toBe(beforeServices + 1);
  expect((await runtime.pagamentosApi.list()).total).toBe(beforePayments + 1);
  await act(async () => view.unmount());
});


it.each([
  ['Aceitar', 'Confirmar aceite', 'accept'],
  ['Recusar', 'Confirmar recusa', 'reject'],
] as const)('envia %s somente após confirmação da oferta', async (action, confirmation, operation) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const offer = { servicoId: 's', versaoOferta: 1, aggregateVersion: 2, inicioPrevisto: '2099-01-01T12:00:00Z', fimPrevisto: '2099-01-01T14:00:00Z', valor: 100, pagamentoConfirmado: true, expiraEmUtc: '2099-01-01T10:00:00Z', status: 'Pendente', checklists: [] };
  const services = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }) };
  const offers = { list: vi.fn().mockResolvedValue({ items: [offer], page: 1, total: 1 }), accept: vi.fn().mockResolvedValue(offer), reject: vi.fn().mockResolvedValue(offer) };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'p', roles: ['Profissional'] } as any} servicosApi={services as any} ofertasApi={offers as any} imoveisApi={{} as any} />); });
  const button = (title: string) => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === title)!;
  await act(async () => button(action).props.onPress());
  expect(offers[operation]).not.toHaveBeenCalled();
  await act(async () => button(confirmation).props.onPress());
  expect(offers[operation]).toHaveBeenCalledOnce();
  expect(offers[operation]).toHaveBeenCalledWith('s', 1, 2, expect.any(String));
  await act(async () => view.unmount());
});


it('percorre matching e envia oferta apenas após confirmação no modo offline', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const runtime = createOfflineDemoRuntime();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<ServicosScreen session={{ userId: 'demo-cliente-profissional', roles: ['Cliente'] } as any} servicosApi={runtime.servicosApi} ofertasApi={runtime.ofertasApi} imoveisApi={runtime.imoveisApi} />); });
  const pressable = (label: string) => view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === label)!;
  const service = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel?.startsWith('Ver serviço:'))!;
  await act(async () => service.props.onPress());
  await act(async () => pressable('Escolher profissional').props.onPress());
  await act(async () => pressable('Selecionar').props.onPress());
  expect((await runtime.ofertasApi.list()).total).toBe(0);
  await act(async () => pressable('Confirmar seleção').props.onPress());
  const offers = await runtime.ofertasApi.list();
  expect(offers.total).toBe(1);
  expect(offers.items[0].status).toBe('Pendente');
  expect((await runtime.servicosApi.get(offers.items[0].servicoId)).status).toBe('AguardandoAceite');
  await act(async () => view.unmount());
});
