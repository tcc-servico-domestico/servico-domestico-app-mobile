import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Agenda from '@/src/app/(tabs)/agenda';

const mocks = vi.hoisted(() => ({
  focusRevision: 0, list: vi.fn(), push: vi.fn(),
  session: { userId: 'prof-1', roles: ['Profissional'] },
}));
vi.mock('@/src/context/AuthContext', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('@/src/context/ExperienceContext', () => ({ useExperience: () => ({ role: 'Profissional' }) }));
vi.mock('@/src/shared/runtime', () => ({ servicosApi: { list: mocks.list } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: () => null }));
vi.mock('@react-navigation/native', async () => {
  const react = await import('react');
  return { useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback, mocks.focusRevision]) };
});
vi.mock('react-native', async () => {
  const react = await import('react');
  const el = (name: string) => ({ children, ...props }: any) => react.createElement(name, props, children);
  return { ActivityIndicator: el('activity'), Button: el('button'), Pressable: el('pressable'), ScrollView: el('scroll'), Text: el('text'), View: el('view'), StyleSheet: { create: (value: unknown) => value } };
});

describe('agenda profissional', () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.focusRevision = 0; });
  it('atualiza ao retornar e mostra apenas atendimentos do profissional', async () => {
    const own = { id: 's1', profissionalId: 'prof-1', status: 'Aceito', inicioPrevisto: '2030-01-21T14:00:00Z', valor: 80 };
    const other = { ...own, id: 's2', profissionalId: 'outro', valor: 99 };
    mocks.list.mockResolvedValueOnce({ items: [], page: 1, total: 0 }).mockResolvedValue({ items: [own, other], page: 1, total: 2 });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<Agenda />); });
    expect(JSON.stringify(view.toJSON())).toContain('Nenhum serviço agendado');
    mocks.focusRevision++;
    await act(async () => view.update(<Agenda />));
    const output = JSON.stringify(view.toJSON());
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(output).toContain('80,00');
    expect(output).not.toContain('99,00');
    expect(output).not.toContain('Nenhum serviço agendado');
    const detail = view.root.findAllByType('pressable' as React.ElementType).find((node) => node.props.accessibilityLabel === 'Ver atendimento')!;
    await act(async () => detail.props.onPress());
    expect(mocks.push).toHaveBeenCalledWith({ pathname: '/(tabs)/servicos', params: { agenda: 's1' } });
    await act(async () => view.unmount());
  });
});


it('prioriza atendimento em execução e separa próximos de concluídos', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); mocks.focusRevision = 0;
  const base = { profissionalId: 'prof-1', valor: 80 };
  const accepted = { ...base, id: 'aceito', status: 'Aceito', inicioPrevisto: '2030-01-21T14:00:00Z' };
  const running = { ...base, id: 'execucao', status: 'EmExecucao', inicioPrevisto: '2030-01-22T14:00:00Z' };
  const completed = { ...base, id: 'concluido', status: 'Concluido', inicioPrevisto: '2030-01-19T14:00:00Z' };
  mocks.list.mockResolvedValue({ items: [accepted, completed, running], page: 1, total: 3 });
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<Agenda />); });
  const output = JSON.stringify(view.toJSON());
  expect(output.indexOf('Próximo serviço')).toBeLessThan(output.indexOf('Em execução'));
  expect(output.indexOf('Em execução')).toBeLessThan(output.indexOf('Depois'));
  expect(output.indexOf('Depois')).toBeLessThan(output.indexOf('Concluídos'));
  await act(async () => view.unmount());
});


it('não apresenta agenda parcial quando páginas repetem atendimento', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); mocks.focusRevision = 0;
  const item = { id: 'repetido', profissionalId: 'prof-1', status: 'Aceito', inicioPrevisto: '2030-01-21T14:00:00Z', valor: 80 };
  mocks.list.mockImplementation(async ({ page }: { page: number }) => ({ items: [item], page, total: 2 }));
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<Agenda />); });
  const output = JSON.stringify(view.toJSON());
  expect(output).toContain('Não foi possível carregar sua agenda');
  expect(output).not.toContain('80,00');
  await act(async () => view.unmount());
});
