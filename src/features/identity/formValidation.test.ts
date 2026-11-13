import { describe, expect, it } from 'vitest';

import { identityFieldErrors, loginErrorMessage, registrationOutcomeUncertain, validateIdentityForm } from './formValidation';

describe('validação de acesso e cadastro', () => {
  it('orienta a correção de credenciais e distingue indisponibilidade de rede e servidor', () => {
    expect(loginErrorMessage(401, 'Unauthorized')).toBe('E-mail ou senha incorretos. Confira os dados e tente novamente.');
    expect(loginErrorMessage(0, 'Network request failed')).toContain('Verifique sua conexão');
    expect(loginErrorMessage()).toBe('Não foi possível entrar. Confira os dados e tente novamente.');
    expect(loginErrorMessage(503, 'Service Unavailable')).toContain('serviço está indisponível');
    expect(loginErrorMessage(422, 'Confira o campo informado.')).toBe('Confira o campo informado.');
  });
  it('exige campos sem exibir erros antes da interação', () => {
    expect(validateIdentityForm('  ', '', 'login', { email: false, password: false })).toEqual({
      emailError: null, passwordError: null, canSubmit: false,
    });
    expect(validateIdentityForm('  ', '', 'login', { email: true, password: true })).toEqual({
      emailError: 'Informe seu e-mail.', passwordError: 'Informe sua senha.', canSubmit: false,
    });
  });

  it('exige oito caracteres no cadastro sem modificar valores preenchidos', () => {
    const touched = { email: true, password: false };
    expect(validateIdentityForm('cliente@example.invalid', '123', 'registration', touched)).toMatchObject({
      emailError: null, passwordError: 'Use pelo menos 8 caracteres.', canSubmit: false,
    });
    expect(validateIdentityForm('cliente@example.invalid', '12345678', 'registration', touched)).toEqual({
      emailError: null, passwordError: null, canSubmit: true,
    });
    expect(validateIdentityForm('cliente@example.invalid', '123', 'login', touched).canSubmit).toBe(true);
  });

  it('associa erros conhecidos do servidor ao campo, sem inventar erros desconhecidos', () => {
    expect(identityFieldErrors({ 'Request.Usuario': ['Informe o usuário.'], Senha: ['Senha inválida.'], outro: ['Erro geral'] }))
      .toEqual({ email: 'Informe o usuário.', password: 'Senha inválida.' });
    expect(identityFieldErrors({ Email: ['E-mail inválido.'], Password: ['Senha curta.'] }))
      .toEqual({ email: 'E-mail inválido.', password: 'Senha curta.' });
    expect(identityFieldErrors(undefined)).toEqual({});
  });

  it('mantém resultado incerto sem resposta, em timeout, limitação ou falha do servidor', () => {
    for (const status of [undefined, 408, 429, 500, 503]) expect(registrationOutcomeUncertain(status)).toBe(true);
    for (const status of [400, 401, 409, 422]) expect(registrationOutcomeUncertain(status)).toBe(false);
  });
});
