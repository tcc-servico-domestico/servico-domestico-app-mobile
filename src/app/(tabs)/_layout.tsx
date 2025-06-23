import { Tabs } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { logout } = useAuth();

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
