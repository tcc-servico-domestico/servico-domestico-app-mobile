import { ActivityIndicator, View } from 'react-native';

import { ServicosScreen } from '@/src/features/operations/servicos/ServicosScreen';
import { useAuth } from '@/src/context/AuthContext';
import { imoveisApi, ofertasApi, servicosApi } from '@/src/shared/runtime';

export default function ServicosRoute() {
  const { session, status } = useAuth();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <ServicosScreen servicosApi={servicosApi} ofertasApi={ofertasApi} imoveisApi={imoveisApi} session={session} />;
}
