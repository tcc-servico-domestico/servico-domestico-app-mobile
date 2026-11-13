export interface CreationAttempt {
  readonly fingerprint: string;
  readonly key: string;
}

/** Uma tentativa de resultado incerto só pode ser repetida com os mesmos dados e chave. */
export function creationAttemptFor(
  previous: CreationAttempt | null,
  fingerprint: string,
  createKey: () => string,
): CreationAttempt | null {
  if (previous) return previous.fingerprint === fingerprint ? previous : null;
  return { fingerprint, key: createKey() };
}
