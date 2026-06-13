import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../constants/colors';
import { api } from '../../services/api';

export default function Activate() {
  const [step, setStep] = useState(1);  // 1 phone → 2 tier → 3 code/amount → 4 success
  const [tiers, setTiers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [phone, setPhone]       = useState('');
  const [existing, setExisting] = useState(null);
  const [tier, setTier]         = useState(null);
  const [code, setCode]         = useState('');
  const [amount, setAmount]     = useState('');
  const [result, setResult]     = useState(null);

  useEffect(() => { loadTiers(); }, []);
  async function loadTiers() {
    try {
      // Reuse admin endpoint (admins gate it; here we read via a public-ish fetch).
      // The agent endpoint isn't strictly available, so we ask backend for active tiers.
      const { data } = await api.get('/admin/tiers').catch(() => ({ data: { tiers: [] } }));
      setTiers(data.tiers?.filter(t => t.is_active) || []);
    } catch (_e) { /* ignore */ }
  }

  async function checkPhone() {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/agent/verify-client/${encodeURIComponent('+91' + clean)}`);
      setExisting(data.exists ? data.user : null);
      setStep(2);
    } catch (e) { setError(e.response?.data?.error || 'Lookup failed'); }
    finally { setLoading(false); }
  }

  async function activate() {
    setError('');
    if (!tier || !code.trim() || !amount) {
      setError('Please complete all fields.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/agent/activate-booklet', {
        client_phone: '+91' + phone.replace(/\D/g, ''),
        tier_id: tier.id,
        activation_code: code.trim().toUpperCase(),
        amount_paid: Number(amount),
      });
      setResult(data);
      setStep(4);
    } catch (e) {
      const code = e.response?.data?.error;
      const msg = {
        activation_code_not_found:           'Activation code not found.',
        activation_code_already_used:        'This activation code is already used.',
        activation_code_tier_mismatch:       'This code is for a different tier.',
        activation_code_not_assigned_to_you: "This code isn't assigned to you. Ask your admin.",
      }[code] || (code || 'Activation failed.');
      setError(msg);
    } finally { setLoading(false); }
  }

  function reset() {
    setStep(1); setPhone(''); setExisting(null); setTier(null);
    setCode(''); setAmount(''); setResult(null); setError('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.stepper}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= i && { color: COLORS.white }]}>{i}</Text>
              </View>
            ))}
          </View>

          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 1 — Client mobile</Text>
              <Text style={styles.help}>Enter the client's 10-digit number.</Text>
              <TextInput
                testID="agent-client-phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="98765 43210"
                placeholderTextColor={COLORS.textMid}
                style={styles.input}
                autoFocus
              />
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <TouchableOpacity onPress={checkPhone} style={styles.btn} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 2 — Choose tier</Text>
              <Text style={styles.help}>
                {existing ? `Existing client: ${existing.full_name || existing.phone}` : 'New client — they will receive a welcome SMS.'}
              </Text>
              {tiers.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTier(t)}
                  style={[styles.tierCard, tier?.id === t.id && styles.tierCardActive]}
                  activeOpacity={0.85}
                  testID={`tier-${t.id}`}
                >
                  <View style={styles.tierTop}>
                    <Text style={styles.tierName}>{t.name}</Text>
                    <Text style={styles.tierPrice}>₹{Number(t.price).toFixed(0)}</Text>
                  </View>
                  <Text style={styles.tierDesc} numberOfLines={2}>{t.description}</Text>
                  <Text style={styles.tierCount}>{t.tests.length} tests · {t.validity_days} days validity</Text>
                </TouchableOpacity>
              ))}
              {tiers.length === 0 && <Text style={styles.help}>No active tiers configured.</Text>}
              <View style={styles.row2}>
                <TouchableOpacity onPress={() => setStep(1)} style={[styles.btn, styles.btnSecondary]}>
                  <Text style={[styles.btnText, { color: COLORS.midBlue }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => tier ? (setAmount(String(tier.price)), setStep(3)) : null}
                  style={[styles.btn, !tier && { opacity: 0.5 }]} disabled={!tier}>
                  <Text style={styles.btnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.h2}>Step 3 — Code & payment</Text>
              <Text style={styles.help}>Enter the activation code from your batch and confirm the amount collected.</Text>

              <Text style={styles.label}>Activation code</Text>
              <TextInput
                testID="agent-activation-code"
                value={code}
                onChangeText={v => setCode(v.toUpperCase())}
                placeholder="ACT-XXXXX"
                autoCapitalize="characters"
                style={styles.input}
              />
              <Text style={styles.label}>Amount collected (₹)</Text>
              <TextInput
                testID="agent-amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                style={styles.input}
              />

              {error ? <Text style={styles.err}>{error}</Text> : null}

              <View style={styles.row2}>
                <TouchableOpacity onPress={() => setStep(2)} style={[styles.btn, styles.btnSecondary]}>
                  <Text style={[styles.btnText, { color: COLORS.midBlue }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={activate} style={[styles.btn, loading && { opacity: 0.7 }]} disabled={loading} testID="agent-activate-btn">
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Activate</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && result && (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={42} color={COLORS.white} />
              </View>
              <Text style={[styles.h2, { textAlign: 'center', marginTop: 16 }]}>Booklet activated!</Text>
              <Text style={[styles.help, { textAlign: 'center' }]}>
                Client will receive a welcome SMS with {result.coupons?.length || 0} coupons.
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
                <Row label="Tier"          value={result.booklet.tier_name} />
                <Row label="Code"          value={result.booklet.activation_code_used} mono />
                <Row label="Amount"        value={`₹${Number(result.booklet.amount_paid).toFixed(0)}`} />
                <Row label="Total coupons" value={String(result.coupons?.length || 0)} />
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

function Row({ label, value, mono }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: COLORS.textMid }}>{label}</Text>
      <Text style={{ color: COLORS.textDark, fontWeight: '600', letterSpacing: mono ? 1 : 0 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll:  { padding: 20, paddingBottom: 60 },

  stepper: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.primaryCyan, borderColor: COLORS.primaryCyan },
  stepDotText:   { color: COLORS.textMid, fontWeight: '700' },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, ...SHADOW },
  h2:      { fontSize: 18, fontWeight: '700', color: COLORS.deepNavy },
  help:    { color: COLORS.textMid, marginTop: 6, fontSize: 13 },

  label:   { color: COLORS.textMid, marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: '500' },
  input:   { backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, height: 48, paddingHorizontal: 14, fontSize: 15, color: COLORS.textDark, marginTop: 12 },

  err:     { color: COLORS.dangerRed, marginTop: 12, fontSize: 13 },

  btn:     { backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 18, flex: 1 },
  btnSecondary: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  row2:    { flexDirection: 'row', gap: 10 },

  tierCard: { backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.card, padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: 'transparent' },
  tierCardActive: { borderColor: COLORS.primaryCyan, backgroundColor: COLORS.lightBlueBg },
  tierTop:  { flexDirection: 'row', justifyContent: 'space-between' },
  tierName: { color: COLORS.deepNavy, fontWeight: '700', fontSize: 16 },
  tierPrice:{ color: COLORS.primaryCyan, fontWeight: '700', fontSize: 16 },
  tierDesc: { color: COLORS.textMid, fontSize: 13, marginTop: 4 },
  tierCount:{ color: COLORS.midBlue, fontSize: 12, fontWeight: '600', marginTop: 6 },

  successCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.successGreen, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
});
