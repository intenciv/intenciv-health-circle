import { useEffect } from 'react';
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

  if (!user) return <Redirect href="/phone-entry" />;

  // Force profile completion for clients.
  if (user.role === 'client' && (!user.full_name || !user.city || !user.pincode)) {
    return <Redirect href="/profile-setup" />;
  }

  if (user.role === 'sales_agent') return <Redirect href="/(tabs)/agent-home" />;
  if (user.role === 'client')      return <Redirect href="/(tabs)/home" />;

  // Receptionists/admins use the web panel.
  return <Redirect href="/phone-entry" />;
}
