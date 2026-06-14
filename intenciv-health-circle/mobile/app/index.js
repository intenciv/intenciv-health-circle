import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants/colors';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.lightBlueBg }}>
        <ActivityIndicator color={COLORS.primaryCyan} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/role-select" />;
  if (user.role === 'salesperson') return <Redirect href="/(tabs)/sp-home" />;
  if (user.role === 'customer')    return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/role-select" />;
}
