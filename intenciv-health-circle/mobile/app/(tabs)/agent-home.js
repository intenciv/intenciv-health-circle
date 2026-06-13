import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function AgentHome() {
  const { user }            = useAuth();
  const [summary, setSummary] = useState({ today_count: 0, month_total: 0 });
  const [recent, setRecent]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/agent/my-sales');
      setSummary(data.summary);
      setRecent(data.sales.slice(0, 4));
    } catch (_e) { /* ignore */ }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.greet}>Hi {firstName(user?.full_name) || 'Agent'}</Text>
        <Text style={styles.sub}>Activate booklets and grow IntenCiv Health Circle.</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Today's sales</Text>
            <Text style={styles.kpiValue}>{summary.today_count}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>This month</Text>
            <Text style={[styles.kpiValue, { color: COLORS.primaryCyan }]}>₹{Number(summary.month_total || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.push('/(tabs)/activate')} style={styles.cta} activeOpacity={0.85} testID="activate-cta-btn">
          <Ionicons name="add-circle" size={28} color={COLORS.white} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.ctaTitle}>Activate New Booklet</Text>
            <Text style={styles.ctaSub}>Quick 3-step wizard — collect payment & activate in under a minute.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Recent activations</Text>
        {recent.length === 0 && <Text style={styles.empty}>No activations yet. Tap the button above to start.</Text>}
        {recent.map(s => (
          <View key={s.id} style={styles.saleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saleClient}>{s.client_name || s.client_phone}</Text>
              <Text style={styles.saleMeta}>{s.tier_name} · ₹{Number(s.amount_paid).toFixed(0)} · {fmtDate(s.activated_at)}</Text>
              <Text style={styles.saleProgress}>{s.coupons_availed}/{s.total_coupons} coupons used</Text>
            </View>
            <View style={s.status === 'active' ? styles.pillOk : styles.pillBad}>
              <Text style={s.status === 'active' ? styles.pillOkText : styles.pillBadText}>{s.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function firstName(s) { return s ? String(s).trim().split(' ')[0] : ''; }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 20, paddingBottom: 40 },
  greet:  { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy, marginTop: 8 },
  sub:    { color: COLORS.textMid, marginTop: 4 },

  kpiRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  kpi:    { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, ...SHADOW },
  kpiLabel: { color: COLORS.textMid, fontSize: 12, fontWeight: '500' },
  kpiValue: { color: COLORS.deepNavy, fontSize: 26, fontWeight: '700', marginTop: 4 },

  cta:    { backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.card, padding: 18, marginTop: 22, flexDirection: 'row', alignItems: 'center', ...SHADOW },
  ctaTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  ctaSub:   { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.midBlue, marginTop: 28, marginBottom: 12 },
  empty:   { color: COLORS.textMid, textAlign: 'center' },

  saleCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', ...SHADOW },
  saleClient: { color: COLORS.deepNavy, fontWeight: '700', fontSize: 15 },
  saleMeta:   { color: COLORS.textMid, marginTop: 2, fontSize: 12 },
  saleProgress: { color: COLORS.primaryCyan, marginTop: 4, fontSize: 12, fontWeight: '600' },

  pillOk:     { backgroundColor: 'rgba(56,161,105,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  pillOkText: { color: COLORS.successGreen, fontWeight: '600', fontSize: 11 },
  pillBad:    { backgroundColor: 'rgba(229,62,62,0.10)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  pillBadText:{ color: COLORS.dangerRed, fontWeight: '600', fontSize: 11 },
});
