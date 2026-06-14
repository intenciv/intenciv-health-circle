import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function TabsLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/role-select" />;
  const isCustomer = user.role === 'customer';
  const isSp       = user.role === 'salesperson';
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
      <Tabs.Screen name="home"      options={{ title: 'Home',     href: isCustomer ? '/(tabs)/home' : null,     tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="coupons"   options={{ title: 'Coupons',  href: isCustomer ? '/(tabs)/coupons' : null,  tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" size={size} color={color} /> }} />
      <Tabs.Screen name="sp-home"   options={{ title: 'Home',     href: isSp ? '/(tabs)/sp-home' : null,        tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} /> }} />
      <Tabs.Screen name="activate"  options={{ title: 'Activate', href: isSp ? '/(tabs)/activate' : null,       tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="my-cards"  options={{ title: 'Cards',    href: isSp ? '/(tabs)/my-cards' : null,       tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} /> }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile',  tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
