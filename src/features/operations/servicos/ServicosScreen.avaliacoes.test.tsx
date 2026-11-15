import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImoveisApi } from '../contracts/imoveis';
import type { OfertasApi } from '../contracts/ofertas';
import type { Servico, ServicosApi } from '../contracts/servicos';
import { HttpProblemError, type OperationsHttpClient } from '@/src/shared/contracts/http';
import type { OperationsRole } from '@/src/shared/contracts/session';
import { createAvaliacoesApi } from '../avaliacoes/api';
import { ServicosScreen } from './ServicosScreen';

vi.mock('expo-router', () => ({ useRouter: () => ({}) }));
vi.mock('../idempotency', () => ({ createIdempotencyKey: vi.fn() }));
vi.mock('../pagamentos/paymentTrackingStore', () => ({ paymentTrackingStore: {} }));
vi.mock('react-native', async () => {
  const react = await import('react');
  const element = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) =>
    react.createElement(name, props, children);
  return {
    ActivityIndicator: element('activity'), Button: element('button'), ScrollView: element('scroll'),
    Text: element('text'), TextInput: element('input'), View: element('view'),
    Pressable: element('pressable'), RefreshControl: element('refresh'),
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
    FlatList: ({ data, renderItem, ListHeaderComponent }: {
      data: readonly unknown[];
      renderItem: (props: { item: unknown }) => React.ReactNode;
      ListHeaderComponent?: React.ReactNode;
    }) => <>{ListHeaderComponent}{data.map((item, index) =>
      <React.Fragment key={index}>{renderItem({ item })}</React.Fragment>)}</>,
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

const servico: Servico = {
  id: 'servico-1', imovelId: 'imovel', profissionalId: 'profissional-1', status: 'Concluido',
  raioBuscaKm: 10, inicioPrevisto: '2026-11-14T12:00:00Z', fimPrevisto: '2026-11-14T14:00:00Z',
  ofertaExpiraEmUtc: null, versaoOferta: 1, valor: 100, moeda: 'BRL', checklists: [], aggregateVersion: 6,
};
const registrada = { nota: 5, comentario: 'Atendimento ótimo' };
const pagina = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

describe('Serviços — UC11 e UC12', () => {
  let view: ReactTestRenderer;
  const get = vi.fn();
  const post = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterEach(async () => { await act(async () => { view.unmount(); }); });

  async function abrir(role: OperationsRole, atendimento = servico, roles: OperationsRole[] = [role]) {
    const http = { get, post } as unknown as OperationsHttpClient;
    const servicosApi = {
      get: async () => atendimento,
      list: async () => pagina([atendimento]),
      listCompatibleProfessionals: async () => pagina([{
        profissionalId: 'profissional-1', nomeExibicao: 'Profissional', distanciaKm: 4,
        avaliacaoMedia: 5, quantidadeAvaliacoes: 1, posicaoRanking: 1,
      }]),
    } as unknown as ServicosApi;
    const ofertasApi = { list: async () => pagina([]) } as unknown as OfertasApi;
    await act(async () => {
      view = create(<ServicosScreen servicosApi={servicosApi} ofertasApi={ofertasApi} imoveisApi={{} as ImoveisApi}
        avaliacoesApi={createAvaliacoesApi(http)} session={{
          status: 'authenticated', userId: role === 'Cliente' ? 'cliente-1' : 'profissional-1',
          roles, accessToken: 'test', expiresAt: '2026-11-15T00:00:00Z',
        }} />);
    });
  }

  const button = (title: string) => view.root.findAllByType('button').find((node) => node.props.title === title);
  const input = (label: string) => view.root.findAllByType('input').find((node) => node.props.accessibilityLabel === label)!;
  const texto = () => JSON.stringify(view.toJSON());
  const tocar = async (title: string) => { await act(async () => { await button(title)!.props.onPress(); }); };
  const abrirDetalhe = async () => { await act(async () => { await view.root.find((node) => String(node.type) === 'pressable').props.onPress(); }); };

  it('reconsulta o atendimento se a resposta do registro for perdida e mostra a avaliação salva', async () => {
    get.mockResolvedValueOnce({ avaliacao: null }).mockResolvedValueOnce({ avaliacao: registrada });
    post.mockRejectedValueOnce(new Error('conexão interrompida'));
    await abrir('Cliente');
    await abrirDetalhe();
    expect(button('Enviar avaliação')?.props.disabled).toBe(true);
    await act(async () => {
      input('Nota de 1 a 5').props.onChangeText('5');
      input('Comentário').props.onChangeText('  Atendimento ótimo  ');
    });
    await tocar('Enviar avaliação');
    expect(post).toHaveBeenCalledExactlyOnceWith('/api/v1/servicos/servico-1/avaliacao', registrada);
    expect(texto()).not.toContain('Avaliação registrada');
    await tocar('Verificar avaliação');
    expect(texto()).toContain('Avaliação registrada');
    expect(texto()).toContain(registrada.comentario);
    expect(button('Enviar avaliação')).toBeUndefined();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('não oferece autoavaliação a uma conta com os dois papéis', async () => {
    await abrir('Profissional', servico, ['Cliente', 'Profissional']);
    await abrirDetalhe();
    expect(texto()).not.toContain('Avalie o atendimento');
    expect(button('Enviar avaliação')).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it('abre as avaliações de um candidato sem selecionar o profissional', async () => {
    get.mockResolvedValue(pagina([registrada]));
    await abrir('Cliente', { ...servico, status: 'AguardandoSelecao', profissionalId: null });
    await abrirDetalhe();
    expect(button('Enviar avaliação')).toBeUndefined();
    await tocar('Escolher profissional');
    await tocar('Ver avaliações');
    expect(texto()).toContain(registrada.comentario);
    expect(get).toHaveBeenCalledExactlyOnceWith('/api/v1/profissionais/profissional-1/avaliacoes', {
      query: { page: 1, pageSize: 20 }, signal: expect.any(AbortSignal),
    });
    expect(post).not.toHaveBeenCalled();
    await tocar('Voltar');
    expect(button('Selecionar')).toBeDefined();
  });

  it('distingue lista vazia autorizada ao consultar pelo detalhe concluído', async () => {
    get.mockResolvedValueOnce({ avaliacao: registrada }).mockResolvedValueOnce(pagina([]));
    await abrir('Cliente');
    await abrirDetalhe();
    await tocar('Consultar avaliações do profissional');
    expect(get).toHaveBeenLastCalledWith('/api/v1/profissionais/profissional-1/avaliacoes', {
      query: { page: 1, pageSize: 20 }, signal: expect.any(AbortSignal),
    });
    expect(texto()).toContain('Ainda não há avaliações.');
  });

  it('descarta as avaliações se a próxima página for recusada', async () => {
    get.mockResolvedValueOnce({ ...pagina([registrada]), total: 21 }).mockRejectedValueOnce(
      new HttpProblemError({ status: 404, title: 'Avaliações indisponíveis', code: 'avaliacoes_nao_encontradas' }),
    );
    await abrir('Cliente', { ...servico, status: 'AguardandoSelecao', profissionalId: null });
    await abrirDetalhe();
    await tocar('Escolher profissional');
    await tocar('Ver avaliações');
    expect(texto()).toContain(registrada.comentario);
    await tocar('Próxima página');
    expect(texto()).not.toContain(registrada.comentario);
    expect(texto()).toContain('As avaliações deste profissional estão indisponíveis.');
    expect(button('Tentar novamente')).toBeUndefined();
    expect(button('Voltar')).toBeDefined();
  });

  it('mostra só os dados agregados ao profissional e não oferece envio', async () => {
    get.mockResolvedValue({ avaliacaoMedia: 4.5, quantidadeAvaliacoes: 2, comentario: 'Não exibir' });
    await abrir('Profissional');
    await abrirDetalhe();
    expect(button('Enviar avaliação')).toBeUndefined();
    await tocar('Voltar');
    await tocar('Minhas avaliações');
    expect(get).toHaveBeenCalledExactlyOnceWith('/api/v1/profissionais/me/avaliacoes', { signal: expect.any(AbortSignal) });
    expect(texto()).toContain('Média: ');
    expect(texto()).toContain('Quantidade de avaliações: ');
    expect(texto()).not.toContain('Não exibir');
  });
});
