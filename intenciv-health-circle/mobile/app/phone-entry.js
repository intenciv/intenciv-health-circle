import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/colors';
import { api } from '../services/api';

export default function PhoneEntry() {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const router = useRouter();

  async function sendOtp() {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      const fullPhone = `+91${clean}`;
      await api.post('/auth/send-otp', { phone: fullPhone });
      router.push({ pathname: '/otp-verify', params: { phone: fullPhone } });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoCircle}>
            <Ionicons name="medkit" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.brand}>IntenCiv Health Circle</Text>
          <Text style={styles.tag}>Diagnostic discounts. Real value. Trusted care.</Text>

          <View style={{ height: 40 }} />
          <Text style={styles.h1}>Welcome to IntenCiv Health Circle</Text>
          <Text style={styles.sub}>Enter your mobile number to continue</Text>

          <View style={styles.inputRow}>
            <View style={styles.flagBox}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.cc}>+91</Text>
            </View>
            <TextInput
              testID="phone-input"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              placeholderTextColor={COLORS.textMid}
              maxLength={11}
              style={styles.input}
              autoFocus
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="send-otp-btn"
            onPress={sendOtp}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.7 }]}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.btnText}>Send OTP</Text>}
          </TouchableOpacity>

          <Text style={styles.footer}>
            By continuing, you agree to receive an SMS OTP from IntenCiv Diagnostics.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { flexGrow: 1, padding: 24, alignItems: 'stretch' },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryCyan,
    alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginTop: 32,
  },
  brand: { fontSize: 22, fontWeight: '700', color: COLORS.deepNavy, textAlign: 'center', marginTop: 14 },
  tag:   { fontSize: 13, color: COLORS.textMid, textAlign: 'center', marginTop: 4 },
  h1:    { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy },
  sub:   { fontSize: 15, color: COLORS.textMid, marginTop: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24,
  },
  flagBox: {
    backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button,
    borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12,
    height: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  flag: { fontSize: 22 },
  cc:   { fontWeight: '600', color: COLORS.textDark },
  input: {
    flex: 1, backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button,
    borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52,
    fontSize: 16, color: COLORS.textDark,
  },
  error: { color: COLORS.dangerRed, marginTop: 10, fontSize: 13 },
  btn:   {
    marginTop: 28, height: 48, backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  footer:  { color: COLORS.textMid, fontSize: 12, textAlign: 'center', marginTop: 18 },
});
