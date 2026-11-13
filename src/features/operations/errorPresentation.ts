import { HttpProblemError } from '@/src/shared/contracts/http';

export function operationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpProblemError) {
    if (error.problem.status === 0) return 'Não foi possível conectar. Verifique sua conexão.';
    return error.problem.detail ?? error.problem.title;
  }
  return error instanceof Error ? error.message : fallback;
}
