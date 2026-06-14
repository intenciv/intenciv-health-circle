import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function SpHome() {
  const { user } = useAuth();
  const router   = useRouter();
  const [kpis, setKpis] = useState({ today_count: 0, month_count: 0, total_count: 0, unused_assigned: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/salesperson/dashboard'); setKpis(data); }
    catch (_e) {} finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.greet}>Hi {firstName(user?.full_name) || 'Sales rep'}</Text>
        <Text style={styles.sub}>Sell IntenCiv Health Privilege Cards.</Text>

        <View style={styles.row}>
          <Kpi label="Today"   value={kpis.today_count} color={COLORS.successGreen} />
          <Kpi label="Month"   value={kpis.month_count} color={COLORS.primaryCyan} />
        </View>
        <View style={styles.row}>
          <Kpi label="Total sold"   value={kpis.total_count} />
          <Kpi label="Cards available" value={kpis.unused_assigned} color={COLORS.warningAmber} />
        </View>

        <TouchableOpacity onPress={() => router.push('/(tabs)/activate')} style={styles.cta} activeOpacity={0.85} testID="cta-activate">
          <Ionicons name="add-circle" size={28} color={COLORS.white} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.ctaTitle}>Activate a card</Text>
            <Text style={styles.ctaSub}>5-step wizard with OTP + your PIN.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(tabs)/my-cards')} style={styles.cta2} activeOpacity={0.85}>
          <Ionicons name="card" size={22} color={COLORS.deepNavy} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.cta2Title}>View my cards</Text>
            <Text style={styles.cta2Sub}>Sold + remaining inventory.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.deepNavy} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
function Kpi({ label, value, color }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color && { color }]}>{value}</Text>
    </View>
  );
}
function firstName(s) { return s ? String(s).trim().split(' ')[0] : ''; }
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 20, paddingBottom: 40 },
  greet:  { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy, marginTop: 8 },
  sub:    { color: COLORS.textMid, marginTop: 4 },
  row:    { flexDirection: 'row', gap: 12, marginTop: 14 },
  kpi:    { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, ...SHADOW },
  kpiLabel:{ color: COLORS.textMid, fontSize: 12, fontWeight: '500' },
  kpiValue:{ color: COLORS.deepNavy, fontSize: 26, fontWeight: '700', marginTop: 4 },
  cta:    { backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.card, padding: 18, marginTop: 22, flexDirection: 'row', alignItems: 'center', ...SHADOW },
  ctaTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  ctaSub:   { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 4 },
  cta2:   { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', ...SHADOW },
  cta2Title: { color: COLORS.deepNavy, fontSize: 15, fontWeight: '700' },
  cta2Sub:   { color: COLORS.textMid, fontSize: 12, marginTop: 2 },
});
