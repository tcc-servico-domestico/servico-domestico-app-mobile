import { describe, expect, it, vi } from 'vitest';
import type { Imovel } from '@/src/features/operations/contracts/imoveis';
import { checklistStatusLabel, propertyDescription, serviceStatusLabel } from './servicePresentation';

describe('apresentação de serviços', () => {
  it('traduz estados e identifica valores desconhecidos', () => {
    expect(serviceStatusLabel('AguardandoSelecao')).toBe('Aguardando escolha de profissional');
    expect(serviceStatusLabel('EmExecucao')).toBe('Em execução');
    expect(serviceStatusLabel('Outro')).toBe('Situação do serviço desconhecida');
    expect(checklistStatusLabel('EmAndamento')).toBe('Em andamento');
    expect(checklistStatusLabel('Outro')).toBe('Situação desconhecida');
  });

  it('não consulta imóvel para perfil sem acesso e informa falhas sem expor identificador', async () => {
    const get = vi.fn().mockRejectedValue(new Error('indisponível'));
    expect(await propertyDescription({ get }, 'id-interno', false)).toBe('Descrição indisponível para este perfil');
    expect(get).not.toHaveBeenCalled();
    expect(await propertyDescription({ get }, 'id-interno', true)).toBe('Descrição indisponível no momento');
    expect(get).toHaveBeenCalledOnce();
  });

  it('apresenta descrição ou logradouro recebido para o perfil autorizado', async () => {
    const property = { descricao: '  Casa de teste  ', endereco: { logradouro: 'Rua de teste' } } as Imovel;
    const get = vi.fn().mockResolvedValueOnce(property).mockResolvedValueOnce({ ...property, descricao: '  ' });
    expect(await propertyDescription({ get }, 'id', true)).toBe('Casa de teste');
    expect(await propertyDescription({ get }, 'id', true)).toBe('Rua de teste');
  });
});
