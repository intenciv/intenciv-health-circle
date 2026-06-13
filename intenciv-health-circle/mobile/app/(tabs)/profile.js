import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import { useAuth } from '../../hooks/useAuth';
import BookHomeCollection from '../../components/BookHomeCollection';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/phone-entry');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.name}>{user?.full_name || 'IntenCiv user'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.rolePill}><Text style={styles.roleText}>{user?.role?.replace('_', ' ').toUpperCase()}</Text></View>
        </View>

        {user?.role === 'client' && (
          <View style={styles.section}>
            <BookHomeCollection />
          </View>
        )}

        {user?.role === 'client' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your details</Text>
            <Row label="Email"   value={user.email   || '—'} />
            <Row label="Address" value={user.address || '—'} />
            <Row label="City"    value={user.city    || '—'} />
            <Row label="Pincode" value={user.pincode || '—'} />
            <TouchableOpacity onPress={() => router.push('/profile-setup')} style={styles.editBtn}>
              <Ionicons name="create-outline" size={18} color={COLORS.primaryCyan} />
              <Text style={styles.editText}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact IntenCiv Diagnostics</Text>
          {CONFIG.COMPANY.phones.map(p => (
            <TouchableOpacity key={p} onPress={() => Linking.openURL(`tel:${p}`)} style={styles.row}>
              <Ionicons name="call" size={18} color={COLORS.primaryCyan} />
              <Text style={styles.rowText}>{p}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONFIG.COMPANY.email}`)} style={styles.row}>
            <Ionicons name="mail" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>{CONFIG.COMPANY.email}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(CONFIG.COMPANY.website)} style={styles.row}>
            <Ionicons name="globe" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>www.intenciv.in</Text>
          </TouchableOpacity>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Ionicons name="location" size={18} color={COLORS.primaryCyan} />
            <Text style={styles.rowText}>{CONFIG.COMPANY.city}</Text>
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

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: COLORS.textMid }}>{label}</Text>
      <Text style={{ color: COLORS.textDark, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll:  { padding: 20, paddingBottom: 60 },
  header:  { alignItems: 'center', marginBottom: 20 },
  avatar:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryCyan, justifyContent: 'center', alignItems: 'center' },
  name:    { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy, marginTop: 12 },
  phone:   { color: COLORS.textMid, marginTop: 4 },
  rolePill:{ backgroundColor: COLORS.lightBlueBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginTop: 10 },
  roleText:{ color: COLORS.midBlue, fontWeight: '600', fontSize: 12, letterSpacing: 0.5 },

  section: { marginVertical: 12 },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, marginTop: 18, ...SHADOW },
  cardTitle:{ fontSize: 16, fontWeight: '700', color: COLORS.deepNavy, marginBottom: 8 },

  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue },
  rowText: { color: COLORS.textDark, fontSize: 14 },

  editBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14, alignSelf: 'flex-start' },
  editText:{ color: COLORS.primaryCyan, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 14, borderRadius: RADIUS.button, backgroundColor: COLORS.white, ...SHADOW },
  logoutText:{ color: COLORS.dangerRed, fontWeight: '700' },

  version: { textAlign: 'center', color: COLORS.textMid, marginTop: 20, fontSize: 12 },
});
