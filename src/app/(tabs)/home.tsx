import { ScrollView, StyleSheet, Text, Button } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function Home() {
  const { logout, session } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Início</Text>
      <Text style={styles.body}>Escolha uma área na navegação para acompanhar suas tarefas.</Text>
      {session?.roles.includes('Cliente') ? <Text style={styles.body}>Em Imóveis, você pode consultar e gerenciar seus imóveis.</Text> : null}
      <Text style={styles.body}>Em Serviços, consulte os serviços e as ações disponíveis para seu perfil.</Text>
      <Text style={styles.body}>Em Pagamentos, acompanhe os pagamentos disponíveis.</Text>
      <Button title="Sair da conta" color="#175E55" onPress={handleLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16, backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2421' },
  body: { fontSize: 16, color: '#1B2421' },
});
