import type { Checklist, ChecklistStatus, Servico, ServicoStatus } from '@/src/features/operations/contracts/servicos';
import type { Oferta, OfertaStatus } from '@/src/features/operations/contracts/ofertas';
import type { OperationsRole } from '@/src/shared/contracts/session';

const hasRole = (roles: readonly OperationsRole[], role: OperationsRole) => roles.includes(role);

export function canCancel(roles: readonly OperationsRole[], status: ServicoStatus): boolean {
  return hasRole(roles, 'Cliente') && ['AguardandoPagamento', 'AguardandoSelecao', 'AguardandoAceite', 'Aceito'].includes(status);
}

export function canChooseProfessional(roles: readonly OperationsRole[], status: ServicoStatus): boolean {
  return hasRole(roles, 'Cliente') && status === 'AguardandoSelecao';
}

export function canStart(roles: readonly OperationsRole[], status: ServicoStatus): boolean {
  return hasRole(roles, 'Profissional') && status === 'Aceito';
}

export function nextChecklistStatus(checklist: Checklist): ChecklistStatus | null {
  if (checklist.status === 'Pendente') return 'EmAndamento';
  if (checklist.status === 'EmAndamento') return 'Concluida';
  return null;
}

export function actionableChecklist(servico: Servico): Checklist | null {
  return [...servico.checklists].sort((a, b) => a.ordem - b.ordem).find((item) => item.status !== 'Concluida') ?? null;
}

export function canComplete(roles: readonly OperationsRole[], servico: Servico): boolean {
  return hasRole(roles, 'Profissional') && servico.status === 'EmExecucao' && servico.checklists.every((item) => item.status === 'Concluida');
}

export function canRespondToOffer(roles: readonly OperationsRole[], oferta: Oferta): boolean {
  return hasRole(roles, 'Profissional') && oferta.status === 'Pendente';
}

export function isTerminal(status: ServicoStatus | OfertaStatus): boolean {
  return ['Concluido', 'Cancelado', 'Expirado', 'Aceita', 'Recusada'].includes(status);
}
