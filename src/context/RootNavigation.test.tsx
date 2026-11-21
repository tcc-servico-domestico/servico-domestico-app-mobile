import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { RootNavigation } from '@/src/app/_layout';

const mock = vi.hoisted(() => ({ status: 'anonymous' as 'anonymous' | 'authenticated', roles: [] as string[] }));
vi.mock('@/src/context/AuthContext', async () => {
  const react = await import('react');
  return { AuthProvider: ({ children }: any) => react.createElement(react.Fragment, null, children), useAuth: () => ({ status: mock.status, session: mock.status === 'authenticated' ? { roles: mock.roles } : null }) };
});
vi.mock('@/src/shared/runtime', () => ({ environment: { demoMode: false } }));
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-router', async () => {
  const react = await import('react');
  const Stack = Object.assign(({ children }: any) => react.createElement('stack', null, children), {
    Screen: ({ name }: any) => react.createElement('screen', { name }),
    Protected: ({ guard, children }: any) => react.createElement('protected', { guard }, children),
  });
  return { Stack, SplashScreen: { preventAutoHideAsync: vi.fn(), hideAsync: vi.fn() } };
});
vi.mock('react-native', async () => {
  const react = await import('react');
  return { View: ({ children }: any) => react.createElement('view', null, children), Text: ({ children }: any) => react.createElement('text', null, children), StyleSheet: { create: (x: unknown) => x } };
});
vi.mock('react-native-safe-area-context', async () => {
  const react = await import('react');
  return { SafeAreaView: ({ children }: any) => react.createElement('safe', null, children) };
});
vi.mock('react-native-paper', async () => {
  const react = await import('react');
  return { PaperProvider: ({ children }: any) => react.createElement(react.Fragment, null, children), MD3LightTheme: { colors: {} } };
});

it('protege rotas de conta e perfil conforme sessão e papel', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mock.status = 'anonymous'; mock.roles = [];
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<RootNavigation />); });
  const guards = () => view.root.findAllByType('protected' as React.ElementType).map((node) => node.props.guard);
  expect(guards()).toEqual([false, false, true]);
  mock.status = 'authenticated'; mock.roles = ['Cliente'];
  await act(async () => view.update(<RootNavigation />));
  expect(guards()).toEqual([true, false, false]);
  mock.roles = ['Profissional'];
  await act(async () => view.update(<RootNavigation />));
  expect(guards()).toEqual([true, true, false]);
  await act(async () => view.unmount());
});
