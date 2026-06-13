import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

export default function CouponCard({ coupon }) {
  const isAvailed = coupon.status === 'availed';
  const isExpired = coupon.status === 'expired';

  const statusStyle =
    isAvailed ? styles.pillAvailed :
    isExpired ? styles.pillExpired : styles.pillActive;
  const statusText =
    isAvailed ? `Used ${formatDate(coupon.availed_at)}` :
    isExpired ? 'Expired' : 'Active';

  return (
    <View style={[styles.card, isAvailed && { opacity: 0.6 }]} testID={`coupon-card-${coupon.coupon_code}`}>
      <View style={styles.topRow}>
        <Text style={styles.testName} numberOfLines={2}>{coupon.test_name}</Text>
        <View style={statusStyle}>
          {isAvailed && <Ionicons name="checkmark" size={12} color={COLORS.textMid} />}
          <Text style={[styles.pillText, isAvailed && { color: COLORS.textMid }, isExpired && { color: COLORS.dangerRed }]}>
            {statusText}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.mrp}>₹{Number(coupon.original_price).toFixed(0)}</Text>
        <Text style={styles.disc}>₹{Number(coupon.discounted_price).toFixed(0)}</Text>
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>{Number(coupon.discount_percent).toFixed(0)}% off</Text>
        </View>
      </View>

      <View style={styles.codePill}>
        <Text style={styles.codeText}>{coupon.coupon_code}</Text>
      </View>
    </View>
  );
}

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const yr = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${yr} ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  testName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: COLORS.deepNavy, flex: 1 },

  pillActive:  { backgroundColor: 'rgba(56,161,105,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillAvailed: { backgroundColor: '#E2E8F0',               paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillExpired: { backgroundColor: 'rgba(229,62,62,0.10)',   paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillText:    { fontSize: 12, fontWeight: '600', color: COLORS.successGreen },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 10, flexWrap: 'wrap' },
  mrp:  { color: COLORS.textMid, textDecorationLine: 'line-through', fontSize: 14 },
  disc: { color: COLORS.primaryCyan, fontSize: 20, fontWeight: '700' },
  discountPill: { backgroundColor: COLORS.lightBlueBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
  discountText: { color: COLORS.midBlue, fontSize: 12, fontWeight: '600' },

  codePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceBlue,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.pill,
    marginTop: 12,
  },
  codeText: { fontFamily: 'Inter_600SemiBold', letterSpacing: 1, color: COLORS.deepNavy, fontSize: 14 },
});
