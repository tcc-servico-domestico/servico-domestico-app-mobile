import { ActivityIndicator, View } from 'react-native';

import { ServicosScreen } from '@/src/features/operations/servicos/ServicosScreen';
import { createServicosApi } from '@/src/features/operations/servicos/api';
import { createOfertasApi } from '@/src/features/operations/ofertas/api';
import { createImoveisApi } from '@/src/features/operations/imoveis/api';
import { useAuth } from '@/src/context/AuthContext';
import { httpClient } from '@/src/shared/runtime';

const servicosApi = createServicosApi(httpClient);
const ofertasApi = createOfertasApi(httpClient);
const imoveisApi = createImoveisApi(httpClient);

export default function ServicosRoute() {
  const { session, status } = useAuth();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <ServicosScreen servicosApi={servicosApi} ofertasApi={ofertasApi} imoveisApi={imoveisApi} session={session} />;
}
