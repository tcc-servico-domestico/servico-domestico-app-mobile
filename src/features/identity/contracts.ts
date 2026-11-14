import type { OperationsSession } from '@/src/shared/contracts/session';

export interface LoginInput {
  readonly usuario: string;
  readonly senha: string;
}

export interface RegisterInput {
  readonly email: string;
  readonly senha: string;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly ativo: boolean;
  readonly emailVerificado: boolean;
  readonly emailPendente?: string | null;
}

export interface IdentityApi {
  login(input: LoginInput): Promise<OperationsSession>;
  register(input: RegisterInput): Promise<void>;
  confirmEmail(token: string): Promise<void>;
  getProfile(userId: string): Promise<UserProfile>;
  requestEmailChange(userId: string, email: string): Promise<void>;
  confirmEmailChange(token: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}
