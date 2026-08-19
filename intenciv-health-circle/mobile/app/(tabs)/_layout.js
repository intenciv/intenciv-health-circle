import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

// Customer-only app (confirmed directly: "The app is for client only. The
// sales person can use the app (pwa) like reception and admin on
// desktop"). Sales Rep's screens (sp-home, activate, my-cards) and the
// role-select/salesperson-login flow that used to live in this mobile
// app have moved to the web panel, alongside admin and reception, which
// already lived there.
export default function TabsLayout() {
  const { user } = useAuth();
  if (!user || user.role !== 'customer') return <Redirect href="/customer-login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primaryCyan,
        tabBarInactiveTintColor: COLORS.textMid,
        tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border, height: 64, paddingBottom: 10 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home"    options={{ title: 'Home',    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="coupons" options={{ title: 'Coupons', tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
