import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PagamentosScreen } from './PagamentosScreen';

vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));

const tracking = vi.hoisted(() => ({ load: vi.fn(), removePixCode: vi.fn() }));
vi.mock('./paymentTrackingStore', () => ({ paymentTrackingStore: tracking }));
vi.mock('@react-navigation/native', async () => {
  const react = await import('react');
  return { useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]) };
});
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => react.createElement(name, props, children);
  return {
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    Button: element('button'), Pressable: element('pressable'), RefreshControl: element('refresh'),
    ScrollView: element('scroll'), Text: element('text'), View: element('view'),
    FlatList: ({ ListHeaderComponent }: { ListHeaderComponent?: React.ReactNode }) => <>{ListHeaderComponent}</>,
    StyleSheet: { create: (value: unknown) => value }, useWindowDimensions: () => ({ fontScale: 1 }),
  };
});
vi.mock('./PixChargeCard', () => ({ PixChargeCard: () => null }));

describe('pagamentos no contexto profissional', () => {
  it('não carrega nem seleciona automaticamente cobranças Pix guardadas no contexto de cliente', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    tracking.load.mockClear();
    const api = { list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 }), get: vi.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PagamentosScreen api={api} session={{ status: 'authenticated', userId: 'u', roles: ['Cliente', 'Profissional'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' }} showTrackedPix={false} />); });
    expect(api.list).toHaveBeenCalled();
    expect(tracking.load).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    await act(async () => view.unmount());
  });
});


it('retorna do detalhe sem alterar ou recriar o pagamento', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  tracking.load.mockResolvedValue([]);
  const payment = { id: 'p', valor: 80, status: 'Confirmado', transacoes: [] };
  const api = { list: vi.fn().mockResolvedValue({ items: [payment], page: 1, pageSize: 100, total: 1 }), get: vi.fn().mockResolvedValue(payment) };
  const onRouteSelectionChange = vi.fn();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<PagamentosScreen api={api as any} session={{ status: 'authenticated', userId: 'u', roles: ['Cliente'], accessToken: 'test', expiresAt: '2099-01-01T00:00:00Z' }} initialPagamentoId="p" onRouteSelectionChange={onRouteSelectionChange} />); });
  expect(api.get).toHaveBeenCalledWith('p');
  const back = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Voltar aos pagamentos')!;
  expect(back.props.accessibilityRole).toBe('button');
  await act(async () => back.props.onPress());
  expect(onRouteSelectionChange).toHaveBeenCalledWith(undefined);
  expect(JSON.stringify(view.toJSON())).toContain('Pagamentos');
  await act(async () => view.unmount());
});
