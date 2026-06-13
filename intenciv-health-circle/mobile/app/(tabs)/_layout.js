import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function TabsLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/phone-entry" />;

  const isClient = user.role === 'client';
  const isAgent  = user.role === 'sales_agent';

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
      {/* Client tabs */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          href: isClient ? '/(tabs)/home' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coupons"
        options={{
          title: 'Coupons',
          href: isClient ? '/(tabs)/coupons' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" size={size} color={color} />,
        }}
      />

      {/* Agent tabs */}
      <Tabs.Screen
        name="agent-home"
        options={{
          title: 'Home',
          href: isAgent ? '/(tabs)/agent-home' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activate"
        options={{
          title: 'Activate',
          href: isAgent ? '/(tabs)/activate' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-sales"
        options={{
          title: 'My Sales',
          href: isAgent ? '/(tabs)/my-sales' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />

      {/* Shared profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
