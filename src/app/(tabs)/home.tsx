import { View, Text, Button } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function Home() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout= () => {
    logout();
    router.push('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Bem-vindo ao app autenticado!</Text>
      <Button title="Sair" onPress={handleLogout} />
    </View>
  );
}