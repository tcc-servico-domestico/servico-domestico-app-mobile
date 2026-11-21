import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmEmailScreen from '@/src/app/confirmar-email';
import ConfirmarAlteracaoEmail from '@/src/app/confirmar-alteracao-email';
import { HttpProblemError } from '@/src/shared/contracts/http';

const mocks = vi.hoisted(() => ({
  token: undefined as string | undefined,
  confirmEmail: vi.fn<(token: string) => Promise<void>>(),
  confirmChange: vi.fn<(token: string) => Promise<void>>(),
  replace: vi.fn(),
  status: 'anonymous' as 'anonymous' | 'authenticated',
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ token: mocks.token }), useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ status: mocks.status, confirmEmail: mocks.confirmEmail }) }));
vi.mock('@/src/shared/runtime', () => ({ environment: { demoMode: false }, identityApi: { confirmEmailChange: mocks.confirmChange } }));
vi.mock('react-native-safe-area-context', async () => {
  const react = await import('react');
  return { SafeAreaView: ({ children }: any) => react.createElement('safe-area', null, children) };
});
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { ActivityIndicator: el('activity'), Pressable: el('button'), ScrollView: el('scroll'), Text: el('text'), View: el('view'), StyleSheet: { create: (styles: unknown) => styles } };
});
vi.mock('react-native-paper', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { ActivityIndicator: el('activity'), Button: el('button'), Text: el('text') };
});

function deferred() {
  let resolve!: () => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

describe('links de confirmação', () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.token = undefined; mocks.status = 'anonymous'; });
  it('exibe carregamento até a resposta e direciona uma sessão ativa ao início', async () => {
    const request = deferred(); mocks.token = 'sintetico'; mocks.status = 'authenticated'; mocks.confirmEmail.mockReturnValue(request.promise);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmEmailScreen />); });
    expect(view.root.findAllByType('activity' as React.ElementType)).toHaveLength(1);
    expect(view.root.findAllByType('button' as React.ElementType)).toHaveLength(0);
    await act(async () => request.resolve());
    const action = view.root.findByType('button' as React.ElementType);
    expect(action.props.accessibilityLabel).toBe('Ir para início');
    await act(async () => action.props.onPress());
    expect(mocks.replace).toHaveBeenCalledWith('/(tabs)/home');
    await act(async () => view.unmount());
  });
  it('não envia confirmação com link incompleto', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmEmailScreen />); });
    expect(mocks.confirmEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain('link de confirmação está incompleto');
    expect(JSON.stringify(view.toJSON())).toContain('Link incompleto');
    await act(async () => view.unmount());
  });
  it('ignora resultado do link anterior quando um novo chega', async () => {
    const first = deferred(); const second = deferred();
    mocks.confirmEmail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mocks.token = 'primeiro';
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmEmailScreen />); });
    mocks.token = 'segundo';
    await act(async () => view.update(<ConfirmEmailScreen />));
    await act(async () => { second.reject(new Error('rede')); });
    expect(JSON.stringify(view.toJSON())).toContain('Não foi possível confirmar');
    await act(async () => { first.resolve(); });
    expect(JSON.stringify(view.toJSON())).not.toContain('E-mail confirmado');
    expect(mocks.confirmEmail).toHaveBeenCalledTimes(2);
    await act(async () => view.unmount());
  });
  it('não reaplica o mesmo token ao remontar o efeito', async () => {
    const request = deferred(); mocks.confirmEmail.mockReturnValue(request.promise); mocks.token = 'unico';
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<React.StrictMode><ConfirmEmailScreen /></React.StrictMode>); });
    expect(mocks.confirmEmail).toHaveBeenCalledOnce();
    await act(async () => request.resolve());
    expect(JSON.stringify(view.toJSON())).toContain('E-mail confirmado');
    await act(async () => view.unmount());
  });
  it('ignora resposta antiga na confirmação de alteração de e-mail', async () => {
    const first = deferred(); const second = deferred();
    mocks.confirmChange.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mocks.token = 'antigo';
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmarAlteracaoEmail />); });
    mocks.token = 'novo';
    await act(async () => view.update(<ConfirmarAlteracaoEmail />));
    await act(async () => second.reject(new Error('rede')));
    await act(async () => first.resolve());
    expect(JSON.stringify(view.toJSON())).toContain('Não foi possível confirmar se o novo e-mail foi alterado');
    expect(JSON.stringify(view.toJSON())).not.toContain('Novo e-mail confirmado');
    await act(async () => view.unmount());
  });
  it('diferencia link inválido de resultado incerto de rede', async () => {
    mocks.token = 'invalido';
    mocks.confirmEmail.mockRejectedValueOnce(new HttpProblemError({ status: 400, title: 'Link inválido' }));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmEmailScreen />); });
    expect(JSON.stringify(view.toJSON())).toContain('Link inválido');
    expect(JSON.stringify(view.toJSON())).not.toContain('se o e-mail foi verificado');
    await act(async () => view.unmount());
    mocks.token = 'incerto'; mocks.confirmEmail.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { view = create(<ConfirmEmailScreen />); });
    expect(JSON.stringify(view.toJSON())).toContain('Não foi possível confirmar se o e-mail foi verificado');
    expect(JSON.stringify(view.toJSON())).toContain('Resultado não confirmado');
    await act(async () => view.unmount());
  });
  it('não reaplica token de alteração na remontagem de efeito', async () => {
    const request = deferred(); mocks.confirmChange.mockReturnValue(request.promise); mocks.token = 'unico';
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<React.StrictMode><ConfirmarAlteracaoEmail /></React.StrictMode>); });
    expect(mocks.confirmChange).toHaveBeenCalledOnce();
    await act(async () => request.resolve());
    expect(JSON.stringify(view.toJSON())).toContain('Novo e-mail confirmado');
    await act(async () => view.unmount());
  });

  it('apresenta conflito confirmado na troca de e-mail', async () => {
    mocks.token = 'conflito';
    mocks.confirmChange.mockRejectedValueOnce(new HttpProblemError({ status: 409, title: 'E-mail já cadastrado' }));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmarAlteracaoEmail />); });
    expect(JSON.stringify(view.toJSON())).toContain('E-mail já cadastrado');
    expect(JSON.stringify(view.toJSON())).not.toContain('se o novo e-mail foi alterado');
    await act(async () => view.unmount());
  });

  it('não afirma falha definitiva quando o servidor de troca está indisponível', async () => {
    mocks.token = 'sintetico';
    mocks.confirmChange.mockRejectedValueOnce(new HttpProblemError({ status: 503, title: 'Indisponível' }));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ConfirmarAlteracaoEmail />); });
    const text = JSON.stringify(view.toJSON());
    expect(text).toContain('Resultado não confirmado');
    expect(text).not.toContain('Novo e-mail confirmado');
    expect(mocks.confirmChange).toHaveBeenCalledOnce();
    await act(async () => view.unmount());
  });

});
