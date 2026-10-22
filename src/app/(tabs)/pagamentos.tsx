import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PagamentosScreen } from '@/src/features/operations/pagamentos/PagamentosScreen';
import { createPagamentosApi } from '@/src/features/operations/pagamentos/api';
import { useAuth } from '@/src/context/AuthContext';
import { paymentHttpClient } from '@/src/shared/runtime';

const pagamentosApi = createPagamentosApi(paymentHttpClient);

export default function PagamentosRoute() {
  const { session, status } = useAuth();
  const { pagamentoId } = useLocalSearchParams<{ readonly pagamentoId?: string | string[] }>();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <PagamentosScreen api={pagamentosApi} session={session} initialPagamentoId={typeof pagamentoId === 'string' ? pagamentoId : undefined} />;
}
