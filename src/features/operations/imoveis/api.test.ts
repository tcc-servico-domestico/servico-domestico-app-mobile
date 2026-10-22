import { describe, expect, it, vi } from 'vitest';

import { createImoveisApi } from './api';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import type { SaveImovelInput } from '@/src/features/operations/contracts/imoveis';

const input: SaveImovelInput = {
  descricao: 'Apartamento', metragemQuadrada: 80, latitude: -15.79, longitude: -47.88,
  endereco: { logradouro: 'Rua A', numero: 10, complemento: null, bairro: 'Centro', cidade: 'Brasília', uf: 'DF', cep: '70000-000' },
};

function client() {
  return {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  } as unknown as OperationsHttpClient;
}

describe('ImoveisApi', () => {
  it('usa somente o contrato público e a chave de idempotência ao criar', async () => {
    const http = client();
    vi.mocked(http.post).mockResolvedValue({ id: 'imovel-1' });

    await createImoveisApi(http).create(input, 'key-1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/imoveis', input, { headers: { 'Idempotency-Key': 'key-1' } });
    expect(JSON.stringify(vi.mocked(http.post).mock.calls[0][1])).not.toContain('PessoaId');
    expect(JSON.stringify(vi.mocked(http.post).mock.calls[0][1])).not.toContain('EnderecoId');
  });

  it('envia a versão pública entre aspas para editar e inativar', async () => {
    const http = client();
    vi.mocked(http.put).mockResolvedValue({ id: 'imovel-1' });
    vi.mocked(http.delete).mockResolvedValue(undefined);
    const api = createImoveisApi(http);

    await api.update('imovel-1', input, 3);
    await api.deactivate('imovel-1', 4);

    expect(http.put).toHaveBeenCalledWith('/api/v1/imoveis/imovel-1', input, { headers: { 'If-Match': '"3"' } });
    expect(http.delete).toHaveBeenCalledWith('/api/v1/imoveis/imovel-1', { headers: { 'If-Match': '"4"' } });
  });

  it('mantém paginação no endpoint v1', async () => {
    const http = client();
    vi.mocked(http.get).mockResolvedValue({ items: [], page: 2, pageSize: 20, total: 40 });

    await createImoveisApi(http).list({ page: 2, pageSize: 20 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/imoveis', { query: { page: 2, pageSize: 20 } });
  });
});
