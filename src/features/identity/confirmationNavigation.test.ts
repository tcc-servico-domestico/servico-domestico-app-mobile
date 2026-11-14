import { describe, expect, it } from 'vitest';

import { confirmationDestination } from './confirmationNavigation';

describe('retorno da confirmação de e-mail', () => {
  it('respeita a rota disponível para cada estado de sessão', () => {
    expect(confirmationDestination('authenticated')).toEqual({ route: '/(tabs)/home', label: 'Ir para início' });
    expect(confirmationDestination('anonymous')).toEqual({ route: '/(auth)/login', label: 'Ir para login' });
  });
});
