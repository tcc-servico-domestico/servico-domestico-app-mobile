import type { IdentityApi, LoginInput, RegisterInput } from '@/src/features/identity/contracts';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import type { OperationsRole, OperationsSession } from '@/src/shared/contracts/session';

interface LoginResponse {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const encoded = token.split('.')[1];
  if (!encoded) throw new Error('Token de acesso inválido.');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(globalThis.atob(normalized)) as Record<string, unknown>;
}

function stringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function createIdentityApi(http: OperationsHttpClient, now = () => Date.now()): IdentityApi {
  return {
    async login(input: LoginInput): Promise<OperationsSession> {
      const response = await http.post<LoginResponse>('/Autenticacao/login', input);
      const claims = decodeJwtPayload(response.accessToken);
      const roles = stringArray(claims.role).filter(
        (role): role is OperationsRole => role === 'Cliente' || role === 'Profissional',
      );
      const expiresAt = typeof claims.exp === 'number'
        ? new Date(claims.exp * 1000).toISOString()
        : new Date(now() + response.expiresIn * 1000).toISOString();
      if (new Date(expiresAt).getTime() <= now()) {
        throw new Error('A sessão recebida já está expirada. Entre novamente.');
      }

      return {
        status: 'authenticated',
        userId: String(claims.sub ?? ''),
        roles,
        accessToken: response.accessToken,
        expiresAt,
      };
    },
    async register(input: RegisterInput) {
      await http.post('/Usuario', input);
    },
    async confirmEmail(token: string) {
      await http.get(`/Usuario/confirmar-email/${encodeURIComponent(token)}`);
    },
  };
}
