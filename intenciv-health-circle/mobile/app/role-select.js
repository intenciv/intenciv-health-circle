import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../constants/colors';

export default function RoleSelect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoCircle}>
          <Ionicons name="medkit" size={36} color={COLORS.white} />
        </View>
        <Text style={styles.brand}>IntenCiv Health Circle</Text>
        <Text style={styles.tag}>Welcome — choose how you'd like to sign in.</Text>

        <TouchableOpacity
          testID="role-customer"
          onPress={() => router.push('/customer-login')}
          style={[styles.card, { backgroundColor: COLORS.primaryCyan }]}
          activeOpacity={0.85}
        >
          <Ionicons name="person" size={28} color={COLORS.white} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitleW}>I'm a member</Text>
            <Text style={styles.cardSubW}>Use your registered mobile number to view your card & coupons.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="role-salesperson"
          onPress={() => router.push('/salesperson-login')}
          style={[styles.card, { backgroundColor: COLORS.white }]}
          activeOpacity={0.85}
        >
          <Ionicons name="briefcase" size={28} color={COLORS.deepNavy} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitleN}>I'm a sales representative</Text>
            <Text style={styles.cardSubN}>Sign in with your mobile + 4-digit PIN to activate cards.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.deepNavy} />
        </TouchableOpacity>

        <Text style={styles.footer}>
          Admin & reception staff sign in on the web panel at app.intenciv.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 24, paddingBottom: 60, flexGrow: 1, justifyContent: 'flex-start' },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryCyan, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  brand:  { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy, textAlign: 'center', marginTop: 14 },
  tag:    { fontSize: 14, color: COLORS.textMid, textAlign: 'center', marginTop: 6, marginBottom: 32 },

  card:   { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: RADIUS.card, marginTop: 14, ...SHADOW },
  cardBody:{ flex: 1, marginHorizontal: 14 },
  cardTitleW: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  cardSubW:   { fontSize: 13, color: 'rgba(255,255,255,0.95)', marginTop: 4 },
  cardTitleN: { fontSize: 17, fontWeight: '700', color: COLORS.deepNavy },
  cardSubN:   { fontSize: 13, color: COLORS.textMid, marginTop: 4 },

  footer: { textAlign: 'center', color: COLORS.textMid, fontSize: 12, marginTop: 32 },
});
