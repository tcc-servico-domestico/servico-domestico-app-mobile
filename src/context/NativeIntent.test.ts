import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectSystemPath } from '@/src/app/+native-intent';

const mock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/src/shared/runtime', () => ({ sessionStore: { load: mock.load } }));

describe('acesso por link externo', () => {
  beforeEach(() => vi.resetAllMocks());

  it('orienta entrada quando uma rota protegida é aberta sem sessão', async () => {
    mock.load.mockResolvedValue(null);
    expect(await redirectSystemPath({ path: 'exp://127.0.0.1:8082/--/perfil-profissional' })).toBe('/acesso-negado');
    expect(await redirectSystemPath({ path: 'servicodomestico://perfil-profissional' })).toBe('/acesso-negado');
    expect(await redirectSystemPath({ path: '/conta' })).toBe('/acesso-negado');
  });

  it('mantém a rota quando a conta possui o papel necessário', async () => {
    mock.load.mockResolvedValue({ roles: ['Profissional'] });
    expect(await redirectSystemPath({ path: '/perfil-profissional' })).toBe('/perfil-profissional');
    expect(await redirectSystemPath({ path: '/imoveis' })).toBe('/acesso-negado');
  });

  it('não bloqueia links públicos com token e falha de forma segura na leitura da sessão', async () => {
    const link = '/confirmar-email?token=sintetico';
    expect(await redirectSystemPath({ path: link })).toBe(link);
    const customLink = 'servicodomestico://confirmar-email?token=sintetico';
    expect(await redirectSystemPath({ path: customLink })).toBe(customLink);
    expect(mock.load).not.toHaveBeenCalled();
    mock.load.mockRejectedValue(new Error('armazenamento indisponível'));
    expect(await redirectSystemPath({ path: '/perfil' })).toBe('/acesso-negado');
  });
});
