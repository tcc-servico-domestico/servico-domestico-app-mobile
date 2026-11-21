import { PerfilProfissionalScreen } from '@/src/features/operations/perfil-profissional/PerfilProfissionalScreen';
import { createAvaliacoesApi } from '@/src/features/operations/avaliacoes/api';
import { createPerfilProfissionalApi } from '@/src/features/operations/perfil-profissional/api';
import { useAuth } from '@/src/context/AuthContext';
import { httpClient } from '@/src/shared/runtime';

const api = createPerfilProfissionalApi(httpClient);
const avaliacoesApi = createAvaliacoesApi(httpClient);

export default function PerfilProfissionalRoute() {
  const { session } = useAuth();
  if (!session?.roles.includes('Profissional')) return null;
  return <PerfilProfissionalScreen key={session.userId} api={api} avaliacoesApi={avaliacoesApi} />;
}
