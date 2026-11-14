import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from './ProfileScreen';

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  deleteAccount: vi.fn(),
  requestEmailChange: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ session: { userId: 'user-1' }, logout: mocks.logout }),
}));
vi.mock('@/src/shared/runtime', () => ({ identityApi: mocks }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) =>
    react.createElement(name, props, children);
  return {
    ActivityIndicator: element('activity'), ScrollView: element('scroll'), Text: element('text'),
    TextInput: element('input'), Button: element('button'), StyleSheet: { create: (styles: unknown) => styles },
  };
});

function button(renderer: ReactTestRenderer, title: string) {
  return renderer.root.findAllByType('button').find((node) => node.props.title === title);
}

describe('ProfileScreen — exclusão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.getProfile.mockResolvedValue({ id: 'user-1', email: 'teste@example.invalid', ativo: true, emailVerificado: true });
  });

  it('permite desistir sem enviar exclusão', async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ProfileScreen />); });
    await act(async () => { button(view, 'Excluir conta')!.props.onPress(); });
    expect(button(view, 'Confirmar exclusão')).toBeDefined();
    await act(async () => { button(view, 'Voltar')!.props.onPress(); });
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(button(view, 'Confirmar exclusão')).toBeUndefined();
    await act(async () => { view.unmount(); });
  });

  it('não afirma exclusão após falha e impede nova solicitação automática', async () => {
    mocks.deleteAccount.mockRejectedValue(new Error('conexão interrompida'));
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ProfileScreen />); });
    await act(async () => { button(view, 'Excluir conta')!.props.onPress(); });
    await act(async () => { await button(view, 'Confirmar exclusão')!.props.onPress(); });
    expect(mocks.deleteAccount).toHaveBeenCalledOnce();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(button(view, 'Excluir conta')).toBeUndefined();
    expect(button(view, 'Sair e tentar entrar')).toBeDefined();
    expect(JSON.stringify(view.toJSON())).toContain('uma falha no login não comprova que a conta foi excluída');
    await act(async () => { view.unmount(); });
  });

  it('limpa a sessão somente após exclusão confirmada', async () => {
    mocks.deleteAccount.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<ProfileScreen />); });
    await act(async () => { button(view, 'Excluir conta')!.props.onPress(); });
    await act(async () => { await button(view, 'Confirmar exclusão')!.props.onPress(); });
    expect(mocks.deleteAccount).toHaveBeenCalledWith('user-1');
    expect(mocks.logout).toHaveBeenCalledOnce();
    await act(async () => { view.unmount(); });
  });
});
