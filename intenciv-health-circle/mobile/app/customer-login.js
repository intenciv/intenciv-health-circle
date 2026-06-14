import { useState } from 'react';
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

export default function CustomerLogin() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function login() {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/customer/login', { phone: `+91${clean}` });
      await setSession(data);
      router.replace('/(tabs)/home');
    } catch (e) {
      const code = e.response?.data?.error;
      setError(
        code === 'mobile_not_registered'
          ? 'This number is not linked to any membership. Please contact your sales representative.'
        : code === 'no_active_membership'
          ? 'No active membership found for this number.'
          : 'Login failed. Please try again.'
      );
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

          <Text style={styles.h1}>Member sign-in</Text>
          <Text style={styles.sub}>Enter the mobile number registered on your IntenCiv Health Privilege Card.</Text>

          <View style={styles.inputRow}>
            <View style={styles.flagBox}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.cc}>+91</Text>
            </View>
            <TextInput
              testID="customer-phone-input"
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
            testID="customer-login-btn"
            onPress={login}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Continue</Text>}
          </TouchableOpacity>

          <View style={styles.help}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.midBlue} />
            <Text style={styles.helpText}>
              Don't have a card yet? Contact your IntenCiv sales representative or visit www.intenciv.in.
            </Text>
          </View>
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
  sub:     { color: COLORS.textMid, marginTop: 8, fontSize: 14, lineHeight: 20 },

  inputRow:{ flexDirection: 'row', gap: 10, marginTop: 32 },
  flagBox: { backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 12, height: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 },
  flag:    { fontSize: 22 },
  cc:      { fontWeight: '600', color: COLORS.textDark },
  input:   { flex: 1, backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, fontSize: 16, color: COLORS.textDark },

  error:   { color: COLORS.dangerRed, marginTop: 14, fontSize: 13, lineHeight: 18 },
  btn:     { height: 48, backgroundColor: COLORS.primaryCyan, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  help:    { flexDirection: 'row', gap: 8, marginTop: 28, padding: 14, backgroundColor: COLORS.white, borderRadius: RADIUS.button, alignItems: 'flex-start' },
  helpText:{ flex: 1, color: COLORS.textMid, fontSize: 13, lineHeight: 18 },
});
