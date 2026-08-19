import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Image, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';
import { connectSocket } from '../../services/socket';

export default function CustomerHome() {
  const router = useRouter();
  const [me, setMe]         = useState(null);
  const [offers, setOffers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]   = useState('');

  const load = useCallback(async () => {
    try {
      const [{ data: meData }, { data: offData }] = await Promise.all([
        api.get('/customer/me'),
        api.get('/customer/offers'),
      ]);
      setMe(meData); setOffers(offData.offers);
    } catch (_e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    let sock;
    (async () => {
      sock = await connectSocket();
      sock.on('coupon:used', (p) => {
        setToast(`Your "${p.benefit_name}" coupon was used — thank you!`);
        setTimeout(() => setToast(''), 3500);
        load();
      });
    })();
    return () => sock?.off('coupon:used');
  }, [load]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.primaryCyan} style={{ marginTop: 80 }} /></SafeAreaView>;
  }
  if (!me) {
    return <SafeAreaView style={styles.safe} edges={['top']}><Text style={styles.empty}>Couldn't load your membership.</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

        {/* Brand header */}
        <View style={styles.brandRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.greet}>Namaste, {firstName(me.member.name)}!</Text>
        <Text style={styles.tag}>Your IntenCiv Health Privilege Card.</Text>

        {/* Offers — promotional banner, shown first so it feels like a proper landing */}
        {offers.length > 0 && (
          <View style={styles.offersSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {offers.map(o => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => o.link_url && Linking.openURL(o.link_url)}
                  activeOpacity={0.85}
                  style={styles.offerCard}
                >
                  {o.image_url ? <Image source={{ uri: o.image_url }} style={styles.offerImg} /> : <View style={[styles.offerImg, { backgroundColor: COLORS.lightBlueBg }]} />}
                  <View style={styles.offerTextWrap}>
                    <Text style={styles.offerTitle} numberOfLines={2}>{o.title}</Text>
                    {o.subtitle && <Text style={styles.offerSub} numberOfLines={2}>{o.subtitle}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Membership card */}
        <View style={styles.card}>
          <Text style={styles.planName}>{me.plan.name} Plan</Text>
          <Text style={styles.cardNumber}>{me.card.number}</Text>
          <View style={styles.divider} />
          <Row label="Member"        value={me.member.name} />
          <Row label="Activated on"  value={fmtDate(me.card.activated_at)} />
          <Row label="Expires on"    value={fmtDate(me.card.expires_at)} />
          <Row label="Days left"     value={`${me.card.days_remaining} days`} />
          <View style={styles.coupBar}>
            <View style={[styles.coupFill, { width: `${me.coupons.total ? (me.coupons.used / me.coupons.total) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.coupText}>{me.coupons.used} of {me.coupons.total} coupons used · {me.coupons.unused} remaining</Text>
        </View>

        {/* Prominent Coupons CTA */}
        <TouchableOpacity style={styles.couponsCta} activeOpacity={0.85} onPress={() => router.push('/(tabs)/coupons')}>
          <Text style={styles.couponsCtaText}>View My Coupons</Text>
        </TouchableOpacity>

        {/* Quick links */}
        <View style={styles.linksRow}>
          <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://www.intenciv.in/contact-us/')}>
            <Text style={styles.linkChipText}>Find a Center</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://intenciv.in/health-check-up-packages/')}>
            <Text style={styles.linkChipText}>Health Packages</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL('https://intenciv.in/blogs/')}>
            <Text style={styles.linkChipText}>Blog</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.help}>
          <Text style={styles.helpTitle}>Use your coupons at any IntenCiv lab</Text>
          <Text style={styles.helpText}>Tap "Coupons" below to view your 8 benefits. Show the coupon code at reception — no OTP is needed.</Text>
        </View>
      </ScrollView>

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    </SafeAreaView>
  );
}

function Row({ label, value }) { return (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
    <Text style={{ color: COLORS.textMid }}>{label}</Text>
    <Text style={{ color: COLORS.textDark, fontWeight: '600' }}>{value}</Text>
  </View>
);}
function firstName(s) { return s ? String(s).trim().split(' ')[0] : 'Member'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll:  { padding: 20, paddingBottom: 40 },
  empty:   { color: COLORS.textMid, textAlign: 'center', marginTop: 80 },

  brandRow: { alignItems: 'center', marginTop: 4, marginBottom: 4 },
  brandLogo: { width: 168, height: 59 },

  greet:   { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy, marginTop: 18, textAlign: 'center' },
  tag:     { color: COLORS.textMid, marginTop: 4, textAlign: 'center' },

  offersSection: { marginTop: 22 },
  offerCard: { width: 240, backgroundColor: COLORS.white, borderRadius: RADIUS.card, overflow: 'hidden', ...SHADOW },
  offerImg:  { width: '100%', height: 120 },
  offerTextWrap: { padding: 12 },
  offerTitle:{ color: COLORS.deepNavy, fontWeight: '700', fontSize: 14 },
  offerSub:  { color: COLORS.textMid, fontSize: 12, marginTop: 4 },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, marginTop: 22, ...SHADOW },
  planName:{ color: COLORS.midBlue, fontWeight: '700' },
  cardNumber: { color: COLORS.deepNavy, fontSize: 22, fontWeight: '700', letterSpacing: 1.2, marginTop: 6 },
  divider: { height: 1, backgroundColor: COLORS.surfaceBlue, marginVertical: 12 },
  coupBar: { height: 8, backgroundColor: COLORS.surfaceBlue, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  coupFill:{ height: '100%', backgroundColor: COLORS.primaryCyan },
  coupText:{ color: COLORS.textMid, marginTop: 6, fontSize: 12 },

  couponsCta: { backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, ...SHADOW },
  couponsCtaText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  linksRow: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  linkChip: { backgroundColor: COLORS.white, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 16 },
  linkChipText: { color: COLORS.midBlue, fontWeight: '600', fontSize: 13 },

  help:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, marginTop: 24, ...SHADOW },
  helpTitle: { color: COLORS.deepNavy, fontWeight: '700', marginBottom: 4 },
  helpText:  { color: COLORS.textMid, fontSize: 13, lineHeight: 19 },

  toast: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: COLORS.deepNavy, padding: 14, borderRadius: 10 },
  toastText: { color: COLORS.white, fontWeight: '500' },
});
