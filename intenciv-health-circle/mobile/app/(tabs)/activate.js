import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

export default function Activate() {
  const [step, setStep] = useState(1);   // 1 pick card, 2 customer details, 3 OTP, 4 PIN, 5 success
  const [cards, setCards] = useState([]);
  const [pickedCard, setPickedCard] = useState(null);
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState(['','','','','','']);
  const [pin, setPin]     = useState(['','','','']);
  const [activationToken, setActivationToken] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);
  const pinRefs = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/salesperson/my-cards');
        setCards(data.cards.filter(c => ['unused','assigned'].includes(c.status)));
      } catch (_e) {}
    })();
  }, []);

  function reset() {
    setStep(1); setPickedCard(null); setName(''); setPhone('');
    setOtp(['','','','','','']); setPin(['','','','']);
    setActivationToken(null); setResult(null); setError('');
  }

  function setOtpDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const n = [...otp]; n[i] = v; setOtp(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function setPinDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const n = [...pin]; n[i] = v; setPin(n);
    if (v && i < 3) pinRefs.current[i + 1]?.focus();
  }

  async function sendOtp() {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (!name.trim() || clean.length !== 10) { setError('Enter customer name and 10-digit mobile.'); return; }
    setLoading(true);
    try {
      await api.post('/salesperson/activation/send-otp', {
        card_id: pickedCard.id,
        customer_phone: `+91${clean}`,
      });
      setStep(3);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send OTP.');
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    setError('');
    const code = otp.join('');
    if (code.length !== 6) { setError('Enter the 6-digit OTP from the customer.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/salesperson/activation/verify-otp', {
        card_id: pickedCard.id,
        customer_phone: `+91${phone.replace(/\D/g, '')}`,
        otp: code,
      });
      setActivationToken(data.activation_token);
      setStep(4);
      setTimeout(() => pinRefs.current[0]?.focus(), 50);
    } catch (e) {
      const code = e.response?.data?.error;
      setError(code === 'otp_incorrect' ? `Wrong OTP. ${e.response.data.attempts_left} attempt(s) left.`
            : code === 'otp_attempts_exhausted' ? 'Too many wrong attempts. Resend OTP.'
            : 'OTP verification failed.');
      setOtp(['','','','']); otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  async function finalize() {
    setError('');
    const pinVal = pin.join('');
    if (pinVal.length !== 4) { setError('Enter your 4-digit PIN to authorize.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/salesperson/activation/finalize', {
        activation_token: activationToken,
        pin: pinVal,
        customer_name: name,
        customer_phone: `+91${phone.replace(/\D/g, '')}`,
        card_id: pickedCard.id,
      });
      setResult(data);
      setStep(5);
    } catch (e) {
      const code = e.response?.data?.error;
      setError(
        code === 'pin_incorrect' ? 'Incorrect PIN. Activation denied.'
      : code === 'card_already_activated' ? 'This card has already been activated.'
      : code === 'activation_token_invalid' ? 'OTP session expired — please redo the wizard.'
      : 'Activation failed.'
      );
      setPin(['','','','']); pinRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.steps}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.dot, step >= i && styles.dotOn]}>
                <Text style={[styles.dotN, step >= i && { color: COLORS.white }]}>{i}</Text>
              </View>
            ))}
          </View>

          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 1 — Pick a card</Text>
              <Text style={styles.help}>Choose an unused / assigned card to activate.</Text>
              {cards.length === 0 && <Text style={styles.empty}>No cards available. Ask the admin to assign cards to you.</Text>}
              {cards.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setPickedCard(c); setStep(2); }}
                  style={styles.cardRow}
                  activeOpacity={0.85}
                  testID={`pick-card-${c.card_number}`}
                >
                  <View>
                    <Text style={styles.cardNum}>{c.card_number}</Text>
                    <Text style={styles.cardMeta}>{c.plan_name} · ₹{Number(c.plan_price).toFixed(0)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMid} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 2 && pickedCard && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 2 — Customer details</Text>
              <Text style={styles.help}>Card {pickedCard.card_number} — {pickedCard.plan_name}</Text>
              <Text style={styles.label}>Customer full name</Text>
              <TextInput testID="cust-name" value={name} onChangeText={setName} style={styles.input} placeholder="Ravi Kumar" />
              <Text style={styles.label}>Customer mobile</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={styles.flagBox}><Text style={styles.flag}>🇮🇳</Text><Text style={styles.cc}>+91</Text></View>
                <TextInput testID="cust-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} style={[styles.input, { flex: 1, marginTop: 0 }]} placeholder="98765 43210" />
              </View>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <View style={styles.row2}>
                <TouchableOpacity onPress={() => setStep(1)} style={[styles.btn, styles.btnSec]}><Text style={[styles.btnText,{ color: COLORS.midBlue }]}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={sendOtp} style={[styles.btn, loading && { opacity: 0.7 }]} disabled={loading} testID="send-otp-btn">
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Send OTP</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 3 — Verify customer's mobile</Text>
              <Text style={styles.help}>Customer received a 6-digit OTP on +91 {phone}. Ask them to read it out (this OTP only verifies the number — it does NOT activate the card).</Text>
              <View style={styles.otpBoxes}>
                {otp.map((d, i) => (
                  <TextInput key={i} testID={`otp-box-${i}`} ref={el => (otpRefs.current[i] = el)} value={d}
                    onChangeText={v => setOtpDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                    keyboardType="number-pad" maxLength={1} style={styles.otpBox} />
                ))}
              </View>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <View style={styles.row2}>
                <TouchableOpacity onPress={() => setStep(2)} style={[styles.btn, styles.btnSec]}><Text style={[styles.btnText,{ color: COLORS.midBlue }]}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={verifyOtp} style={[styles.btn, loading && { opacity: 0.7 }]} disabled={loading} testID="verify-otp-btn">
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Verify OTP</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 4 — Enter your PIN to activate</Text>
              <Text style={styles.help}>This is the actual security gate — without your PIN, the card cannot be activated.</Text>
              <View style={styles.fourBoxes}>
                {pin.map((d, i) => (
                  <TextInput key={i} testID={`pin-box-${i}`} ref={el => (pinRefs.current[i] = el)} value={d}
                    onChangeText={v => setPinDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !pin[i] && i > 0) pinRefs.current[i - 1]?.focus(); }}
                    keyboardType="number-pad" maxLength={1} secureTextEntry style={styles.boxInput} />
                ))}
              </View>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <View style={styles.row2}>
                <TouchableOpacity onPress={() => setStep(3)} style={[styles.btn, styles.btnSec]}><Text style={[styles.btnText,{ color: COLORS.midBlue }]}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={finalize} style={[styles.btn, loading && { opacity: 0.7 }]} disabled={loading} testID="activate-btn">
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Activate card</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 5 && result?.card && (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <View style={styles.ok}><Ionicons name="checkmark" size={42} color={COLORS.white} /></View>
              <Text style={[styles.h2, { marginTop: 16, textAlign: 'center' }]}>Card activated!</Text>
              <Text style={[styles.help, { textAlign: 'center' }]}>Customer will receive a welcome SMS.</Text>
              <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
                <Row label="Customer"      value={result.card.customer_name} />
                <Row label="Mobile"        value={result.card.customer_phone} />
                <Row label="Card number"   value={result.card.card_number} />
                <Row label="Plan"          value={result.card.plan_name} />
                <Row label="Expires"       value={new Date(result.card.expires_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} />
                <Row label="Total coupons" value={String(result.card.total_coupons)} />
              </View>
              <TouchableOpacity onPress={reset} style={[styles.btn, { alignSelf: 'stretch', marginTop: 20 }]}>
                <Text style={styles.btnText}>Activate another</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Row({ label, value }) { return (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
    <Text style={{ color: COLORS.textMid }}>{label}</Text>
    <Text style={{ color: COLORS.textDark, fontWeight: '600' }}>{value}</Text>
  </View>
);}
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 20, paddingBottom: 60 },
  steps:  { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  dot:    { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  dotOn:  { backgroundColor: COLORS.primaryCyan, borderColor: COLORS.primaryCyan },
  dotN:   { color: COLORS.textMid, fontWeight: '700' },
  card:   { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, ...SHADOW },
  h2:     { fontSize: 18, fontWeight: '700', color: COLORS.deepNavy },
  help:   { color: COLORS.textMid, marginTop: 6, fontSize: 13, lineHeight: 18 },
  empty:  { color: COLORS.textMid, textAlign: 'center', marginTop: 18, fontSize: 13 },
  label:  { color: COLORS.textMid, fontSize: 13, fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input:  { backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, height: 48, paddingHorizontal: 14, fontSize: 15, color: COLORS.textDark, marginTop: 12 },
  flagBox:{ backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12, height: 48, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  flag:   { fontSize: 20 }, cc: { fontWeight: '600', color: COLORS.textDark },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBlue },
  cardNum: { color: COLORS.deepNavy, fontWeight: '700', letterSpacing: 1 },
  cardMeta:{ color: COLORS.textMid, fontSize: 12, marginTop: 2 },

  fourBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 16 },
  boxInput:{ width: 56, height: 56, borderRadius: RADIUS.button, backgroundColor: COLORS.surfaceBlue, borderWidth: 1.5, borderColor: COLORS.border, fontSize: 22, fontWeight: '700', textAlign: 'center', color: COLORS.deepNavy },
  otpBoxes:{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  otpBox:  { width: 44, height: 52, borderRadius: RADIUS.button, backgroundColor: COLORS.surfaceBlue, borderWidth: 1.5, borderColor: COLORS.border, fontSize: 20, fontWeight: '700', textAlign: 'center', color: COLORS.deepNavy },

  err:    { color: COLORS.dangerRed, marginTop: 12, fontSize: 13 },
  row2:   { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn:    { backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, height: 48, justifyContent: 'center', alignItems: 'center', flex: 1 },
  btnSec: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  btnText:{ color: COLORS.white, fontWeight: '700', fontSize: 15 },
  ok:     { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.successGreen, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
});
