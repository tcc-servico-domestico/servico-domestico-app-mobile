import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createFetchHttpClient } from '@/src/shared/http/fetchHttpClient';
import { createPerfilProfissionalApi } from './api';

const url = 'https://core.example.test/api/v1/profissionais/me';
const server = setupServer();
const api = createPerfilProfissionalApi(createFetchHttpClient({
  baseUrl: 'https://core.example.test', getAccessToken: async () => 'profissional-teste',
}));
const dados = {
  habilidades: ['Limpeza'],
  areas: [{ latitude: -15.78, longitude: -47.92 }],
  disponibilidades: [{ dia: '2026-11-20', horaInicio: '10:00:00', horaFim: '14:00:00' }],
};
const perfil = { ...dados, aggregateVersion: 1 };
const ausente = () => HttpResponse.json({ code: 'perfil_profissional_nao_encontrado' }, { status: 404 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('perfil profissional', () => {
  it('distingue a ausência de perfil de falta de vínculo e de uma rota inexistente', async () => {
    server.use(http.get(url, ausente));
    await expect(api.obter()).resolves.toBeNull();
    server.use(http.get(url, () => HttpResponse.json({ code: 'core_identity_not_found' }, { status: 403 })));
    await expect(api.obter()).rejects.toMatchObject({ problem: { status: 403, code: 'core_identity_not_found' } });
    server.use(http.get(url, () => new HttpResponse(null, { status: 404 })));
    await expect(api.obter()).rejects.toMatchObject({ problem: { status: 404 } });
  });

  it('trata uma resposta bem-sucedida sem representação como falha de consulta', async () => {
    server.use(http.get(url, () => new HttpResponse(null, { status: 204 })));
    await expect(api.obter()).rejects.toThrow('resposta de perfil inválida');
  });

  it('usa a sessão e as pré-condições de criação e edição', async () => {
    server.use(http.put(url, async ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer profissional-teste');
      expect(await request.json()).toEqual(dados);
      const editando = request.headers.has('if-match');
      if (editando) {
        expect(request.headers.get('if-match')).toBe('"1"');
        expect(request.headers.has('if-none-match')).toBe(false);
      } else {
        expect(request.headers.get('if-none-match')).toBe('*');
      }
      return HttpResponse.json({ ...perfil, aggregateVersion: editando ? 2 : 1 }, { status: editando ? 200 : 201 });
    }));
    await expect(api.salvar(dados, null)).resolves.toMatchObject({ estado: 'salvo', perfil });
    await expect(api.salvar(dados, 1)).resolves.toMatchObject({ estado: 'salvo', perfil: { aggregateVersion: 2 } });
  });

  it('confirma cadastro com resposta perdida somente se a releitura coincidir', async () => {
    let gravado = false;
    let envios = 0;
    server.use(
      http.put(url, () => {
        gravado = true;
        envios++;
        return HttpResponse.error();
      }),
      http.get(url, () => gravado ? HttpResponse.json(perfil) : ausente()),
    );
    await expect(api.salvar(dados, null)).resolves.toEqual({ estado: 'salvo', perfil });
    expect(envios).toBe(1);
  });

  it('oferece recuperação sem confirmar cadastro quando a gravação ou releitura falham', async () => {
    server.use(http.put(url, () => HttpResponse.error()), http.get(url, ausente));
    await expect(api.salvar(dados, null)).resolves.toEqual({ estado: 'ausente' });
    server.use(http.get(url, () => HttpResponse.error()));
    await expect(api.salvar(dados, null)).resolves.toEqual({ estado: 'incerto' });
  });

  it('preserva o estado concorrente para revisão e compara faixas normalizadas', async () => {
    server.use(
      http.put(url, () => HttpResponse.json({ code: 'precondition_failed' }, { status: 412 })),
      http.get(url, () => HttpResponse.json({ ...perfil, habilidades: ['Outra'], aggregateVersion: 2 })),
    );
    await expect(api.salvar(dados, 1)).resolves.toMatchObject({ estado: 'divergente', perfil: { aggregateVersion: 2 } });
    server.use(http.get(url, () => HttpResponse.json({
      ...perfil, aggregateVersion: 2,
      disponibilidades: [{ ...dados.disponibilidades[0], horaInicio: '10:00:00.000000' }],
    })));
    await expect(api.salvar(dados, 1)).resolves.toMatchObject({ estado: 'salvo', perfil: { aggregateVersion: 2 } });
  });
});
