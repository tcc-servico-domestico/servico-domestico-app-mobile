import { ActivityIndicator, Text, View } from 'react-native';
import { useExperience } from '@/src/context/ExperienceContext';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PagamentosScreen } from '@/src/features/operations/pagamentos/PagamentosScreen';
import { useAuth } from '@/src/context/AuthContext';
import { pagamentosApi } from '@/src/shared/runtime';

export default function PagamentosRoute() {
  const { session, status } = useAuth();
  const { role } = useExperience();
  const router = useRouter();
  const { pagamentoId } = useLocalSearchParams<{ readonly pagamentoId?: string | string[] }>();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <View style={{ flex: 1 }}>
    {role === 'Profissional' ? <Text accessibilityRole="alert" style={{ padding: 12, color: '#0D251B', backgroundColor: '#FFF1CF' }}>{session.roles.includes('Cliente') ? 'Esta lista pode incluir pagamentos acessíveis pelos dois papéis. ' : ''}Consulte a situação de cada pagamento: a lista não representa saldo ou repasse a receber.</Text> : null}
    <PagamentosScreen key={`${session.userId}-${role}`} api={pagamentosApi} session={session} showTrackedPix={role === 'Cliente'} initialPagamentoId={role === 'Cliente' && typeof pagamentoId === 'string' ? pagamentoId : undefined} onRouteSelectionChange={(id) => { if (role === 'Cliente') router.setParams({ pagamentoId: id }); }} />
  </View>;
}
