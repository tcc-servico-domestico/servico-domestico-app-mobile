import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { environment } from '@/src/shared/runtime';

export default function AcessoNegado() {
  const { status } = useAuth();
  const router = useRouter();
  const authenticated = status === 'authenticated';
  return <SafeAreaView edges={environment.demoMode ? [] : ['top']} style={styles.screen}>
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Acesso indisponível</Text>
      <Text style={styles.body}>{authenticated ? 'Esta área não está disponível para os perfis desta conta.' : 'Entre na sua conta para acessar esta área.'}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace(authenticated ? '/(tabs)/home' : '/(auth)/login')}>
        <Text style={styles.buttonText}>{authenticated ? 'Ir para início' : 'Ir para entrar'}</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F4EB' },
  content: { padding: 24, gap: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#0D251B' },
  body: { fontSize: 16, lineHeight: 24, color: '#1B2421' },
  button: { minHeight: 48, borderRadius: 16, backgroundColor: '#005B44', justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
