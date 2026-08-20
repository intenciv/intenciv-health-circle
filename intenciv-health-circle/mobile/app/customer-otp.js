import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/colors';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function CustomerOtp() {
  const { setSession } = useAuth();
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]     = useState('');
  const [resent, setResent]   = useState(false);
  const inputRef = useRef(null);

  async function verify() {
    setError('');
    setResent(false);
    if (otp.length < 4) { setError('Enter the OTP sent to your phone.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/customer/verify-otp', { phone: `+91${phone}`, otp });
      await setSession(data);
      router.replace('/(tabs)/home');
    } catch (e) {
      const code = e.response?.data?.error;
      const attemptsLeft = e.response?.data?.attempts_left;
      setError(
        code === 'otp_attempts_exhausted'
          ? 'Too many incorrect attempts. Please request a new OTP.'
        : code === 'invalid_otp'
          ? `Incorrect OTP.${typeof attemptsLeft === 'number' ? ` ${attemptsLeft} attempt(s) left.` : ''}`
          : 'Could not verify OTP. Please try again.'
      );
      setOtp('');
    } finally { setLoading(false); }
  }

  async function resendOtp() {
    setError('');
    setResent(false);
    setResending(true);
    try {
      await api.post('/auth/customer/send-otp', { phone: `+91${phone}` });
      setResent(true);
      setOtp('');
      inputRef.current?.focus();
    } catch (_e) {
      setError('Could not resend OTP. Please try again in a moment.');
    } finally { setResending(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={COLORS.midBlue} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <Image source={require('../assets/brand-logo.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <Text style={styles.h1}>Enter OTP</Text>
          <Text style={styles.sub}>We've sent a verification code to +91 {phone}.</Text>

          <TextInput
            testID="customer-otp-input"
            ref={inputRef}
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="Enter OTP"
            placeholderTextColor={COLORS.textMid}
            maxLength={8}
            style={styles.input}
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {resent ? <Text style={styles.resentText}>OTP resent successfully.</Text> : null}

          <TouchableOpacity
            testID="customer-verify-otp-btn"
            onPress={verify}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Verify & Continue</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={resendOtp} disabled={resending} style={styles.resendBtn}>
            <Text style={styles.resendText}>{resending ? 'Resending…' : "Didn't get the code? Resend OTP"}</Text>
          </TouchableOpacity>
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
  brandRow:{ alignItems: 'center', marginTop: 12, marginBottom: 4 },
  brandLogo:{ width: 140, height: 49 },

  h1:      { fontSize: 26, fontWeight: '700', color: COLORS.deepNavy, marginTop: 20 },
  sub:     { color: COLORS.textMid, marginTop: 8, fontSize: 14, lineHeight: 20 },

  input:   { marginTop: 32, backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, fontSize: 20, letterSpacing: 4, color: COLORS.textDark, textAlign: 'center' },

  error:   { color: COLORS.dangerRed, marginTop: 14, fontSize: 13, lineHeight: 18 },
  resentText: { color: COLORS.successGreen, marginTop: 14, fontSize: 13, lineHeight: 18 },
  btn:     { height: 48, backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  resendBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  resendText: { color: COLORS.midBlue, fontWeight: '600', fontSize: 14 },
});
