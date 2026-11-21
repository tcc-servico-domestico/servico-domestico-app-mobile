import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfilProfissionalScreen } from './PerfilProfissionalScreen';

vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => react.createElement(name, props, children);
  return { ActivityIndicator: element('activity'), Pressable: element('button'), ScrollView: element('scroll'), StyleSheet: { create: (styles: unknown) => styles }, Text: element('text'), TextInput: element('input'), View: element('view') };
});

describe('resumo do perfil profissional', () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  it('exibe dados salvos e reputação agregada antes de abrir edição', async () => {
    const api = { obter: vi.fn().mockResolvedValue({ aggregateVersion: 1, habilidades: ['Limpeza'], areas: [{ latitude: -15, longitude: -47 }], disponibilidades: [] }), salvar: vi.fn(), verificar: vi.fn() };
    const avaliacoesApi = { resumir: vi.fn().mockResolvedValue({ avaliacaoMedia: 4.5, quantidadeAvaliacoes: 2 }) };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PerfilProfissionalScreen api={api} avaliacoesApi={avaliacoesApi} />); });
    expect(JSON.stringify(view.toJSON())).toContain('Limpeza');
    expect(JSON.stringify(view.toJSON())).toContain('2 avaliações');
    expect(view.root.findAllByType('input')).toHaveLength(0);
    await act(async () => { view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Editar perfil profissional')!.props.onPress(); });
    expect(view.root.findAllByType('input').length).toBeGreaterThan(0);
    await act(async () => { view.root.findAllByType('input')[0].props.onChangeText('Rascunho'); });
    await act(async () => { view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Voltar ao resumo')!.props.onPress(); });
    expect(JSON.stringify(view.toJSON())).toContain('Limpeza');
    await act(async () => { view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Editar perfil profissional')!.props.onPress(); });
    expect(view.root.findAllByType('input')[0].props.value).toBe('Rascunho');
    expect(api.salvar).not.toHaveBeenCalled();
    await act(async () => { view.unmount(); });
  });
  it('mostra o perfil remoto após conflito sem descartar o rascunho', async () => {
    const initial = { aggregateVersion: 1, habilidades: ['Original'], areas: [{ latitude: -15, longitude: -47 }], disponibilidades: [] };
    const remote = { ...initial, aggregateVersion: 2, habilidades: ['Remoto'] };
    const api = { obter: vi.fn().mockResolvedValue(initial), salvar: vi.fn().mockResolvedValue({ estado: 'divergente', perfil: remote }), verificar: vi.fn() };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PerfilProfissionalScreen api={api} />); });
    const button = (title: string) => view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === title)!;
    await act(async () => { button('Editar perfil profissional').props.onPress(); });
    await act(async () => { view.root.findAllByType('input')[0].props.onChangeText('Rascunho'); });
    await act(async () => { button('Salvar perfil profissional').props.onPress(); });
    await act(async () => { button('Manter rascunho e revisar').props.onPress(); });
    await act(async () => { button('Voltar ao resumo').props.onPress(); });
    expect(JSON.stringify(view.toJSON())).toContain('Remoto');
    await act(async () => { button('Editar perfil profissional').props.onPress(); });
    expect(view.root.findAllByType('input')[0].props.value).toBe('Rascunho');
    await act(async () => { view.unmount(); });
  });
  it('não inventa reputação quando a consulta falha', async () => {
    const api = { obter: vi.fn().mockResolvedValue(null), salvar: vi.fn(), verificar: vi.fn() };
    const avaliacoesApi = { resumir: vi.fn().mockRejectedValueOnce(new Error('indisponível')).mockResolvedValueOnce({ avaliacaoMedia: 5, quantidadeAvaliacoes: 1 }) };
    let view!: ReactTestRenderer;
    await act(async () => { view = create(<PerfilProfissionalScreen api={api} avaliacoesApi={avaliacoesApi} />); });
    expect(JSON.stringify(view.toJSON())).toContain('Não foi possível consultar sua reputação');
    expect(view.root.findAllByType('button').some((node) => node.props.accessibilityLabel === 'Começar cadastro')).toBe(true);
    await act(async () => { view.root.findAllByType('button').find((node) => node.props.accessibilityLabel === 'Tentar consultar reputação')!.props.onPress(); });
    expect(JSON.stringify(view.toJSON())).toContain('1 avaliação');
    await act(async () => { view.unmount(); });
  });
});
