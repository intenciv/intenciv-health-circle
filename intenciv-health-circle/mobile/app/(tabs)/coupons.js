import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS } from '../../constants/colors';
import { api } from '../../services/api';
import CouponCard from '../../components/CouponCard';
import BookHomeCollection from '../../components/BookHomeCollection';

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'active',  label: 'Active' },
  { id: 'availed', label: 'Used' },
  { id: 'expired', label: 'Expired' },
];

export default function ClientCoupons() {
  const [filter, setFilter]     = useState('all');
  const [coupons, setCoupons]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/client/coupons');
      setCoupons(data.coupons);
    } catch (_e) { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = coupons.filter(c => filter === 'all' ? true : c.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Your Coupons</Text>
        <Text style={styles.sub}>{coupons.length} total · {coupons.filter(c => c.status === 'active').length} active</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={{ maxHeight: 56 }}
      >
        {FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              testID={`filter-${f.id}`}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <BookHomeCollection />
        <View style={{ height: 18 }} />

        {loading && <ActivityIndicator color={COLORS.primaryCyan} />}
        {!loading && visible.length === 0 && (
          <Text style={styles.empty}>No coupons match this filter.</Text>
        )}
        {visible.map(c => <CouponCard key={c.id} coupon={c} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: { padding: 20, paddingBottom: 8 },
  h1:     { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 4 },

  chipRow: { paddingHorizontal: 20, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip:    {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipActive:    { backgroundColor: COLORS.primaryCyan, borderColor: COLORS.primaryCyan },
  chipText:      { color: COLORS.midBlue, fontWeight: '600', fontSize: 13 },
  chipTextActive:{ color: COLORS.white },

  list:  { padding: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { color: COLORS.textMid, textAlign: 'center', marginTop: 40 },
});
