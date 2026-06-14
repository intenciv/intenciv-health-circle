import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/colors';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function SalespersonLogin() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const pinRefs = useRef([]);

  function setDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const n = [...pin]; n[i] = v; setPin(n);
    if (v && i < 3) pinRefs.current[i + 1]?.focus();
    if (i === 3 && v) submit(phone, n.join(''));
  }

  async function submit(phoneVal = phone, pinVal = pin.join('')) {
    setError('');
    const clean = String(phoneVal).replace(/\D/g, '');
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile.'); return; }
    if (pinVal.length !== 4)  { setError('Enter your 4-digit PIN.');     return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/salesperson/login', { phone: `+91${clean}`, pin: pinVal });
      await setSession(data);
      router.replace('/(tabs)/sp-home');
    } catch (_e) {
      setError('Invalid mobile or PIN. Ask your admin to reset your PIN if needed.');
      setPin(['', '', '', '']); pinRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={COLORS.midBlue} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.h1}>Sales rep sign-in</Text>
          <Text style={styles.sub}>Mobile + admin-assigned 4-digit PIN.</Text>

          <Text style={styles.label}>Registered mobile number</Text>
          <View style={styles.inputRow}>
            <View style={styles.flagBox}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.cc}>+91</Text>
            </View>
            <TextInput
              testID="sp-phone-input"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              placeholderTextColor={COLORS.textMid}
              maxLength={11}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>4-digit PIN</Text>
          <View style={styles.pinRow}>
            {pin.map((d, i) => (
              <TextInput
                key={i}
                testID={`pin-box-${i}`}
                ref={el => (pinRefs.current[i] = el)}
                value={d}
                onChangeText={v => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !pin[i] && i > 0) pinRefs.current[i - 1]?.focus();
                }}
                keyboardType="number-pad"
                maxLength={1}
                secureTextEntry
                style={styles.pinBox}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="sp-login-btn"
            onPress={() => submit()}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Sign in</Text>}
          </TouchableOpacity>

          <Text style={styles.footer}>
            Forgot your PIN? Contact the admin to issue a new one — sales reps can't change their own PIN.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll:  { padding: 24, paddingTop: 12 },
  back:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8 },
  backText:{ color: COLORS.midBlue, marginLeft: 2, fontWeight: '600' },
  h1:      { fontSize: 26, fontWeight: '700', color: COLORS.deepNavy, marginTop: 24 },
  sub:     { color: COLORS.textMid, marginTop: 6, fontSize: 14 },

  label:   { color: COLORS.textMid, fontSize: 13, fontWeight: '500', marginTop: 24, marginBottom: 8 },
  inputRow:{ flexDirection: 'row', gap: 10 },
  flagBox: { backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12, height: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 },
  flag:    { fontSize: 22 },
  cc:      { fontWeight: '600', color: COLORS.textDark },
  input:   { flex: 1, backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, fontSize: 16, color: COLORS.textDark },

  pinRow:  { flexDirection: 'row', gap: 14 },
  pinBox:  { width: 56, height: 56, borderRadius: RADIUS.button, backgroundColor: COLORS.surfaceBlue, borderWidth: 1.5, borderColor: COLORS.border, fontSize: 22, fontWeight: '700', textAlign: 'center', color: COLORS.deepNavy },

  error:   { color: COLORS.dangerRed, marginTop: 14, fontSize: 13 },
  btn:     { height: 48, backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  footer:  { color: COLORS.textMid, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
