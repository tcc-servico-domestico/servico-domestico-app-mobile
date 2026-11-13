export interface IdentityFormState {
  readonly emailError: string | null;
  readonly passwordError: string | null;
  readonly canSubmit: boolean;
}

export interface IdentityFieldErrors {
  readonly email?: string;
  readonly password?: string;
}

export function identityFieldErrors(errors: Readonly<Record<string, readonly string[]>> | undefined): IdentityFieldErrors {
  const result: { email?: string; password?: string } = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const field = key.split('.').at(-1)?.toLowerCase();
    const message = messages[0];
    if (!message) continue;
    if (field === 'email' || field === 'usuario') result.email = message;
    if (field === 'senha' || field === 'password') result.password = message;
  }
  return result;
}

export function registrationOutcomeUncertain(status?: number): boolean {
  return status === undefined || status < 400 || status >= 500 || status === 408 || status === 429;
}

export function loginErrorMessage(status?: number, serverMessage?: string): string {
  if (status === 401) return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  if (status === 0) return 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
  if (status !== undefined && status >= 500) return 'O serviço está indisponível no momento. Tente novamente mais tarde.';
  return serverMessage || 'Não foi possível entrar. Confira os dados e tente novamente.';
}

export function validateIdentityForm(
  email: string,
  password: string,
  mode: 'login' | 'registration',
  touched: { readonly email: boolean; readonly password: boolean },
): IdentityFormState {
  const emailMissing = !email.trim();
  const passwordInvalid = mode === 'registration' ? password.length < 8 : !password;
  return {
    emailError: touched.email && emailMissing ? 'Informe seu e-mail.' : null,
    passwordError: (touched.password || (mode === 'registration' && password.length > 0)) && passwordInvalid
      ? mode === 'registration' ? 'Use pelo menos 8 caracteres.' : 'Informe sua senha.'
      : null,
    canSubmit: !emailMissing && !passwordInvalid,
  };
}
