import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { connectSocket } from '../../services/socket';
import CouponCard from '../../components/CouponCard';
import BookHomeCollection from '../../components/BookHomeCollection';

export default function ClientHome() {
  const { user } = useAuth();
  const [coupons, setCoupons]   = useState([]);
  const [booklets, setBooklets] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]       = useState('');
  const toastY = useState(new Animated.Value(60))[0];
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [{ data: cdata }, { data: bdata }] = await Promise.all([
        api.get('/client/coupons'),
        api.get('/client/booklets'),
      ]);
      setCoupons(cdata.coupons);
      setBooklets(bdata.booklets);
    } catch (_e) { /* swallow — toast already shown elsewhere */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    let socket;
    (async () => {
      socket = await connectSocket();
      socket.on('coupon:availed', payload => {
        setCoupons(prev => prev.map(c =>
          c.id === payload.coupon_id
            ? { ...c, status: 'availed', availed_at: payload.availed_at }
            : c
        ));
        showToast(`Your ${payload.test_name} coupon has been used — thank you!`);
      });
    })();
    return () => { socket?.off('coupon:availed'); };
  }, []);

  function showToast(msg) {
    setToast(msg);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.delay(3000),
      Animated.timing(toastY, { toValue: 60, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(''));
  }

  const active   = coupons.filter(c => c.status === 'active').length;
  const availed  = coupons.filter(c => c.status === 'availed').length;
  const soon     = coupons.filter(c => {
    if (c.status !== 'active') return false;
    const days = (new Date(c.expires_at) - Date.now()) / 86400000;
    return days <= 60;
  }).length;
  const booklet = booklets[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.greet}>Hi {firstName(user?.full_name) || 'there'}!</Text>
        <Text style={styles.tagline}>Your IntenCiv Health Circle benefits at a glance.</Text>

        <View style={styles.kpiRow}>
          <Kpi label="Active offers"  value={active} color={COLORS.successGreen} />
          <Kpi label="Used"           value={availed} color={COLORS.textMid} />
          <Kpi label="Expiring soon"  value={soon} color={COLORS.warningAmber} />
        </View>

        <View style={styles.bookSection}>
          <BookHomeCollection />
        </View>

        {booklet && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{booklet.tier_name} Booklet</Text>
            <View style={{ height: 6 }} />
            <Row label="Activated"      value={fmtDate(booklet.activated_at)} />
            <Row label="Expires"        value={fmtDate(booklet.expires_at)} />
            <Row label="Tests in plan"  value={String(coupons.filter(c => c.booklet_id === booklet.id).length)} />
            <Row label="Status"         value={booklet.status.toUpperCase()} />
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Recent coupons</Text>
          {loading && <ActivityIndicator color={COLORS.primaryCyan} style={{ marginTop: 24 }} />}
          {!loading && coupons.length === 0 && (
            <Text style={styles.empty}>You don't have any coupons yet. Your sales agent will activate your booklet shortly.</Text>
          )}
          {coupons.slice(0, 5).map(c => <CouponCard key={c.id} coupon={c} />)}
        </View>
      </ScrollView>

      {toast ? (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: COLORS.textMid }}>{label}</Text>
      <Text style={{ color: COLORS.textDark, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
function Kpi({ label, value, color }) {
  return (
    <View style={styles.kpi}>
      <Text style={{ color: COLORS.textMid, fontSize: 12, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: '700', marginTop: 4 }}>{value}</Text>
    </View>
  );
}
function firstName(s) { return s ? String(s).trim().split(' ')[0] : ''; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll:  { padding: 20, paddingBottom: 40 },
  greet:   { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy, marginTop: 8 },
  tagline: { color: COLORS.textMid, marginTop: 4, fontSize: 14 },

  kpiRow:  { flexDirection: 'row', gap: 10, marginTop: 18 },
  kpi:     { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, ...SHADOW },

  bookSection: { marginTop: 20 },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, marginTop: 20, ...SHADOW },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.deepNavy },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.midBlue, marginTop: 24, marginBottom: 12 },
  empty:   { color: COLORS.textMid, textAlign: 'center', marginTop: 16, fontSize: 14 },

  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    backgroundColor: COLORS.deepNavy, padding: 14, borderRadius: 10,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  toastText: { color: COLORS.white, fontWeight: '500' },
});
