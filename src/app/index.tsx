import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') return null;
  return <Redirect href={status === 'authenticated' ? '/home' : '/login'} />;
}
