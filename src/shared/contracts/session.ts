export type OperationsRole = 'Cliente' | 'Profissional';

export interface OperationsSession {
  readonly status: 'authenticated';
  readonly userId: string;
  readonly roles: readonly OperationsRole[];
  readonly accessToken: string;
  readonly expiresAt: string;
}

export interface SessionStore {
  load(): Promise<OperationsSession | null>;
  save(session: OperationsSession, persistent: boolean): Promise<void>;
  clear(): Promise<void>;
  subscribe?(listener: (session: OperationsSession | null) => void): () => void;
}
