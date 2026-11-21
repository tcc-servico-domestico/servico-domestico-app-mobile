import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CadastroScreen from '@/src/app/(auth)/cadastro';
import { HttpProblemError } from '@/src/shared/contracts/http';

const mock = vi.hoisted(() => ({ register: vi.fn(), replace: vi.fn(), alert: vi.fn(), dispatch: vi.fn(), prevent: vi.fn() }));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ register: mock.register }) }));
vi.mock('@/src/context/TypographyContext', () => ({ usePrototypeFonts: () => false }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: mock.replace }) }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: mock.dispatch }), usePreventRemove: mock.prevent }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => react.createElement(name, props, children);
  return { Alert: { alert: mock.alert }, ScrollView: element('scroll'), View: element('view'), Text: element('text'), TouchableOpacity: element('touchable'), StyleSheet: { create: (s: unknown) => s } };
});
vi.mock('react-native-paper', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => react.createElement(name, props, children);
  return { TextInput: Object.assign(element('input'), { Icon: element('icon') }), Button: element('button'), HelperText: element('helper') };
});

async function fill(view: ReactTestRenderer) {
  const inputs = view.root.findAllByType('input');
  await act(async () => { inputs[0].props.onChangeText('teste@example.invalid'); inputs[1].props.onChangeText('senha-teste'); });
}

describe('resultado do cadastro', () => {
  beforeEach(() => { vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  it('mostra os erros ao tentar cadastrar sem preencher os campos', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    const errors = view.root.findAllByType('helper' as React.ElementType).map((node) => node.props.children);
    expect(errors).toContain('Informe seu e-mail.');
    expect(errors).toContain('Use pelo menos 8 caracteres.');
    expect(mock.register).not.toHaveBeenCalled();
    await act(async () => view.unmount());
  });
  it('direciona o foco para o primeiro campo inválido', async () => {
    const emailFocus = vi.fn();
    const passwordFocus = vi.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<CadastroScreen />, { createNodeMock: (element) => element.type === 'input'
        ? { focus: (element.props as { accessibilityLabel?: string }).accessibilityLabel === 'E-mail' ? emailFocus : passwordFocus }
        : null });
    });
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    expect(emailFocus).toHaveBeenCalledOnce();
    expect(passwordFocus).not.toHaveBeenCalled();
    await act(async () => view.root.findAllByType('input')[0].props.onChangeText('teste@example.invalid'));
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    expect(passwordFocus).toHaveBeenCalledOnce();
    expect(mock.register).not.toHaveBeenCalled();
    await act(async () => view.unmount());
  });
  it('permite voltar à entrada pelo cabeçalho do cadastro', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    const back = view.root.findAllByType('touchable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Voltar para entrar');
    expect(back).toBeDefined();
    await act(async () => back!.props.onPress());
    expect(mock.replace).toHaveBeenCalledWith('/(auth)/login');
    await act(async () => view.unmount());
  });
  it('avisa antes de descartar os dados de cadastro ao navegar', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    await fill(view);
    const [prevent, onPrevent] = mock.prevent.mock.lastCall!;
    expect(prevent).toBe(true);
    const action = { type: 'GO_BACK' };
    await act(async () => onPrevent({ data: { action } }));
    expect(mock.dispatch).not.toHaveBeenCalled();
    const actions = mock.alert.mock.lastCall![2];
    expect(actions.find((item: any) => item.text === 'Continuar editando').style).toBe('cancel');
    await act(async () => actions.find((item: any) => item.text === 'Sair').onPress());
    expect(mock.dispatch).toHaveBeenCalledWith(action);
    await act(async () => view.unmount());
  });
  it('apresenta confirmação somente após resposta bem-sucedida e permite ir para entrada', async () => {
    mock.register.mockResolvedValue(undefined);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    await fill(view);
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    expect(JSON.stringify(view.toJSON())).toContain('Cadastro recebido');
    expect(view.root.findAllByType('input')).toHaveLength(0);
    await act(async () => { view.root.findByType('button').props.onPress(); });
    expect(mock.replace).toHaveBeenCalledWith('/(auth)/login');
    await act(async () => { view.unmount(); });
  });
  it('mantém a orientação de incerteza quando não há resposta confirmada', async () => {
    mock.register.mockRejectedValue(new Error('sem conexão'));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    await fill(view);
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    expect(view.root.findAllByType('text' as React.ElementType).some((node) => String(node.props.children).includes('Não foi possível confirmar se o cadastro foi recebido'))).toBe(true);
    expect(view.root.findAllByType('input')).toHaveLength(2);
    await act(async () => { view.unmount(); });
  });

  it('mantém a mensagem do serviço junto ao campo em rejeição confirmada', async () => {
    mock.register.mockRejectedValue(new HttpProblemError({ status: 409, title: 'Cadastro recusado', errors: { email: ['Este e-mail já tem uma conta.'] } }));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<CadastroScreen />); });
    await fill(view);
    await act(async () => { await view.root.findByType('button').props.onPress(); });
    expect(view.root.findAllByType('helper' as React.ElementType).some((node) => node.props.children === 'Este e-mail já tem uma conta.')).toBe(true);
    expect(view.root.findAllByType('text' as React.ElementType).some((node) => node.props.children === 'Resultado não confirmado')).toBe(false);
    await act(async () => view.unmount());
  });
});
