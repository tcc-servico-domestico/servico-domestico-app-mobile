export function confirmationDestination(status: 'loading' | 'anonymous' | 'authenticated') {
  return status === 'authenticated'
    ? { route: '/(tabs)/home' as const, label: 'Ir para início' }
    : { route: '/(auth)/login' as const, label: 'Ir para login' };
}
