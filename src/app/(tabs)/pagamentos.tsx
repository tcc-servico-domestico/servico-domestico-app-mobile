import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PagamentosScreen } from '@/src/features/operations/pagamentos/PagamentosScreen';
import { useAuth } from '@/src/context/AuthContext';
import { pagamentosApi } from '@/src/shared/runtime';

export default function PagamentosRoute() {
  const { session, status } = useAuth();
  const { pagamentoId } = useLocalSearchParams<{ readonly pagamentoId?: string | string[] }>();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <PagamentosScreen api={pagamentosApi} session={session} initialPagamentoId={typeof pagamentoId === 'string' ? pagamentoId : undefined} />;
}
