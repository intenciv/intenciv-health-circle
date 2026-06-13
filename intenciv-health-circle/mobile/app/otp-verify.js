import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, RADIUS } from '../constants/colors';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function OtpVerify() {
  const { phone } = useLocalSearchParams();
  const { setSession } = useAuth();
  const [otp, setOtp]         = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [count, setCount]     = useState(60);
  const refs = useRef([]);
  const shake = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  function shakeBoxes() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function setDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 3) refs.current[i + 1]?.focus();
    if (i === 3 && v) verify(next.join(''));
  }

  async function verify(code) {
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp: code });
      // Only clients and agents use the mobile app.
      if (!['client', 'sales_agent'].includes(data.user.role)) {
        setError('This portal is for clients and sales agents. Please use the web panel.');
        setOtp(['', '', '', '']); refs.current[0]?.focus(); shakeBoxes();
        return;
      }
      await setSession(data);
      if (data.is_new_user && data.user.role === 'client') {
        router.replace('/profile-setup');
      } else if (data.user.role === 'sales_agent') {
        router.replace('/(tabs)/agent-home');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      const code = e.response?.data?.error;
      const attemptsLeft = e.response?.data?.attempts_left;
      setError(
        code === 'otp_incorrect' && attemptsLeft != null
          ? `Wrong OTP. ${attemptsLeft} attempt(s) left.`
          : code === 'otp_attempts_exhausted' ? 'Too many wrong attempts. Resend OTP.'
          : code === 'otp_not_found_or_expired' ? 'OTP expired. Please resend.'
          : 'Verification failed. Please try again.'
      );
      setOtp(['', '', '', '']); refs.current[0]?.focus(); shakeBoxes();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (count > 0) return;
    setError(''); setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone });
      setCount(60);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to resend OTP.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.body}>
          <Text style={styles.h1}>Verify your number</Text>
          <Text style={styles.sub}>We've sent a 4-digit OTP to {phone}</Text>

          <Animated.View style={[styles.boxes, { transform: [{ translateX: shake }] }]}>
            {otp.map((d, i) => (
              <TextInput
                key={i}
                testID={`otp-box-${i}`}
                ref={el => (refs.current[i] = el)}
                value={d}
                onChangeText={v => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                }}
                keyboardType="number-pad"
                maxLength={1}
                style={[styles.box, error ? styles.boxError : null]}
              />
            ))}
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="resend-otp-btn"
            onPress={resend}
            disabled={count > 0 || loading}
            style={{ marginTop: 24, alignSelf: 'center' }}
          >
            <Text style={[styles.resend, count > 0 && { color: COLORS.textMid }]}>
              {count > 0
                ? `Resend OTP in 0:${String(count).padStart(2, '0')}`
                : loading ? 'Resending…' : 'Resend OTP'}
            </Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator color={COLORS.primaryCyan} style={{ marginTop: 16 }} />}

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 32, alignSelf: 'center' }}>
            <Text style={{ color: COLORS.textMid, fontSize: 13 }}>← Change number</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.lightBlueBg },
  body:  { flex: 1, padding: 24, justifyContent: 'flex-start', paddingTop: 48 },
  h1:    { fontSize: 26, fontWeight: '700', color: COLORS.deepNavy },
  sub:   { fontSize: 14, color: COLORS.textMid, marginTop: 8 },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 36 },
  box: {
    width: 56, height: 56, borderRadius: RADIUS.button,
    backgroundColor: COLORS.surfaceBlue, borderWidth: 1.5, borderColor: COLORS.border,
    fontSize: 24, fontWeight: '700', textAlign: 'center', color: COLORS.deepNavy,
  },
  boxError: { borderColor: COLORS.dangerRed },
  error:    { color: COLORS.dangerRed, textAlign: 'center', marginTop: 12, fontSize: 13 },
  resend:   { color: COLORS.primaryCyan, fontWeight: '600', fontSize: 14 },
});
