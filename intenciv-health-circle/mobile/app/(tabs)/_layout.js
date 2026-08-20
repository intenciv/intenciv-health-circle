import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  if (!user || user.role !== 'customer') return <Redirect href="/customer-login" />;
  // Confirmed directly: the tab bar was hiding behind Android's own
  // system navigation bar. The previous fixed height/paddingBottom had
  // no awareness of the device's actual bottom safe-area inset (the
  // system nav bar's real height, which varies by device - 3-button nav
  // vs gesture nav, and by manufacturer). Using the real measured inset
  // instead of a guessed constant fixes this correctly across devices,
  // not just the one this was tested on.
  const tabBarHeight = 54 + insets.bottom;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primaryCyan,
        tabBarInactiveTintColor: COLORS.textMid,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home"    options={{ title: 'Home',    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="coupons" options={{ title: 'Coupons', tabBarIcon: ({ color, size }) => <Ionicons name="pricetags" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
