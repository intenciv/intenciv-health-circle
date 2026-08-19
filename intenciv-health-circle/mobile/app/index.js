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

  if (!user) return <Redirect href="/customer-login" />;
  if (user.role === 'customer') return <Redirect href="/(tabs)/home" />;
  // Salesperson/admin/reception accounts should use the web panel — see
  // customer-login.js's error copy for mobile_not_registered. This app is
  // customer-only now (confirmed directly: "The app is for client only.
  // The sales person can use the app (pwa) like reception and admin on
  // desktop"). A non-customer role reaching this app at all shouldn't
  // happen via the customer login endpoint, but fail back to login
  // rather than a dead-end screen if it somehow does.
  return <Redirect href="/customer-login" />;
}
