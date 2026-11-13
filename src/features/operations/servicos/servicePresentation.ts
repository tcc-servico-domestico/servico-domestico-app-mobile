import type { ImoveisApi } from '@/src/features/operations/contracts/imoveis';

export async function propertyDescription(api: Pick<ImoveisApi, 'get'>, id: string, canView: boolean): Promise<string> {
  if (!canView) return 'Descrição indisponível para este perfil';
  try {
    const property = await api.get(id);
    return property.descricao?.trim() || property.endereco.logradouro || 'Descrição indisponível';
  } catch {
    return 'Descrição indisponível no momento';
  }
}

const serviceStatuses: Record<string, string> = {
  AguardandoPagamento: 'Aguardando pagamento', AguardandoSelecao: 'Aguardando escolha de profissional',
  AguardandoAceite: 'Aguardando resposta do profissional', Aceito: 'Aceito', EmExecucao: 'Em execução',
  Concluido: 'Concluído', Cancelado: 'Cancelado', Expirado: 'Expirado',
};
const checklistStatuses: Record<string, string> = {
  Pendente: 'Pendente', EmAndamento: 'Em andamento', Concluida: 'Concluída',
};

export function serviceStatusLabel(status: string): string {
  return serviceStatuses[status] ?? 'Situação do serviço desconhecida';
}

export function checklistStatusLabel(status: string): string {
  return checklistStatuses[status] ?? 'Situação desconhecida';
}
