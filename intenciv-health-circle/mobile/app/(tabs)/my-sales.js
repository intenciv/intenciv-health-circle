import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

export default function MySales() {
  const [sales, setSales]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/agent/my-sales');
      setSales(data.sales);
    } catch (_e) { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>My Sales</Text>
        <Text style={styles.sub}>{sales.length} activations</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading && <ActivityIndicator color={COLORS.primaryCyan} />}
        {!loading && sales.length === 0 && <Text style={styles.empty}>You haven't activated any booklets yet.</Text>}
        {sales.map(s => (
          <View key={s.id} style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.client}>{s.client_name || s.client_phone}</Text>
              <Text style={styles.amount}>₹{Number(s.amount_paid).toFixed(0)}</Text>
            </View>
            <Text style={styles.meta}>{s.client_phone} · {s.tier_name}</Text>
            <View style={styles.row}>
              <Pill label={s.status} status={s.status} />
              <Text style={styles.metaSmall}>Activated {fmtDate(s.activated_at)}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct(s)}%` }]} />
            </View>
            <Text style={styles.progressText}>{s.coupons_availed}/{s.total_coupons} coupons used</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function pct(s) {
  if (!s.total_coupons) return 0;
  return Math.round((s.coupons_availed / s.total_coupons) * 100);
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function Pill({ status }) {
  const isActive = status === 'active';
  const color = isActive ? COLORS.successGreen : COLORS.dangerRed;
  const bg    = isActive ? 'rgba(56,161,105,0.12)' : 'rgba(229,62,62,0.10)';
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 16 }}>
      <Text style={{ color, fontWeight: '600', fontSize: 11 }}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: { padding: 20, paddingBottom: 8 },
  h1:     { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 4 },
  list:   { padding: 20, paddingTop: 8, paddingBottom: 40 },
  empty:  { color: COLORS.textMid, textAlign: 'center', marginTop: 40 },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, marginBottom: 12, ...SHADOW },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  client:  { color: COLORS.deepNavy, fontWeight: '700', fontSize: 16 },
  amount:  { color: COLORS.primaryCyan, fontWeight: '700', fontSize: 16 },
  meta:    { color: COLORS.textMid, marginTop: 2, fontSize: 13 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  metaSmall: { color: COLORS.textMid, fontSize: 11 },

  progressBar: { height: 6, backgroundColor: COLORS.surfaceBlue, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primaryCyan },
  progressText: { color: COLORS.textMid, fontSize: 11, marginTop: 4 },
});
