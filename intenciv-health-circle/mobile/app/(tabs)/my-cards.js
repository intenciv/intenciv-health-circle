import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

const FILTERS = ['all', 'available', 'active', 'expired'];
const LABELS  = { all: 'All', available: 'Available', active: 'Active', expired: 'Expired' };

export default function MyCards() {
  const [cards, setCards] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/salesperson/my-cards'); setCards(data.cards); }
    catch (_e) {} finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = cards.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'available') return ['unused','assigned'].includes(c.status);
    return c.status === filter;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>My Cards</Text>
        <Text style={styles.sub}>{cards.length} total</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ maxHeight: 56 }}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipOn]} activeOpacity={0.8} testID={`chip-${f}`}>
              <Text style={[styles.chipT, active && { color: COLORS.white }]}>{LABELS[f]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {loading && <ActivityIndicator color={COLORS.primaryCyan} />}
        {!loading && visible.length === 0 && <Text style={styles.empty}>No cards in this filter.</Text>}
        {visible.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cardNum}>{c.card_number}</Text>
              <Pill status={c.status} />
            </View>
            <Text style={styles.cardMeta}>{c.plan_name}{c.amount_paid ? ` · ₹${Number(c.amount_paid).toFixed(0)}` : ''}</Text>
            {c.customer_name ? (
              <Text style={styles.cardCust}>{c.customer_name} · {c.customer_phone}</Text>
            ) : null}
            {c.activated_at && (
              <Text style={styles.cardDates}>Activated {fmt(c.activated_at)} · Expires {fmt(c.expires_at)}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
function Pill({ status }) {
  const map = {
    unused:   { bg: 'rgba(245,158,11,0.12)', fg: COLORS.warningAmber, label: 'UNUSED' },
    assigned: { bg: COLORS.lightBlueBg,       fg: COLORS.midBlue,      label: 'AVAILABLE' },
    active:   { bg: 'rgba(56,161,105,0.12)', fg: COLORS.successGreen, label: 'ACTIVE' },
    expired:  { bg: 'rgba(229,62,62,0.10)',   fg: COLORS.dangerRed,    label: 'EXPIRED' },
  };
  const m = map[status] || map.unused;
  return <View style={{ backgroundColor: m.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}><Text style={{ color: m.fg, fontWeight: '600', fontSize: 11 }}>{m.label}</Text></View>;
}
function fmt(d) { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: { padding: 20, paddingBottom: 8 },
  h1:     { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 4 },
  chipRow:{ paddingHorizontal: 20, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip:   { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', flexShrink: 0 },
  chipOn: { backgroundColor: COLORS.primaryCyan, borderColor: COLORS.primaryCyan },
  chipT:  { color: COLORS.midBlue, fontWeight: '600', fontSize: 13 },
  list:   { padding: 20, paddingTop: 4, paddingBottom: 40 },
  empty:  { color: COLORS.textMid, textAlign: 'center', marginTop: 40 },
  card:   { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW },
  cardNum:{ color: COLORS.deepNavy, fontWeight: '700', letterSpacing: 1 },
  cardMeta:{ color: COLORS.textMid, marginTop: 4, fontSize: 13 },
  cardCust:{ color: COLORS.midBlue, marginTop: 4, fontSize: 13, fontWeight: '600' },
  cardDates:{ color: COLORS.textMid, marginTop: 6, fontSize: 11 },
});
