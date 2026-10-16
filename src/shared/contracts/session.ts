export type OperationsRole = 'Cliente' | 'Profissional';

export interface OperationsSession {
  readonly status: 'authenticated';
  readonly userId: string;
  readonly roles: readonly OperationsRole[];
}
