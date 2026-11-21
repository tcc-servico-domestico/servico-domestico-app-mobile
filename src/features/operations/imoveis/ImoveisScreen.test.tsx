import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ImoveisScreen } from './ImoveisScreen';

vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return {
    ActivityIndicator: el('activity'), Modal: el('modal'), Pressable: el('button'), RefreshControl: el('refresh'),
    ScrollView: el('scroll'), Text: el('text'), TextInput: el('input'), View: el('view'),
    FlatList: ({ ListHeaderComponent, data, renderItem }: any) => react.createElement('list', null, ListHeaderComponent, data.map((item: any) => react.createElement(react.Fragment, { key: item.id }, renderItem({ item })))),
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 }, useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

const client = { userId: 'c', roles: ['Cliente'] } as any;
const property = { id: 'i', descricao: 'Casa', status: 'Ativo', endereco: { logradouro: 'Rua', numero: '1', bairro: 'Centro', cidade: 'Cidade', uf: 'SP', cep: '00000000' } };
const enable = () => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('lista de imóveis', () => {
  it('mostra carregamento enquanto a consulta inicial está pendente', async () => {
    enable();
    const list = vi.fn().mockImplementation(() => new Promise(() => {}));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ImoveisScreen api={{ list } as any} session={client} />); });
    expect(JSON.stringify(view.toJSON())).toContain('Carregando imóveis');
    expect(JSON.stringify(view.toJSON())).not.toContain('Nenhum imóvel ainda');
    await act(async () => view.unmount());
  });

  it('apresenta o estado vazio e permite iniciar cadastro', async () => {
    enable();
    const api = { list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0 }) };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ImoveisScreen api={api as any} session={client} />); });
    expect(JSON.stringify(view.toJSON())).toContain('Nenhum imóvel ainda');
    const add = view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Cadastrar imóvel')!;
    await act(async () => add.props.onPress());
    expect(JSON.stringify(view.toJSON())).toContain('Campos marcados com');
    await act(async () => view.unmount());
  });

  it('mostra erro e permite nova tentativa, sem afirmar que a lista está vazia', async () => {
    enable();
    const list = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [property], page: 1, total: 1 });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ImoveisScreen api={{ list } as any} session={client} />); });
    expect(JSON.stringify(view.toJSON())).not.toContain('Nenhum imóvel ainda');
    const retry = view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Tentar novamente')!;
    await act(async () => retry.props.onPress());
    expect(JSON.stringify(view.toJSON())).toContain('Casa');
    expect(JSON.stringify(view.toJSON())).toContain('Ativos');
    await act(async () => view.unmount());
  });

  it('informa resposta incompleta ao invés de mostrar vazio', async () => {
    enable();
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ImoveisScreen api={{ list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 2 }) } as any} session={client} />); });
    expect(JSON.stringify(view.toJSON())).toContain('lista de imóveis veio incompleta');
    expect(JSON.stringify(view.toJSON())).not.toContain('Nenhum imóvel ainda');
    await act(async () => view.unmount());
  });

  it('não consulta imóveis sem autorização de cliente', async () => {
    enable();
    const list = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ImoveisScreen api={{ list } as any} session={{ userId: 'p', roles: ['Profissional'] } as any} />); });
    expect(list).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain('perfil Cliente é necessário');
    await act(async () => view.unmount());
  });
});
