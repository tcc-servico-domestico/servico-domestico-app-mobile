import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import LoginScreen from '@/src/app/(auth)/login';
import { HttpProblemError } from '@/src/shared/contracts/http';

const mocks = vi.hoisted(() => ({ login: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock('@/src/context/TypographyContext', () => ({ usePrototypeFonts: () => false }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { Alert: { alert: vi.fn() }, View: el('view'), Text: el('text'), ScrollView: el('scroll'), TouchableOpacity: el('touchable'), StyleSheet: { create: (s: unknown) => s } };
});
vi.mock('react-native-paper', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { TextInput: Object.assign(el('input'), { Icon: el('icon') }), Button: el('button'), Checkbox: el('checkbox'), HelperText: el('helper') };
});

beforeEach(() => { vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });

it('mostra erros ao tentar entrar sem enviar dados inválidos', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<LoginScreen />); });
  await act(async () => { await view.root.findByType('button').props.onPress(); });
  const errors = view.root.findAllByType('helper' as React.ElementType).map((node) => node.props.children);
  expect(errors).toContain('Informe seu e-mail.');
  expect(errors).toContain('Informe sua senha.');
  expect(mocks.login).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});

it('preserva os dados e orienta após credenciais recusadas', async () => {
  mocks.login.mockRejectedValueOnce(new HttpProblemError({ status: 401, title: 'Não autorizado' }));
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<LoginScreen />); });
  const fields = view.root.findAllByType('input');
  await act(async () => { fields[0].props.onChangeText('cliente@example.invalid'); fields[1].props.onChangeText('senha-teste'); });
  await act(async () => { await view.root.findByType('button').props.onPress(); });
  expect(mocks.login).toHaveBeenCalledWith({ usuario: 'cliente@example.invalid', senha: 'senha-teste' }, false);
  expect(view.root.findAllByType('view' as React.ElementType).filter((node) => node.props.accessibilityRole === 'alert')).toHaveLength(1);
  expect(view.root.findAllByType('text' as React.ElementType).some((node) => String(node.props.children).includes('E-mail ou senha incorretos'))).toBe(true);
  expect(view.root.findAllByType('input')[0].props.value).toBe('cliente@example.invalid');
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});

it('navega após autenticação confirmada e respeita a opção de sessão', async () => {
  mocks.login.mockResolvedValueOnce(undefined);
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<LoginScreen />); });
  const fields = view.root.findAllByType('input');
  await act(async () => { fields[0].props.onChangeText('cliente@example.invalid'); fields[1].props.onChangeText('senha-teste'); });
  await act(async () => view.root.findAllByType('touchable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Continuar conectado')!.props.onPress());
  await act(async () => { await view.root.findByType('button').props.onPress(); });
  expect(mocks.login).toHaveBeenCalledWith({ usuario: 'cliente@example.invalid', senha: 'senha-teste' }, true);
  expect(mocks.replace).toHaveBeenCalledWith('/(tabs)/home');
  await act(async () => view.unmount());
});

it('indica carregamento e impede novo envio enquanto aguarda a resposta', async () => {
  let resolveLogin!: () => void;
  mocks.login.mockReturnValueOnce(new Promise<void>((resolve) => { resolveLogin = resolve; }));
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<LoginScreen />); });
  const fields = view.root.findAllByType('input');
  await act(async () => { fields[0].props.onChangeText('cliente@example.invalid'); fields[1].props.onChangeText('senha-teste'); });
  await act(async () => { void view.root.findByType('button').props.onPress(); });
  const button = view.root.findByType('button');
  expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => { void button.props.onPress(); });
  expect(mocks.login).toHaveBeenCalledOnce();
  await act(async () => resolveLogin());
  await act(async () => view.unmount());
});
