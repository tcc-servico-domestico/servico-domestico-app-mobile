import { ActivityIndicator, View } from 'react-native';

import { ImoveisScreen } from '@/src/features/operations/imoveis/ImoveisScreen';
import { createImoveisApi } from '@/src/features/operations/imoveis/api';
import { useAuth } from '@/src/context/AuthContext';
import { httpClient } from '@/src/shared/runtime';

const imoveisApi = createImoveisApi(httpClient);

export default function ImoveisRoute() {
  const { session, status } = useAuth();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <ImoveisScreen api={imoveisApi} session={session} />;
}
