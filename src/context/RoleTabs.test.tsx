import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TabsLayout from '../app/(tabs)/_layout';

const mocks = vi.hoisted(() => ({
  session: { userId: 'dual', roles: ['Cliente', 'Profissional'] as string[] },
  alert: vi.fn(), replace: vi.fn(), push: vi.fn(), logout: vi.fn(),
}));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ session: mocks.session, logout: mocks.logout }) }));
vi.mock('expo-router', async () => {
  const react = await import('react');
  const Tabs = Object.assign(({ screenOptions, children }: any) => react.createElement('tabs', null, screenOptions.headerRight(), children), {
    Screen: ({ name, options }: any) => react.createElement('screen', { name, ...options }),
  });
  return { Tabs, useRouter: () => ({ replace: mocks.replace, push: mocks.push }) };
});
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { Alert: { alert: mocks.alert }, Pressable: element('button'), Text: element('text'), View: element('view'), useWindowDimensions: () => ({ fontScale: 1 }) };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('@react-navigation/elements', () => ({ PlatformPressable: () => null }));

describe('alternância de experiência', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.session = { userId: 'dual', roles: ['Cliente', 'Profissional'] };
  });

  it('avisa sobre rascunhos e troca somente após confirmação', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<TabsLayout />); });
    const switcher = () => view.root.findAllByType('button').find((node) => node.props.accessibilityLabel?.includes('Trocar experiência'))!;
    expect(switcher().props.accessibilityLabel).toBe('Experiência Cliente. Trocar experiência');
    await act(async () => switcher().props.onPress());
    const [title, message, actions] = mocks.alert.mock.calls[0];
    expect(title).toBe('Trocar experiência?');
    expect(message).toContain('Rascunhos não enviados');
    expect(actions.find((action: any) => action.text === 'Permanecer').style).toBe('cancel');
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () => actions.find((action: any) => action.text === 'Trocar').onPress());
    expect(mocks.replace).toHaveBeenCalledWith('/(tabs)/servicos');
    expect(switcher().props.accessibilityLabel).toBe('Experiência Profissional. Trocar experiência');
    await act(async () => view.unmount());
  });

  it('não oferece troca para uma conta com apenas um papel', async () => {
    mocks.session = { userId: 'client', roles: ['Cliente'] };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<TabsLayout />); });
    expect(view.root.findAllByType('button').some((node) => node.props.accessibilityLabel?.includes('Trocar experiência'))).toBe(false);
    await act(async () => view.unmount());
  });

  it('apresenta destinos de cliente e oculta os destinos profissionais', async () => {
    mocks.session = { userId: 'client', roles: ['Cliente'] };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<TabsLayout />); });
    const screen = (name: string) => view.root.findAllByType('screen' as React.ElementType).find((item) => item.props.name === name)!;
    expect(screen('home').props.href).toBeUndefined();
    expect(screen('imoveis').props.href).toBeUndefined();
    expect(screen('agenda').props.href).toBeNull();
    expect(screen('profissional-perfil').props.href).toBeNull();
    expect(screen('pagamentos').props.title).toBe('Pagamentos');
    await act(async () => view.unmount());
  });

  it('apresenta destinos profissionais e oculta os destinos de cliente', async () => {
    mocks.session = { userId: 'professional', roles: ['Profissional'] };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<TabsLayout />); });
    const screen = (name: string) => view.root.findAllByType('screen' as React.ElementType).find((item) => item.props.name === name)!;
    expect(screen('home').props.href).toBeNull();
    expect(screen('imoveis').props.href).toBeNull();
    expect(screen('agenda').props.href).toBeUndefined();
    expect(screen('profissional-perfil').props.href).toBeUndefined();
    expect(screen('servicos').props.title).toBe('Ofertas');
    expect(screen('pagamentos').props.title).toBe('Recebimentos');
    await act(async () => view.unmount());
  });

  it('abre a conta dentro da navegação contextual sem adicioná-la como aba', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<TabsLayout />); });
    const account = view.root.findAllByType('screen' as React.ElementType).find((item) => item.props.name === 'conta')!;
    expect(account.props.href).toBeNull();
    await act(async () => view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Minha conta')!.props.onPress());
    expect(mocks.push).toHaveBeenCalledWith('/(tabs)/conta');
    await act(async () => view.unmount());
  });
});
