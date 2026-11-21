import { useExperience } from '@/src/context/ExperienceContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { createAvaliacoesApi } from '@/src/features/operations/avaliacoes/api';
import { ServicosScreen } from '@/src/features/operations/servicos/ServicosScreen';
import { useAuth } from '@/src/context/AuthContext';
import { httpClient, imoveisApi, ofertasApi, servicosApi } from '@/src/shared/runtime';

const avaliacoesApi = createAvaliacoesApi(httpClient);

export default function ServicosRoute() {
  const { session, status } = useAuth();
  const { role } = useExperience();
  const router = useRouter();
  const { novo, atendimento, agenda } = useLocalSearchParams<{ novo?: string; atendimento?: string; agenda?: string }>();
  if (status === 'loading' || !session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sessão" /></View>;
  return <View style={{ flex: 1 }}>
    <ServicosScreen key={`${session.userId}-${role}`} mixedRoleList={role === 'Cliente' && session.roles.includes('Profissional')} openCreateToken={novo} onCreateOpened={() => router.setParams({ novo: undefined })} openServiceId={atendimento} onServiceOpened={() => router.setParams({ atendimento: undefined })} openProfessionalServiceId={agenda} onProfessionalServiceOpened={() => router.setParams({ agenda: undefined })} avaliacoesApi={avaliacoesApi} servicosApi={servicosApi} ofertasApi={ofertasApi} imoveisApi={imoveisApi} session={{ ...session, roles: [role] }} />
  </View>;
}
