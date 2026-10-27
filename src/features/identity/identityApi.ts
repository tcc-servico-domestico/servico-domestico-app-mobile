import type { IdentityApi, LoginInput, RegisterInput } from '@/src/features/identity/contracts';
import type { OperationsHttpClient } from '@/src/shared/contracts/http';
import type { OperationsRole, OperationsSession } from '@/src/shared/contracts/session';

interface LoginResponse {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  const encoded = parts[1];
  if (parts.length !== 3 || !encoded || !parts[0] || !parts[2]) throw new Error('Token de acesso inválido.');

  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(normalized)) as Record<string, unknown>;
  } catch {
    throw new Error('Token de acesso inválido.');
  }
}

function stringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

export function createIdentityApi(http: OperationsHttpClient, now = () => Date.now()): IdentityApi {
  return {
    async login(input: LoginInput): Promise<OperationsSession> {
      const response = await http.post<LoginResponse>('/Autenticacao/login', input);
      if (response.tokenType.toLowerCase() !== 'bearer') {
        throw new Error('A resposta de autenticação é inválida.');
      }
      const claims = decodeJwtPayload(response.accessToken);
      const roles = stringArray(claims.role).filter(
        (role): role is OperationsRole => role === 'Cliente' || role === 'Profissional',
      );
      const subject = typeof claims.sub === 'string' ? claims.sub.trim() : '';
      const expiration = typeof claims.exp === 'number' ? claims.exp * 1000 : Number.NaN;
      if (!subject || roles.length === 0 || !Number.isFinite(expiration)) {
        throw new Error('Token de acesso inválido.');
      }
      if (expiration <= now()) {
        throw new Error('A sessão recebida já está expirada. Entre novamente.');
      }
      const expiresAt = new Date(expiration).toISOString();

      return {
        status: 'authenticated',
        userId: subject,
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
