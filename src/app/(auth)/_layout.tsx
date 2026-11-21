import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { environment } from '@/src/shared/runtime';

export default function AuthLayout() {
  return (
    <SafeAreaView edges={environment.demoMode ? [] : ['top']} style={{ flex: 1, backgroundColor: '#F8F4EB' }}>
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ headerShown: false }} />
    </Stack>
    </SafeAreaView>
  );
}
