import type { OperationsSession } from '@/src/shared/contracts/session';

export interface LoginInput {
  readonly usuario: string;
  readonly senha: string;
}

export interface RegisterInput {
  readonly email: string;
  readonly senha: string;
}

export interface IdentityApi {
  login(input: LoginInput): Promise<OperationsSession>;
  register(input: RegisterInput): Promise<void>;
  confirmEmail(token: string): Promise<void>;
}
