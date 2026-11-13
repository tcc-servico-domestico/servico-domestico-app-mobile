import { HttpProblemError } from '@/src/shared/contracts/http';

export function operationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpProblemError) {
    if (error.problem.status === 0) return 'Não foi possível conectar. Verifique sua conexão.';
    if (error.problem.status === 401) return 'Sua sessão não foi autorizada. Entre novamente para continuar.';
    if (error.problem.status === 403) return 'Seu perfil não tem permissão para realizar esta ação.';
    return error.problem.detail ?? error.problem.title;
  }
  return error instanceof Error ? error.message : fallback;
}
