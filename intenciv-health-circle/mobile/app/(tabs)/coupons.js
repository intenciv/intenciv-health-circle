import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

const ICONS = {
  HC: 'medkit', HM: 'home', VC: 'pulse', BG: 'gift',
  SE: 'people', IC: 'flask', MT: 'female', IS: 'leaf',
};

/* ── small helpers ───────────────────────────────────────────── */
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Returns true when a coupon has max_uses > 1 (multi-use coupon) */
function isMultiUse(coupon) {
  return (coupon.max_uses ?? 1) > 1;
}

/** Dot indicators for multi-use coupons e.g. ●●○ for 2/3 used */
function UsageDots({ current, max }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i < current ? styles.dotFilled : styles.dotEmpty]}
        />
      ))}
    </View>
  );
}

/* ── main screen ─────────────────────────────────────────────── */
export default function CustomerCoupons() {
  const [benefits, setBenefits]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked]         = useState(null);
  const [pickedCoupon, setPickedCoupon] = useState(null); // detail modal for a single coupon

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/customer/coupons');
      setBenefits(data.benefits);
    } catch (_e) {
      // silently fail — pull-to-refresh available
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* ── benefit list ─────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Your Benefits</Text>
        <Text style={styles.sub}>Tap a benefit to see your coupon codes.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        {loading && <ActivityIndicator color={COLORS.primaryCyan} />}

        {!loading && benefits.length === 0 && (
          <Text style={styles.empty}>No active membership found.</Text>
        )}

        {benefits.map(b => (
          <TouchableOpacity
            key={b.id}
            style={styles.benefitCard}
            activeOpacity={0.85}
            onPress={() => setPicked(b)}
            testID={`benefit-${b.benefit_code}`}
          >
            <View style={styles.benefitIcon}>
              <Ionicons name={ICONS[b.benefit_code] || 'pricetag'} size={22} color={COLORS.primaryCyan} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.benefitName} numberOfLines={2}>{b.name}</Text>
              <Text style={styles.benefitDesc} numberOfLines={2}>{b.description || ''}</Text>
              <View style={styles.row}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{b.unused}/{b.total} available</Text>
                </View>
                {b.used > 0 && <Text style={styles.usedNote}>{b.used} used</Text>}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={COLORS.textMid} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── benefit detail modal ─────────────────────────────── */}
      <Modal
        visible={!!picked}
        animationType="slide"
        transparent
        onRequestClose={() => setPicked(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setPicked(null)} style={{ alignSelf: 'flex-end' }}>
              <Ionicons name="close" size={24} color={COLORS.textMid} />
            </TouchableOpacity>

            {picked && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.benefitIconLg}>
                  <Ionicons name={ICONS[picked.benefit_code] || 'pricetag'} size={28} color={COLORS.white} />
                </View>
                <Text style={styles.modalTitle}>{picked.name}</Text>
                <Text style={styles.modalDesc}>{picked.description}</Text>

                {picked.conditions ? (
                  <View style={styles.conditions}>
                    <Text style={styles.condTitle}>Terms &amp; conditions</Text>
                    <Text style={styles.condText}>{picked.conditions}</Text>
                  </View>
                ) : null}

                <Text style={styles.sectionLbl}>Your coupons</Text>

                {(picked.coupons || []).map(c => {
                  const multi   = isMultiUse(c);
                  const current = c.current_uses ?? 0;
                  const max     = c.max_uses ?? 1;
                  const remaining = max - current;
                  const isUsed  = c.status === 'used';
                  const isExp   = c.status === 'expired';

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.couponRow, isUsed && !multi && { opacity: 0.55 }]}
                      activeOpacity={multi ? 0.8 : 1}
                      onPress={() => multi ? setPickedCoupon(c) : null}
                      testID={`coupon-${c.coupon_code}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.couponCode,
                          isUsed && !multi && { textDecorationLine: 'line-through' },
                        ]}>
                          {c.coupon_code}
                        </Text>
                        <Text style={styles.couponMeta}>Expires {fmtDate(c.expires_at)}</Text>

                        {/* Multi-use usage tracker */}
                        {multi && (
                          <View style={styles.usageRow}>
                            <UsageDots current={current} max={max} />
                            <Text style={styles.usageText}>
                              {remaining > 0
                                ? `${remaining} of ${max} remaining`
                                : 'All uses exhausted'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        {/* Status badge */}
                        <View style={isUsed ? styles.statusUsed : isExp ? styles.statusExp : styles.statusOk}>
                          <Text style={isUsed ? styles.statusUsedT : isExp ? styles.statusExpT : styles.statusOkT}>
                            {isUsed ? 'Used' : isExp ? 'Expired' : 'Active'}
                          </Text>
                        </View>
                        {/* Tap hint for multi-use */}
                        {multi && !isUsed && !isExp && (
                          <Ionicons name="chevron-forward" size={14} color={COLORS.textMid} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.tipText}>
                  Show the coupon code to the receptionist at IntenCiv. No OTP is needed.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── multi-use coupon detail modal ────────────────────── */}
      <Modal
        visible={!!pickedCoupon}
        animationType="slide"
        transparent
        onRequestClose={() => setPickedCoupon(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setPickedCoupon(null)} style={{ alignSelf: 'flex-end' }}>
              <Ionicons name="close" size={24} color={COLORS.textMid} />
            </TouchableOpacity>

            {pickedCoupon && (() => {
              const current   = pickedCoupon.current_uses ?? 0;
              const max       = pickedCoupon.max_uses ?? 1;
              const remaining = max - current;
              const isUsed    = pickedCoupon.status === 'used';
              const isExp     = pickedCoupon.status === 'expired';
              const history   = pickedCoupon.redemption_history || [];

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={styles.multiHeader}>
                    <View style={styles.benefitIconLg}>
                      <Ionicons
                        name={ICONS[pickedCoupon.benefit_code] || 'pricetag'}
                        size={28}
                        color={COLORS.white}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.modalTitle}>{pickedCoupon.benefit_name}</Text>
                      <Text style={styles.couponCode}>{pickedCoupon.coupon_code}</Text>
                    </View>
                  </View>

                  {/* Usage tracker card */}
                  <View style={styles.usageCard}>
                    <Text style={styles.usageCardTitle}>Usage this year</Text>
                    <UsageDots current={current} max={max} />
                    <Text style={styles.usageCardCount}>
                      {current} of {max} used
                    </Text>

                    {/* Big remaining badge */}
                    <View style={[
                      styles.remainingBadge,
                      remaining === 0 && { backgroundColor: 'rgba(229,62,62,0.10)' },
                    ]}>
                      <Text style={[
                        styles.remainingNum,
                        remaining === 0 && { color: COLORS.dangerRed },
                      ]}>
                        {remaining}
                      </Text>
                      <Text style={[
                        styles.remainingLabel,
                        remaining === 0 && { color: COLORS.dangerRed },
                      ]}>
                        {remaining === 1 ? 'use remaining' : remaining === 0 ? 'no uses left' : 'uses remaining'}
                      </Text>
                    </View>

                    <Text style={styles.expiryNote}>
                      Valid until {fmtDate(pickedCoupon.expires_at)}
                    </Text>
                  </View>

                  {/* Status banner */}
                  {(isUsed || isExp) && (
                    <View style={[styles.statusBanner, isExp && styles.statusBannerExp]}>
                      <Ionicons
                        name={isExp ? 'time-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={isExp ? COLORS.dangerRed : COLORS.textMid}
                      />
                      <Text style={[styles.statusBannerText, isExp && { color: COLORS.dangerRed }]}>
                        {isExp ? 'This coupon has expired.' : 'All uses for this coupon have been exhausted.'}
                      </Text>
                    </View>
                  )}

                  {/* Redemption history */}
                  {history.length > 0 && (
                    <>
                      <Text style={styles.sectionLbl}>Redemption history</Text>
                      {history.map((h, idx) => (
                        <View key={h.id ?? idx} style={styles.historyRow}>
                          <View style={styles.historyDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyDate}>{fmtDateTime(h.redeemed_at)}</Text>
                            {h.service_note
                              ? <Text style={styles.historyNote}>{h.service_note}</Text>
                              : null}
                            {h.redeemed_by_name
                              ? <Text style={styles.historyBy}>by {h.redeemed_by_name}</Text>
                              : null}
                          </View>
                          <View style={styles.historyBadge}>
                            <Text style={styles.historyBadgeText}>#{idx + 1}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {history.length === 0 && (
                    <View style={styles.noHistory}>
                      <Ionicons name="receipt-outline" size={32} color={COLORS.textMid} />
                      <Text style={styles.noHistoryText}>No redemptions yet</Text>
                    </View>
                  )}

                  <Text style={styles.tipText}>
                    Show the coupon code to the receptionist at IntenCiv. No OTP is needed.
                  </Text>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  header: { padding: 20, paddingBottom: 8 },
  h1:     { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 4 },
  list:   { padding: 20, paddingTop: 8, paddingBottom: 40 },
  empty:  { color: COLORS.textMid, textAlign: 'center', marginTop: 40 },

  /* benefit cards */
  benefitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW },
  benefitIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.lightBlueBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  benefitName: { color: COLORS.deepNavy, fontWeight: '700', fontSize: 15 },
  benefitDesc: { color: COLORS.textMid, fontSize: 12, marginTop: 2 },
  row:         { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  pill:        { backgroundColor: COLORS.lightBlueBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  pillText:    { color: COLORS.midBlue, fontWeight: '600', fontSize: 11 },
  usedNote:    { color: COLORS.textMid, fontSize: 11 },

  /* modals */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30,58,138,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  benefitIconLg: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryCyan, justifyContent: 'center', alignItems: 'center' },
  modalTitle:    { color: COLORS.deepNavy, fontSize: 20, fontWeight: '700', marginTop: 14 },
  modalDesc:     { color: COLORS.textMid, marginTop: 6, lineHeight: 20 },
  conditions:    { backgroundColor: COLORS.surfaceBlue, borderRadius: 8, padding: 12, marginTop: 14 },
  condTitle:     { color: COLORS.deepNavy, fontWeight: '700', fontSize: 13 },
  condText:      { color: COLORS.textMid, marginTop: 4, fontSize: 13, lineHeight: 19 },
  sectionLbl:    { color: COLORS.midBlue, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  tipText:       { color: COLORS.textMid, fontSize: 12, marginTop: 18, lineHeight: 18, textAlign: 'center', marginBottom: 8 },

  /* coupon rows */
  couponRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue },
  couponCode:  { color: COLORS.deepNavy, fontWeight: '700', letterSpacing: 0.8, fontSize: 15 },
  couponMeta:  { color: COLORS.textMid, fontSize: 11, marginTop: 2 },

  /* status badges */
  statusOk:    { backgroundColor: 'rgba(56,161,105,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusOkT:   { color: COLORS.successGreen, fontWeight: '600', fontSize: 11 },
  statusUsed:  { backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusUsedT: { color: COLORS.textMid, fontWeight: '600', fontSize: 11 },
  statusExp:   { backgroundColor: 'rgba(229,62,62,0.10)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusExpT:  { color: COLORS.dangerRed, fontWeight: '600', fontSize: 11 },

  /* multi-use dots */
  usageRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  usageText:   { color: COLORS.textMid, fontSize: 11 },
  dotsRow:     { flexDirection: 'row', gap: 5 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  dotFilled:   { backgroundColor: COLORS.primaryCyan },
  dotEmpty:    { backgroundColor: COLORS.surfaceBlue, borderWidth: 1, borderColor: COLORS.primaryCyan },

  /* multi-use detail modal */
  multiHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  usageCard:     { backgroundColor: COLORS.lightBlueBg, borderRadius: RADIUS.card, padding: 18, alignItems: 'center', gap: 10 },
  usageCardTitle:{ color: COLORS.midBlue, fontWeight: '700', fontSize: 13 },
  usageCardCount:{ color: COLORS.textMid, fontSize: 12 },
  remainingBadge:{ backgroundColor: 'rgba(56,161,105,0.12)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  remainingNum:  { color: COLORS.successGreen, fontSize: 32, fontWeight: '800' },
  remainingLabel:{ color: COLORS.successGreen, fontSize: 12, fontWeight: '600' },
  expiryNote:    { color: COLORS.textMid, fontSize: 11, marginTop: 4 },

  statusBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E2E8F0', borderRadius: 8, padding: 12, marginTop: 14 },
  statusBannerExp: { backgroundColor: 'rgba(229,62,62,0.10)' },
  statusBannerText:{ color: COLORS.textMid, fontSize: 13 },

  /* history */
  historyRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue, gap: 10 },
  historyDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primaryCyan, marginTop: 5 },
  historyDate:     { color: COLORS.deepNavy, fontWeight: '600', fontSize: 13 },
  historyNote:     { color: COLORS.textMid, fontSize: 12, marginTop: 2 },
  historyBy:       { color: COLORS.textMid, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  historyBadge:    { backgroundColor: COLORS.surfaceBlue, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  historyBadgeText:{ color: COLORS.midBlue, fontSize: 11, fontWeight: '700' },
  noHistory:       { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noHistoryText:   { color: COLORS.textMid, fontSize: 13 },
});
