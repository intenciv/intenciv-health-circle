import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

const CONTACT = {
  phones: ['0141-6695038', '7399000299'],
  email: 'contact@intenciv.in',
  website: 'https://www.intenciv.in',
  city: 'Jaipur, Rajasthan',
};

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/role-select');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={styles.avatar}><Ionicons name="person" size={36} color={COLORS.white} /></View>
          <Text style={styles.name}>{user?.full_name || 'IntenCiv user'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.rolePill}><Text style={styles.roleText}>{(user?.role || '').replace('_', ' ').toUpperCase()}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact IntenCiv Diagnostics</Text>
          {CONTACT.phones.map(p => (
            <TouchableOpacity key={p} onPress={() => Linking.openURL(`tel:${p}`)} style={styles.row}>
              <Ionicons name="call" size={18} color={COLORS.primaryCyan} />
              <Text style={styles.rowText}>{p}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT.email}`)} style={styles.row}>
            <Ionicons name="mail" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>{CONTACT.email}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(CONTACT.website)} style={styles.row}>
            <Ionicons name="globe" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>www.intenciv.in</Text>
          </TouchableOpacity>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Ionicons name="location" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>{CONTACT.city}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} testID="logout-btn">
          <Ionicons name="log-out-outline" size={18} color={COLORS.dangerRed} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>IntenCiv Health Circle · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 20, paddingBottom: 60 },
  head:   { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryCyan, justifyContent: 'center', alignItems: 'center' },
  name:   { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy, marginTop: 12 },
  phone:  { color: COLORS.textMid, marginTop: 4 },
  rolePill:{ backgroundColor: COLORS.lightBlueBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginTop: 10 },
  roleText:{ color: COLORS.midBlue, fontWeight: '600', fontSize: 12, letterSpacing: 0.5 },
  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, marginTop: 18, ...SHADOW },
  cardTitle:{ fontSize: 16, fontWeight: '700', color: COLORS.deepNavy, marginBottom: 8 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue },
  rowText: { color: COLORS.textDark, fontSize: 14 },
  logoutBtn:{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 14, borderRadius: RADIUS.button, backgroundColor: COLORS.white, ...SHADOW },
  logoutText:{ color: COLORS.dangerRed, fontWeight: '700' },
  version: { textAlign: 'center', color: COLORS.textMid, marginTop: 20, fontSize: 12 },
});
