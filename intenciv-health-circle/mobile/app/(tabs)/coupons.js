import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

const ICONS = {
  HC: 'medkit', HM: 'home', VC: 'pulse', BG: 'gift',
  SE: 'people', IC: 'flask', MT: 'female', IS: 'leaf',
};

export default function CustomerCoupons() {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked]     = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/customer/coupons'); setBenefits(data.benefits); }
    catch (_e) {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Your Benefits</Text>
        <Text style={styles.sub}>Tap a benefit to see your coupon codes.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {loading && <ActivityIndicator color={COLORS.primaryCyan} />}
        {!loading && benefits.length === 0 && <Text style={styles.empty}>No active membership found.</Text>}
        {benefits.map(b => (
          <TouchableOpacity key={b.id} style={styles.benefitCard} activeOpacity={0.85} onPress={() => setPicked(b)} testID={`benefit-${b.benefit_code}`}>
            <View style={styles.benefitIcon}><Ionicons name={ICONS[b.benefit_code] || 'pricetag'} size={22} color={COLORS.primaryCyan} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitName} numberOfLines={2}>{b.name}</Text>
              <Text style={styles.benefitDesc} numberOfLines={2}>{b.description || ''}</Text>
              <View style={styles.row}>
                <View style={styles.pill}><Text style={styles.pillText}>{b.unused}/{b.total} available</Text></View>
                {b.used > 0 && <Text style={styles.usedNote}>{b.used} used</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMid} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!picked} animationType="slide" transparent onRequestClose={() => setPicked(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setPicked(null)} style={{ alignSelf: 'flex-end' }}>
              <Ionicons name="close" size={24} color={COLORS.textMid} />
            </TouchableOpacity>
            {picked && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.benefitIconLg}><Ionicons name={ICONS[picked.benefit_code] || 'pricetag'} size={28} color={COLORS.white} /></View>
                <Text style={styles.modalTitle}>{picked.name}</Text>
                <Text style={styles.modalDesc}>{picked.description}</Text>
                {picked.conditions ? (
                  <View style={styles.conditions}>
                    <Text style={styles.condTitle}>Terms & conditions</Text>
                    <Text style={styles.condText}>{picked.conditions}</Text>
                  </View>
                ) : null}
                <Text style={styles.sectionLbl}>Your coupons</Text>
                {(picked.coupons || []).map(c => {
                  const isUsed = c.status === 'used';
                  const isExp  = c.status === 'expired';
                  return (
                    <View key={c.id} style={[styles.couponRow, isUsed && { opacity: 0.55 }]} testID={`coupon-${c.coupon_code}`}>
                      <View>
                        <Text style={[styles.couponCode, isUsed && { textDecorationLine: 'line-through' }]}>{c.coupon_code}</Text>
                        <Text style={styles.couponMeta}>Expires {fmtDate(c.expires_at)}</Text>
                      </View>
                      <View style={isUsed ? styles.statusUsed : isExp ? styles.statusExp : styles.statusOk}>
                        <Text style={isUsed ? styles.statusUsedT : isExp ? styles.statusExpT : styles.statusOkT}>
                          {isUsed ? 'Used' : isExp ? 'Expired' : 'Unused'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={styles.tipText}>Show the coupon code to the receptionist at IntenCiv. No OTP is needed.</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: { padding: 20, paddingBottom: 8 },
  h1:     { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 4 },
  list:   { padding: 20, paddingTop: 8, paddingBottom: 40 },
  empty:  { color: COLORS.textMid, textAlign: 'center', marginTop: 40 },

  benefitCard:{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW },
  benefitIcon:{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.lightBlueBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  benefitName:{ color: COLORS.deepNavy, fontWeight: '700', fontSize: 15 },
  benefitDesc:{ color: COLORS.textMid, fontSize: 12, marginTop: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  pill:       { backgroundColor: COLORS.lightBlueBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  pillText:   { color: COLORS.midBlue, fontWeight: '600', fontSize: 11 },
  usedNote:   { color: COLORS.textMid, fontSize: 11 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30,58,138,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  benefitIconLg: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryCyan, justifyContent: 'center', alignItems: 'center' },
  modalTitle:    { color: COLORS.deepNavy, fontSize: 20, fontWeight: '700', marginTop: 14 },
  modalDesc:     { color: COLORS.textMid, marginTop: 6, lineHeight: 20 },
  conditions:    { backgroundColor: COLORS.surfaceBlue, borderRadius: 8, padding: 12, marginTop: 14 },
  condTitle:     { color: COLORS.deepNavy, fontWeight: '700', fontSize: 13 },
  condText:      { color: COLORS.textMid, marginTop: 4, fontSize: 13, lineHeight: 19 },
  sectionLbl:    { color: COLORS.midBlue, fontWeight: '700', marginTop: 18, marginBottom: 8 },

  couponRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue },
  couponCode:  { color: COLORS.deepNavy, fontWeight: '700', letterSpacing: 0.8, fontSize: 15 },
  couponMeta:  { color: COLORS.textMid, fontSize: 11, marginTop: 2 },
  statusOk:    { backgroundColor: 'rgba(56,161,105,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusOkT:   { color: COLORS.successGreen, fontWeight: '600', fontSize: 11 },
  statusUsed:  { backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusUsedT: { color: COLORS.textMid, fontWeight: '600', fontSize: 11 },
  statusExp:   { backgroundColor: 'rgba(229,62,62,0.10)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusExpT:  { color: COLORS.dangerRed, fontWeight: '600', fontSize: 11 },
  tipText:     { color: COLORS.textMid, fontSize: 12, marginTop: 18, lineHeight: 18, textAlign: 'center' },
});
