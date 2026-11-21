import { HttpProblemError } from '@/src/shared/contracts/http';

type ConfirmationSubject = 'email' | 'email-change';

/** Um token pode ter sido consumido mesmo quando a resposta de rede não chegou. */
export function confirmationFailure(cause: unknown, subject: ConfirmationSubject): { state: 'error' | 'uncertain'; message: string } {
  if (cause instanceof HttpProblemError && ([400, 401, 403, 404, 410, 422].includes(cause.problem.status) ||
    (subject === 'email-change' && cause.problem.status === 409))) {
    return { state: 'error', message: cause.message };
  }
  return {
    state: 'uncertain',
    message: subject === 'email'
      ? 'Não foi possível confirmar se o e-mail foi verificado. Tente entrar ou consulte sua conta antes de solicitar outro link.'
      : 'Não foi possível confirmar se o novo e-mail foi alterado. Consulte sua conta antes de solicitar outro link.',
  };
}
